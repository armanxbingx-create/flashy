# Graph Report - flashy  (2026-09-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 333 nodes · 715 edges · 22 communities (18 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c74f9c7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- data/index.ts
- generate-icons.mjs
- package.json
- DesignPlayground.tsx
- FeedbackSystem
- compilerOptions
- RouterProvider.tsx
- compilerOptions
- react
- SettingsScreen.tsx
- Button
- App.tsx
- manifest.json
- DeckDetailScreen.tsx
- LibraryScreen.tsx
- sw.js
- .oxlintrc.json
- tokens/index.ts
- BottomNavigation.tsx
- opencode.json
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `Flashcard` - 27 edges
2. `react` - 26 edges
3. `compilerOptions` - 18 edges
4. `Button()` - 17 edges
5. `TopBar()` - 16 edges
6. `Deck` - 15 edges
7. `useRouter()` - 15 edges
8. `compilerOptions` - 15 edges
9. `FeedbackSystem` - 13 edges
10. `DeckDetailScreen()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `DeckWithCount` --inherits--> `Deck`  [EXTRACTED]
  src/screens/LibraryScreen.tsx → src/data/types.ts
- `SearchResults` --references--> `Flashcard`  [EXTRACTED]
  src/screens/LibraryScreen.tsx → src/data/types.ts
- `ReviewSessionState` --references--> `Flashcard`  [EXTRACTED]
  src/screens/ReviewSessionScreen.tsx → src/data/types.ts
- `SettingsScreen()` --calls--> `exportData()`  [EXTRACTED]
  src/screens/SettingsScreen.tsx → src/data/export.ts
- `SettingsScreen()` --calls--> `importData()`  [EXTRACTED]
  src/screens/SettingsScreen.tsx → src/data/export.ts

## Import Cycles
- None detected.

## Communities (22 total, 4 thin omitted)

### Community 0 - "data/index.ts"
Cohesion: 0.11
Nodes (29): db, FlashyDatabase, exportData(), importData(), validateExport(), newId(), deckRepository, reviewEventRepository (+21 more)

### Community 1 - "generate-icons.mjs"
Cohesion: 0.07
Nodes (19): vite, @vitejs/plugin-react, BASE, clamp(), coverage(), crc32(), CRC_TABLE, encodePng() (+11 more)

### Community 2 - "package.json"
Cohesion: 0.07
Nodes (28): dependencies, dexie, react, react-dom, devDependencies, oxlint, @types/node, @types/react (+20 more)

### Community 3 - "DesignPlayground.tsx"
Cohesion: 0.12
Nodes (14): BottomNavigation(), Card(), CardProps, BoxData, FiveBoxCard(), FiveBoxCardProps, Flashcard(), Glass() (+6 more)

### Community 4 - "FeedbackSystem"
Cohesion: 0.14
Nodes (7): FeedbackOverlay(), FeedbackOverlayProps, FeedbackType, FlashcardProps, SwipeState, FeedbackSystem, ToneOptions

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 6 - "RouterProvider.tsx"
Cohesion: 0.15
Nodes (13): react-dom, App(), bootstrap(), hideSplash(), RouterContext, getTabForScreen(), RouterProvider(), TAB_SCREENS (+5 more)

### Community 7 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "react"
Cohesion: 0.23
Nodes (6): react, ButtonProps, cardRepository, fiveBoxEngine, load(), emptyBoxes()

### Community 9 - "SettingsScreen.tsx"
Cohesion: 0.16
Nodes (10): DownloadIcon(), UploadIcon(), SheetProps, ALGORITHMS, SettingsScreen(), THEMES, Theme, ThemeContext (+2 more)

### Community 10 - "Button"
Cohesion: 0.33
Nodes (8): ScreenRouter(), Button(), TopBar(), useRouter(), BoxOverviewScreen(), CardEditorScreen(), ReviewSessionScreen(), StudyScreen()

### Community 11 - "App.tsx"
Cohesion: 0.23
Nodes (8): NAV_ITEMS, SCREEN_TO_TAB, ChevronLeftIcon(), IconProps, LibraryIcon(), SettingsIcon(), StudyIcon(), TopBarProps

### Community 12 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 13 - "DeckDetailScreen.tsx"
Cohesion: 0.31
Nodes (4): ConfirmDialog(), ConfirmDialogProps, DeckDetailScreen(), emptyBoxes()

### Community 14 - "LibraryScreen.tsx"
Cohesion: 0.33
Nodes (5): ChevronRightIcon(), PlusIcon(), SearchIcon(), Sheet(), LibraryScreen()

### Community 15 - "sw.js"
Cohesion: 0.57
Nodes (6): handleAsset(), handleNavigation(), matchShell(), openShellCache(), saveToShell(), SHELL_ASSETS

### Community 16 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 18 - "tokens/index.ts"
Cohesion: 0.40
Nodes (4): COLORS, DURATIONS, GRADIENTS, RADII

## Knowledge Gaps
- **117 isolated node(s):** `IconProps`, `TopBarProps`, `ConfirmDialogProps`, `BottomNavigationProps`, `NavItem` (+112 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 162 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `DesignPlayground.tsx`, `FeedbackSystem`, `RouterProvider.tsx`, `SettingsScreen.tsx`, `Button`, `App.tsx`, `DeckDetailScreen.tsx`, `LibraryScreen.tsx`, `BottomNavigation.tsx`?**
  _High betweenness centrality (0.255) - this node is a cross-community bridge._
- **Why does `vite` connect `generate-icons.mjs` to `package.json`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `@vitejs/plugin-react` connect `generate-icons.mjs` to `package.json`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `IconProps`, `TopBarProps`, `ConfirmDialogProps` to the rest of the system?**
  _117 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11137254901960784 - nodes in this community are weakly interconnected._
- **Should `generate-icons.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07459677419354839 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._