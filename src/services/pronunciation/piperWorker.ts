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
  // TEMPORARY diagnostic probe (remove with piperDiagnostics.ts).
  | { type: 'fetch-test' }
  // TEMPORARY GitHub fetch probe (remove with piperDiagnostics.ts).
  | { type: 'fetch-test-github' }

type OutgoingMessage =
  | { type: 'ready' }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; id: number; wav: ArrayBuffer }
  | { type: 'error'; id: number | null; message: string }
  // TEMPORARY diagnostic event (remove with piperDiagnostics.ts).
  | { type: 'diag'; event: string; detail?: string; at: number }
  // TEMPORARY fetch-test completion marker (remove with piperDiagnostics.ts).
  | { type: 'fetch-test-done' }
  // TEMPORARY GitHub fetch-test completion marker (remove with piperDiagnostics.ts).
  | { type: 'github-fetch-test-done'; ok: boolean }

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

/**
 * Verify the main-thread-downloaded assets are present in OPFS.
 * The worker NEVER fetches model/config itself (iOS Safari workers reject
 * cross-origin fetch with `TypeError: Load failed` on the target device).
 * The main thread downloads (see piperAssetStore.ts); the worker only reads.
 * The Piper library then finds the same filenames via its own OPFS lookup
 * and performs zero network fetches for model/config.
 */
async function verifyCachedAssets(): Promise<void> {
  const config = await readCachedFile(PIPER_CONFIG_FILE)
  if (!config || config.size <= 0) {
    diag('worker:asset-check', `MISS config ${PIPER_CONFIG_FILE} — main thread must download first`)
    throw new Error('ASSETS_MISSING: config not in OPFS')
  }
  diag('worker:asset-check', `HIT config ${PIPER_CONFIG_FILE} (${config.size} bytes)`)
  const model = await readCachedFile(PIPER_MODEL_FILE)
  if (!model || model.size !== PIPER_EXPECTED_MODEL_BYTES) {
    diag(
      'worker:asset-check',
      `MISS model ${PIPER_MODEL_FILE} (got ${model?.size ?? -1}, expected ${PIPER_EXPECTED_MODEL_BYTES})`,
    )
    throw new Error('ASSETS_MISSING: model not in OPFS')
  }
  diag('worker:asset-check', `HIT model ${PIPER_MODEL_FILE} (${model.size} bytes)`)
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
    // TEMPORARY: show the final resolved asset URLs (R2 base or HF fallback).
    // No user text or secrets — these are public static model URLs.
    diag('worker:asset-urls', `config=${PIPER_CONFIG_URL} model=${PIPER_MODEL_URL}`)
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

    // The library reads the same filenames from OPFS (see piperAssetStore.ts),
    // so with main-thread-seeded files it performs no network fetches itself.
    try {
      await verifyCachedAssets()
    } catch (error) {
      diag('worker:asset-verify-failed', describeWorkerError(error))
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

function describeResponse(response: Response): string {
  return (
    `resolved-url=${response.url} status=${response.status} ok=${response.ok} ` +
    `content-type=${response.headers.get('Content-Type') ?? '—'} ` +
    `content-length=${response.headers.get('Content-Length') ?? '—'}`
  )
}

/**
 * TEMPORARY diagnostic probe (remove with piperDiagnostics.ts).
 * Fetches the exact manifest config URL with GET and HEAD to isolate
 * whether the iOS worker failure happens in fetch() itself or while
 * reading the body. Reads only — never touches OPFS, never persists.
 */
async function runFetchTest(): Promise<void> {
  try {
    diag('worker:fetchtest-start', PIPER_CONFIG_URL)
    // --- GET: fetch() and body read are isolated in separate try blocks.
    diag('worker:fetchtest-get-fetch-start')
    let getResponse: Response | null = null
    try {
      getResponse = await fetch(PIPER_CONFIG_URL, { method: 'GET' })
      diag('worker:fetchtest-get-fetch-ok', describeResponse(getResponse))
    } catch (error) {
      diag('worker:fetchtest-get-fetch-failed', describeWorkerError(error))
    }
    if (getResponse) {
      diag('worker:fetchtest-get-read-start')
      try {
        const buffer = await getResponse.arrayBuffer()
        diag('worker:fetchtest-get-read-ok', `${buffer.byteLength} bytes read`)
      } catch (error) {
        diag('worker:fetchtest-get-read-failed', describeWorkerError(error))
      }
    } else {
      diag('worker:fetchtest-get-read-skipped', 'no response (fetch failed)')
    }
    // --- HEAD: isolates header/redirect behavior without a body.
    diag('worker:fetchtest-head-start')
    try {
      const headResponse = await fetch(PIPER_CONFIG_URL, { method: 'HEAD' })
      diag('worker:fetchtest-head-result', describeResponse(headResponse))
    } catch (error) {
      diag('worker:fetchtest-head-failed', describeWorkerError(error))
    }
  } finally {
    post({ type: 'fetch-test-done' })
  }
}

/**
 * TEMPORARY diagnostic probe (remove with piperDiagnostics.ts).
 * Tests whether the iOS worker can fetch the public GitHub Release asset.
 * Exact URL under test (public, no auth). Reads only — never touches OPFS,
 * never persists, never initializes Piper, never downloads the 63 MB model.
 */
const GITHUB_FETCH_TEST_URL =
  'https://github.com/armanxbingx-create/flashy/releases/download/piper-assets-v1/en_US-amy-medium.onnx.json'

async function runGithubFetchTest(): Promise<void> {
  let ok = false
  try {
    diag('worker:github-fetch-test-start', GITHUB_FETCH_TEST_URL)
    let response: Response | null = null
    try {
      response = await fetch(GITHUB_FETCH_TEST_URL, { method: 'GET' })
      diag(
        'worker:github-fetch-test-fetch-ok',
        `resolved-url=${response.url} status=${response.status} ok=${response.ok} ` +
          `content-type=${response.headers.get('Content-Type') ?? '—'} ` +
          `content-length=${response.headers.get('Content-Length') ?? '—'}`,
      )
    } catch (error) {
      diag('worker:github-fetch-test-fetch-failed', describeWorkerError(error))
    }
    if (response) {
      try {
        const buffer = await response.arrayBuffer()
        ok = response.ok && buffer.byteLength > 0
        diag('worker:github-fetch-test-read-ok', `${buffer.byteLength} bytes read`)
      } catch (error) {
        diag('worker:github-fetch-test-read-failed', describeWorkerError(error))
      }
    } else {
      diag('worker:github-fetch-test-read-skipped', 'no response (fetch failed)')
    }
  } finally {
    diag(`worker:github-fetch-test-done ${ok ? 'success' : 'failed'}`)
    post({ type: 'github-fetch-test-done', ok })
  }
}

ctx.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === 'fetch-test-github') {
    void runGithubFetchTest()
    return
  }
  if (message.type === 'fetch-test') {
    void runFetchTest()
    return
  }
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
