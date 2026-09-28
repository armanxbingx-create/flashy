import type { CSSProperties } from 'react'
import styles from './FiveBoxCard.module.css'

interface BoxData {
  count: number
}

interface FiveBoxCardProps {
  boxes: readonly BoxData[]
  priorityBox?: number | null
  selectedBox?: number | null
  compact?: boolean
  showDistribution?: boolean
  onBoxClick?: (boxNumber: number) => void
  className?: string
  style?: CSSProperties
}

export function FiveBoxCard({
  boxes,
  priorityBox = null,
  selectedBox = null,
  compact = false,
  showDistribution = true,
  onBoxClick,
  className = '',
  style,
}: FiveBoxCardProps) {
  const total = boxes.reduce((sum, b) => sum + b.count, 0)

  return (
    <div
      className={`${styles.container} ${compact ? styles.compact : ''} ${className}`}
      style={style}
    >
      {boxes.map((box, i) => {
        const boxNum = i + 1
        const isPriority = priorityBox === boxNum
        const isSelected = selectedBox === boxNum
        const isEmpty = box.count === 0
        const isClickable = !!onBoxClick
        const count = box.count

        return (
          <div key={boxNum} className={styles.boxRow}>
            <div
              className={[
                styles.box,
                isPriority ? styles.priority : '',
                isSelected ? styles.selected : '',
                isEmpty ? styles.boxEmpty : '',
                isClickable ? styles.clickable : '',
              ].filter(Boolean).join(' ')}
              onClick={isClickable ? () => onBoxClick(boxNum) : undefined}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              aria-pressed={isClickable ? isSelected : undefined}
              onKeyDown={isClickable ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onBoxClick(boxNum)
                }
              } : undefined}
            >
              <span className={styles.boxIndex}>Box {boxNum}</span>
              <span className={styles.boxCount}>
                {count} {count === 1 ? 'word' : 'words'}
              </span>
            </div>
          </div>
        )
      })}

      {showDistribution && total > 0 && (
        <div className={styles.distribution} aria-hidden="true">
          {boxes.map((box, i) => (
            <div
              key={i}
              className={`${styles.segment} ${priorityBox === i + 1 ? styles.segmentActive : ''}`}
              style={{ flex: box.count || 0 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
