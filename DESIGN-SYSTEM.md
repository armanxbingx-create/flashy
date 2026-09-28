# Vocabulary App — Design System v1

## Purpose

This document is the visual source of truth for the Vocabulary App.

The product should feel like a small, premium, tactile learning instrument — not a generic SaaS dashboard, AI dashboard, children's language-learning game, or template.

The visual language is inspired by the dark, colorful, tactile material quality discussed in the approved design playground. Do not copy another product's layout or assets.

---

## 1. Design Principles

1. Dark first.
2. Spectrum is a material, not decoration.
3. Glass is a material, not a default component.
4. Rounded, tactile geometry.
5. Strong typography and hierarchy.
6. Motion should communicate state.
7. Interfaces must remain calm and focused.
8. Every decorative element must have a purpose.
9. Mobile interaction comes first.
10. iPhone 8 performance is a design constraint.

---

## 2. Color Tokens

### Base

- `background`: `#070912`
- `surface`: `#10141F`
- `surface-2`: `#151A26`
- `text`: `#F7F7FB`
- `text-muted`: `#9DA1B0`
- `text-dim`: `#686D7B`
- `line`: `rgba(255,255,255,0.10)`
- `line-strong`: `rgba(255,255,255,0.16)`

### Spectrum

- `spectrum-pink`: `#FF187F`
- `spectrum-magenta`: `#DF12E8`
- `spectrum-purple`: `#8D22FF`
- `spectrum-orange`: `#FF6415`
- `spectrum-yellow`: `#FFC52A`

These are starting tokens. Preserve the visual relationship rather than obsessing over individual hex values.

---

## 3. Spectrum Material

The signature visual effect is colored light behind dark glass.

Concept:

colored spectrum
→ diffusion
→ dark translucent surface
→ subtle internal reflection

Use primarily for:

- primary deck
- active Study navigation
- primary CTA
- important selected state
- splash/loading
- positive/special feedback

Do not put the full spectrum on every card.

The spectrum should feel scarce enough to remain meaningful.

---

## 4. Glass

Glass uses:

- dark translucent fill
- subtle border
- restrained blur
- subtle internal highlight
- optional spectrum reflection

Glass must have a fallback opaque/semi-opaque surface.

Preferred:

- one glass layer per component
- one navigation glass layer
- one flashcard glass layer

Avoid:

- nested glass
- glass inside glass
- huge blur radii
- bright white borders
- excessive glow

Ordinary list rows should normally use solid dark surfaces.

---

## 5. Shape Language

The app uses soft geometry.

Suggested radii:

- small: 12–14px
- medium: 16–18px
- large: 22–24px
- hero: 28–32px
- bottom navigation: 26–30px

Avoid sharp corners.

Avoid making every element a pill.

---

## 6. Typography

Use the native system font stack first.

Preferred behavior on Apple devices:

- SF Pro / system UI when available
- normal system fallback elsewhere

Do not add a large webfont without explicit approval.

Hierarchy:

- display: large, tight, confident
- title: strong but restrained
- body: highly readable
- metadata: small, muted
- labels: compact uppercase/letter-spaced only when useful

Do not overuse giant headings.

---

## 7. Navigation

Exactly three primary destinations:

`Library | Study | Settings`

Study is centered.

Bottom navigation:

- dark glass
- rounded container
- subtle border
- restrained shadow
- three icons
- labels optional depending on available space

Active Study:

- icon remains simple
- a soft Spectrum Material reflection appears underneath/behind the icon
- no solid neon button
- no giant glow

---

## 8. Cards

Cards should feel tactile and dense enough to be useful.

Do:

- rounded corners
- dark surfaces
- subtle borders
- strong hierarchy
- restrained shadows
- occasional glass

Do not:

- make every list item a floating glass card
- use giant shadows
- use decorative gradients without purpose
- use excessive badges

---

## 9. Flashcard

The flashcard is the primary interaction surface.

Front:

- word/prompt
- progress
- reveal affordance

Back:

- answer/meaning
- reveal state
- response actions

Interaction:

- swipe left = incorrect
- swipe right = correct
- explicit buttons remain available
- reveal button remains available
- vertical/tap reveal may be supported

The UI must communicate that a swipe is available without requiring hidden gesture discovery.

---

## 10. Feedback

Correct:

- positive motion
- subtle spectrum/green visual cue where appropriate
- optional haptic
- next card transition

Incorrect:

- distinct but restrained motion
- subtle red/error cue
- optional haptic
- card returns/moves to the next review state

Do not use aggressive shaking, flashing, or loud animation.

---

## 11. Motion

Use animation mainly through:

- `transform`
- `opacity`

Preferred duration:

- micro: 120–180ms
- normal: 180–260ms
- card transition: 220–320ms

Respect `prefers-reduced-motion`.

Reduced-motion mode should replace large movement with opacity/state changes.

Avoid continuous animation loops.

---

## 12. Icons

Icons must be:

- simple
- rounded
- consistent
- readable at small sizes
- visually subordinate to typography

Prefer a small icon set.

Do not add a large icon dependency just for convenience.

Do not use random emoji as interface icons.

---

## 13. iPhone 8 Visual Performance

Visual fidelity must not come at the cost of usability.

Avoid:

- multiple simultaneous backdrop filters
- large animated blurs
- particle effects
- canvas UI
- complex 3D
- video backgrounds
- continuously animated shadows
- expensive filter stacks

If a visual effect is too expensive, preserve the hierarchy and material idea with a cheaper CSS implementation.

---

## 14. Anti-Patterns

Never introduce without explicit approval:

- generic purple AI aesthetic
- dashboard-heavy layouts
- excessive gradients
- excessive glassmorphism
- neumorphism
- huge floating cards
- stock illustrations
- random decorative elements
- excessive badges
- unnecessary animations
- sharp UI corners
- huge icon libraries
- heavy chart libraries
- unnecessary third-party UI libraries

---

## 15. Responsive Rule

Design mobile-first.

Primary layout target:

- iPhone 8 portrait

Also verify:

- iPhone 16 portrait
- desktop browser

Desktop may have more breathing room, but the interaction model remains mobile-first.

---

## 16. Design QA

Before considering a screen complete, check:

- Is hierarchy immediately obvious?
- Is the primary action obvious?
- Does the screen look coherent with the rest of the app?
- Is Spectrum Material used intentionally?
- Is glass used intentionally?
- Are corners and spacing consistent?
- Are there unnecessary decorative elements?
- Does it remain performant on iPhone 8?
- Does reduced motion remain usable?
