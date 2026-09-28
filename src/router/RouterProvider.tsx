import { useCallback, useMemo, useRef, useState } from 'react'
import { RouterContext } from './context'
import type { RouterState, ScreenId, TabId } from './types'

const TAB_SCREENS: Record<TabId, ScreenId> = {
  study: 'study',
  library: 'library',
  settings: 'settings',
}

function getTabForScreen(screen: ScreenId): TabId {
  if (screen === 'study' || screen === 'box-overview' || screen === 'review-session') return 'study'
  if (screen === 'library' || screen === 'deck-detail' || screen === 'card-editor') return 'library'
  return 'settings'
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RouterState>({
    screen: 'study',
    params: {},
  })
  const history = useRef<RouterState[]>([])

  const activeTab = getTabForScreen(state.screen)

  const navigate = useCallback((screen: ScreenId, params: Record<string, string> = {}) => {
    setState((prev) => {
      history.current.push(prev)
      return { screen, params }
    })
  }, [])

  const goBack = useCallback(() => {
    if (history.current.length > 0) {
      const prev = history.current.pop()!
      setState(prev)
    }
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      navigate,
      goBack,
      activeTab,
    }),
    [state, navigate, goBack, activeTab]
  )

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  )
}

export { TAB_SCREENS }
