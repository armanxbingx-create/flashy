import { db } from '../db'
import { newId } from '../id'
import type { ReviewEvent } from '../types'

export const reviewEventRepository = {
  async getAll(): Promise<ReviewEvent[]> {
    return db.reviewEvents.toArray()
  },

  async getByCard(cardId: string): Promise<ReviewEvent[]> {
    return db.reviewEvents.where('cardId').equals(cardId).toArray()
  },

  async getByDeck(deckId: string): Promise<ReviewEvent[]> {
    return db.reviewEvents.where('deckId').equals(deckId).toArray()
  },

  async create(data: Omit<ReviewEvent, 'id' | 'timestamp'>): Promise<ReviewEvent> {
    const event: ReviewEvent = {
      ...data,
      id: newId(),
      timestamp: Date.now(),
    }
    await db.reviewEvents.add(event)
    return event
  },

  async deleteByDeck(deckId: string): Promise<void> {
    await db.reviewEvents.where('deckId').equals(deckId).delete()
  },

  async count(): Promise<number> {
    return db.reviewEvents.count()
  },
}
