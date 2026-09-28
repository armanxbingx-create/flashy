export type BoxNumber = 1 | 2 | 3 | 4 | 5

export interface Deck {
  id: string
  name: string
  description?: string
  isPrimary: boolean
  createdAt: number
  updatedAt: number
}

export interface Flashcard {
  id: string
  deckId: string
  front: string
  back: string
  box: BoxNumber
  createdAt: number
  updatedAt: number
  lastReviewedAt?: number
  reviewCount: number
  correctCount: number
  incorrectCount: number
}

export interface ReviewEvent {
  id: string
  cardId: string
  deckId: string
  previousBox: BoxNumber
  nextBox: BoxNumber
  result: 'correct' | 'incorrect'
  timestamp: number
}

export interface ReviewResult {
  previousBox: BoxNumber
  nextBox: BoxNumber
  result: 'correct' | 'incorrect'
}

export interface Settings {
  id: string
  theme: 'dark' | 'light' | 'system'
  learningAlgorithm: 'five-box'
  hapticsEnabled: boolean
  soundEnabled: boolean
  reducedMotion?: boolean
}

export interface AppExport {
  schemaVersion: number
  exportedAt: number
  decks: Deck[]
  cards: Flashcard[]
  reviewEvents: ReviewEvent[]
  settings: Settings
}

export const CURRENT_SCHEMA_VERSION = 1

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  theme: 'dark',
  learningAlgorithm: 'five-box',
  hapticsEnabled: true,
  soundEnabled: false,
}
