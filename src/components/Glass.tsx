import type { ReactNode, CSSProperties } from 'react'
import styles from './Glass.module.css'

interface GlassProps {
  children: ReactNode
  strong?: boolean
  className?: string
  style?: CSSProperties
  radius?: string
}

export function Glass({ children, strong = false, className = '', style, radius }: GlassProps) {
  const classes = [
    styles.glass,
    strong ? styles.glassStrong : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={{
        borderRadius: radius || 'var(--radius-md)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
