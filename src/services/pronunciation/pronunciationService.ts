/**
 * pronunciationService — app-wide singleton composing Piper (primary)
 * with Web Speech (fallback).
 *
 * Policy (no second-tap penalty):
 * - If Piper is ready (or becomes ready), use it.
 * - Otherwise start Piper warm-up in the background and speak with
 *   Web Speech immediately, so the first tap still produces audio.
 * - Any Piper failure (unsupported OPFS, download error, inference
 *   error, iOS playback rejection) falls back to Web Speech silently.
 *
 * No cloud TTS, no telemetry, no user-data upload. Only static
 * model/runtime downloads, then fully offline.
 */

import type {
  PronunciationEngine,
  PronunciationProvider,
  SpeakOptions,
} from './PronunciationProvider'
import { WebSpeechProvider } from './WebSpeechProvider'
import { PiperProvider, piperOpfsSupported } from './PiperProvider'
// TEMPORARY diagnostics (remove with piperDiagnostics.ts).
import { formatDiagError, logPiperDiag } from './piperDiagnostics'

class CompositePronunciationService implements PronunciationProvider {
  private webSpeech = new WebSpeechProvider()
  private piper: PiperProvider | null = null
  private warmUpStarted = false

  get piperReady(): boolean {
    return this.piper?.isReady ?? false
  }

  private ensurePiper(): PiperProvider | null {
    if (this.piper) return this.piper
    if (!piperOpfsSupported()) return null
    try {
      this.piper = new PiperProvider()
      return this.piper
    } catch {
      this.piper = null
      return null
    }
  }

  async speak(text: string, options?: SpeakOptions): Promise<PronunciationEngine> {
    const trimmed = text.trim()
    if (!trimmed) return 'silent'

    const piper = this.ensurePiper()
    if (piper) {
      if (piper.isReady) {
        // Hot path: model cached + session alive — pure Piper.
        // TEMPORARY: log the attempt and its real outcome.
        logPiperDiag('main', 'main:hot-path-attempt')
        try {
          await piper.speak(trimmed, options?.onProgress)
          logPiperDiag('main', 'main:hot-path-ok')
          return 'piper'
        } catch (error) {
          // Fall through to Web Speech below.
          logPiperDiag('main', 'main:hot-path-failed', formatDiagError(error))
        }
      } else {
        // Cold path: kick off lazy download/init in the background, but
        // speak with Web Speech NOW so this tap still produces audio.
        if (!this.warmUpStarted) {
          this.warmUpStarted = true
          logPiperDiag('main', 'main:cold-path-warmup-started')
          piper.warmUp(options?.onProgress)
        } else {
          logPiperDiag('main', 'main:cold-path-warmup-already-started')
        }
      }
    } else {
      // TEMPORARY: record exactly why Piper was skipped.
      logPiperDiag('main', 'main:piper-skipped', 'ensurePiper() returned null (OPFS unsupported)')
    }

    const ok = this.webSpeech.speak(trimmed)
    // TEMPORARY: record which fallback actually happened.
    logPiperDiag('main', 'main:fallback-webspeech', ok ? 'spoken=true' : 'spoken=false')
    return ok ? 'webspeech' : 'silent'
  }
  cancel(): void {
    try {
      this.piper?.cancel()
    } catch {
      // Ignore.
    }
    this.webSpeech.cancel()
  }

  /**
   * TEMPORARY diagnostic entry point (remove with piperDiagnostics.ts).
   * Creates the PiperProvider exactly as speak() would and starts warm-up,
   * but never speaks — so Settings can observe init/download silently.
   */
  warmUpForDiagnostics(): void {
    const piper = this.ensurePiper()
    if (!piper) {
      logPiperDiag('main', 'main:diag-warmup', 'ensurePiper returned null (OPFS unsupported)')
      return
    }
    if (this.warmUpStarted) {
      logPiperDiag('main', 'main:diag-warmup', 'warm-up already started earlier')
      return
    }
    this.warmUpStarted = true
    logPiperDiag('main', 'main:diag-warmup', 'warm-up started from Settings diagnostics')
    piper.warmUp()
  }

