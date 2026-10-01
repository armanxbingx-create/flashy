/**
 * piperWorker — dedicated Worker for Piper + ONNX Runtime Web inference.
 *
 * Runs OFF the React main thread so card swipes/animations never block.
 * The main thread must never create the ONNX InferenceSession.
 *
 * iOS constraints honored:
 * - `ort.env.wasm.numThreads = 1` (no SharedArrayBuffer / COOP / COEP).
 * - WASM CPU only, no WebGPU dependency.
 * - Model bytes live in OPFS; only static file downloads use network.
 *
 * Protocol (main <-> worker):
 * - main: { type: 'init' } -> worker warms runtime + model, posts 'ready'
 * - main: { type: 'synthesize', id, text } -> worker posts 'result' with
 *   transferable WAV ArrayBuffer, or 'error'. Progress posts 'progress'.
 * - main: { type: 'cancel', id } -> worker drops that job (best-effort;
 *   the underlying library has no mid-inference abort, so stale results
 *   are ignored by id on both sides).
 */

import {
  PIPER_CONFIG_FILE,
  PIPER_CONFIG_URL,
  PIPER_EXPECTED_MODEL_BYTES,
  PIPER_MODEL_FILE,
  PIPER_MODEL_URL,
  PIPER_VOICE_ID,
} from './piperManifest'

type IncomingMessage =
  | { type: 'init' }
  | { type: 'synthesize'; id: number; text: string }
  | { type: 'cancel'; id: number }

type OutgoingMessage =
  | { type: 'ready' }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; id: number; wav: ArrayBuffer }
  | { type: 'error'; id: number | null; message: string }
  // TEMPORARY diagnostic event (remove with piperDiagnostics.ts).
  | { type: 'diag'; event: string; detail?: string; at: number }

const ctx = self as unknown as {
  postMessage(message: OutgoingMessage, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TtsSessionClass: any = null
let sessionReady = false
let sessionFailed: string | null = null
let activeJobId: number | null = null
let sessionPromise: Promise<void> | null = null

function post(message: OutgoingMessage, transfer?: Transferable[]): void {
  ctx.postMessage(message, transfer)
}

// TEMPORARY diagnostic emitter (remove with piperDiagnostics.ts).
function diag(event: string, detail?: string): void {
  post({ type: 'diag', event, detail, at: Date.now() })
}

function describeWorkerError(error: unknown): string {
  if (error instanceof Error) {
    const stackFirst = error.stack?.split('\n').slice(0, 3).join(' | ')
    const message = stackFirst && stackFirst.length < 500 ? stackFirst : error.message
    return `${error.name || 'Error'}: ${message || String(error)}`
  }
  return `Unknown: ${String(error)}`
}

function opfsSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    )
  } catch {
    return false
  }
}

async function readCachedFile(name: string): Promise<File | undefined> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('piper', { create: true })
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch {
    return undefined
  }
}

