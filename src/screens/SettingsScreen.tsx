import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronRightIcon, DownloadIcon, UploadIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { Sheet } from '../components/Sheet'
import { useTheme } from '../theme/ThemeContext'
import { settingsRepository, exportData, importData, cardRepository, reviewEventRepository, deckRepository } from '../data'
import { feedbackSystem } from '../feedback/FeedbackSystem'
import styles from './SettingsScreen.module.css'

const THEMES = [
  { value: 'dark' as const, label: 'Dark' },
  { value: 'light' as const, label: 'Light' },
  { value: 'system' as const, label: 'System' },
]

const ALGORITHMS = [
  { value: 'five-box' as const, label: 'Five Box', description: 'Leitner-style box progression' },
]

// ---------------------------------------------------------------------------
// TEMPORARY — TTS Diagnostics. Read-only inspection of the WebKit
// speechSynthesis voice list. Never calls speak/cancel/resume, never writes
// settings, never changes TTS behavior. Remove before release.
// ---------------------------------------------------------------------------
interface DiagnosticVoice {
  name: string
  lang: string
  voiceURI: string
  localService: boolean
  default: boolean
}

function readSpeechVoices(): DiagnosticVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  try {
    return window.speechSynthesis.getVoices().map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      localService: voice.localService,
      default: voice.default,
    }))
  } catch {
    return []
  }
}

// Read-only mirror of the voice-selection priority in Flashcard.handleSpeak.
// Any change to the priority there must be copied here (or vice versa).
function selectFlashyVoice(voices: DiagnosticVoice[]): DiagnosticVoice | null {
  return (
    voices.find(
      (voice) =>
        voice.name.toLowerCase().includes('allison') &&
        voice.lang.toLowerCase().startsWith('en'),
    ) ??
    voices.find((voice) => voice.lang.toLowerCase() === 'en-us') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ??
    null
  )
}

