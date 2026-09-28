import Dexie, { type EntityTable } from 'dexie'
import type { Deck, Flashcard, ReviewEvent, Settings } from './types'

class FlashyDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  cards!: EntityTable<Flashcard, 'id'>
  reviewEvents!: EntityTable<ReviewEvent, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('flashy')

    this.version(1).stores({
      decks: 'id, isPrimary, createdAt',
      cards: 'id, deckId, box, lastReviewedAt, createdAt',
      reviewEvents: 'id, cardId, deckId, timestamp',
      settings: 'id',
    })
  }
}

export const db = new FlashyDatabase()
