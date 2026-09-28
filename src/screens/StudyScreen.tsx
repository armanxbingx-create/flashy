import { useState, useEffect } from 'react'
import { useRouter } from '../router/context'
import { SpectrumMaterial } from '../components/SpectrumMaterial'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/Button'
import { ChevronRightIcon, LibraryIcon } from '../components/Icons'
import { fiveBoxEngine } from '../learning'
import { deckRepository, cardRepository } from '../data'
import type { Deck, Flashcard } from '../data'
import styles from './StudyScreen.module.css'

interface DeckWithStats extends Deck {
  cards: Flashcard[]
  cardCount: number
  box5Count: number
  box5Percent: number
  dueCount: number
}

export function StudyScreen() {
  const { navigate } = useRouter()
  const [decks, setDecks] = useState<DeckWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const allDecks = await deckRepository.getAll()
      const withStats = await Promise.all(
        allDecks.map(async (deck) => {
          const cards = await cardRepository.getByDeck(deck.id)
          const boxCounts = fiveBoxEngine.getBoxCounts(cards)
          const priorityBox = fiveBoxEngine.getPriorityBox(cards)
          const cardCount = cards.length
          return {
            ...deck,
            cards,
            cardCount,
            box5Count: boxCounts[5],
            box5Percent: cardCount > 0 ? Math.round((boxCounts[5] / cardCount) * 100) : 0,
            dueCount: priorityBox !== null ? boxCounts[priorityBox as 1 | 2 | 3 | 4 | 5] : 0,
          }
        })
      )
      if (!cancelled) {
        setDecks(withStats)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const primaryDeck = decks.find((d) => d.isPrimary)
  const otherDecks = decks.filter((d) => !d.isPrimary)

  const openDeck = (deckId: string) => navigate('box-overview', { deckId })

  if (loading) {
    return (
      <div className={styles.screen}>
        <TopBar />
        <div className={styles.content}>
          <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <TopBar />

      <div className={styles.content}>
        {/* Primary deck */}
        {primaryDeck && (
          <div className={styles.primaryDeck}>
            <SpectrumMaterial active style={{ borderRadius: 'var(--radius-lg)' }}>
              <div
                className={styles.primaryDeckCard}
                onClick={() => openDeck(primaryDeck.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openDeck(primaryDeck.id)
                  }
                }}
              >
                <div className={styles.primaryDeckIcon} aria-hidden="true">
                  {primaryDeck.name.charAt(0)}
                </div>
                <div className={styles.primaryDeckInfo}>
                  <div className={styles.primaryDeckTitle}>{primaryDeck.name}</div>
                  <div className={styles.primaryDeckMeta}>
                    {primaryDeck.cardCount} cards · {primaryDeck.box5Percent}% in Box 5
                  </div>
                  {primaryDeck.dueCount > 0 && (
                    <div className={styles.primaryDeckDue}>
                      {primaryDeck.dueCount} ready to review
                    </div>
                  )}
                </div>
                <ChevronRightIcon size={20} className={styles.primaryDeckChevron} />
              </div>
            </SpectrumMaterial>
          </div>
        )}

        {/* Other decks */}
        {otherDecks.length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Other Decks</span>
            </div>

            <div className={styles.deckList}>
              {otherDecks.map((deck) => (
                <div
                  key={deck.id}
                  className={styles.deckItem}
                  onClick={() => openDeck(deck.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openDeck(deck.id)
                    }
                  }}
                >
                  <div className={styles.deckIcon} aria-hidden="true">
                    {deck.name.charAt(0)}
                  </div>
                  <div className={styles.deckInfo}>
                    <div className={styles.deckName}>{deck.name}</div>
                    <div className={styles.deckMeta}>
                      {deck.cardCount} cards
                      {deck.dueCount > 0 && (
                        <span className={styles.deckDue}> · {deck.dueCount} due</span>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon size={18} className={styles.deckChevron} />
                </div>
              ))}
            </div>
          </>
        )}

        {decks.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <LibraryIcon size={28} />
            </div>
            <div className={styles.emptyTitle}>No decks yet</div>
            <div className={styles.emptyDesc}>Create your first deck in the Library to start learning.</div>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('library')}
              style={{ marginTop: 'var(--space-xl)' }}
            >
              Go to Library
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
