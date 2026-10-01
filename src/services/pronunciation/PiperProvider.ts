/**
 * PiperProvider — main-thread owner of the Piper Web Worker + WAV playback.
 *
 * - Lazy: no Worker, no download, no ONNX session until first `speak()`.
 * - OPFS persistence with feature detection; Dexie schema untouched.
 * - One synthesis job at a time; a new request cancels/replaces the old.
 * - WAV playback via a dedicated HTMLAudioElement + Blob URL.
 *   FeedbackSystem is never used here.
 * - Any failure throws so the caller can fall back to Web Speech.
 */

import {
  PIPER_MODEL_VERSION,
  PIPER_VERSION_STORAGE_KEY,
} from './piperManifest'
import type { PronunciationProgress } from './PronunciationProvider'
// TEMPORARY diagnostics (remove with piperDiagnostics.ts).
import {
  logPiperDiag,
  setPiperDownloadProgress,
} from './piperDiagnostics'

type WorkerOutgoing =
  | { type: 'ready' }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; id: number; wav: ArrayBuffer }
  | { type: 'error'; id: number | null; message: string }
  // TEMPORARY diagnostic event forwarded from the worker.
  | { type: 'diag'; event: string; detail?: string; at: number }
  // TEMPORARY fetch-test completion marker forwarded from the worker.
  | { type: 'fetch-test-done' }

type WorkerIncoming =
  | { type: 'init' }
  | { type: 'synthesize'; id: number; text: string }
  | { type: 'cancel'; id: number }
  // TEMPORARY diagnostic probe (remove with piperDiagnostics.ts).
  | { type: 'fetch-test' }

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
async function evictStaleModel(): Promise<void> {
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
    // Missing directory or unsupported — worker will report accurately.
  }
  writeStoredVersion(PIPER_MODEL_VERSION)
}

export class PiperProvider {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<
    number,
    {
      resolve: (wav: ArrayBuffer) => void
      reject: (error: Error) => void
      onProgress?: (progress: PronunciationProgress) => void
    }
  >()
  private ready = false
  private initStarted = false
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private disposed = false

  get isReady(): boolean {
    return this.ready
  }

  /** Warm the runtime + model in the background (still lazy, never at boot). */
  warmUp(onProgress?: (progress: PronunciationProgress) => void): void {
    if (this.disposed || this.initStarted) {
      logPiperDiag('main', 'main:warmup-skipped', 'disposed or already started')
      return
    }
    if (!piperOpfsSupported()) {
      logPiperDiag('main', 'main:warmup-skipped', 'OPFS unsupported')
      return
    }
    this.initStarted = true
    logPiperDiag('main', 'main:warmup-called')
    void evictStaleModel()
      .catch(() => {})
      .then(() => this.ensureWorker())
      .then((worker) => {
        logPiperDiag('main', 'main:init-posted')
        worker.postMessage({ type: 'init' } satisfies WorkerIncoming)
        if (onProgress) {
          // Track the next synthesize progress via a throwaway hook.
          this.progressHook = onProgress
        }
      })
      .catch(() => {})
  }

