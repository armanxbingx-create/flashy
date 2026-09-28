# Vocabulary App — Project Specification
Version: 0.1
Status: Pre-development / approved product direction
Primary target: iPhone 8 / iOS 16 Safari Home Screen PWA
Secondary target: modern iPhone Safari + desktop browsers for development/testing

---

## 1. Product Summary

Build a personal English vocabulary learning web app for one primary user.

The product is an offline-first Progressive Web App (PWA). The core learning experience must work without an internet connection. Online functionality is optional and modular.

The app is intentionally small, focused, tactile, premium, and mobile-first.

The primary mental model is:

- Library = where decks and flashcards are created/managed.
- Study = where learning happens.
- Settings = preferences, data management, and advanced/developer-facing options.

The application must NOT feel like a generic SaaS dashboard, an AI-generated template, or a gamified children's language-learning app.

---

# 2. Product Principles

## 2.1 Offline first

Local device data is the source of truth for the core app.

The following must work offline:

- Open the app.
- Open existing decks.
- Create decks.
- Edit/delete decks.
- Create flashcards.
- Edit/delete flashcards.
- Review flashcards.
- Move cards through the five learning boxes.
- Search locally stored cards/decks.
- View learning progress.
- Export data.
- Import previously exported backup data.

Internet is required only for optional online features such as:

- Online word search.
- Automatic linguistic information.
- Pronunciation/audio.
- Example sentences.
- Synonyms.
- Future LLM-powered features.

If online services fail, the application must continue working normally for the offline core.

---

# 3. Target Device and Compatibility

## 3.1 Primary device

Primary production target:

- iPhone 8
- iOS 16.x
- Safari / Home Screen PWA

Apple lists iPhone 8 and iPhone 8 Plus among devices compatible with iOS 16.

The application must therefore be designed against the capabilities and performance characteristics of iOS 16 Safari rather than assuming the latest iOS APIs.

## 3.2 Secondary development targets

The application must also work on:

- iPhone 16 / modern iOS Safari
- Desktop Chrome
- Desktop Safari
- Desktop Edge

Desktop is primarily a development/QA environment, not the primary UX target.

## 3.3 Browser strategy

Use standard web APIs and progressive enhancement.

Do NOT make the application dependent on APIs that are unavailable or inconsistent on older iOS Safari.

Feature detection is required before using optional APIs.

---

# 4. Performance Requirements for iPhone 8

The iPhone 8 is the performance constraint that governs implementation choices.

## 4.1 General rule

Prefer:

- small JavaScript bundles
- simple component trees
- CSS transforms
- CSS opacity transitions
- asynchronous IndexedDB access
- lazy loading of optional online features
- small optimized assets
- system fonts
- minimal third-party dependencies

Avoid:

- large UI frameworks
- unnecessary animation libraries
- huge icon packs
- video backgrounds
- large raster backgrounds
- continuously running JavaScript animation loops
- canvas-based UI where normal HTML/CSS is sufficient
- expensive particle systems
- complex 3D transforms
- unnecessary state re-renders

## 4.2 Animation rules

Animations should primarily use:

- `transform`
- `opacity`

Avoid animating:

- width
- height
- top/left
- box-shadow continuously
- expensive filter effects

Flashcard swipe animation must remain smooth on iPhone 8.

Animations should be short and purposeful.

Recommended ranges:

- micro feedback: 120–180ms
- normal UI transition: 180–260ms
- card movement: 220–320ms

Respect:

`prefers-reduced-motion`

When reduced motion is enabled, replace movement-heavy transitions with subtle opacity/state changes.

## 4.3 Blur / glass performance

The visual system uses dark glass, but glass must not become a performance problem.

Rules:

- `backdrop-filter` is progressive enhancement.
- Always provide an opaque/semi-opaque fallback background.
- Do not stack multiple backdrop filters.
- Do not use large blur radii on many simultaneous elements.
- Navigation may use one glass layer.
- A flashcard may use one glass layer.
- Ordinary list items should usually use solid dark surfaces rather than glass.

The visual result must remain acceptable if backdrop blur is unavailable.

---

# 5. Technology Architecture

## 5.1 Recommended stack

Use:

- TypeScript
- React
- Vite
- PWA support via a lightweight Vite PWA solution
- IndexedDB for application data
- Dexie (or an equally lightweight IndexedDB wrapper) for database access

