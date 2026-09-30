import { useState, useRef, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'
import styles from './Flashcard.module.css'
import { Button } from './Button'
import { FeedbackOverlay } from './FeedbackOverlay'
import { settingsRepository } from '../data/repositories/settingsRepository'

interface FlashcardProps {
  front: string
  back: string
  progress?: number
  totalProgress?: number
  onCorrect?: () => void
  onIncorrect?: () => void
  onReveal?: () => void
  className?: string
  style?: CSSProperties
}

type SwipeState = 'idle' | 'swiping-left' | 'swiping-right' | 'exit-left' | 'exit-right' | 'enter'
type FeedbackType = 'correct' | 'incorrect' | null

export function Flashcard({
  front,
  back,
  progress = 0,
  totalProgress = 5,
  onCorrect,
  onIncorrect,
  onReveal,
  className = '',
  style,
}: FlashcardProps) {
  const [revealed, setRevealed] = useState(false)
  const [swipeState, setSwipeState] = useState<SwipeState>('enter')
  const [dragX, setDragX] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackType>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const isDragging = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (swipeState !== 'idle' && swipeState !== 'enter') return
    startX.current = e.clientX
    isDragging.current = true
    setDragX(0)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [swipeState])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - startX.current
    setDragX(dx)
    if (dx < -40) {
      setSwipeState('swiping-left')
    } else if (dx > 40) {
      setSwipeState('swiping-right')
    } else {
      setSwipeState('idle')
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    if (dragX > 80) {
      setSwipeState('exit-right')
      setFeedback('correct')
      setTimeout(() => {
        onCorrect?.()
        setRevealed(false)
        setDragX(0)
        setSwipeState('enter')
      }, 280)
    } else if (dragX < -80) {
      setSwipeState('exit-left')
      setFeedback('incorrect')
      setTimeout(() => {
        onIncorrect?.()
        setRevealed(false)
        setDragX(0)
        setSwipeState('enter')
      }, 280)
    } else {
      setSwipeState('idle')
      setDragX(0)
    }
  }, [dragX, onCorrect, onIncorrect])

  const handleReveal = () => {
    setRevealed(true)
    onReveal?.()
  }

  // Offline American-English pronunciation via the Web Speech API.
  // Gated on the existing Sound setting; no network, files, or dependencies.
  const handleSpeak = useCallback(async () => {
    try {
      const settings = await settingsRepository.get()
      if (!settings.soundEnabled) return
    } catch {
      return
    }
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return
    const text = front.trim()
    if (!text) return
    try {
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      const voices = synth.getVoices()
      const enUsVoice =
        voices.find((voice) => voice.lang?.toLowerCase() === 'en-us') ??
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'))
      if (enUsVoice) utterance.voice = enUsVoice
      synth.speak(utterance)
    } catch {
      // Speech synthesis unavailable — stay silent.
    }
  }, [front])

  // Stop any in-flight speech when the card unmounts (e.g. next card).
  useEffect(() => {
    return () => {
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel()
        }
      } catch {
        // Ignore — speech cleanup is best-effort.
      }
    }
  }, [])

  const handleCorrect = () => {
    setSwipeState('exit-right')
    setFeedback('correct')
    setTimeout(() => {
      onCorrect?.()
      setRevealed(false)
      setDragX(0)
      setSwipeState('enter')
    }, 280)
  }

  const handleIncorrect = () => {
    setSwipeState('exit-left')
    setFeedback('incorrect')
    setTimeout(() => {
      onIncorrect?.()
      setRevealed(false)
      setDragX(0)
      setSwipeState('enter')
    }, 280)
  }

  const cardClasses = [
    styles.card,
    swipeState === 'exit-right' ? styles.swipeExitRight : '',
    swipeState === 'exit-left' ? styles.swipeExitLeft : '',
    swipeState === 'enter' ? styles.cardEnter : '',
  ].filter(Boolean).join(' ')

  const containerClasses = [
    styles.container,
    swipeState === 'swiping-left' ? styles.swipingLeft : '',
    swipeState === 'swiping-right' ? styles.swipingRight : '',
    className,
  ].filter(Boolean).join(' ')

  const rotation = dragX * 0.05
  const cardStyle: CSSProperties = {
    transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
  }

  return (
    <>
      <FeedbackOverlay type={feedback} />
      <div className={containerClasses} style={style}>
        <div
          ref={cardRef}
          className={cardClasses}
          style={cardStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className={styles.surface}>
            <div className={styles.spectrumEdge} />

            {/* Progress */}
            <div className={styles.progress}>
              {Array.from({ length: totalProgress }, (_, i) => (
                <div
                  key={i}
                  className={`${styles.progressDot} ${i <= progress ? styles.progressDotFilled : ''}`}
                />
              ))}
            </div>

            {/* Front */}
            <div className={styles.wordRow}>
              <div className={styles.word}>{front}</div>
              <button
                type="button"
                className={styles.speakButton}
                onClick={handleSpeak}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`Hear pronunciation of ${front}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H2v6h4l5 4V5z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              </button>
            </div>

            {/* Back (revealed) */}
            {revealed && (
              <div className={styles.backContent}>{back}</div>
            )}

            {/* Swipe indicators */}
            <div className={`${styles.swipeIndicator} ${styles.swipeLeft}`}>Again</div>
            <div className={`${styles.swipeIndicator} ${styles.swipeRight}`}>Correct</div>

            {/* Reveal hint */}
            {!revealed && (
              <div className={styles.revealHint}>Tap to reveal</div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          <Button
            variant="danger"
            size="md"
            onClick={handleIncorrect}
            icon={<span style={{ fontSize: '18px' }}>&times;</span>}
          >
            Again
          </Button>
          {!revealed && (
            <Button variant="secondary" size="lg" onClick={handleReveal}>
              Reveal
            </Button>
          )}
          {revealed && (
            <Button
              variant="correct"
              size="md"
              onClick={handleCorrect}
              icon={<span style={{ fontSize: '16px' }}>&check;</span>}
            >
              Correct
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
