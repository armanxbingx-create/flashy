import { settingsRepository } from '../data/repositories/settingsRepository'

interface ToneOptions {
  notes: number[]
  step: number
  type: OscillatorType
  gain: number
}

/**
 * FeedbackSystem — optional sound + haptic feedback (project-spec §13).
 *
 * Visual feedback always works on its own; this system is progressive
 * enhancement only. Unsupported platform capabilities resolve to no-ops and
 * never throw.
 */
class FeedbackSystem {
  private hapticsEnabled = true
  private soundEnabled = false
  private audioContext: AudioContext | null = null
  private primed = false

  /** Read the persisted user preferences. Safe to call at startup. */
  async load(): Promise<void> {
    try {
      const settings = await settingsRepository.get()
      this.hapticsEnabled = settings.hapticsEnabled
      this.soundEnabled = settings.soundEnabled
    } catch {
      // Keep the defaults; feedback stays available.
    }
  }

  /** Update preferences without re-reading storage (used by Settings). */
  configure(hapticsEnabled: boolean, soundEnabled: boolean): void {
    this.hapticsEnabled = hapticsEnabled
    this.soundEnabled = soundEnabled
  }

  /**
   * Create the AudioContext inside a real user gesture so iOS Safari will let
   * it play later. Safe to call multiple times.
   */
  prime(): void {
    if (this.primed || typeof window === 'undefined') return
    this.primed = true
    const start = () => {
      this.getContext()
      window.removeEventListener('pointerdown', start, true)
      window.removeEventListener('keydown', start, true)
    }
    window.addEventListener('pointerdown', start, true)
    window.addEventListener('keydown', start, true)
  }

  success(): void {
    this.haptic([14])
    this.tone({ notes: [659.25, 987.77], step: 72, type: 'sine', gain: 0.05 })
  }

  error(): void {
    this.haptic([16, 42, 16])
    this.tone({ notes: [311.13, 233.08], step: 95, type: 'triangle', gain: 0.045 })
  }

  selection(): void {
    this.haptic([7])
    this.tone({ notes: [1174.66], step: 34, type: 'sine', gain: 0.03 })
  }

  private haptic(pattern: number | number[]): void {
    if (!this.hapticsEnabled) return
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern)
      }
    } catch {
      // Haptics unavailable — visual feedback already happened.
    }
  }

  private getContext(): AudioContext | null {
    try {
      if (!this.audioContext) {
        const w = window as unknown as {
          AudioContext?: typeof AudioContext
          webkitAudioContext?: typeof AudioContext
        }
        const Ctor = w.AudioContext ?? w.webkitAudioContext
        if (!Ctor) return null
        this.audioContext = new Ctor()
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => {})
      }
      return this.audioContext
    } catch {
      return null
    }
  }

  private tone(options: ToneOptions): void {
    if (!this.soundEnabled) return
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const step = options.step / 1000
      options.notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator()
        const amp = ctx.createGain()
        const start = ctx.currentTime + index * step
        const end = start + step

        oscillator.type = options.type
        oscillator.frequency.setValueAtTime(frequency, start)

        amp.gain.setValueAtTime(0, start)
        amp.gain.linearRampToValueAtTime(options.gain, start + 0.008)
        amp.gain.setValueAtTime(options.gain, Math.max(start + 0.01, end - 0.02))
        amp.gain.linearRampToValueAtTime(0, end)

        oscillator.connect(amp)
        amp.connect(ctx.destination)
        oscillator.start(start)
        oscillator.stop(end + 0.02)
      })
    } catch {
      // Audio unavailable — never break the review flow.
    }
  }
}

export const feedbackSystem = new FeedbackSystem()