Do NOT introduce a backend in V1.

Do NOT introduce authentication in V1.

Do NOT introduce a cloud database in V1.

## 5.2 Why React + Vite

The application contains enough interaction to benefit from component-based UI:

- flashcard gestures
- animated transitions
- deck state
- review state
- settings
- forms
- reusable design-system components

Vite keeps the build straightforward and lightweight.

Avoid adding large meta-frameworks unless a real requirement appears.

## 5.3 Routing

Do not introduce a heavy routing architecture for V1.

Use a simple client-side route/state model suitable for:

- Study
- Library
- Settings
- Deck detail
- Box overview
- Review session
- Card editor

If routing becomes more complex later, a dedicated router can be introduced.

---

# 6. Data Architecture

IndexedDB is the primary persistent store.

Do NOT use localStorage as the primary application database.

localStorage may only be used for tiny non-critical preferences if necessary.

## 6.1 Core entities

### Deck

```ts
Deck {
  id: string
  name: string
  description?: string
  isPrimary: boolean
  createdAt: number
  updatedAt: number
}
```

### Flashcard

```ts
Flashcard {
  id: string
  deckId: string
  front: string
  back: string

  box: 1 | 2 | 3 | 4 | 5

  createdAt: number
  updatedAt: number
  lastReviewedAt?: number

  reviewCount: number
  correctCount: number
  incorrectCount: number
}
```

### Review Event

```ts
ReviewEvent {
  id: string
  cardId: string
  deckId: string

  previousBox: 1 | 2 | 3 | 4 | 5
  nextBox: 1 | 2 | 3 | 4 | 5

  result: "correct" | "incorrect"

  timestamp: number
}
```

### Settings

```ts
Settings {
  theme: "dark" | "light" | "system"
  learningAlgorithm: "five-box"

  hapticsEnabled: boolean
  soundEnabled: boolean

  reducedMotion?: boolean
}
```

The schema must be versioned so future migrations are possible.

---

# 7. Backup / Import / Export

This is a critical feature.

The user must never be locked into the current implementation.

## 7.1 Export

Export a complete JSON backup containing:

- schema version
- decks
- flashcards
- current box state
- review statistics
- review history
- settings

Example:

```json
{
  "schemaVersion": 1,
  "exportedAt": 0,
  "decks": [],
  "cards": [],
  "reviewEvents": [],
  "settings": {}
}
```

## 7.2 Import

Import must:

1. Read JSON.
2. Validate schema.
3. Reject malformed/incompatible files safely.
4. Show a confirmation before replacing/merging data.
5. Preserve data integrity.
6. Never silently delete existing data.

V1 may support:

- Replace all data
- Merge/import as a new dataset

The exact UX can be finalized during implementation.

---

# 8. Learning Architecture

The V1 algorithm is Five-Box / Leitner-style.

However, the implementation must NOT hard-code learning logic directly into UI components.

Use a replaceable abstraction.

Example:

```ts
interface LearningEngine {
  getPriorityBox(cards: Flashcard[]): number | null

  reviewCard(
    card: Flashcard,
    result: "correct" | "incorrect"
  ): ReviewResult
}
```

V1 implementation:

```ts
FiveBoxLearningEngine
```

Future possibilities:

- SM-2
- FSRS
- custom algorithms

These should be addable without rebuilding the entire UI.

---

# 9. Five-Box Rules — V1

Initial state:

```text
New card → Box 1
```

Correct:

```text
Box 1 → Box 2
Box 2 → Box 3
Box 3 → Box 4
Box 4 → Box 5
Box 5 → Box 5
```

Incorrect:

```text
Any box → Box 1
```

This is the initial V1 rule.

Do not add complicated interval scheduling yet.

The product is currently about learning state and simple repetition, not a full research-grade SRS.

## 9.1 Priority box

Priority is always the lowest-numbered box containing at least one card.

Example:

```text
Box 1 = 0
Box 2 = 20
Box 3 = 30
Box 4 = 10
Box 5 = 5

Priority = Box 2
```

If all boxes are empty, there is nothing to study.

---

# 10. Main Navigation

Exactly three primary tabs:

```text
Library       Study       Settings
                  ●
```

Study is centered.

The navigation bar is dark glass with rounded corners.

The active Study icon receives the Spectrum Material treatment.

Do not add more primary tabs in V1.

---

# 11. Study

