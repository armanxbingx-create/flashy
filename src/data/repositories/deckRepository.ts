import { db } from '../db'
import { newId } from '../id'
import type { Deck } from '../types'

export const deckRepository = {
  async getAll(): Promise<Deck[]> {
    return db.decks.toArray()
  },

  async getById(id: string): Promise<Deck | undefined> {
    return db.decks.get(id)
  },

  async getPrimary(): Promise<Deck | undefined> {
    return db.decks.where('isPrimary').equals(1).first()
  },

  async create(data: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deck> {
    const now = Date.now()
    const deck: Deck = {
      ...data,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    }
    await db.decks.add(deck)
    return deck
  },

  async update(id: string, changes: Partial<Pick<Deck, 'name' | 'description' | 'isPrimary'>>): Promise<void> {
    await db.decks.update(id, { ...changes, updatedAt: Date.now() })
  },

  async delete(id: string): Promise<void> {
    await db.decks.delete(id)
  },

  async count(): Promise<number> {
    return db.decks.count()
  },
}
