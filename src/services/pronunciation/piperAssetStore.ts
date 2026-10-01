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

/**
 * Fetch one asset with retry (4 attempts, 1s/2s/4s backoff). Retries network
 * throws and retryable HTTP (429/5xx); other 4xx fail immediately. Only a
 * fully-assembled, size-verified blob is written to OPFS.
 */
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
      const total = Number(response.headers.get('Content-Length') ?? 0) || expectedBytes || 0
      // TEMPORARY: reset milestones per fresh download attempt.
      lastMilestone = -1
      lastMilestoneLoaded = 0
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          loaded += value.length
          emitProgress(loaded, total)
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
      logPiperDiag('main', `main:asset-${kind}-download-complete`, `${blob.size} bytes → OPFS`)
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
