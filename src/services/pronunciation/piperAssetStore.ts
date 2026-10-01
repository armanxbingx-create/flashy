/**
 * piperAssetStore — MAIN-THREAD download + OPFS persistence for Piper assets.
 *
 * iOS Safari/PWA compatibility: `fetch()` fails inside the Web Worker on the
 * target device (`TypeError: Load failed` for every host tried), so the main
 * thread downloads while the worker only READS already-cached OPFS files.
 * No model bytes ever cross `postMessage`.
 *
 * Bridge to `@realtimex/piper-tts-web@1.1.1` (verified against its source):
 * `TtsSession.init` loads the model via `getBlob(HF_URL)` → `readBlob(URL)`
 * first, which returns OPFS `piper/<filename>` when present (filename =
 * last URL segment). Our files are named exactly
 * `en_US-amy-medium.onnx` / `.onnx.json`, so the worker's session finds
 * them with zero worker network — regardless of which host URL the main
 * thread downloaded them from.
 *
 * Rules preserved: download only when missing, write only complete files,
 * no IndexedDB, no SW precache, no bundling, retry with backoff.
 */

import {
  PIPER_CONFIG_FILE,
  PIPER_CONFIG_URL,
  PIPER_EXPECTED_MODEL_BYTES,
  PIPER_MODEL_FILE,
  PIPER_MODEL_URL,
  PIPER_MODEL_VERSION,
  PIPER_VERSION_STORAGE_KEY,
} from './piperManifest'
import { logPiperDiag, setPiperDownloadProgress } from './piperDiagnostics'

export interface PiperAssetProgress {
  loaded: number
  total: number
}

export function piperOpfsSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.storage &&
      typeof (navigator.storage as unknown as { getDirectory?: unknown }).getDirectory ===
        'function'
    )
  } catch {
    return false
  }
}

export async function readCachedAsset(name: string): Promise<File | undefined> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('piper', { create: true })
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch {
    return undefined
  }
}

/** Best-effort removal of a (possibly partial) cached file. Never throws. */
async function removeCachedAsset(name: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('piper')
    const removable = dir as unknown as {
      removeEntry?: (name: string) => Promise<void>
    }
    if (typeof removable.removeEntry === 'function') {
      await removable.removeEntry(name)
    }
  } catch {
    // Ignore — size checks treat leftovers as a cache miss anyway.
  }
}

