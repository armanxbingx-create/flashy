import { useState } from 'react'
import styles from './DesignPlayground.module.css'
import { Glass } from '../components/Glass'
import { SpectrumMaterial } from '../components/SpectrumMaterial'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { BottomNavigation } from '../components/BottomNavigation'
import { Flashcard } from '../components/Flashcard'
import { FiveBoxCard } from '../components/FiveBoxCard'
import { LibraryIcon, StudyIcon, SettingsIcon, PlusIcon, SearchIcon, ChevronRightIcon } from '../components/Icons'

const NAV_ITEMS = [
  { id: 'library', label: 'Library', icon: <LibraryIcon size={22} /> },
  { id: 'study', label: 'Study', icon: <StudyIcon size={22} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={22} /> },
]

const SAMPLE_BOXES = [
  { count: 12 },
  { count: 8 },
  { count: 15 },
  { count: 6 },
  { count: 20 },
] as const

export function DesignPlayground() {
  const [activeNav, setActiveNav] = useState('study')
  const [flashcardKey, setFlashcardKey] = useState(0)

  const handleCorrect = () => {
    setFlashcardKey((k) => k + 1)
  }

  const handleIncorrect = () => {
    setFlashcardKey((k) => k + 1)
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={`${styles.headerTitle} ${styles.spectrumText}`}>Flashy</h1>
        <p className={styles.headerSub}>Design System Playground</p>
      </header>

      {/* Colors */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Colors</h2>
          <p className={styles.sectionDesc}>Base palette and spectrum tokens</p>

          <div className={styles.swatchGrid}>
            {[
              { color: '#070912', label: 'Background' },
              { color: '#10141F', label: 'Surface' },
              { color: '#151A26', label: 'Surface 2' },
              { color: '#FF187F', label: 'Pink' },
              { color: '#DF12E8', label: 'Magenta' },
              { color: '#8D22FF', label: 'Purple' },
              { color: '#FF6415', label: 'Orange' },
              { color: '#FFC52A', label: 'Yellow' },
              { color: '#34D399', label: 'Correct' },
              { color: '#EF4444', label: 'Incorrect' },
              { color: '#9DA1B0', label: 'Muted' },
              { color: '#686D7B', label: 'Dim' },
            ].map((s) => (
              <div
                key={s.label}
                className={styles.swatch}
                style={{ background: s.color }}
              >
                <span className={styles.swatchLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Typography</h2>
          <p className={styles.sectionDesc}>System font stack, tight display tracking</p>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-display">Display</span>
            </div>
            <span className={styles.typeMeta}>40px / bold / -0.02em</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-h1">Heading 1</span>
            </div>
            <span className={styles.typeMeta}>32px / bold</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-h2">Heading 2</span>
            </div>
            <span className={styles.typeMeta}>24px / semibold</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-h3">Heading 3</span>
            </div>
            <span className={styles.typeMeta}>20px / semibold</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-body">Body text</span>
            </div>
            <span className={styles.typeMeta}>15px / regular</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-small">Small text</span>
            </div>
            <span className={styles.typeMeta}>13px / regular</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-caption text-muted">Caption</span>
            </div>
            <span className={styles.typeMeta}>11px / medium</span>
          </div>

          <div className={styles.typeRow}>
            <div className={styles.typeSample}>
              <span className="text-label text-dim">Label</span>
            </div>
            <span className={styles.typeMeta}>11px / semibold / uppercase</span>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Buttons</h2>
          <p className={styles.sectionDesc}>Primary actions, states, and sizes</p>

          <div className={styles.buttonRow}>
            <span className={styles.buttonRowLabel}>Variants</span>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="correct">Correct</Button>
          </div>

          <div className={styles.buttonRow}>
            <span className={styles.buttonRowLabel}>Sizes</span>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>
          </div>

          <div className={styles.buttonRow}>
            <span className={styles.buttonRowLabel}>With Icons</span>
            <Button variant="primary" icon={<PlusIcon size={18} />}>New Deck</Button>
            <Button variant="secondary" icon={<SearchIcon size={16} />}>Search</Button>
            <Button variant="secondary" icon={<ChevronRightIcon size={16} />} iconOnly />
          </div>
        </div>
      </section>

      {/* Glass Material */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Glass Material</h2>
          <p className={styles.sectionDesc}>Dark translucent glass with subtle borders</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Glass>
              <div className={styles.glassDemo}>
                <div className={styles.glassDemoText}>Default Glass</div>
                <div className={styles.glassDemoSub}>Dark translucent fill with subtle border and inner highlight</div>
              </div>
            </Glass>

            <Glass strong>
              <div className={styles.glassDemo}>
                <div className={styles.glassDemoText}>Strong Glass</div>
                <div className={styles.glassDemoSub}>Higher opacity for important surfaces</div>
              </div>
            </Glass>
          </div>
        </div>
      </section>

      {/* Spectrum Material */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Spectrum Material</h2>
          <p className={styles.sectionDesc}>Colored light behind dark glass - the signature brand effect</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <SpectrumMaterial active>
              <div className={styles.spectrumDemo}>
                <div className={styles.spectrumDemoText}>Primary Deck Card</div>
                <div className="text-small text-muted" style={{ marginTop: 'var(--space-xs)' }}>
                  Full spectrum glow with edge light
                </div>
              </div>
            </SpectrumMaterial>

            <SpectrumMaterial subtle>
              <div className={styles.spectrumDemo}>
                <div className={styles.spectrumDemoText}>Subtle Spectrum</div>
                <div className="text-small text-muted" style={{ marginTop: 'var(--space-xs)' }}>
                  Muted spectrum for secondary elements
                </div>
              </div>
            </SpectrumMaterial>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Cards</h2>
          <p className={styles.sectionDesc}>Dark surfaces with tactile geometry</p>

          <div className={styles.cardDemoRow}>
            <Card>
              <div style={{ padding: 'var(--space-xl)' }}>
                <div className="text-h3">Default Card</div>
                <div className="text-small text-muted" style={{ marginTop: 'var(--space-sm)' }}>
                  Dark surface with subtle border and rounded corners
                </div>
              </div>
            </Card>

            <Card interactive>
              <div style={{ padding: 'var(--space-xl)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="text-h3">Interactive Card</div>
                  <div className="text-small text-muted" style={{ marginTop: 'var(--space-xs)' }}>
                    Tap or click to interact
                  </div>
                </div>
                <ChevronRightIcon size={20} style={{ color: 'var(--color-text-dim)' }} />
              </div>
            </Card>

            <Card compact>
              <div style={{ padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '18px' }}>A</span>
                </div>
                <div>
                  <div className="text-body" style={{ fontWeight: 'var(--weight-medium)' }}>Compact Card</div>
                  <div className="text-small text-dim">Tighter spacing for lists</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Bottom Navigation */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Bottom Navigation</h2>
          <p className={styles.sectionDesc}>Dark glass nav with spectrum glow on active</p>

          <div className={styles.navDemo}>
            <div style={{ width: '100%', maxWidth: 400 }}>
              <BottomNavigation
                items={NAV_ITEMS}
                activeId={activeNav}
                onNavigate={setActiveNav}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Five-Box Cards */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Five-Box Cards</h2>
          <p className={styles.sectionDesc}>Learning box visualization with priority highlighting</p>

          <div className={styles.fiveBoxDemo}>
            <FiveBoxCard
              boxes={[...SAMPLE_BOXES]}
              priorityBox={1}
            />

            <FiveBoxCard
              boxes={[...SAMPLE_BOXES]}
              priorityBox={3}
              compact
            />
          </div>
        </div>
      </section>

      {/* Flashcard */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Flashcard</h2>
          <p className={styles.sectionDesc}>Primary learning interaction surface with swipe gestures</p>

          <div className={styles.flashcardDemo}>
            <Flashcard
              key={flashcardKey}
              front="ephemeral"
              back="lasting for a very short time"
              progress={2}
              totalProgress={5}
              onCorrect={handleCorrect}
              onIncorrect={handleIncorrect}
            />
          </div>
        </div>
      </section>

      {/* Spacing */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Spacing & Radii</h2>
          <p className={styles.sectionDesc}>Consistent scale for layout and geometry</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <div>
              <div className="text-label text-dim" style={{ marginBottom: 'var(--space-md)' }}>Spacing Scale</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-md)' }}>
                {[
                  { name: 'xs', value: 4 },
                  { name: 'sm', value: 8 },
                  { name: 'md', value: 12 },
                  { name: 'lg', value: 16 },
                  { name: 'xl', value: 20 },
                  { name: '2xl', value: 24 },
                  { name: '3xl', value: 32 },
                  { name: '4xl', value: 40 },
                  { name: '5xl', value: 48 },
                ].map((s) => (
                  <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    <div style={{ width: s.value, height: s.value, background: 'var(--color-spectrum-purple)', borderRadius: '4px', opacity: 0.6 }} />
                    <span className="text-caption text-dim">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-label text-dim" style={{ marginBottom: 'var(--space-md)' }}>Border Radii</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                {[
                  { name: 'sm', value: '12px' },
                  { name: 'md', value: '16px' },
                  { name: 'lg', value: '22px' },
                  { name: 'hero', value: '28px' },
                ].map((r) => (
                  <div key={r.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    <div style={{ width: 48, height: 48, background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: r.value }} />
                    <span className="text-caption text-dim">{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