  private progressHook: ((progress: PronunciationProgress) => void) | null = null

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./piperWorker.ts', import.meta.url), {
      type: 'module',
    })
    logPiperDiag('main', 'main:worker-created')
    worker.onmessage = (event: MessageEvent<WorkerOutgoing>) => {
      const message = event.data
      if (message.type === 'ready') {
        this.ready = true
        logPiperDiag('main', 'main:ready-received', 'ready=true set')
        return
      }
      // TEMPORARY: forward worker lifecycle events to the diag log.
      if (message.type === 'diag') {
        logPiperDiag('worker', message.event, message.detail)
        return
      }
      // TEMPORARY: fetch-test completion marker.
      if (message.type === 'fetch-test-done') {
        logPiperDiag('main', 'main:fetchtest-done')
        const pendingTest = this.fetchTestPending
        this.fetchTestPending = null
        if (pendingTest) {
          clearTimeout(pendingTest.timer)
          pendingTest.resolve()
        }
        return
      }
      if (message.type === 'progress') {
        const fraction =
          message.total > 0 ? Math.min(1, message.loaded / message.total) : undefined
        const progress: PronunciationProgress = {
          fraction,
          loaded: message.loaded,
          total: message.total,
        }
        // TEMPORARY: snapshot for Settings + milestone log lines.
        setPiperDownloadProgress({
          started: true,
          loaded: message.loaded,
          total: message.total,
          done: false,
        })
        this.logDownloadMilestone(message.loaded, message.total)
        this.progressHook?.(progress)
        for (const entry of this.pending.values()) entry.onProgress?.(progress)
        return
      }
      if (message.type === 'result') {
        const entry = this.pending.get(message.id)
        if (entry) {
          this.pending.delete(message.id)
          entry.resolve(message.wav)
        }
        return
      }
      if (message.type === 'error') {
        if (message.id === null) {
          // Init failure — fail all pending synthesizes.
          // TEMPORARY: surface the actual init error.
          logPiperDiag('main', 'main:init-error', message.message)
          const error = new Error(message.message)
          for (const [id, entry] of this.pending) {
            this.pending.delete(id)
            entry.reject(error)
          }
          return
        }
        const entry = this.pending.get(message.id)
        if (entry) {
          // TEMPORARY: surface the actual synthesize error.
          logPiperDiag('main', 'main:synthesize-error', message.message)
          this.pending.delete(message.id)
          entry.reject(new Error(message.message))
        }
      }
    }
    worker.onerror = () => {
      // TEMPORARY: surface worker crashes in diagnostics.
      logPiperDiag('main', 'main:worker-onerror', 'Worker error event (no detail from browser)')
      const error = new Error('Piper worker failed')
      for (const [id, entry] of this.pending) {
        this.pending.delete(id)
        entry.reject(error)
      }
    }
    this.worker = worker
    return worker
  }

  // TEMPORARY download-milestone logging (remove with piperDiagnostics.ts).
  private lastMilestone = -1

  private logDownloadMilestone(loaded: number, total: number): void {
    if (total <= 0) {
      if (this.lastMilestone !== 0) {
        this.lastMilestone = 0
        logPiperDiag('main', 'main:download-progress', `${loaded} bytes (total unknown)`)
      }
      return
    }
    if (loaded < this.lastMilestoneLoaded) {
      // New download (restart) — reset milestones.
      this.lastMilestone = -1
    }
    this.lastMilestoneLoaded = loaded
    const pct = Math.floor((loaded / total) * 100)
    const milestone = pct >= 100 ? 100 : Math.floor(pct / 25) * 25
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone
      logPiperDiag('main', 'main:download-progress', `${pct}% (${loaded}/${total} bytes)`)
      if (milestone >= 100) {
        setPiperDownloadProgress({ started: true, loaded, total, done: true })
      }
    }
  }

  private lastMilestoneLoaded = 0

  /**
   * Synthesize text to a WAV ArrayBuffer. Rejects on any failure
   * (unsupported OPFS, download error, inference error) so the caller
   * can fall back to Web Speech immediately.
   */
  synthesize(
    text: string,
    onProgress?: (progress: PronunciationProgress) => void,
  ): Promise<ArrayBuffer> {
    if (this.disposed) return Promise.reject(new Error('Piper disposed'))
    if (!piperOpfsSupported()) return Promise.reject(new Error('OPFS_UNSUPPORTED'))
    const trimmed = text.trim()
    if (!trimmed) return Promise.reject(new Error('Empty text'))
    // One job at a time: fail superseded requests rather than queueing.
    for (const [id, entry] of this.pending) {
      this.pending.delete(id)
      entry.reject(new Error('Superseded by newer request'))
      try {
        this.worker?.postMessage({ type: 'cancel', id } satisfies WorkerIncoming)
      } catch {
        // Ignore — worker teardown is best-effort.
      }
    }
    this.stopAudio()
    if (!this.initStarted) {
      this.initStarted = true
      // Fire-and-forget version eviction; worker pre-seed validates size.
      void evictStaleModel().catch(() => {})
    }
    const worker = this.ensureWorker()
    const id = this.nextId++
    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
    })
    try {
      worker.postMessage({ type: 'synthesize', id, text: trimmed } satisfies WorkerIncoming)
    } catch (error) {
      this.pending.delete(id)
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
    return promise
  }

  /**
   * Synthesize and play through a dedicated HTMLAudioElement.
   * Rejects if playback fails (e.g. iOS gesture restriction) so the
   * caller can fall back to Web Speech.
   */
  async speak(
    text: string,
    onProgress?: (progress: PronunciationProgress) => void,
  ): Promise<void> {
    const wav = await this.synthesize(text, onProgress)
    this.stopAudio()
    const blob = new Blob([wav], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    this.objectUrl = url
    try {
      const audio = new Audio(url)
      audio.preload = 'auto'
      this.audio = audio
      await audio.play()
      await new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener('ended', done)
          audio.removeEventListener('error', done)
          resolve()
        }
        audio.addEventListener('ended', done)
        audio.addEventListener('error', done)
      })
    } finally {
      this.stopAudio()
    }
  }

  /** Stop Piper audio + revoke Blob URL. Never throws. */
  stopAudio(): void {
    try {
      if (this.audio) {
        this.audio.pause()
        this.audio.src = ''
      }
    } catch {
      // Ignore.
    }
    this.audio = null
    try {
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    } catch {
      // Ignore.
    }
    this.objectUrl = null
  }

  cancel(): void {
    for (const [id, entry] of this.pending) {
      this.pending.delete(id)
      entry.reject(new Error('Cancelled'))
      try {
        this.worker?.postMessage({ type: 'cancel', id } satisfies WorkerIncoming)
      } catch {
        // Ignore.
      }
    }
    this.stopAudio()
  }

  // TEMPORARY fetch-test state (remove with piperDiagnostics.ts).
  private fetchTestPending: {
    resolve: () => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  /**
   * TEMPORARY diagnostic probe (remove with piperDiagnostics.ts).
   * Asks the worker to GET + HEAD the exact manifest config URL and report
   * back. Writes nothing to OPFS, persists nothing, changes no behavior.
   */
  runFetchTest(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Piper disposed'))
    let worker: Worker
    try {
      worker = this.ensureWorker()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logPiperDiag('main', 'main:fetchtest-worker-failed', message)
      return Promise.reject(error instanceof Error ? error : new Error(message))
    }
    if (this.fetchTestPending) {
      return Promise.reject(new Error('Fetch test already running'))
    }
    logPiperDiag('main', 'main:fetchtest-started')
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fetchTestPending = null
        logPiperDiag('main', 'main:fetchtest-timeout', 'no fetch-test-done within 90s')
        reject(new Error('Fetch test timed out'))
      }, 90000)
      this.fetchTestPending = { resolve, reject, timer }
      try {
        worker.postMessage({ type: 'fetch-test' } satisfies WorkerIncoming)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        const pendingTest = this.fetchTestPending
        this.fetchTestPending = null
        clearTimeout(timer)
        pendingTest?.reject(err)
        logPiperDiag('main', 'main:fetchtest-post-failed', err.message)
      }
    })
  }

  dispose(): void {
    this.disposed = true
    this.cancel()
    try {
      this.worker?.terminate()
    } catch {
      // Ignore.
    }
    this.worker = null
  }
}
