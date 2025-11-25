## War Machine SPA Redesign Document

### 1. Goals & Scope
- Consolidate the multi-page HTML tools into a single-page application using vanilla JS + Bun bundling.
- Provide a Swiss-inspired text-first UI with a shared design system and sidebar navigation.
- Centralize BECMI rules logic into modular files so mechanics can be iterated easily.
- Maintain a unified state tree persisted to localStorage with single import/export JSON for the entire suite.
- Keep Python simulator out of scope; only focus on the JS stack.
- becmi-rules-cyclopedia.md is the source of all BECMI rules truth

---

### 2. Technical Architecture

**2.1 Project Structure**

```
/public
  index.html        # Root shell, loads bundled JS/CSS
  assets/           # Static assets (logos, favicons, hex sprite sheets if needed)

/src
  main.ts           # Entry point; initializes state, router, layout
  bootstrap.ts      # (optional) fonts, global listeners

  state/
    store.ts        # Core state object + persistence + subscriptions
    schema.ts       # Type definitions, version metadata, migration helpers

  router/
    index.ts        # Hash router logic
    routes.ts       # Route registry emitted by features

  layout/
    app-shell.ts    # Renders sidebar + content area
    sidebar.ts      # Menu rendering, export/import controls
    panels.ts       # Generic panel scaffolding, scroll containers

  components/
    panel.ts        # Panel wrapper with header, body
    button.ts       # Compact button render helper
    form.ts         # Text fields, number inputs, selects
    stat-grid.ts    # Shared numeric grid renderer
    table.ts        # Simple text tables
    tabs.ts, toast.ts (as needed)

  styles/
    tokens.css      # Color palette, spacing, typography variables
    base.css        # Reset + base typography rules
    layout.css      # Wrapper, grids, sidebar, panels
    components.css  # Buttons, forms, tables
    utilities.css   # helpers (visually-hidden, scroll padding)

  rules/
    dice.ts               # Random number utilities
    tables/
      thac0.ts
      saving-throws.ts
      cleric-spells.ts
      mu-spells.ts
      thief-skills.ts
    party.ts              # Character gen, equipment logic
    dominion.ts           # Confidence, taxation rules
    wilderness.ts         # Movement, encounters
    siege.ts, merchant.ts # Additional engines

  features/
    party/
      index.ts            # Route registration + mount/unmount
      view.ts             # DOM rendering functions
      controller.ts       # Event wiring, state updates
      selectors.ts        # Derived data from global state
    dominion/
    wilderness/
    calendar/
    siege/
    merchant/
    stronghold/
    treasure/
    lab/
    dungeon/

  data/
    names.ts              # Converted from names.js
    presets/
      sample-party.json
      sample-dominion.json
```

**2.2 Build & Runtime**
- Bun bundler: `bun build src/main.ts --outdir=dist --target=browser --watch`.
- Development server via `bun dev` script to serve `/public` with live reload.
- No framework; use ES modules + DOM APIs.

---

### 3. State Management

**3.1 Global Schema (`WarMachineState`)**

```ts
interface WarMachineState {
  meta: {
    version: string;        // e.g., "1.0.0"
    lastUpdated: number;    // epoch ms
  };
  party: PartyState;
  dungeon: DungeonState;
  dominion: DominionState;
  wilderness: WildernessState;
  siege: SiegeState;
  merchant: MerchantState;
  stronghold: StrongholdState;
  treasure: TreasureState;
  lab: LabState;
  calendar: CalendarState;
}
```

Each module’s state shape defined in `state/schema.ts`, e.g.:

```ts
interface PartyState {
  roster: Character[];
  retainers: Retainer[];
  partyResources: {
    bankedGold: number;
    loot: number;
    torches: number;
    rations: number;
  };
}
```

**3.2 Store Responsibilities (`state/store.ts`)**
- `loadState()`: read from localStorage, validate version, run migrations.
- `saveState(partial)`: merge partial updates, persist, notify subscribers.
- `subscribe(listener)`: simple pub/sub for modules to react to changes.
- `exportState()`: produce JSON with schema version + state.
- `importState(json)`: validate, replace current state (with backup fallback).
- Provide derived selectors for computed values via `selectors.ts` per feature.

**3.3 Persistence**
- Primary persistence: `localStorage.setItem('war-machine-state', json)`.
- Fallback backup key after import to allow manual rollback.
- Debounce save operations to avoid excessive writes; immediate save for critical operations (e.g., exports).

---

### 4. Routing & Navigation

**4.1 Router**
- Hash-based router (`#/party`, `#/dominion`, etc.).
- `router/index.ts` listens for `hashchange` and `DOMContentLoaded`.
- Routes defined via feature registration: `registerRoute({ id: 'party', title: 'Party Registry', mount, unmount })`.
- Router handles:
  - Default route (e.g., `#/party`).
  - Not-found fallback.
  - Before-change hooks if modules need cleanup (e.g., stop timers).

