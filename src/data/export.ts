import { db } from './db'
import type { AppExport, Deck, Flashcard, ReviewEvent } from './types'
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from './types'

export async function exportData(): Promise<AppExport> {
  const [decks, cards, reviewEvents, settings] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviewEvents.toArray(),
    db.settings.get('main'),
  ])

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    decks,
    cards,
    reviewEvents,
    settings: settings ?? { ...DEFAULT_SETTINGS },
  }
}

function validateExport(data: unknown): data is AppExport {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>

  if (typeof obj.schemaVersion !== 'number') return false
  if (typeof obj.exportedAt !== 'number') return false
  if (!Array.isArray(obj.decks)) return false
  if (!Array.isArray(obj.cards)) return false
  if (!Array.isArray(obj.reviewEvents)) return false
  if (typeof obj.settings !== 'object' || obj.settings === null) return false

  for (const deck of obj.decks) {
    if (typeof deck !== 'object' || deck === null) return false
    const d = deck as Record<string, unknown>
    if (typeof d.id !== 'string' || typeof d.name !== 'string') return false
  }

  for (const card of obj.cards) {
    if (typeof card !== 'object' || card === null) return false
    const c = card as Record<string, unknown>
    if (typeof c.id !== 'string' || typeof c.deckId !== 'string') return false
    if (typeof c.front !== 'string' || typeof c.back !== 'string') return false
    if (typeof c.box !== 'number') return false
  }

  for (const event of obj.reviewEvents) {
    if (typeof event !== 'object' || event === null) return false
    const e = event as Record<string, unknown>
    if (typeof e.id !== 'string' || typeof e.cardId !== 'string') return false
    if (e.result !== 'correct' && e.result !== 'incorrect') return false
  }

  return true
}

export async function importData(jsonString: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = JSON.parse(jsonString)

    if (!validateExport(data)) {
      return { success: false, error: 'Invalid backup file format.' }
    }

    if (data.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return { success: false, error: 'This backup was created with a newer version of Flashy.' }
    }

    await db.transaction('rw', [db.decks, db.cards, db.reviewEvents, db.settings], async () => {
      await db.decks.clear()
      await db.cards.clear()
      await db.reviewEvents.clear()

      const decks: Deck[] = data.decks.map((d: Omit<Deck, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }) => ({
        ...d,
        createdAt: d.createdAt ?? Date.now(),
        updatedAt: d.updatedAt ?? Date.now(),
      }))

      const cards: Flashcard[] = data.cards.map((c: Omit<Flashcard, 'createdAt' | 'updatedAt' | 'reviewCount' | 'correctCount' | 'incorrectCount'> & { createdAt?: number; updatedAt?: number; reviewCount?: number; correctCount?: number; incorrectCount?: number }) => ({
        ...c,
        createdAt: c.createdAt ?? Date.now(),
        updatedAt: c.updatedAt ?? Date.now(),
        reviewCount: c.reviewCount ?? 0,
        correctCount: c.correctCount ?? 0,
        incorrectCount: c.incorrectCount ?? 0,
      }))

      const events: ReviewEvent[] = data.reviewEvents.map((e: Omit<ReviewEvent, 'timestamp'> & { timestamp?: number }) => ({
        ...e,
        timestamp: e.timestamp ?? Date.now(),
      }))

      await db.decks.bulkPut(decks)
      await db.cards.bulkPut(cards)
      await db.reviewEvents.bulkPut(events)
      await db.settings.put(data.settings)
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Failed to parse backup file.' }
  }
}
