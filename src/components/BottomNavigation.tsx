import type { CSSProperties } from 'react'
import styles from './BottomNavigation.module.css'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

interface BottomNavigationProps {
  items: NavItem[]
  activeId: string
  onNavigate: (id: string) => void
  className?: string
  style?: CSSProperties
}

export function BottomNavigation({
  items,
  activeId,
  onNavigate,
  className = '',
  style,
}: BottomNavigationProps) {
  return (
    <nav className={`${styles.nav} ${className}`} style={style}>
      <div className={styles.navInner}>
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && <div className={styles.spectrumGlow} />}
              <div className={styles.navIcon}>{item.icon}</div>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