  dispose(): void {
    try {
      this.piper?.dispose()
    } catch {
      // Ignore.
    }
    this.piper = null
    this.webSpeech.cancel()
  }

  /**
   * TEMPORARY diagnostic entry point (remove with piperDiagnostics.ts).
   * Runs the worker fetch probe (GET + HEAD of the manifest config URL).
   * Writes nothing, persists nothing, speaks nothing.
   */
  runFetchTestForDiagnostics(): Promise<void> {
    const piper = this.ensurePiper()
    if (!piper) {
      logPiperDiag('main', 'main:diag-fetchtest', 'ensurePiper returned null (OPFS unsupported)')
      return Promise.reject(new Error('OPFS unsupported'))
    }
    logPiperDiag('main', 'main:diag-fetchtest', 'fetch test requested from Settings diagnostics')
    return piper.runFetchTest()
  }

  /**
   * TEMPORARY diagnostic entry point (remove with piperDiagnostics.ts).
   * Runs the worker GitHub Release fetch probe. Writes nothing, persists
   * nothing, speaks nothing, never initializes Piper.
   */
  runGithubFetchTestForDiagnostics(): Promise<boolean> {
    const piper = this.ensurePiper()
    if (!piper) {
      logPiperDiag(
        'main',
        'main:diag-github-fetchtest',
        'ensurePiper returned null (OPFS unsupported)',
      )
      return Promise.reject(new Error('OPFS unsupported'))
    }
    logPiperDiag(
      'main',
      'main:diag-github-fetchtest',
      'GitHub fetch test requested from Settings diagnostics',
    )
    return piper.runGithubFetchTest()
  }
}

let singleton: CompositePronunciationService | null = null

export function getPronunciationService(): PronunciationProvider {
  if (!singleton) singleton = new CompositePronunciationService()
  return singleton
}

/**
 * TEMPORARY diagnostic entry point (remove with piperDiagnostics.ts).
 * Starts the same lazy Piper warm-up the first speaker tap would start,
 * but WITHOUT speaking — so Settings can observe init/download progress
 * silently. Does not change fallback behavior.
 */
export function diagnosePiperWarmUp(): void {
  try {
    if (!singleton) singleton = new CompositePronunciationService()
    singleton.warmUpForDiagnostics()
  } catch (error) {
    logPiperDiag('main', 'main:diag-warmup-failed', formatDiagError(error))
  }
}

/**
 * TEMPORARY diagnostic entry point (remove with piperDiagnostics.ts).
 * Probes worker fetch (GET + HEAD) without writing, persisting, or speaking.
 */
export function diagnoseWorkerFetch(): Promise<void> {
  try {
    if (!singleton) singleton = new CompositePronunciationService()
    return singleton.runFetchTestForDiagnostics().catch((error: unknown) => {
      logPiperDiag(
        'main',
        'main:diag-fetchtest-failed',
        error instanceof Error ? error.message : String(error),
      )
    })
  } catch (error) {
    logPiperDiag('main', 'main:diag-fetchtest-failed', formatDiagError(error))
    return Promise.resolve()
  }
}

/**
 * TEMPORARY diagnostic entry point (remove with piperDiagnostics.ts).
 * Probes worker fetch of the public GitHub Release asset without writing,
 * persisting, speaking, or initializing Piper.
 */
export function diagnoseGithubFetch(): Promise<void> {
  try {
    if (!singleton) singleton = new CompositePronunciationService()
    return singleton.runGithubFetchTestForDiagnostics().then(
      () => {},
      (error: unknown) => {
        logPiperDiag(
          'main',
          'main:diag-github-fetchtest-failed',
          error instanceof Error ? error.message : String(error),
        )
      },
    )
  } catch (error) {
    logPiperDiag('main', 'main:diag-github-fetchtest-failed', formatDiagError(error))
    return Promise.resolve()
  }
}
