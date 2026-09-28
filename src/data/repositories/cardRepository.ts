import { db } from '../db'
import { newId } from '../id'
import type { Flashcard, BoxNumber } from '../types'

export const cardRepository = {
  async getAll(): Promise<Flashcard[]> {
    return db.cards.toArray()
  },

  async getById(id: string): Promise<Flashcard | undefined> {
    return db.cards.get(id)
  },

  async getByDeck(deckId: string): Promise<Flashcard[]> {
    return db.cards.where('deckId').equals(deckId).toArray()
  },

  async getByBox(deckId: string, box: BoxNumber): Promise<Flashcard[]> {
    return db.cards.where('deckId').equals(deckId).filter((c) => c.box === box).toArray()
  },

  async countByDeck(deckId: string): Promise<number> {
    return db.cards.where('deckId').equals(deckId).count()
  },

  async countByBox(deckId: string): Promise<Record<BoxNumber, number>> {
    const cards = await db.cards.where('deckId').equals(deckId).toArray()
    const counts: Record<BoxNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const card of cards) {
      counts[card.box]++
    }
    return counts
  },

  async create(data: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'correctCount' | 'incorrectCount'>): Promise<Flashcard> {
    const now = Date.now()
    const card: Flashcard = {
      ...data,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
    }
    await db.cards.add(card)
    return card
  },

  async update(id: string, changes: Partial<Pick<Flashcard, 'front' | 'back' | 'box' | 'lastReviewedAt' | 'reviewCount' | 'correctCount' | 'incorrectCount'>>): Promise<void> {
    await db.cards.update(id, { ...changes, updatedAt: Date.now() })
  },

  async delete(id: string): Promise<void> {
    await db.cards.delete(id)
  },

  async deleteByDeck(deckId: string): Promise<void> {
    await db.cards.where('deckId').equals(deckId).delete()
  },

  async search(query: string): Promise<Flashcard[]> {
    const q = query.toLowerCase()
    return db.cards
      .filter((card) => card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q))
      .toArray()
  },
}
