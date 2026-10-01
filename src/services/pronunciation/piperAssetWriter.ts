/**
 * piperAssetWriter — tiny dedicated Web Worker that persists downloaded
 * Piper asset bytes into OPFS.
 *
 * Why this exists: older Safari/iOS implements OPFS reads but NOT
 * `FileSystemFileHandle.createWritable()` on the main thread, so the main
 * thread can download but cannot save files itself. The synchronous access
 * handle API (`createSyncAccessHandle`) is worker-only and IS available on
 * those same versions, so the write happens here.
 *
 * The main thread keeps fetching and streams each chunk over with
 * transferables, awaiting every ack (backpressure), so at most ~1 chunk
 * lives in either thread and the 63 MB model never sits wholly in memory
 * twice. Atomicity: the file is truncated on open, and close verifies the
 * final size (plus JSON validity for the config) and deletes the file on
 * any mismatch — a partial file is never reported as complete, and the
 * existing size checks treat leftovers as a cache miss on the next run.
 *
 * Protocol (single job per worker instance; the owner terminates it after):
 *   main   → { type: 'open', name }
 *   worker → { type: 'opened' } | { type: 'error', message }
 *   main   → { type: 'chunk', data: ArrayBuffer }   (transferred)
 *   worker → { type: 'ack', bytes: number } | { type: 'error', message }
 *   main   → { type: 'close', expectedBytes?: number, validateJson?: boolean }
 *   worker → { type: 'done', size: number } | { type: 'error', message }
 * Observability uses { type: 'diag', event, detail?, at }, forwarded by the
 * owner into the shared diagnostic log.
 */

interface OpenMessage {
  type: 'open'
  name: string
}

interface ChunkMessage {
  type: 'chunk'
  data: ArrayBuffer
}

interface CloseMessage {
  type: 'close'
  expectedBytes?: number
  validateJson?: boolean
}

type IncomingMessage = OpenMessage | ChunkMessage | CloseMessage

interface OpenedMessage {
  type: 'opened'
}

interface AckMessage {
  type: 'ack'
  bytes: number
}

interface DoneMessage {
  type: 'done'
  size: number
}

interface ErrorMessage {
  type: 'error'
  message: string
}

interface DiagMessage {
  type: 'diag'
  event: string
  detail?: string
  at: number
}

type OutgoingMessage = OpenedMessage | AckMessage | DoneMessage | ErrorMessage | DiagMessage

/**
 * Structural subset of the File System Access sync-handle API. Declared
 * locally (instead of relying on DOM lib coverage) because older Safari
 * exposes this API only inside workers and only at runtime — availability
 * is feature-detected below, never assumed.
 */
interface PiperSyncAccessHandle {
  write(buffer: ArrayBuffer, options?: { at?: number }): number
  truncate(newSize: number): void
  flush(): void
  close(): void
}

interface PiperSyncCapableFileHandle extends FileSystemFileHandle {
  createSyncAccessHandle?: () => Promise<PiperSyncAccessHandle>
}

const ctx = self as unknown as {
  postMessage(message: OutgoingMessage, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null
}

function post(message: OutgoingMessage, transfer?: Transferable[]): void {
  ctx.postMessage(message, transfer)
}

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

let syncHandle: PiperSyncAccessHandle | null = null
let openName = ''
let bytesWritten = 0

function closeHandleQuietly(): void {
  try {
    syncHandle?.close()
  } catch {
    // Ignore — cleanup is best-effort.
  }
  syncHandle = null
}

async function removePartialFile(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('piper')
    await dir.removeEntry(openName)
  } catch {
    // Ignore — the size checks treat leftovers as a cache miss anyway.
  }
}

async function handleOpen(name: string): Promise<void> {
  closeHandleQuietly()
  openName = name
  bytesWritten = 0
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle('piper', { create: true })
  const fileHandle: PiperSyncCapableFileHandle = await dir.getFileHandle(name, { create: true })
  if (typeof fileHandle.createSyncAccessHandle !== 'function') {
    throw new Error(
      'OPFS sync write unsupported on this device (createSyncAccessHandle is not a function)',
    )
  }
  let sync: PiperSyncAccessHandle
  try {
    sync = await fileHandle.createSyncAccessHandle()
  } catch (error) {
    throw new Error(
      `OPFS sync write unsupported on this device (createSyncAccessHandle failed): ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  // Truncate first so a previous partial file can never be mistaken for
  // complete data if this run fails partway through.
  sync.truncate(0)
  syncHandle = sync
  diag('worker:asset-write-opened', name)
  post({ type: 'opened' })
}

function handleChunk(data: ArrayBuffer): void {
  if (!syncHandle) {
    post({ type: 'error', message: 'OPFS writer received a chunk with no open file' })
    return
  }
  const written = syncHandle.write(data, { at: bytesWritten })
  if (written !== data.byteLength) {
    post({
      type: 'error',
      message: `OPFS short write: wrote ${written} of ${data.byteLength} bytes`,
    })
    return
  }
  bytesWritten += data.byteLength
  post({ type: 'ack', bytes: bytesWritten })
}

async function handleClose(expectedBytes?: number, validateJson?: boolean): Promise<void> {
  const sync = syncHandle
  syncHandle = null
  if (!sync) {
    post({ type: 'error', message: 'OPFS writer received close with no open file' })
    return
  }
  try {
    sync.flush()
  } catch {
    // Some implementations flush on close; failure here is non-fatal.
  }
  try {
    sync.close()
  } catch {
    // Ignore — proceed to verification, which is authoritative.
  }
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle('piper')
  const fileHandle = await dir.getFileHandle(openName)
  const file = await fileHandle.getFile()
  if (expectedBytes !== undefined && file.size !== expectedBytes) {
    await removePartialFile()
    post({
      type: 'error',
      message: `Model size mismatch: got ${file.size}, expected ${expectedBytes}`,
    })
    return
  }
  if (validateJson) {
    try {
      JSON.parse(await file.text())
    } catch {
      await removePartialFile()
      post({ type: 'error', message: 'Config file is not valid JSON' })
      return
    }
  }
  diag('worker:asset-write-complete', `${openName} (${file.size} bytes)`)
  post({ type: 'done', size: file.size })
}

ctx.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === 'open') {
    void handleOpen(message.name).catch((error: unknown) => {
      closeHandleQuietly()
      post({ type: 'error', message: describeWorkerError(error) })
    })
    return
  }
  if (message.type === 'chunk') {
    try {
      handleChunk(message.data)
    } catch (error) {
      closeHandleQuietly()
      post({ type: 'error', message: describeWorkerError(error) })
    }
    return
  }
  if (message.type === 'close') {
    void handleClose(message.expectedBytes, message.validateJson).catch((error: unknown) => {
      closeHandleQuietly()
      post({ type: 'error', message: describeWorkerError(error) })
    })
  }
}
