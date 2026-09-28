import type { Flashcard } from '../data/types'
import type { ReviewResult } from '../data/types'

export interface LearningEngine {
  getPriorityBox(cards: Flashcard[]): number | null
  reviewCard(card: Flashcard, result: 'correct' | 'incorrect'): ReviewResult
  getBoxCounts(cards: Flashcard[]): Record<number, number>
  getProgress(cards: Flashcard[]): { total: number; mastered: number; masteredPercent: number }
}
