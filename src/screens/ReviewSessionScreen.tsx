import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '../router/context'
import { Flashcard } from '../components/Flashcard'
import { Button } from '../components/Button'
import { TopBar } from '../components/TopBar'
import { fiveBoxEngine } from '../learning'
import { cardRepository, reviewEventRepository } from '../data'
import type { Flashcard as FlashcardType } from '../data'
import styles from './ReviewSessionScreen.module.css'

interface ReviewSessionState {
  cards: FlashcardType[]
  currentIndex: number
  reviewedCount: number
  correctCount: number
  incorrectCount: number
  finished: boolean
}

export function ReviewSessionScreen() {
  const { params, goBack } = useRouter()
  const deckId = params.deckId ?? ''
  const requestedBox = params.box ? Number(params.box) : null
  const [session, setSession] = useState<ReviewSessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [isReviewing, setIsReviewing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const cards = await cardRepository.getByDeck(deckId)

      // Determine which box to review
      let targetBox = requestedBox
      if (targetBox === null || targetBox < 1 || targetBox > 5) {
        // No specific box requested — use priority box
        targetBox = fiveBoxEngine.getPriorityBox(cards)
      }

      if (targetBox === null) {
        // No cards at all
        if (!cancelled) {
          setSession({ cards: [], currentIndex: 0, reviewedCount: 0, correctCount: 0, incorrectCount: 0, finished: true })
          setLoading(false)
        }
        return
      }

      const boxCards = cards.filter((c) => c.box === targetBox)
      if (!cancelled) {
        setSession({
          cards: boxCards,
          currentIndex: 0,
          reviewedCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          finished: boxCards.length === 0,
        })
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [deckId, requestedBox])

  const handleReview = useCallback(async (result: 'correct' | 'incorrect') => {
    if (!session || session.finished || isReviewing) return
    setIsReviewing(true)

    try {
      const card = session.cards[session.currentIndex]
      const reviewResult = fiveBoxEngine.reviewCard(card, result)

      // Update card in database
      await cardRepository.update(card.id, {
        box: reviewResult.nextBox,
        lastReviewedAt: Date.now(),
        reviewCount: card.reviewCount + 1,
        correctCount: card.correctCount + (result === 'correct' ? 1 : 0),
        incorrectCount: card.incorrectCount + (result === 'incorrect' ? 1 : 0),
      })

      // Record review event
      await reviewEventRepository.create({
        cardId: card.id,
        deckId,
        previousBox: reviewResult.previousBox,
        nextBox: reviewResult.nextBox,
        result,
      })

      // Update local card state
      const updatedCard = { ...card, box: reviewResult.nextBox }
      const newCards = [...session.cards]
      newCards[session.currentIndex] = updatedCard

      const nextIndex = session.currentIndex + 1
      const finished = nextIndex >= session.cards.length

      setSession({
        ...session,
        cards: newCards,
        currentIndex: nextIndex,
        reviewedCount: session.reviewedCount + 1,
        correctCount: session.correctCount + (result === 'correct' ? 1 : 0),
        incorrectCount: session.incorrectCount + (result === 'incorrect' ? 1 : 0),
        finished,
      })
    } finally {
      setIsReviewing(false)
    }
  }, [session, deckId, isReviewing])

  if (loading || !session) {
    return (
      <div className={styles.screen}>
        <TopBar showBack onBack={goBack} />
        <div className={styles.content}>
          <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const currentCard = session.cards[session.currentIndex]
  const progressPercent = session.cards.length > 0
    ? Math.round((session.reviewedCount / session.cards.length) * 100)
    : 0

  return (
    <div className={styles.screen}>
      <TopBar
        showBack
        onBack={goBack}
        right={
          <span className={styles.progressText}>
            {session.reviewedCount}/{session.cards.length}
          </span>
        }
      />

      {/* Progress bar */}
      {!session.finished && (
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <div className={styles.content}>
        {session.finished ? (
          <div className={styles.completedState}>
            <div className={styles.completedIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={styles.completedTitle}>Session Complete</div>
            <div className={styles.completedStats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{session.reviewedCount}</span>
                <span className={styles.statLabel}>Reviewed</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{session.correctCount}</span>
                <span className={styles.statLabel}>Correct</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{session.incorrectCount}</span>
                <span className={styles.statLabel}>Incorrect</span>
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={goBack} style={{ width: '100%', marginTop: 'var(--space-2xl)' }}>
              Done
            </Button>
          </div>
        ) : currentCard ? (
          <div className={styles.cardArea}>
            <Flashcard
              key={currentCard.id}
              front={currentCard.front}
              back={currentCard.back}
              progress={currentCard.box - 1}
              totalProgress={5}
              onCorrect={() => handleReview('correct')}
              onIncorrect={() => handleReview('incorrect')}
            />
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No cards to review</div>
            <div className={styles.emptyDesc}>All cards in this deck are mastered or the deck is empty.</div>
            <Button variant="primary" size="md" onClick={goBack} style={{ marginTop: 'var(--space-xl)' }}>
              Go Back
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
