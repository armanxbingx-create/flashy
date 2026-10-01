/**
 * TEMPORARY — Piper diagnostics (remove before release, with the rest of
 * the temporary TTS diagnostics in SettingsScreen).
 *
 * In-memory only: no storage writes, no behavior changes. Lets the iPhone 8
 * PWA expose *why* Piper never becomes ready instead of silently falling
 * back to Web Speech.
 */

export interface PiperDiagEvent {
  seq: number
  at: number
  source: 'main' | 'worker'
  event: string
  detail?: string
}

export interface PiperDownloadSnapshot {
  started: boolean
  loaded: number
  total: number
  done: boolean
}

export interface OpfsProbeResult {
  storageExists: boolean
  getDirectoryExists: boolean
  /** null = getDirectory() was not attempted (missing API). */
  getDirectoryOk: boolean | null
  errorName?: string
  errorMessage?: string
}

const MAX_EVENTS = 200

let seq = 0
let events: PiperDiagEvent[] = []
let progress: PiperDownloadSnapshot = { started: false, loaded: 0, total: 0, done: false }
let version = 0

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  version++
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // Diagnostic listeners must never break pronunciation.
    }
  }
}

/** Append a lifecycle event. Never throws. */
export function logPiperDiag(source: 'main' | 'worker', event: string, detail?: string): void {
  try {
    seq++
    events = [...events.slice(-(MAX_EVENTS - 1)), { seq, at: Date.now(), source, event, detail }]
    notify()
  } catch {
    // Ignore — diagnostics are best-effort.
  }
}

/** Update the download progress snapshot (called per progress message). */
export function setPiperDownloadProgress(snapshot: PiperDownloadSnapshot): void {
  try {
    progress = snapshot
    notify()
  } catch {
    // Ignore.
  }
}

export function getPiperDiagEvents(): PiperDiagEvent[] {
  return [...events].reverse()
}

export function getPiperDownloadProgress(): PiperDownloadSnapshot {
  return progress
}

export function clearPiperDiag(): void {
  events = []
  progress = { started: false, loaded: 0, total: 0, done: false }
  notify()
}

export function subscribePiperDiag(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPiperDiagVersion(): number {
  return version
}

function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    const stackFirst = error.stack?.split('\n').slice(0, 3).join(' | ')
    const message = stackFirst && stackFirst.length < 500 ? stackFirst : error.message
    return { name: error.name || 'Error', message: message || String(error) }
  }
  return { name: 'Unknown', message: String(error) }
}

/**
 * Pure read probe of OPFS support. Uses `{ create: false }` so it never
 * creates directories — strictly observational.
 */
export async function probeOpfs(): Promise<OpfsProbeResult> {
  const storageExists =
    typeof navigator !== 'undefined' &&
    !!(navigator as unknown as { storage?: unknown }).storage
  const getDirectoryExists =
    storageExists &&
    typeof (navigator.storage as unknown as { getDirectory?: unknown }).getDirectory ===
      'function'
  if (!storageExists || !getDirectoryExists) {
    return { storageExists, getDirectoryExists, getDirectoryOk: null }
  }
  try {
    await navigator.storage.getDirectory()
    return { storageExists, getDirectoryExists, getDirectoryOk: true }
  } catch (error) {
    const { name, message } = describeError(error)
    return {
      storageExists,
      getDirectoryExists,
      getDirectoryOk: false,
      errorName: name,
      errorMessage: message,
    }
  }
}

/** Format an error for a diag `detail` string (name + message + short stack). */
export function formatDiagError(error: unknown): string {
  const { name, message } = describeError(error)
  return `${name}: ${message}`
}