function TtsDiagnostics() {
  const [voices, setVoices] = useState<DiagnosticVoice[]>(() => readSpeechVoices())

  const refresh = useCallback(() => {
    setVoices(readSpeechVoices())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    synth.addEventListener('voiceschanged', refresh)
    return () => {
      synth.removeEventListener('voiceschanged', refresh)
    }
  }, [refresh])

  const available = typeof window !== 'undefined' && !!window.speechSynthesis
  const selected = selectFlashyVoice(voices)
  const allisonVoices = voices.filter((v) => v.name.toLowerCase().includes('allison'))
  const enhancedVoices = voices.filter((v) => v.name.toLowerCase().includes('enhanced'))
  const enUsCount = voices.filter((v) => v.lang.toLowerCase() === 'en-us').length
  const enCount = voices.filter((v) => v.lang.toLowerCase().startsWith('en')).length

  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>TEMPORARY — TTS Diagnostics</div>
      <div className={styles.groupCard}>
        <div className={`${styles.row} ${styles.rowInteractive}`} onClick={refresh}>
          <span className={styles.rowLabel}>Refresh Voices</span>
          <span className={styles.rowValue}>{voices.length} voices</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>speechSynthesis available</span>
          <span className={styles.rowValue}>{available ? 'YES' : 'NO'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Total voices</span>
          <span className={styles.rowValue}>{voices.length}</span>
        </div>
      </div>

      <div className={styles.groupTitle}>Selected Flashy voice</div>
      <div className={styles.groupCard}>
        {selected ? (
          <>
            <div className={styles.row}>
              <span className={styles.rowLabel}>name</span>
              <span className={styles.rowValueSmall}>{selected.name || '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>lang</span>
              <span className={styles.rowValueSmall}>{selected.lang || '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>voiceURI</span>
              <span className={styles.rowValueSmall}>{selected.voiceURI || '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>localService</span>
              <span className={styles.rowValue}>{selected.localService ? 'YES' : 'NO'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>default</span>
              <span className={styles.rowValue}>{selected.default ? 'YES' : 'NO'}</span>
            </div>
          </>
        ) : (
          <div className={styles.diagNote}>
            No explicit voice selected; browser/iOS default is being used.
          </div>
        )}
      </div>

      <div className={styles.groupTitle}>Summary checks</div>
      <div className={styles.groupCard}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Allison found</span>
          <span className={styles.rowValue}>{allisonVoices.length > 0 ? 'YES' : 'NO'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Allison voices</span>
          <span className={styles.rowValueSmall}>
            {allisonVoices.length > 0 ? allisonVoices.map((v) => v.name).join(', ') : '—'}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Enhanced in name</span>
          <span className={styles.rowValue}>{enhancedVoices.length > 0 ? 'YES' : 'NO'}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Enhanced voices</span>
          <span className={styles.rowValueSmall}>
            {enhancedVoices.length > 0 ? enhancedVoices.map((v) => v.name).join(', ') : '—'}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>en-US voice count</span>
          <span className={styles.rowValue}>{enUsCount}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>en-* voice count</span>
          <span className={styles.rowValue}>{enCount}</span>
        </div>
      </div>

      <div className={styles.groupTitle}>Complete voice list</div>
      <div className={`${styles.groupCard} ${styles.diagScroll}`}>
        {voices.length === 0 ? (
          <div className={styles.diagNote}>
            No voices returned. On iOS the list loads asynchronously — tap Refresh Voices or wait for voiceschanged.
          </div>
        ) : (
          voices.map((voice, index) => (
            <div key={`${voice.voiceURI}-${voice.name}-${index}`} className={styles.diagVoice}>
              <div className={styles.diagVoiceName}>{voice.name || '(unnamed)'}</div>
              <div className={styles.diagVoiceMeta}>lang: {voice.lang || '—'}</div>
              <div className={styles.diagVoiceMeta}>voiceURI: {voice.voiceURI || '—'}</div>
              <div className={styles.diagVoiceMeta}>
                localService: {voice.localService ? 'YES' : 'NO'}
                {' · '}
                default: {voice.default ? 'YES' : 'NO'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const { theme, setTheme } = useTheme()
  const [haptics, setHaptics] = useState(true)
  const [sound, setSound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [stats, setStats] = useState({ decks: 0, cards: 0, reviews: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const settings = await settingsRepository.get()
      const decks = await deckRepository.getAll()
      const cards = await cardRepository.getAll()
      const reviews = await reviewEventRepository.count()
      if (!cancelled) {
        setHaptics(settings.hapticsEnabled)
        setSound(settings.soundEnabled)
        setStats({ decks: decks.length, cards: cards.length, reviews })
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleHapticsToggle = async () => {
    const next = !haptics
    setHaptics(next)
    feedbackSystem.configure(next, sound)
    await settingsRepository.update({ hapticsEnabled: next })
    if (next) feedbackSystem.selection()
  }

  const handleSoundToggle = async () => {
    const next = !sound
    setSound(next)
    feedbackSystem.configure(haptics, next)
    await settingsRepository.update({ soundEnabled: next })
    if (next) feedbackSystem.selection()
  }

  const handleThemeSelect = async (newTheme: 'dark' | 'light' | 'system') => {
    feedbackSystem.selection()
    setTheme(newTheme)
    setShowThemePicker(false)
  }

  const handleExport = async () => {
    try {
      const data = await exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flashy-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    }
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = await importData(text)
    if (result.success) {
      window.location.reload()
    } else {
      alert(result.error ?? 'Import failed.')
    }
    e.target.value = ''
  }

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

  const themeLabel = THEMES.find((t) => t.value === theme)?.label ?? 'Dark'

  return (
    <div className={styles.screen}>
      <TopBar />

      <div className={styles.content}>
        {/* Appearance */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>Appearance</div>
          <div className={styles.groupCard}>
            <div
              className={`${styles.row} ${styles.rowInteractive}`}
              onClick={() => setShowThemePicker(true)}
            >
              <span className={styles.rowLabel}>Theme</span>
              <span className={styles.rowValue}>
                {themeLabel}
                <ChevronRightIcon size={16} className={styles.rowChevron} />
              </span>
            </div>
          </div>
        </div>

        {/* Learning */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>Learning</div>
          <div className={styles.groupCard}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Algorithm</span>
              <span className={styles.rowValue}>
                {ALGORITHMS[0].label}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Description</span>
              <span className={styles.rowValueSmall}>
                {ALGORITHMS[0].description}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>Feedback</div>
          <div className={styles.groupCard}>
            <div className={`${styles.row} ${styles.rowInteractive}`} onClick={handleHapticsToggle}>
              <span className={styles.rowLabel}>Haptics</span>
              <button
                className={styles.toggle}
                data-on={haptics}
                aria-label="Toggle haptics"
              >
                <div className={styles.toggleKnob} />
              </button>
            </div>
            <div className={`${styles.row} ${styles.rowInteractive}`} onClick={handleSoundToggle}>
              <span className={styles.rowLabel}>Sound</span>
              <button
                className={styles.toggle}
                data-on={sound}
                aria-label="Toggle sound"
              >
                <div className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>Data</div>
          <div className={styles.groupCard}>
            <div className={`${styles.row} ${styles.rowInteractive}`} onClick={handleExport}>
              <span className={styles.rowLabel}>Export</span>
              <span className={styles.rowValue}>
                <DownloadIcon size={18} style={{ color: 'var(--color-text-dim)' }} />
              </span>
            </div>
            <div className={`${styles.row} ${styles.rowInteractive}`} onClick={handleImport}>
              <span className={styles.rowLabel}>Import</span>
              <span className={styles.rowValue}>
                <UploadIcon size={18} style={{ color: 'var(--color-text-dim)' }} />
              </span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* About */}
        <div className={styles.group}>
          <div className={styles.groupTitle}>About</div>
          <div className={styles.groupCard}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Version</span>
              <span className={styles.rowValue}>0.1.0</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Decks</span>
              <span className={styles.rowValue}>{stats.decks}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Cards</span>
              <span className={styles.rowValue}>{stats.cards}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Reviews</span>
              <span className={styles.rowValue}>{stats.reviews}</span>
            </div>
          </div>
        </div>

        <div className={styles.aboutText}>
          Flashy — A personal vocabulary learning instrument.
        </div>

        {/* TEMPORARY — TTS Diagnostics (remove before release) */}
        <TtsDiagnostics />
      </div>

      {/* Theme Picker Sheet */}
      <Sheet
        open={showThemePicker}
        title="Theme"
        onClose={() => setShowThemePicker(false)}
      >
        {THEMES.map((t) => (
          <div
            key={t.value}
            className={`${styles.themeOption} ${theme === t.value ? styles.themeOptionActive : ''}`}
            onClick={() => handleThemeSelect(t.value)}
          >
            <span className={styles.themeLabel}>{t.label}</span>
            {theme === t.value && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-spectrum-purple)' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        ))}
      </Sheet>
    </div>
  )
}
