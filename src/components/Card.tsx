import type { ReactNode, CSSProperties } from 'react'
import styles from './Card.module.css'

interface CardProps {
  children: ReactNode
  interactive?: boolean
  compact?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

export function Card({
  children,
  interactive = false,
  compact = false,
  className = '',
  style,
  onClick,
}: CardProps) {
  const classes = [
    styles.card,
    interactive ? styles.cardInteractive : '',
    compact ? styles.cardCompact : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} style={style} onClick={onClick} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined}>
      {children}
    </div>
  )
}
