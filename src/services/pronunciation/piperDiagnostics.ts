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

// ---------------------------------------------------------------------------
// TEMPORARY — main-thread fetch probe (remove with piperDiagnostics.ts).
// Runs directly on the MAIN thread (never the worker): one GET of the small
// public GitHub Release config asset plus one GET of a tiny same-origin
// Flashy asset. Never downloads the 63 MB model, writes nothing, persists
// nothing, speaks nothing, changes no behavior.
// ---------------------------------------------------------------------------

/** Exact public config asset under test (temporary diagnostic constant). */
const DIRECT_FETCH_TEST_URL =
  'https://github.com/armanxbingx-create/flashy/releases/download/piper-assets-v1/en_US-amy-medium.onnx.json'

/** Tiny same-origin asset that Flashy itself serves (exists in public/). */
const SAME_ORIGIN_FETCH_TEST_URL = '/favicon.svg'

function errorConstructorName(error: unknown): string {
  try {
    const ctor = (error as { constructor?: { name?: unknown } } | null)?.constructor
    return typeof ctor?.name === 'string' && ctor.name ? ctor.name : typeof error
  } catch {
    return typeof error
  }
}

function describeFetchError(error: unknown, phase: 'fetch()' | 'response.text()', url: string): string {
  const { name, message } = describeError(error)
  const stack =
    error instanceof Error && error.stack
      ? error.stack.split('\n').slice(0, 4).join(' | ').slice(0, 600)
      : '—'
  return (
    `phase=${phase} url=${url} ctor=${errorConstructorName(error)} ` +
    `name=${name} message=${message} stack=${stack}`
  )
}

function describeFetchResponse(response: Response): string {
  return (
    `status=${response.status} statusText=${response.statusText || '—'} ok=${response.ok} ` +
    `url=${response.url || '—'} type=${response.type} redirected=${response.redirected} ` +
    `content-type=${response.headers.get('Content-Type') ?? '—'} ` +
    `content-length=${response.headers.get('Content-Length') ?? '—'}`
  )
}

/** TEMPORARY: main-thread GET probe. Resolves when done; all output via diag log. */
export async function diagnoseMainThreadFetch(): Promise<void> {
  // --- Cross-origin: small public GitHub Release config asset.
  logPiperDiag('main', 'main:direct-fetch-start', DIRECT_FETCH_TEST_URL)
  let directResponse: Response | null = null
  try {
    directResponse = await fetch(DIRECT_FETCH_TEST_URL, { method: 'GET' })
    logPiperDiag('main', 'main:direct-fetch-ok', describeFetchResponse(directResponse))
  } catch (error) {
    logPiperDiag(
      'main',
      'main:direct-fetch-failed',
      describeFetchError(error, 'fetch()', DIRECT_FETCH_TEST_URL),
    )
  }
  if (directResponse) {
    logPiperDiag('main', 'main:direct-fetch-read-start', DIRECT_FETCH_TEST_URL)
    try {
      const text = await directResponse.text()
      logPiperDiag('main', 'main:direct-fetch-read-ok', `${text.length} chars read`)
    } catch (error) {
      logPiperDiag(
        'main',
        'main:direct-fetch-read-failed',
        describeFetchError(error, 'response.text()', DIRECT_FETCH_TEST_URL),
      )
    }
  } else {
    logPiperDiag('main', 'main:direct-fetch-read-skipped', 'no Response (fetch failed)')
  }
  logPiperDiag(
    'main',
    'main:direct-fetch-done',
    directResponse ? 'finished with Response' : 'finished without Response',
  )

  // --- Same-origin control: tiny Flashy-owned static asset.
  logPiperDiag('main', 'main:same-origin-fetch-start', SAME_ORIGIN_FETCH_TEST_URL)
  try {
    const sameOriginResponse = await fetch(SAME_ORIGIN_FETCH_TEST_URL, { method: 'GET' })
    logPiperDiag('main', 'main:same-origin-fetch-ok', describeFetchResponse(sameOriginResponse))
  } catch (error) {
    logPiperDiag(
      'main',
      'main:same-origin-fetch-failed',
      describeFetchError(error, 'fetch()', SAME_ORIGIN_FETCH_TEST_URL),
    )
  }
  logPiperDiag('main', 'main:same-origin-fetch-done')
}