Study is the primary destination.

## 11.1 Study Home

Display:

- primary deck first
- other decks below
- number of cards
- percentage of cards in Box 5
- subtle indication when a deck has cards ready to study

Primary deck receives the stronger Spectrum Material treatment.

Other decks remain visually restrained.

## 11.2 Deck Overview

Selecting a deck opens:

- five learning boxes
- count in each box
- priority box highlight
- distribution chart

The priority box is visually emphasized.

## 11.3 Distribution chart

Use a simple donut/pie visualization.

The chart is secondary information.

The five-box interface is the primary learning information.

Avoid turning this page into a dashboard.

---

# 12. Flashcard Review UX

The review screen is a major interaction surface.

## 12.1 Front

Initially show:

- word/front
- progress indicator
- reveal control

## 12.2 Reveal

The back can be revealed using:

- Reveal button
- vertical gesture/scroll
- tap interaction if appropriate

V1 front/back content remains intentionally simple.

Future versions may add:

- pronunciation
- examples
- synonyms
- part of speech
- images
- richer metadata

## 12.3 Answer interaction

Primary gestures:

```text
Swipe left  → Incorrect
Swipe right → Correct
```

Explicit controls remain visible:

```text
× Again        ✓ Correct
```

The application must never require gesture discovery to function.

## 12.4 Feedback

Correct:

- card moves away positively
- next card enters
- subtle visual feedback
- optional haptic feedback

Incorrect:

- card moves away differently
- subtle error feedback
- optional haptic feedback

Never use aggressive animations.

---

# 13. Haptics

Haptics are optional progressive enhancement.

Do NOT make the application depend on the Web Vibration API.

Implement:

```ts
FeedbackSystem
```

with methods such as:

```ts
success()
error()
selection()
```

The implementation may use available platform capabilities.

If haptics are unavailable:

- do nothing
- visual feedback remains sufficient

Never throw errors because haptics are unsupported.

---

# 14. Library

Library manages user data.

## 14.1 Top area

A search field appears near the top.

V1:

- local search should work
- online search may be visually present but can remain disabled until online functionality is implemented

Search should eventually support:

- local cards
- online word lookup

## 14.2 My Decks

Heading:

`My Decks`

Action:

`+ New Deck`

Deck list should show:

- name
- number of cards
- optional progress indicator

## 14.3 Deck Detail

Selecting a deck shows:

- deck title
- card count
- `+ New Flashcard`
- flashcard list

Each card displays:

- front
- short back preview
- optional box indicator

---

# 15. Flashcard Creation

V1 editor:

```text
Front
[____________]

Back
[____________]

Save
```

Do not overbuild the editor.

Future online enrichment can add:

- pronunciation
- examples
- synonyms
- grammatical information

The saved result must always become a normal local Flashcard.

---

# 16. Settings

Settings should remain intentionally small.

## Appearance

- Dark
- Light
- System

Dark is the default.

## Learning

- Learning algorithm
- Future review settings

V1 only exposes:

`Five Box`

## Feedback

- Haptics
- Sound

## Data

- Export
- Import

## About / Advanced

Developer-oriented information can live here.

Do not expose technical implementation details elsewhere in the application.

---

# 17. Visual Design System

## 17.1 Overall aesthetic

Keywords:

- dark
- tactile
- premium
- editorial
- calm
- architectural
- modern
- precise
- playful only through material and motion

Do NOT make it:

- childish
- gamified
- SaaS-like
- dashboard-heavy
- generic AI UI

---

# 18. Color System

Base:

```text
Background: #070912
Surface:    #10141F
Surface 2:  #151A26
```

Spectrum:

```text
Pink:       #FF187F
Magenta:    #DF12E8
Purple:     #8D22FF
Orange:     #FF6415
Yellow:     #FFC52A
```

These values are starting tokens, not sacred pixel values.

The spectrum is a visual material.

Do not apply the complete spectrum to every component.

---

# 19. Spectrum Material

The signature brand language is:

```text
colored light
      ↓
blurred / diffused
      ↓
dark translucent glass
      ↓
subtle reflection
```

Use this for:

- primary deck
- active navigation
- important actions
- special feedback
- splash/loading
- selected states

Do not use it on every card.

---

# 20. Glass Rules

Glass is a material, not a default component style.

Glass may use:

- dark translucent fill
- subtle border
- controlled backdrop blur
- subtle internal highlight
- spectrum reflection

