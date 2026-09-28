import { useState, useEffect } from 'react'
import { useRouter } from '../router/context'
import { Button } from '../components/Button'
import { TopBar } from '../components/TopBar'
import { FiveBoxCard } from '../components/FiveBoxCard'
import { fiveBoxEngine } from '../learning'
import { deckRepository, cardRepository } from '../data'
import type { Deck, Flashcard } from '../data'
import styles from './BoxOverviewScreen.module.css'

function emptyBoxes(): { count: number }[] {
  return [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }]
}

interface OverviewData {
  deck: Deck
  cards: Flashcard[]
  boxCounts: { count: number }[]
  priorityBox: number | null
  totalCards: number
  box5Percent: number
}

export function BoxOverviewScreen() {
  const { params, goBack, navigate } = useRouter()
  const requestedBox = params.box ? Number(params.box) : null
  const [data, setData] = useState<OverviewData | null>(null)
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const deckId = params.deckId
      if (!deckId) return
      const deck = await deckRepository.getById(deckId)
      if (!deck) return
      const cards = await cardRepository.getByDeck(deckId)
      const counts = fiveBoxEngine.getBoxCounts(cards)
      const priorityBox = fiveBoxEngine.getPriorityBox(cards)
      const totalCards = cards.length
      if (cancelled) return
      setData({
        deck,
        cards,
        boxCounts: emptyBoxes().map((_, i) => ({ count: counts[(i + 1) as 1 | 2 | 3 | 4 | 5] })),
        priorityBox,
        totalCards,
        box5Percent: totalCards > 0 ? Math.round((counts[5] / totalCards) * 100) : 0,
      })
      const validRequested =
        requestedBox !== null && requestedBox >= 1 && requestedBox <= 5 ? requestedBox : null
      setSelectedBox(validRequested ?? priorityBox)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [params.deckId, requestedBox])

  if (loading || !data) {
    return (
      <div className={styles.screen}>
        <TopBar showBack onBack={goBack} />
        <div className={styles.content}>
          <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const handleReview = () => {
    if (selectedBox === null) return
    navigate('review-session', { deckId: data.deck.id, box: String(selectedBox) })
  }

  return (
    <div className={styles.screen}>
      <TopBar showBack onBack={goBack} />

      <div className={styles.content}>
        <div className={styles.deckHeader}>
          <h2 className={styles.deckTitle}>{data.deck.name}</h2>
          <div className={styles.summary}>
            {data.totalCards} cards · {data.box5Percent}% in Box 5
          </div>
        </div>

        <FiveBoxCard
          boxes={data.boxCounts}
          priorityBox={data.priorityBox}
          selectedBox={selectedBox}
          showDistribution
          onBoxClick={setSelectedBox}
        />

        <div className={styles.actionBar}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleReview}
            disabled={selectedBox === null || data.totalCards === 0}
            style={{ width: '100%' }}
          >
            {selectedBox !== null ? `Review Box ${selectedBox}` : 'Select a Box'}
          </Button>
        </div>

        {data.totalCards === 0 && (
          <div className={styles.hint}>
            No cards yet. Add them from Library → Deck → New Flashcard.
          </div>
        )}
      </div>
    </div>
  )
}
