import { db } from './db'
import type { Deck, Flashcard } from './types'

const SEED_DECKS: Deck[] = [
  {
    id: 'deck-gre',
    name: 'GRE Vocabulary',
    description: 'Essential GRE vocabulary words',
    isPrimary: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'deck-japanese',
    name: 'Japanese N3',
    description: 'JLPT N3 vocabulary',
    isPrimary: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'deck-medical',
    name: 'Medical Terms',
    description: 'Common medical terminology',
    isPrimary: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const SEED_CARDS: Flashcard[] = [
  // GRE Vocabulary
  { id: 'card-1', deckId: 'deck-gre', front: 'ephemeral', back: 'lasting for a very short time', box: 2, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 3, correctCount: 2, incorrectCount: 1 },
  { id: 'card-2', deckId: 'deck-gre', front: 'ubiquitous', back: 'present, appearing, or found everywhere', box: 4, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 8, correctCount: 7, incorrectCount: 1 },
  { id: 'card-3', deckId: 'deck-gre', front: 'pragmatic', back: 'dealing with things sensibly and realistically', box: 1, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 1, correctCount: 0, incorrectCount: 1 },
  { id: 'card-4', deckId: 'deck-gre', front: 'ambiguous', back: 'open to more than one interpretation', box: 3, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 5, correctCount: 4, incorrectCount: 1 },
  { id: 'card-5', deckId: 'deck-gre', front: 'resilient', back: 'able to recover quickly from difficulties', box: 5, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 10, correctCount: 10, incorrectCount: 0 },
  { id: 'card-6', deckId: 'deck-gre', front: 'eloquent', back: 'fluent or persuasive in speaking or writing', box: 3, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 4, correctCount: 3, incorrectCount: 1 },
  { id: 'card-7', deckId: 'deck-gre', front: 'benevolent', back: 'well-meaning and kindly', box: 2, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 2, correctCount: 1, incorrectCount: 1 },
  { id: 'card-8', deckId: 'deck-gre', front: 'diligent', back: 'having or showing care in one\'s work', box: 4, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 6, correctCount: 6, incorrectCount: 0 },

  // Japanese N3
  { id: 'card-9', deckId: 'deck-japanese', front: '勉強 (べんきょう)', back: 'study; effort', box: 1, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 0, correctCount: 0, incorrectCount: 0 },
  { id: 'card-10', deckId: 'deck-japanese', front: '挑戦 (ちょうせん)', back: 'challenge; attempt', box: 2, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 2, correctCount: 1, incorrectCount: 1 },
  { id: 'card-11', deckId: 'deck-japanese', front: '経験 (けいけん)', back: 'experience', box: 3, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 4, correctCount: 3, incorrectCount: 1 },
  { id: 'card-12', deckId: 'deck-japanese', front: '成果 (せいか)', back: 'result; achievement', box: 1, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 1, correctCount: 0, incorrectCount: 1 },

  // Medical Terms
  { id: 'card-13', deckId: 'deck-medical', front: 'hypertension', back: 'abnormally high blood pressure', box: 2, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 2, correctCount: 1, incorrectCount: 1 },
  { id: 'card-14', deckId: 'deck-medical', front: 'bradycardia', back: 'abnormally slow heart rate', box: 1, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 0, correctCount: 0, incorrectCount: 0 },
  { id: 'card-15', deckId: 'deck-medical', front: 'hemoglobin', back: 'protein in red blood cells that carries oxygen', box: 4, createdAt: Date.now(), updatedAt: Date.now(), reviewCount: 7, correctCount: 7, incorrectCount: 0 },
]

export async function seedDatabase(): Promise<void> {
  const deckCount = await db.decks.count()
  if (deckCount > 0) return

  await db.transaction('rw', [db.decks, db.cards], async () => {
    await db.decks.bulkAdd(SEED_DECKS)
    await db.cards.bulkAdd(SEED_CARDS)
  })
}