Glass must always have a non-glass fallback.

Do not create:

- glass everywhere
- nested glass
- huge blur layers
- excessive white borders
- excessive glow

---

# 21. Shape Language

No sharp UI corners.

Use:

- rounded cards
- rounded buttons
- rounded navigation
- rounded icon containers

Recommended tokens:

```text
small:  12–14px
medium: 16–18px
large:  22–24px
hero:   28–32px
nav:    26–30px
```

Do not turn every element into an enormous pill.

---

# 22. Typography

Use a system-first font stack appropriate to Apple devices.

Preferred:

- SF Pro / system UI where available
- fallback to standard system sans-serif

Avoid downloading a large webfont unless there is a compelling design reason.

Typography should have:

- strong display hierarchy
- tight display tracking
- restrained metadata
- high readability
- generous line-height for explanatory text

---

# 23. Icons

Icons should be:

- simple
- rounded
- consistent
- visually light
- suitable for small screens

Avoid huge icon libraries.

Prefer a small custom/icon set.

The active icon gets the Spectrum Material treatment.

---

# 24. Component Rules

Core components:

```text
AppShell
BottomNavigation
TopBar
DeckCard
DeckListItem
FlashcardListItem
CreateButton
SearchField
FiveBoxCard
DistributionChart
Flashcard
RevealButton
ReviewActions
Toast/Feedback
Modal/Sheet
TextInput
SettingsRow
```

Components must remain composable.

Avoid one-off duplicated UI.

---

# 25. Design Anti-Patterns

OpenCode must NOT introduce these without explicit approval:

- generic purple AI gradients
- excessive gradients
- excessive glassmorphism
- huge shadows
- neumorphism
- excessive floating cards
- dashboard grids everywhere
- sharp rectangular UI
- generic stock illustrations
- decorative icons with no function
- random emoji as UI icons
- oversized headings on every page
- excessive badges
- unnecessary animations
- unnecessary dependencies
- complex chart libraries
- heavy component libraries

---

# 26. Accessibility

Minimum requirements:

- touch targets around 44px or larger where practical
- sufficient text contrast
- visible focus states on desktop
- keyboard accessibility on desktop
- `prefers-reduced-motion`
- no gesture-only actions
- readable text on iPhone 8
- support text scaling without catastrophic layout breakage

---

# 27. PWA Architecture

The application must be installable from Safari's Add to Home Screen flow.

Provide:

- Web App Manifest
- app icon
- standalone display mode
- service worker
- offline asset caching

Cache:

- application shell
- CSS
- JavaScript
- icons
- essential static assets

Do NOT cache arbitrary online API responses as if they were authoritative local card data.

---

# 28. Storage Strategy

Use:

```text
IndexedDB
  ├── decks
  ├── cards
  ├── reviewEvents
  └── settings
```

Use Cache Storage/service worker for application assets.

Do not put application data in Cache Storage.

Do not use localStorage for cards or review history.

Consider requesting persistent storage where supported, but the application must remain correct if persistence cannot be granted.

---

# 29. Online Services Architecture

Online functionality must be modular.

Example:

```text
services/
  dictionary/
  pronunciation/
  examples/
  synonyms/
  llm/
```

Each service should have an interface.

Example:

```ts
interface DictionaryProvider {
  lookupWord(word: string): Promise<WordLookupResult>
}
```

The rest of the app must not know which provider is being used.

This makes it possible to change APIs later.

---

# 30. Backend Strategy

V1:

NO BACKEND.

The phone communicates directly with optional third-party services only if the service permits safe client-side usage.

If an API requires a secret key:

Do NOT expose the key in the frontend.

At that point introduce a minimal backend/proxy.

This is a future architecture decision, not a V1 requirement.

---

# 31. Development Phases

OpenCode must NOT attempt to build the entire application in one pass.

Development must be explicitly phased.

## Phase 0 — Design System Playground

Goal:

Implement the approved visual language in isolation.

Build:

- colors
- typography
- buttons
- cards
- glass
- Spectrum Material
- navigation
- flashcard
- five-box cards
- animations
- responsive behavior

Acceptance:

Must visually match the approved playground direction.

No business logic.

---

## Phase 1 — Application Shell

Build:

- Vite + React + TypeScript
- PWA manifest
- service worker
- app shell
- three-tab navigation
- routing/state
- responsive layout

