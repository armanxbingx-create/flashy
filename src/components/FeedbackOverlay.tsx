import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { feedbackSystem } from '../feedback/FeedbackSystem'
import styles from './FeedbackOverlay.module.css'

interface FeedbackOverlayProps {
  type: 'correct' | 'incorrect' | null
  onDone?: () => void
  className?: string
  style?: CSSProperties
}

export function FeedbackOverlay({ type, onDone, className = '', style }: FeedbackOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!type) {
      setVisible(false)
      return
    }

    setVisible(true)

    // Optional sound + haptic feedback. Visual feedback above already happened.
    if (type === 'correct') {
      feedbackSystem.success()
    } else {
      feedbackSystem.error()
    }

    const timer = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 400)

    return () => clearTimeout(timer)
  }, [type, onDone])

  if (!type || !visible) return null

  return (
    <div
      className={`${styles.overlay} ${type === 'correct' ? styles.correct : styles.incorrect} ${className}`}
      style={style}
    >
      <div className={styles.icon}>
        {type === 'correct' ? (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
    </div>
  )
}
