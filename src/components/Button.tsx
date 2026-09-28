import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'correct'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  iconOnly?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    iconOnly ? styles.iconOnly : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} {...props}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {!iconOnly && children}
    </button>
  )
}