No real learning data yet.

Acceptance:

All screens are navigable and feel like one coherent app.

---

## Phase 2 — Local Data Layer

Build:

- IndexedDB
- schema versioning
- repositories
- migrations
- seed data
- import/export

Acceptance:

Close/reopen the app and all data remains.

Test offline.

---

## Phase 3 — Library

Build:

- deck creation
- deck editing
- deck deletion
- flashcard creation
- flashcard editing
- flashcard deletion
- local search
- deck detail

Acceptance:

A user can create a deck and populate it entirely offline.

---

## Phase 4 — Five-Box Learning

Build:

- box state
- priority calculation
- correct/incorrect transitions
- review event recording
- progress calculation

Acceptance:

Every transition is deterministic and testable.

---

## Phase 5 — Review Experience

Build:

- flashcard front
- reveal
- swipe left/right
- explicit buttons
- animations
- feedback abstraction
- next-card flow

Acceptance:

Review feels smooth on iPhone 8.

---

## Phase 6 — Study Dashboard

Build:

- deck cards
- primary deck treatment
- five-box overview
- priority highlighting
- distribution chart
- study entry points

Acceptance:

The user immediately understands what to study next.

---

## Phase 7 — Settings

Build:

- appearance
- haptics
- sound
- algorithm setting
- import/export
- about/advanced

Acceptance:

Settings remain simple and uncluttered.

---

## Phase 8 — Performance / iPhone 8 QA

Test specifically on:

- iPhone 8
- iOS 16 Safari
- Home Screen PWA mode

Check:

- startup time
- memory behavior
- scrolling
- flashcard gestures
- animations
- IndexedDB reliability
- offline launch
- offline review
- import/export
- orientation
- text scaling
- reduced motion

No feature should be considered finished until it works acceptably on the primary device.

---

## Phase 9 — FUTURE / OPTIONAL — Online Features

This phase is NOT part of V1 and must NOT be started automatically.

After Phase 8, stop development and use the V1 app.

Only begin Phase 9 when the user explicitly decides to add online functionality.

Possible future order:

1. Online word search
2. Dictionary information
3. Pronunciation
4. Examples
5. Synonyms
6. LLM features

Each future feature must be modular and fail gracefully.

Starting Phase 9 requires explicit user approval.

---

# 32. Testing Strategy

Testing is part of every phase.

Do not wait until the end.

At minimum:

## Unit tests

Test:

- five-box transitions
- priority box
- progress calculations
- import validation
- export/import round trip
- database migrations

## Interaction tests

Test:

- create deck
- create card
- review card
- correct
- incorrect
- navigate tabs
- export
- import

## Device QA

Every major phase must include a manual iPhone 8 check.

---

# 33. Code Quality Rules for OpenCode

OpenCode should:

1. Read this specification before implementation.
2. Work phase-by-phase.
3. Never silently redesign the visual system.
4. Never add major dependencies without explaining why.
5. Keep business logic separate from UI.
6. Keep the learning engine independent from components.
7. Keep storage access behind repositories/services.
8. Keep online services modular.
9. Test each phase before moving on.
10. Stop and report blockers rather than improvising architecture that contradicts this specification.

When a requirement is ambiguous:

- choose the simplest implementation consistent with this spec
- document the assumption
- do not expand scope unnecessarily

---

# 34. Definition of Done

A phase is NOT done merely because the code compiles.

A phase is done when:

- implementation works
- relevant tests pass
- no console errors exist
- mobile layout is verified
- iPhone 8 constraints are respected
- visual design matches the Design System
- offline behavior is verified where relevant
- no unnecessary dependencies were introduced

---

# 35. Future Direction — Explicitly Out of Scope for V1

Do not build these now:

- accounts
- authentication
- cloud sync
- multi-user support
- social features
- leaderboards
- gamification
- achievements
- complex SRS scheduling
- multiple learning algorithms in the UI
- AI-generated cards
- automatic online enrichment during basic card creation
- push notification system
- native iOS wrapper

These may be considered later.

---

# 36. Product Success Criteria

The V1 should feel like:

> A small, premium, tactile personal vocabulary instrument.

It should NOT feel like:

> A website that happens to contain flashcards.

The three core qualities are:

1. Fast
2. Beautiful
3. Effortless

The user should be able to open the app, identify the priority deck/box, and begin studying within seconds.
