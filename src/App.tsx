import { useEffect } from 'react'
import { useRouter } from './router/context'
import { RouterProvider, TAB_SCREENS } from './router/RouterProvider'
import { ThemeProvider } from './theme/ThemeContext'
import { BottomNavigation } from './components/BottomNavigation'
import { LibraryIcon, StudyIcon, SettingsIcon } from './components/Icons'
import { feedbackSystem } from './feedback/FeedbackSystem'
import {
  StudyScreen,
  LibraryScreen,
  SettingsScreen,
  DeckDetailScreen,
  BoxOverviewScreen,
  ReviewSessionScreen,
  CardEditorScreen,
} from './screens'
import type { ScreenId } from './router/types'

const NAV_ITEMS = [
  { id: 'library', label: 'Library', icon: <LibraryIcon size={22} /> },
  { id: 'study', label: 'Study', icon: <StudyIcon size={22} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={22} /> },
]

const SCREEN_TO_TAB: Record<ScreenId, string> = {
  study: 'study',
  library: 'library',
  settings: 'settings',
  'deck-detail': 'library',
  'box-overview': 'study',
  'review-session': 'study',
  'card-editor': 'library',
}

function ScreenRouter() {
  const { screen, navigate } = useRouter()

  const handleNavigate = (id: string) => {
    navigate(TAB_SCREENS[id as keyof typeof TAB_SCREENS])
  }

  const renderScreen = () => {
    switch (screen) {
      case 'study':
        return <StudyScreen />
      case 'library':
        return <LibraryScreen />
      case 'settings':
        return <SettingsScreen />
      case 'deck-detail':
        return <DeckDetailScreen />
      case 'box-overview':
        return <BoxOverviewScreen />
      case 'review-session':
        return <ReviewSessionScreen />
      case 'card-editor':
        return <CardEditorScreen />
      default:
        return <StudyScreen />
    }
  }

  return (
    <div style={{ minHeight: '100dvh' }}>
      {renderScreen()}
      <BottomNavigation
        items={NAV_ITEMS}
        activeId={SCREEN_TO_TAB[screen] ?? 'study'}
        onNavigate={handleNavigate}
      />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    // Sound/haptics are progressive enhancement: prime the audio context on
    // the first gesture and load the persisted user preferences.
    feedbackSystem.prime()
    void feedbackSystem.load()
  }, [])

  return (
    <ThemeProvider>
      <RouterProvider>
        <ScreenRouter />
      </RouterProvider>
    </ThemeProvider>
  )
}
