import type { Flashcard, BoxNumber, ReviewResult } from '../data/types'
import type { LearningEngine } from './LearningEngine'

export class FiveBoxLearningEngine implements LearningEngine {
  getPriorityBox(cards: Flashcard[]): number | null {
    const counts = this.getBoxCounts(cards)
    for (let i = 1; i <= 5; i++) {
      if (counts[i as BoxNumber] > 0) return i
    }
    return null
  }

  reviewCard(card: Flashcard, result: 'correct' | 'incorrect'): ReviewResult {
    const previousBox = card.box
    let nextBox: BoxNumber

    if (result === 'correct') {
      nextBox = previousBox < 5 ? ((previousBox + 1) as BoxNumber) : 5
    } else {
      nextBox = 1
    }

    return { previousBox, nextBox, result }
  }

  getBoxCounts(cards: Flashcard[]): Record<BoxNumber, number> {
    const counts: Record<BoxNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const card of cards) {
      counts[card.box]++
    }
    return counts
  }

  getProgress(cards: Flashcard[]): { total: number; mastered: number; masteredPercent: number } {
    const total = cards.length
    const mastered = cards.filter((c) => c.box === 5).length
    return {
      total,
      mastered,
      masteredPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
    }
  }
}

export const fiveBoxEngine = new FiveBoxLearningEngine()