**4.2 Sidebar**
- Data-driven menu built from registered routes.
- Sections grouped logically (Characters, Domain, Logistics, Magic).
- Includes global controls:
  - Export suite data (calls `stateStore.exportState()`).
  - Import suite data (file picker + `stateStore.importState()`).
  - Clear local data (with confirmation, resets to defaults).
- Compact button styles per design system.

---

### 5. Design System Implementation

**5.1 Fonts & Base Styles**
- Load IBM Plex Mono via JS-delivered `@import` or `<link>` in `public/index.html`.
- `styles/base.css` includes reset (modern-normalize) and sets body typography:

```css
body {
  font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.35;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin: 0;
}
```

**5.2 Tokens**
- Implement provided palette/spacing variables verbatim in `styles/tokens.css`.
- Additional utility variables as needed (e.g., `--shadow-soft`, `--border-muted`).

**5.3 Panels & Grids**
- `.wrapper`, `.main-grid`, `.panel` classes defined per spec.
- Scroll containers include `padding-bottom: var(--scrollbox-pad)` and `scrollbar-gutter: stable`.

**5.4 Typography**
- Panel titles: uppercase, small caps style via `letter-spacing`.
- Secondary labels: `.label` class with `font-size: 0.65rem` and `opacity: 0.8`.
- Timestamps: `.timestamp`.
- Provide helper classes (`.muted`, `.meta`, `.stat-value`) to maintain consistency.

**5.5 Controls**
- Buttons: `button.compact` with minimal padding, uppercase text.
- Inputs/selects styled with border `var(--panel-border)`, background `var(--bg-primary)`.

**5.6 Accent Usage**
- `--accent-a` for primary interactive states, `--accent-b` success, etc., as defined.
- Provide utility classes `.accent-a`, `.accent-b`, etc., for text highlights.
- Keep saturation low; use color only for key statuses (HP, errors, warnings).

---

### 6. Feature Migration Strategy

**Phase 1: Infrastructure**
1. Set up Bun project scaffolding, install IBM Plex Mono (via Google Fonts).
2. Implement styles (tokens, base, layout).
3. Build state store with empty default state + persistence.
4. Implement router, sidebar, placeholder content panels.
5. Add global import/export dialogs.

**Phase 2: Party Generator Port**
1. Extract data tables into `rules/tables/*`.
2. Move character generation logic into `rules/party.ts`; ensure functions rely on pure data to ease tweaking.
3. Build `features/party` UI with the design system, referencing state store.
4. Replace inline names list with module import from `data/names.ts`.
5. Ensure retainer logic tied to global state slice.

**Phase 3: Additional Modules**
- Migrate modules one at a time, each iteration:
  - Move rules/engines into `rules/`.
  - Implement UI as text-first panels with shared components.
  - Wire state updates via store.
- Suggested order: Dominion → Wilderness → Calendar → Stronghold → Siege → Merchant → Treasure → Lab → Dungeon.

**Phase 4: Polish**
- Implement global notifications/toasts for actions (import success, errors).
- Add keyboard shortcuts or command palette if useful.
- Integrate CSS refinements, add documentation.

---

### 7. Rules & Mechanics Modularity

- Each rules file exports pure functions (no DOM), e.g.:

```ts
export function calculateThac0(classKey: ClassKey, level: number): number;
export function generateCharacter(config: CharacterConfig, tables: Tables): Character;
export function processDominionSeason(state: DominionState, params: TurnParams): DominionResult;
```

- Provide descriptive TypeScript interfaces so future tweaks to BECMI logic are localized.
- Keep tables (THAC0, spells, saving throws) in separate data files so they can be edited without touching logic.

---

### 8. Testing & Validation

- Since vanilla JS, rely on unit tests via Bun’s test runner for pure functions in `rules/`.
- Manual QA for UI flows; consider lightweight smoke tests using Playwright later if needed.
- Validate export/import schema via JSON schema tests.

---

### 9. Documentation & Maintenance

- Add `docs/architecture.md` summarizing this plan and instructions for adding new modules.
- Document state schema and versioning policy.
- Provide style guide reference referencing tokens and component classes.
- Keep changelog for BECMI rule adjustments to track gameplay impact.

---

### 10. Open Questions / Decisions

- Should we add optional TypeScript types for runtime validation (e.g., `zod`), or rely on manual checks? (leaning manual to stay lightweight).
- Do we need offline-first/backups beyond localStorage (e.g., file system API)? Table for later.
- Accessibility plan: ensure high contrast, keyboard navigation, aria labels for panels.