/** Pre-seed OPFS from the configurable manifest URL (R2 later, HF for now). */
async function seedFileFromManifest(
  name: string,
  url: string,
  expectedBytes: number | undefined,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  const cached = await readCachedFile(name)
  if (cached && cached.size > 0) {
    if (expectedBytes === undefined || cached.size === expectedBytes) return
    // Size mismatch (e.g. partial download) — re-download below.
  }
  // Retry transient network failures: iOS Safari workers often throw a bare
  // `TypeError: Load failed` on the first fetch attempt (DNS/QUIC race in a
  // freshly spawned worker, radio handoff, …). Only fully-assembled blobs
  // are written to OPFS, so a failed attempt never leaves partial files.
  const kind = name.endsWith('.onnx') ? 'model' : 'config'
  const maxAttempts = 4
  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok || !response.body) {
        // Retry rate-limiting and server errors; other 4xx are permanent.
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Model download failed: HTTP ${response.status} (retryable)`)
        }
        throw new Error(`Model download failed: HTTP ${response.status}`)
      }
      const total = Number(response.headers.get('Content-Length') ?? 0) || expectedBytes || 0
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.length
      onProgress(loaded, total)
    }
  }
      const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' })
      if (expectedBytes !== undefined && blob.size !== expectedBytes) {
        throw new Error(`Model size mismatch: got ${blob.size}, expected ${expectedBytes}`)
      }
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle('piper', { create: true })
      const handle = await dir.getFileHandle(name, { create: true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const permanentHttp =
        message.startsWith('Model download failed: HTTP') && !message.includes('(retryable)')
      if (permanentHttp || attempt === maxAttempts) {
        throw error
      }
      diag(`worker:${kind}-fetch-retry`, `attempt ${attempt}/${maxAttempts} failed: ${message}`)
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function ensureSession(): Promise<void> {
  if (sessionReady) return
  if (sessionFailed) throw new Error(sessionFailed)
  if (sessionPromise) return sessionPromise
  sessionPromise = (async () => {
    if (!opfsSupported()) {
      diag('worker:opfs-check', 'FAIL: navigator.storage.getDirectory missing')
      throw new Error('OPFS_UNSUPPORTED')
    }
    diag('worker:opfs-check', 'ok')
    // Single-thread WASM: no SharedArrayBuffer, no COOP/COEP. On a
    // non-crossOriginIsolated page ORT forces this anyway; set it
    // explicitly so desktop dev matches iPhone behavior.
    diag('worker:ort-import-start')
    let ortEnv: { wasm?: { numThreads?: number } } | undefined
    try {
      const ort = await import('onnxruntime-web')
      ortEnv = (ort.default ?? ort).env
      if (ortEnv?.wasm) {
        ortEnv.wasm.numThreads = 1
      }
      diag('worker:ort-import-complete')
    } catch (error) {
      diag('worker:ort-import-failed', describeWorkerError(error))
      throw error
    }
    diag('worker:lib-import-start')
    try {
      const lib = await import('@realtimex/piper-tts-web')
      TtsSessionClass = lib.TtsSession
      diag('worker:lib-import-complete')
    } catch (error) {
      diag('worker:lib-import-failed', describeWorkerError(error))
      throw error
    }

    // Seed model + config from manifest URLs. The library caches OPFS
    // entries keyed by filename, so these seeds satisfy its own lookup
    // and it will not re-download from its built-in mirror.
    diag('worker:config-fetch-start', PIPER_CONFIG_URL)
    try {
      await seedFileFromManifest(
        PIPER_CONFIG_FILE,
        PIPER_CONFIG_URL,
        undefined,
        () => {},
      )
      const cachedConfig = await readCachedFile(PIPER_CONFIG_FILE)
      diag('worker:config-fetch-complete', `${cachedConfig?.size ?? -1} bytes`)
    } catch (error) {
      diag('worker:config-fetch-failed', describeWorkerError(error))
      throw error
    }
    diag('worker:model-fetch-start', PIPER_MODEL_URL)
    try {
      await seedFileFromManifest(
        PIPER_MODEL_FILE,
        PIPER_MODEL_URL,
        PIPER_EXPECTED_MODEL_BYTES,
        (loaded, total) => post({ type: 'progress', loaded, total }),
      )
      const cachedModel = await readCachedFile(PIPER_MODEL_FILE)
      diag(
        'worker:model-fetch-complete',
        `${cachedModel?.size ?? -1} bytes (expected ${PIPER_EXPECTED_MODEL_BYTES})`,
      )
    } catch (error) {
      diag('worker:model-fetch-failed', describeWorkerError(error))
      throw error
    }

    diag('worker:tts-session-construct-start', PIPER_VOICE_ID)
    const ttsSession = new TtsSessionClass({
      voiceId: PIPER_VOICE_ID,
      progress: (progress: { loaded: number; total: number }) => {
        post({ type: 'progress', loaded: progress.loaded, total: progress.total })
      },
    })
    diag('worker:waitready-start')
    await ttsSession.waitReady
    diag('worker:waitready-complete')
    // TtsSession.init resets numThreads to hardwareConcurrency; force
    // single-thread back (ORT also self-forces 1 when the page is not
    // crossOriginIsolated, which a PWA never is — this keeps dev matching).
    if (ortEnv?.wasm) {
      ortEnv.wasm.numThreads = 1
    }
    // Keep a process-wide reference: the library singletons the session,
    // so subsequent predicts reuse the loaded model without re-download.
    ;(ctx as unknown as Record<string, unknown>)['__flashyTtsSession'] = ttsSession
    sessionReady = true
  })()
  try {
    await sessionPromise
  } catch (error) {
    const message = describeWorkerError(error)
    diag('worker:ensure-session-failed', message)
    sessionFailed = error instanceof Error ? error.message : String(error)
    sessionPromise = null
    throw error
  }
}

function currentSession(): {
  predict(text: string): Promise<Blob>
} {
  const stored = (ctx as unknown as Record<string, unknown>)['__flashyTtsSession'] as {
    predict(text: string): Promise<Blob>
  }
  if (!stored) throw new Error('Piper session not initialized')
  return stored
}

ctx.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    diag('worker:init-received')
    void ensureSession().then(
      () => {
        diag('worker:ready-posted')
        post({ type: 'ready' })
      },
      (error: unknown) =>
        post({
          type: 'error',
          id: null,
          message: error instanceof Error ? error.message : String(error),
        }),
    )
    return
  }
  if (message.type === 'cancel') {
    if (activeJobId === message.id) activeJobId = null
    return
  }
  if (message.type === 'synthesize') {
    const { id, text } = message
    activeJobId = id
    void (async () => {
      try {
        await ensureSession()
        if (activeJobId !== id) return // superseded while loading
        const blob = await currentSession().predict(text)
        if (activeJobId !== id) return // superseded during inference
        activeJobId = null
        const buffer = await blob.arrayBuffer()
        post({ type: 'result', id, wav: buffer }, [buffer])
      } catch (error) {
        if (activeJobId === id) activeJobId = null
        post({
          type: 'error',
          id,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }
}
