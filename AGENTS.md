# Vocabulary App — OpenCode Project Instructions

## Read this first

Before changing code, read:

- `project-spec.md`
- `DESIGN-SYSTEM.md`

Treat both as project source-of-truth documents.

## Product constraints

- This is an offline-first personal vocabulary PWA.
- Primary target is iPhone 8 / iOS 16 Safari.
- Do not assume modern iOS-only web APIs.
- Core learning must work without internet.
- V1 has exactly three primary tabs: Library, Study, Settings.
- Study is the central primary destination.
- V1 learning algorithm is Five-Box.
- Do not add additional learning algorithms to the UI.
- Do not add accounts, authentication, cloud sync, social features, gamification, or online enrichment to V1.

## Architecture constraints

- Use TypeScript + React + Vite.
- Use IndexedDB for application data.
- Keep storage behind repositories/services.
- Keep learning logic behind a `LearningEngine` abstraction.
- Keep online integrations modular and optional.
- Do not add a backend in V1.
- Do not expose API secrets in client code.
- Prefer small dependencies.

## iPhone 8 constraints

Always optimize for the primary device.

Prefer:

- CSS transforms
- opacity transitions
- async IndexedDB
- small bundles
- system fonts
- lazy loading

Avoid:

- expensive continuous JS animation
- large dependency bundles
- heavy chart libraries
- large icon libraries
- canvas-based UI when HTML/CSS is sufficient
- unnecessary blur/filter stacks
- complex 3D effects

Use feature detection for optional browser APIs.

## Design constraints

Read `DESIGN-SYSTEM.md` before implementing UI.

Do not invent a new visual language.

Do not make the app look like:

- generic SaaS
- generic AI UI
- children's learning software
- dashboard templates

Do not introduce:

- excessive gradients
- excessive glassmorphism
- giant shadows
- sharp corners
- random icons
- decorative UI without purpose

## Phase discipline

Work ONLY on the current phase.

Do not start later phases automatically.

At the end of a phase:

1. Run relevant tests/typecheck/build.
2. Perform focused manual verification.
3. Report what changed.
4. Report what was tested.
5. Report any assumptions.
6. Stop and wait for explicit instruction to begin the next phase.

Never implement the whole roadmap in one pass.

## Ambiguity

When requirements are ambiguous:

1. Prefer the smallest implementation consistent with the spec.
2. Do not expand scope.
3. Record the assumption.
4. If the decision affects architecture or UX materially, stop and ask.

## Verification

A phase is not complete merely because the app compiles.

Before declaring completion:

- no TypeScript errors
- no relevant console errors
- relevant tests pass
- mobile layout checked
- iPhone 8 constraints considered
- visual system matches `DESIGN-SYSTEM.md`

## Future work boundary

Online features are FUTURE WORK.

After Phase 8, stop.

Do not continue into online services unless the user explicitly asks to begin the future online phase.
