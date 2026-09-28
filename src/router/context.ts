import { createContext, useContext } from 'react'
import type { RouterContextValue } from './types'

export const RouterContext = createContext<RouterContextValue | null>(null)

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within RouterProvider')
  return ctx
}
