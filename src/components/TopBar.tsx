import type { ReactNode } from 'react'
import { ChevronLeftIcon } from './Icons'
import styles from './TopBar.module.css'

interface TopBarProps {
  showBack?: boolean
  onBack?: () => void
  right?: ReactNode
}

export function TopBar({ showBack = false, onBack, right }: TopBarProps) {
  return (
    <header className={styles.header}>
      <div className={styles.side}>
        {showBack && (
          <button className={styles.backButton} onClick={onBack} aria-label="Go back">
            <ChevronLeftIcon size={22} />
          </button>
        )}
      </div>

      <h1 className={styles.brand}>Flashy</h1>

      <div className={`${styles.side} ${styles.sideEnd}`}>{right}</div>
    </header>
  )
}
