import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '../router/context'
import { Button } from '../components/Button'
import { Sheet } from '../components/Sheet'
import { SearchIcon, PlusIcon, ChevronRightIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { deckRepository, cardRepository } from '../data'
import type { Deck, Flashcard } from '../data'
import styles from './LibraryScreen.module.css'

interface DeckWithCount extends Deck {
  cardCount: number
}

interface SearchResults {
  decks: DeckWithCount[]
  cards: (Flashcard & { deckName: string })[]
}

export function LibraryScreen() {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')
  const [decks, setDecks] = useState<DeckWithCount[]>([])
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const loadDecks = useCallback(async () => {
    const allDecks = await deckRepository.getAll()
    const withCounts = await Promise.all(
      allDecks.map(async (deck) => {
        const count = await cardRepository.countByDeck(deck.id)
        return { ...deck, cardCount: count }
      })
    )
    setDecks(withCounts)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await loadDecks()
      if (cancelled) return
    }
    load()
    return () => { cancelled = true }
  }, [loadDecks])

  // Search across decks and cards
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null)
      return
    }
    let cancelled = false
    async function doSearch() {
      const q = search.toLowerCase()
      const matchingDecks = decks.filter((d) => d.name.toLowerCase().includes(q))
      const allCards = await cardRepository.search(search)
      const deckMap = new Map(decks.map((d) => [d.id, d.name]))
      const matchingCards = allCards.map((c) => ({
        ...c,
        deckName: deckMap.get(c.deckId) ?? 'Unknown Deck',
      }))
      if (!cancelled) {
        setSearchResults({ decks: matchingDecks, cards: matchingCards })
      }
    }
    doSearch()
    return () => { cancelled = true }
  }, [search, decks])

  const filtered = searchResults
    ? searchResults.decks
    : decks

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await deckRepository.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        isPrimary: decks.length === 0,
      })
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      await loadDecks()
    } finally {
      setSaving(false)
    }
  }

  const handleOpenCreate = () => {
    setNewName('')
    setNewDesc('')
    setShowCreate(true)
  }

  return (
    <div className={styles.screen}>
      <TopBar />

      <div className={styles.content}>
        {/* Search */}
        <div className={styles.searchField}>
          <SearchIcon size={18} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search decks and cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* My Decks */}
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>My Decks</span>
          <Button variant="ghost" size="sm" icon={<PlusIcon size={16} />} onClick={handleOpenCreate}>
            New Deck
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading...</div>
        ) : filtered.length > 0 ? (
          <div className={styles.deckList}>
            {filtered.map((deck) => (
              <div
                key={deck.id}
                className={styles.deckItem}
                onClick={() => navigate('deck-detail', { deckId: deck.id })}
                role="button"
                tabIndex={0}
              >
                <div className={styles.deckIcon}>
                  {deck.name.charAt(0)}
                </div>
                <div className={styles.deckInfo}>
                  <div className={styles.deckName}>{deck.name}</div>
                  <div className={styles.deckMeta}>{deck.cardCount} cards</div>
                </div>
                <ChevronRightIcon size={18} className={styles.deckChevron} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <PlusIcon size={28} />
            </div>
            <div className={styles.emptyTitle}>No decks found</div>
            <div className={styles.emptyDesc}>
              {search ? 'Try a different search term.' : 'Create your first deck to start learning.'}
            </div>
          </div>
        )}

        {/* Search results: matching cards */}
        {searchResults && searchResults.cards.length > 0 && (
          <>
            <div className={styles.sectionHeader} style={{ marginTop: 'var(--space-2xl)' }}>
              <span className={styles.sectionTitle}>Matching Cards</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-dim)' }}>
                {searchResults.cards.length} found
              </span>
            </div>
            <div className={styles.deckList}>
              {searchResults.cards.map((card) => (
                <div
                  key={card.id}
                  className={styles.deckItem}
                  onClick={() => navigate('card-editor', { deckId: card.deckId, cardId: card.id })}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.deckIcon} style={{ background: 'var(--color-spectrum-purple)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}>
                    {card.box}
                  </div>
                  <div className={styles.deckInfo}>
                    <div className={styles.deckName}>{card.front}</div>
                    <div className={styles.deckMeta}>{card.deckName}</div>
                  </div>
                  <ChevronRightIcon size={18} className={styles.deckChevron} />
                </div>
              ))}
            </div>
          </>
        )}

        {search && searchResults && searchResults.decks.length === 0 && searchResults.cards.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No results</div>
            <div className={styles.emptyDesc}>Try a different search term.</div>
          </div>
        )}
      </div>

      {/* Create Deck Sheet */}
      <Sheet
        open={showCreate}
        title="New Deck"
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!newName.trim() || saving}
              onClick={handleCreate}
              style={{ flex: 1 }}
            >
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="deck-name">Name</label>
          <input
            id="deck-name"
            className={styles.fieldInput}
            type="text"
            placeholder="e.g. GRE Vocabulary"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="deck-desc">Description (optional)</label>
          <input
            id="deck-desc"
            className={styles.fieldInput}
            type="text"
            placeholder="Brief description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
      </Sheet>
    </div>
  )
}
