/**
 * WebSpeechProvider — the existing Flashy iOS Web Speech implementation,
 * extracted verbatim from `Flashcard.handleSpeak` so behavior cannot regress.
 *
 * Keeps: en-US lang, Allison → en-US → en-* voice priority,
 * cancel() + resume() stuck-queue recovery, fully synchronous speak() inside
 * the tap gesture, silent no-op when unsupported.
 */

export class WebSpeechProvider {
  /**
   * Speak synchronously (must be called inside a user gesture on iOS).
   * Returns true if speech was requested, false if unavailable/empty.
   */
  speak(text: string): boolean {
    if (typeof window === 'undefined') return false
    const synth = window.speechSynthesis
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false
    const trimmed = text.trim()
    if (!trimmed) return false
    try {
      synth.cancel()
      // Recover from a paused/stuck speech queue on iOS.
      if (typeof synth.resume === 'function') synth.resume()
      const utterance = new SpeechSynthesisUtterance(trimmed)
      utterance.lang = 'en-US'
      const voices = synth.getVoices()
      const preferredVoice =
        voices.find(
          (voice) =>
            voice.name?.toLowerCase().includes('allison') &&
            voice.lang?.toLowerCase().startsWith('en'),
        ) ??
        voices.find((voice) => voice.lang?.toLowerCase() === 'en-us') ??
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'))
      if (preferredVoice) utterance.voice = preferredVoice
      synth.speak(utterance)
      return true
    } catch {
      return false
    }
  }

  cancel(): void {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    } catch {
      // Ignore — speech cleanup is best-effort.
    }
  }
}
