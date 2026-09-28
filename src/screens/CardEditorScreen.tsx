import { useState, useEffect } from 'react'
import { useRouter } from '../router/context'
import { Button } from '../components/Button'
import { TopBar } from '../components/TopBar'
import { cardRepository } from '../data'
import styles from './CardEditorScreen.module.css'

export function CardEditorScreen() {
  const { params, goBack } = useRouter()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const cardId = params.cardId
  const deckId = params.deckId ?? ''
  const isEditing = !!cardId

  useEffect(() => {
    if (!cardId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      const card = await cardRepository.getById(cardId)
      if (card && !cancelled) {
        setFront(card.front)
        setBack(card.back)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [cardId])

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) return

    setSaving(true)
    try {
      if (isEditing && cardId) {
        await cardRepository.update(cardId, {
          front: front.trim(),
          back: back.trim(),
        })
      } else {
        await cardRepository.create({
          deckId,
          front: front.trim(),
          back: back.trim(),
          box: 1,
        })
      }
      goBack()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.screen}>
        <TopBar showBack onBack={goBack} />
        <div className={styles.content}>
          <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <TopBar showBack onBack={goBack} />

      <div className={styles.content}>
        <h2 className={styles.formTitle}>{isEditing ? 'Edit Card' : 'New Card'}</h2>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="card-front">Front</label>
            <input
              id="card-front"
              className={styles.fieldInput}
              type="text"
              placeholder="Enter word or phrase"
              value={front}
              onChange={(e) => setFront(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="card-back">Back</label>
            <textarea
              id="card-back"
              className={`${styles.fieldInput} ${styles.fieldTextarea}`}
              placeholder="Enter definition or translation"
              value={back}
              onChange={(e) => setBack(e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <Button variant="ghost" size="md" onClick={goBack} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!front.trim() || !back.trim() || saving}
              onClick={handleSave}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
