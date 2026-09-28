import type { ReactNode, CSSProperties } from 'react'
import styles from './SpectrumMaterial.module.css'

interface SpectrumMaterialProps {
  children: ReactNode
  active?: boolean
  subtle?: boolean
  className?: string
  style?: CSSProperties
}

export function SpectrumMaterial({
  children,
  active = false,
  subtle = false,
  className = '',
  style,
}: SpectrumMaterialProps) {
  const classes = [
    styles.wrapper,
    active ? styles.alwaysOn : '',
    subtle ? styles.subtle : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} data-active={active ? 'true' : 'false'} style={style}>
      <div className={styles.glow}>
        <div className={styles.spectrumBg} />
        <div className={styles.spectrumEdge} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
