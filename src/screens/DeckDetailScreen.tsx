import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '../router/context'
import { Button } from '../components/Button'
import { Sheet } from '../components/Sheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FiveBoxCard } from '../components/FiveBoxCard'
import { PlusIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { fiveBoxEngine } from '../learning'
import { deckRepository, cardRepository, reviewEventRepository } from '../data'
import type { Deck, Flashcard } from '../data'
import styles from './DeckDetailScreen.module.css'

interface DeckData {
  deck: Deck
  cards: Flashcard[]
  boxCounts: Record<number, number>
  totalCards: number
  masteredCount: number
  priorityBox: number | null
}

function emptyBoxes(): { count: number }[] {
  return [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }]
}

export function DeckDetailScreen() {
  const { params, goBack, navigate } = useRouter()
  const [data, setData] = useState<DeckData | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit deck state
  const [showEditDeck, setShowEditDeck] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingDeck, setSavingDeck] = useState(false)

  // Delete deck state
  const [showDeleteDeck, setShowDeleteDeck] = useState(false)
  const [deletingDeck, setDeletingDeck] = useState(false)

  // Edit card state
  const [showEditCard, setShowEditCard] = useState(false)
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null)
  const [editCardFront, setEditCardFront] = useState('')
  const [editCardBack, setEditCardBack] = useState('')
  const [savingCard, setSavingCard] = useState(false)

  // Delete card state
  const [showDeleteCard, setShowDeleteCard] = useState(false)
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null)
  const [confirmingCardDelete, setConfirmingCardDelete] = useState(false)

  const deckId = params.deckId ?? ''

  const loadData = useCallback(async () => {
    if (!deckId) return
    const deck = await deckRepository.getById(deckId)
    if (!deck) return
    const cards = await cardRepository.getByDeck(deckId)
    const boxCounts = fiveBoxEngine.getBoxCounts(cards)
    setData({
      deck,
      cards,
      boxCounts: boxCounts as Record<number, number>,
      totalCards: cards.length,
      masteredCount: boxCounts[5],
      priorityBox: fiveBoxEngine.getPriorityBox(cards),
    })
    setLoading(false)
  }, [deckId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await loadData()
      if (cancelled) return
    }
    load()
    return () => { cancelled = true }
  }, [loadData])

  // Deck editing
  const handleOpenEditDeck = () => {
    if (!data) return
    setEditName(data.deck.name)
    setEditDesc(data.deck.description ?? '')
    setShowEditDeck(true)
  }

  const handleSaveDeck = async () => {
    if (!editName.trim()) return
    setSavingDeck(true)
    try {
      await deckRepository.update(deckId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      })
      setShowEditDeck(false)
      await loadData()
    } finally {
      setSavingDeck(false)
    }
  }

  // Deck deletion
  const handleDeleteDeck = async () => {
    setDeletingDeck(true)
    try {
      await reviewEventRepository.deleteByDeck(deckId)
      await cardRepository.deleteByDeck(deckId)
      await deckRepository.delete(deckId)
      setShowDeleteDeck(false)
      goBack()
    } finally {
      setDeletingDeck(false)
    }
  }

  // Card editing
  const handleOpenEditCard = (card: Flashcard) => {
    setEditingCard(card)
    setEditCardFront(card.front)
    setEditCardBack(card.back)
    setShowEditCard(true)
  }

  const handleSaveCard = async () => {
    if (!editingCard || !editCardFront.trim() || !editCardBack.trim()) return
    setSavingCard(true)
    try {
      await cardRepository.update(editingCard.id, {
        front: editCardFront.trim(),
        back: editCardBack.trim(),
      })
      setShowEditCard(false)
      setEditingCard(null)
      await loadData()
    } finally {
      setSavingCard(false)
    }
  }

  // Card deletion
  const handleDeleteCard = async () => {
    if (!deletingCard) return
    setConfirmingCardDelete(true)
    try {
      await cardRepository.delete(deletingCard.id)
      setShowDeleteCard(false)
      setDeletingCard(null)
      await loadData()
    } finally {
      setConfirmingCardDelete(false)
    }
  }

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

  const boxes = emptyBoxes().map((_, i) => ({ count: data.boxCounts[i + 1] }))
  const box5Percent = data.totalCards > 0 ? Math.round((data.masteredCount / data.totalCards) * 100) : 0

  return (
    <div className={styles.screen}>
      <TopBar
        showBack
        onBack={goBack}
        right={
          <button className={styles.menuButton} onClick={handleOpenEditDeck} aria-label="Edit deck">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        }
      />

      <div className={styles.content}>
        <div className={styles.deckHeader}>
          <h2 className={styles.deckTitle}>{data.deck.name}</h2>
        </div>

        {/* Stats */}
        <div className={styles.deckStats}>
          <div className={styles.deckStat}>
            <div className={styles.deckStatValue}>{data.totalCards}</div>
            <div className={styles.deckStatLabel}>Cards</div>
          </div>
          <div className={styles.deckStat}>
            <div className={styles.deckStatValue}>{data.masteredCount}</div>
            <div className={styles.deckStatLabel}>Mastered</div>
          </div>
          <div className={styles.deckStat}>
            <div className={styles.deckStatValue}>{box5Percent}%</div>
            <div className={styles.deckStatLabel}>Box 5</div>
          </div>
        </div>

        {/* Five box overview */}
        <FiveBoxCard
          boxes={boxes}
          priorityBox={data.priorityBox}
          showDistribution
          onBoxClick={(box) => navigate('box-overview', { deckId, box: String(box) })}
        />

        {/* Action bar */}
        <div className={styles.actionBar}>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('review-session', { deckId })}
            style={{ flex: 1 }}
          >
            Review
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<PlusIcon size={18} />}
            onClick={() => navigate('card-editor', { deckId })}
            style={{ flex: 1 }}
          >
            New Card
          </Button>
        </div>

        {/* Card list */}
        <div className={styles.cardListHeader}>
          <span className={styles.cardListTitle}>Cards</span>
        </div>

        <div className={styles.cardList}>
          {data.cards.map((card) => (
            <div
              key={card.id}
              className={styles.cardItem}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenEditCard(card)}
            >
              <span className={styles.cardFront}>{card.front}</span>
              <span className={styles.cardBack}>{card.back}</span>
              <span className={styles.cardBox} aria-label={`Box ${card.box}`}>{card.box}</span>
            </div>
          ))}
          {data.cards.length === 0 && (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-dim)', fontSize: 'var(--text-sm)' }}>
              No cards in this deck yet.
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className={styles.dangerZone}>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteDeck(true)}
          >
            Delete Deck
          </Button>
        </div>
      </div>

      {/* Edit Deck Sheet */}
      <Sheet
        open={showEditDeck}
        title="Edit Deck"
        onClose={() => setShowEditDeck(false)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setShowEditDeck(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!editName.trim() || savingDeck}
              onClick={handleSaveDeck}
              style={{ flex: 1 }}
            >
              {savingDeck ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="edit-deck-name">Name</label>
          <input
            id="edit-deck-name"
            className={styles.fieldInput}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="edit-deck-desc">Description</label>
          <input
            id="edit-deck-desc"
            className={styles.fieldInput}
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
        </div>
      </Sheet>

      {/* Delete Deck Confirm */}
      <ConfirmDialog
        open={showDeleteDeck}
        title="Delete Deck"
        message={`Are you sure you want to delete "${data.deck.name}"? This will also delete all ${data.totalCards} cards in this deck. This cannot be undone.`}
        confirmLabel={deletingDeck ? 'Deleting...' : 'Delete'}
        destructive
        onConfirm={handleDeleteDeck}
        onCancel={() => setShowDeleteDeck(false)}
      />

      {/* Edit Card Sheet */}
      <Sheet
        open={showEditCard}
        title="Edit Card"
        onClose={() => setShowEditCard(false)}
        footer={
          <>
            <Button variant="danger" size="md" onClick={() => { setDeletingCard(editingCard); setShowEditCard(false); setShowDeleteCard(true) }} style={{ flex: '0 0 auto' }}>
              Delete
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="md" onClick={() => setShowEditCard(false)} style={{ flex: '0 0 auto' }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!editCardFront.trim() || !editCardBack.trim() || savingCard}
              onClick={handleSaveCard}
              style={{ flex: '0 0 auto' }}
            >
              {savingCard ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="edit-card-front">Front</label>
          <input
            id="edit-card-front"
            className={styles.fieldInput}
            type="text"
            value={editCardFront}
            onChange={(e) => setEditCardFront(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="edit-card-back">Back</label>
          <textarea
            id="edit-card-back"
            className={`${styles.fieldInput} ${styles.fieldTextarea}`}
            value={editCardBack}
            onChange={(e) => setEditCardBack(e.target.value)}
          />
        </div>
      </Sheet>

      {/* Delete Card Confirm */}
      <ConfirmDialog
        open={showDeleteCard}
        title="Delete Card"
        message={`Are you sure you want to delete "${deletingCard?.front}"? This cannot be undone.`}
        confirmLabel={confirmingCardDelete ? 'Deleting...' : 'Delete'}
        destructive
        onConfirm={handleDeleteCard}
        onCancel={() => { setShowDeleteCard(false); setDeletingCard(null) }}
      />
    </div>
  )
}
