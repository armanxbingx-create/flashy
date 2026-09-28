export type TabId = 'study' | 'library' | 'settings'

export type ScreenId =
  | TabId
  | 'deck-detail'
  | 'box-overview'
  | 'review-session'
  | 'card-editor'

export interface RouterState {
  screen: ScreenId
  params: Record<string, string>
}

export interface RouterContextValue extends RouterState {
  navigate: (screen: ScreenId, params?: Record<string, string>) => void
  goBack: () => void
  activeTab: TabId
}
