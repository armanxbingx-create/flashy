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
        try {
          await piper.speak(trimmed, options?.onProgress)
          return 'piper'
        } catch {
          // Fall through to Web Speech below.
        }
      } else {
        // Cold path: kick off lazy download/init in the background, but
        // speak with Web Speech NOW so this tap still produces audio.
        if (!this.warmUpStarted) {
          this.warmUpStarted = true
          piper.warmUp(options?.onProgress)
        }
      }
    }

    const ok = this.webSpeech.speak(trimmed)
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

  dispose(): void {
    try {
      this.piper?.dispose()
    } catch {
      // Ignore.
    }
    this.piper = null
    this.webSpeech.cancel()
  }
}

let singleton: CompositePronunciationService | null = null

export function getPronunciationService(): PronunciationProvider {
  if (!singleton) singleton = new CompositePronunciationService()
  return singleton
}