function readStoredVersion(): string | null {
  try {
    return window.localStorage.getItem(PIPER_VERSION_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredVersion(version: string): void {
  try {
    window.localStorage.setItem(PIPER_VERSION_STORAGE_KEY, version)
  } catch {
    // Private mode etc. — model still cached in OPFS for the session.
  }
}

/** Remove a stale OPFS model copy when the manifest version changes. */
export async function evictStalePiperAssets(): Promise<void> {
  try {
    if (readStoredVersion() === PIPER_MODEL_VERSION) return
    const root = await navigator.storage.getDirectory()
    // `removeEntry` is the broadly-typed DOM API; newer specs call it `remove`.
    const removable = root as unknown as {
      removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>
      remove?: (options?: { recursive?: boolean }) => Promise<void>
    }
    if (typeof removable.removeEntry === 'function') {
      await removable.removeEntry('piper', { recursive: true })
    } else if (typeof removable.remove === 'function') {
      const dir = await root.getDirectoryHandle('piper')
      const dirRemovable = dir as unknown as {
        remove?: (options?: { recursive?: boolean }) => Promise<void>
      }
      await dirRemovable.remove?.({ recursive: true })
    }
  } catch {
    // Missing directory or unsupported — the worker will report accurately.
  }
  writeStoredVersion(PIPER_MODEL_VERSION)
}

// TEMPORARY download-milestone logging (remove with piperDiagnostics.ts).
let lastMilestone = -1
let lastMilestoneLoaded = 0

function logDownloadMilestone(loaded: number, total: number): void {
  if (total <= 0) {
    if (lastMilestoneLoaded === 0 && loaded > 0) {
      logPiperDiag('main', 'main:download-progress', `${loaded} bytes (total unknown)`)
    }
    lastMilestoneLoaded = loaded
    return
  }
  if (loaded < lastMilestoneLoaded) {
    // New download (restart) — reset milestones.
    lastMilestone = -1
  }
  lastMilestoneLoaded = loaded
  const pct = Math.floor((loaded / total) * 100)
  const milestone = pct >= 100 ? 100 : Math.floor(pct / 25) * 25
  if (milestone > lastMilestone) {
    lastMilestone = milestone
    logPiperDiag('main', 'main:download-progress', `${pct}% (${loaded}/${total} bytes)`)
    if (milestone >= 100) {
      setPiperDownloadProgress({ started: true, loaded, total, done: true })
    }
  }
}

function emitProgress(loaded: number, total: number): void {
  setPiperDownloadProgress({
    started: true,
    loaded,
    total,
    done: total > 0 && loaded >= total,
  })
  logDownloadMilestone(loaded, total)
  for (const listener of progressListeners) {
    try {
      listener(loaded, total)
    } catch {
      // Diagnostic listeners must never break the download.
    }
  }
}

const progressListeners = new Set<(loaded: number, total: number) => void>()

type WriterIncoming =
  | { type: 'open'; name: string }
  | { type: 'chunk'; data: ArrayBuffer }
  | { type: 'close'; expectedBytes?: number; validateJson?: boolean }

type WriterOutgoing =
  | { type: 'opened' }
  | { type: 'ack'; bytes: number }
  | { type: 'done'; size: number }
  | { type: 'error'; message: string }
  | { type: 'diag'; event: string; detail?: string; at: number }

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`OPFS writer timeout: ${label}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

/**
 * Streams response bytes into OPFS through the dedicated writer worker
 * (see piperAssetWriter.ts). The main thread reads the network stream and
 * forwards each chunk with a transferable, awaiting every ack so memory
 * stays bounded. Resolves with the verified final size. Rejects clearly —
 * including when the device lacks the sync-handle API — so callers fall
 * back to Web Speech instead of corrupting the cache.
 */
async function streamResponseToOpfs(
  name: string,
  response: Response,
  expectedBytes: number | undefined,
  validateJson: boolean,
  kind: 'config' | 'model',
  onChunk: (loaded: number, total: number) => void,
): Promise<number> {
  const total = Number(response.headers.get('Content-Length') ?? 0) || expectedBytes || 0
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Model download failed: empty response body')
  const worker = new Worker(new URL('./piperAssetWriter.ts', import.meta.url), {
    type: 'module',
  })
  logPiperDiag('main', 'main:asset-writer-created', name)
  // Final verified size reported by the writer worker on close.
  let doneSize = 0
  const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>()
  const failAll = (error: Error) => {
    for (const [, entry] of pending) entry.reject(error)
    pending.clear()
  }
  worker.onmessage = (event: MessageEvent<WriterOutgoing>) => {
    const message = event.data
    if (message.type === 'diag') {
      logPiperDiag('worker', message.event, message.detail)
      return
    }
    if (message.type === 'error') {
      failAll(new Error(message.message))
      return
    }
    if (message.type === 'done') {
      doneSize = message.size
      const entry = pending.get('close')
      if (entry) {
        pending.delete('close')
        entry.resolve()
      }
      return
    }
    const key = message.type === 'opened' ? 'open' : message.type === 'ack' ? 'chunk' : null
    if (key) {
      const entry = pending.get(key)
      if (entry) {
        pending.delete(key)
        entry.resolve()
      }
    }
  }
  worker.onerror = () => {
    failAll(new Error('OPFS writer worker failed'))
  }
  const request = (key: string, message: WriterIncoming, transfer?: Transferable[]): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      pending.set(key, { resolve, reject })
      try {
        worker.postMessage(message, transfer ?? [])
      } catch (error) {
        pending.delete(key)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  const terminate = () => {
    try {
      worker.terminate()
    } catch {
      // Ignore — teardown is best-effort.
    }
  }
  // Final verified size reported by the writer worker on close.
  try {
    await withTimeout(
      request('open', { type: 'open', name }),
      30000,
      `open ${name}`,
    )
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        const buffer = value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength,
        ) as ArrayBuffer
        loaded += buffer.byteLength
        await withTimeout(
          request('chunk', { type: 'chunk', data: buffer }, [buffer]),
          30000,
          `chunk @${loaded} of ${name}`,
        )
        onChunk(loaded, total)
      }
    }
    let finalSize = 0
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        // The 'done' branch of onmessage records the verified size into
        // doneSize before resolving, so it is valid to read after await.
        const checkDone = () => {
          const entry = pending.get('close')
          if (entry) {
            pending.delete('close')
            finalSize = doneSize
            resolve()
          }
        }
        pending.set('close', { resolve: checkDone, reject })
        try {
          worker.postMessage({ type: 'close', expectedBytes, validateJson })
        } catch (error) {
          pending.delete('close')
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }),
      60000,
      `close ${name}`,
    )
    logPiperDiag('main', `main:asset-${kind}-download-complete`, `${finalSize} bytes → OPFS`)
    return finalSize
  } catch (error) {
    // Never leave a partial file that could later be treated as valid.
    await removeCachedAsset(name)
    try {
      await reader.cancel()
    } catch {
      // Ignore — the network stream is already broken or consumed.
    }
    throw error
  } finally {
    terminate()
  }
}
async function downloadAsset(
  name: string,
  url: string,
  expectedBytes: number | undefined,
  kind: 'config' | 'model',
): Promise<void> {
  const maxAttempts = 4
  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok || !response.body) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Model download failed: HTTP ${response.status} (retryable)`)
        }
        throw new Error(`Model download failed: HTTP ${response.status}`)
      }
      // TEMPORARY: reset milestones per fresh download attempt.
      lastMilestone = -1
      lastMilestoneLoaded = 0
      // The main thread reads the network stream here (progress reporting
      // is unchanged); persistence goes through the writer worker because
      // FileSystemFileHandle.createWritable() is missing on older iOS.
      // The config additionally gets JSON-validated on write.
      await streamResponseToOpfs(
        name,
        response,
        expectedBytes,
        kind === 'config',
        kind,
        (loaded, total) => emitProgress(loaded, total),
      )
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const retryableHttp = message.includes('(retryable)')
      const permanentHttp =
        message.startsWith('Model download failed: HTTP') && !retryableHttp
      if (permanentHttp || attempt === maxAttempts) {
        logPiperDiag('main', `main:asset-${kind}-download-failed`, message)
        throw error
      }
      logPiperDiag(
        'main',
        `main:asset-${kind}-download-retry`,
        `attempt ${attempt}/${maxAttempts} failed: ${message}`,
      )
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function ensurePiperAsset(
  name: string,
  url: string,
  expectedBytes: number | undefined,
  kind: 'config' | 'model',
): Promise<void> {
  const cached = await readCachedAsset(name)
  if (cached && cached.size > 0) {
    if (expectedBytes === undefined || cached.size === expectedBytes) {
      // The config has no expected size, so a killed mid-write run could
      // leave a non-empty but truncated file. JSON is cheap to revalidate
      // (~5 KB) and closes that window.
      if (kind === 'config') {
        try {
          JSON.parse(await cached.text())
        } catch {
          logPiperDiag('main', 'main:asset-cache-miss', `${name} is not valid JSON — re-downloading`)
          await removeCachedAsset(name)
          logPiperDiag('main', `main:asset-${kind}-download-start`, url)
          await downloadAsset(name, url, expectedBytes, kind)
          return
        }
      }
      logPiperDiag('main', 'main:asset-cache-hit', `${name} (${cached.size} bytes, no download)`)
      return
    }
    logPiperDiag(
      'main',
      'main:asset-cache-miss',
      `${name} size ${cached.size} ≠ expected ${expectedBytes} — re-downloading`,
    )
  } else {
    logPiperDiag('main', 'main:asset-cache-miss', `${name} not in OPFS — downloading`)
  }
  logPiperDiag('main', `main:asset-${kind}-download-start`, url)
  await downloadAsset(name, url, expectedBytes, kind)
}

let assetsPromise: Promise<void> | null = null
let evicted = false

/**
 * Ensure config + model are in OPFS (shared single-flight promise).
 * Resolves fast on cache hit. Rejects with the real error on failure so
 * callers fall back to Web Speech; resets so the next tap retries.
 */
export function ensurePiperAssets(
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  if (onProgress) progressListeners.add(onProgress)
  if (!assetsPromise) {
    assetsPromise = (async () => {
      if (!piperOpfsSupported()) throw new Error('OPFS_UNSUPPORTED')
      if (!evicted) {
        evicted = true
        await evictStalePiperAssets()
      }
      await ensurePiperAsset(PIPER_CONFIG_FILE, PIPER_CONFIG_URL, undefined, 'config')
      await ensurePiperAsset(
        PIPER_MODEL_FILE,
        PIPER_MODEL_URL,
        PIPER_EXPECTED_MODEL_BYTES,
        'model',
      )
    })().catch((error: unknown) => {
      assetsPromise = null
      throw error
    })
  }
  const current = assetsPromise
  return current.finally(() => {
    if (onProgress) progressListeners.delete(onProgress)
  })
}
