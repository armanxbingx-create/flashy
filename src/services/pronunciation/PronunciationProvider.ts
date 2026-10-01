/**
 * PronunciationProvider — small abstraction over pronunciation engines.
 *
 * Primary: Piper (local neural TTS in a Web Worker).
 * Fallback: Web Speech API (existing iOS implementation, untouched behavior).
 *
 * No user text is ever sent to a cloud TTS API. The only network use is
 * downloading static model/runtime files once (see PiperProvider).
 */

export type PronunciationEngine = 'piper' | 'webspeech' | 'silent'

export interface PronunciationProgress {
  /** 0..1 when total is known, otherwise undefined. */
  fraction: number | undefined
  loaded: number
  total: number
}

export interface SpeakOptions {
  onProgress?: (progress: PronunciationProgress) => void
}

export interface PronunciationProvider {
  /**
   * Speak text. Resolves with the engine that actually produced audio.
   * Rejects only when neither engine could speak (caller may stay silent).
   */
  speak(text: string, options?: SpeakOptions): Promise<PronunciationEngine>
  /** Stop any in-flight pronunciation audio. Never throws. */
  cancel(): void
  /** Release worker/audio resources (e.g. on app teardown). Never throws. */
  dispose(): void
  /** True once Piper has a ready session (model cached + loaded). */
  readonly piperReady: boolean
}
