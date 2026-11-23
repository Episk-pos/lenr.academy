# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LENR Academy is a React/TypeScript SPA that provides interactive tools for exploring Low Energy Nuclear Reactions (LENR) and cold fusion transmutation pathways. It's a modern reimplementation of the original [Nanosoft Package](https://nanosoft.co.nz) PHP application developed by R.W. Greenyer and P.W. Power.

The application operates entirely client-side using a 161MB SQLite database (parkhomov.db) containing Dr. Alexander Parkhomov's nuclear reaction tables:
- 3,921 fusion reactions (1,505 without neutrinos)
- 1,733 fission reactions (818 without neutrinos)
- 1,215,374 two-to-two reactions (518,657 without neutrinos)

**Live site**: https://lenr.academy
**Repository**: https://github.com/Episk-pos/lenr.academy
**License**: AGPL-3.0

## Commands

```bash
# Development
npm run dev          # Start Vite dev server on http://localhost:5173

# Building
npm run build        # TypeScript compile + Vite build to ./dist
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # ESLint check

# Database Management
npm run db:download                      # Download latest database from S3 to ./public
bash scripts/download-db.sh v1.2.3       # Download specific version
npm run db:upload                        # Upload database (uses version from .db.meta.json)
npm run db:upload --version=v1.2.3       # Upload database with specific version
npm run db:index                         # Regenerate S3 bucket index.html and versions.json

# Deployment (AWS S3 + CloudFront)
npm run deploy       # Deploy to S3 and invalidate CloudFront cache
npm run deploy:s3    # Sync ./dist to s3://lenr.academy
npm run deploy:uncache # Invalidate CloudFront distribution
```

## Architecture

### Three-Layer Architecture

1. **Data Layer** (`src/services/`)
   - `database.ts` - sql.js initialization with streaming download and progress tracking
   - `dbCache.ts` - IndexedDB caching with version management and persistent storage
   - `queryService.ts` - SQL query builders for fusion, fission, two-to-two, and nuclide queries

2. **State Layer** (`src/contexts/`)
   - `DatabaseContext.tsx` - Global database state with metered connection detection
   - `ThemeContext.tsx` - Dark/light theme with localStorage persistence

3. **UI Layer** (`src/components/` and `src/pages/`)
   - Query pages: FusionQuery, FissionQuery, TwoToTwoQuery
   - Data viewers: ShowElementData, TablesInDetail, AllTables
   - Shared components: PeriodicTable, PeriodicTableSelector, ElementDetailsCard, NuclideDetailsCard

### Database Architecture

The application uses **sql.js** (SQLite compiled to WebAssembly) to run queries entirely in the browser. The database lifecycle:

1. **First Load**: Downloads parkhomov.db (161MB) from `/public/parkhomov.db` with streaming fetch and progress tracking
2. **Caching**: Stores database in IndexedDB via `dbCache.ts` with version metadata
3. **Subsequent Loads**: Loads from IndexedDB cache instantly
4. **Updates**: Checks `/parkhomov.db.meta.json` for version changes and shows update banner when available

**Key tables**:
- `NuclidesPlus` - Nuclide properties (Z, A, binding energy, half-life, boson/fermion flags)
- `ElementPropertiesPlus` - Element properties (melting point, density, electronegativity, etc.)
- `RadioNuclides` - Radioactive decay data (46,797 records) with decay modes, radiation types, energies, intensities, and half-lives
- `FusionAll` - A + B → C reactions (includes neutrino-involved reactions)
- `FissionAll` - A → B + C reactions (includes neutrino-involved reactions)
- `TwoToTwoAll` - A + B → C + D reactions (includes neutrino-involved reactions)

### URL State Management

The ShowElementData page uses `useSearchParams` from React Router to enable deep linking:
- `/element-data?Z=26` - Shows Iron (Z=26)
- `/element-data?Z=26&A=56` - Shows Iron-56 isotope

Browser back/forward navigation works naturally. Parameters are validated against available data.

### Privacy & Analytics

- **Umami Analytics**: Privacy-friendly, GDPR-compliant analytics loaded conditionally from `index.html`
- **PrivacyBanner**: First-visit consent banner with opt-out using localStorage key `lenr-analytics-consent`
- **Metered Connection Detection**: Uses Network Information API to warn before 161MB download on cellular connections (localStorage key: `lenr-metered-download-consent`)

### Styling System

- **TailwindCSS** with custom primary color palette (blue theme)
- **Dark mode**: Implemented via `class` strategy in `tailwind.config.js`, managed by ThemeContext
- **Responsive**: Mobile-first design with collapsible sidebar

## Key Technical Patterns

### Query Service Pattern

All database queries go through `queryService.ts` which:
1. Validates input elements exist in database
2. Builds parameterized SQL queries
3. Executes with timing measurement
4. Returns typed results with related nuclides and elements

Example:
```typescript
const result = queryFusionReactions(db, {
  element1List: ['H'],
  element2List: ['Li'],
  minMeV: 1.0
});
// Returns: { reactions, nuclides, elements, executionTime, rowCount, totalCount }
```

### Context Provider Hierarchy

```typescript
<ThemeProvider>          // Dark/light mode
  <DatabaseProvider>     // sql.js database + metered warning
    <Router>
      <Layout>           // Sidebar + main content
        <Routes />
      </Layout>
    </Router>
  </DatabaseProvider>
</ThemeProvider>
```

### Component Communication

- **Props down**: Parent components pass data to children via props
- **Context up**: Components access global state via `useDatabase()` and `useTheme()` hooks
- **URL state**: ShowElementData uses `useSearchParams` for shareable state

### Radioactive Decay Chain Visualization

The application includes interactive multi-generation decay chain visualization for radioactive nuclides:

**Architecture** (`src/services/decayChainService.ts`):
- `traceDecayChain()` - Recursively builds decay trees from `RadioNuclides` table
  - Parameters: `db`, `Z`, `A`, `maxDepth` (default: 10), `minBranchingRatio` (default: 1%)
  - Returns: Tree structure with nodes containing nuclide, decay mode, branching ratio, children[]
  - Handles branching decay paths and circular references (e.g., isomeric transitions)
  - Stop conditions: stable nuclide (LHL > 9), max depth reached, or already visited
- `getDaughterNuclide()` - Calculates daughter Z/A from decay modes (A, B-, B+, EC, IT)
- `getLinearDecayChain()` - Simplified linear chain following primary decay mode only

**UI Components**:
- `DecayChainDiagram.tsx` - SVG tree visualization with:
  - Reingold-Tilford tree layout algorithm for balanced node spacing
  - Color-coded decay modes (alpha=red, beta-=blue, beta+=green, EC=purple, IT=yellow)
  - Interactive nodes (click to navigate to nuclide details page)
  - Hover tooltips with full decay information
  - Responsive sizing with automatic viewBox calculation
- `NuclideDetailsCard.tsx` - Integrates decay chain with:
  - Collapsible "Decay Chain Visualization" section
  - Interactive depth slider (1-15 generations)
  - Branching ratio filter (1-100%)
  - Chain metadata display (total generations, branch count, terminal nuclides)

**Famous Decay Series** (`src/constants/decaySeries.ts`):
- Uranium-238 series (4n+2) - 14 steps → Pb-206
- Thorium-232 series (4n) - 10 steps → Pb-208
- Uranium-235 actinium series (4n+3) - 11 steps → Pb-207
- Neptunium-237 series (4n+1) - 11 steps → Bi-209 (synthetic)

**Usage Example**:
```typescript
import { traceDecayChain } from '../services/decayChainService'

// Trace U-238 decay chain
const chain = traceDecayChain(db, 92, 238, {
  maxDepth: 10,
  minBranchingRatio: 5  // Only show branches ≥5%
})

// chain.root contains full tree
// chain.totalGenerations = maximum depth
// chain.branchCount = number of branching points
// chain.terminalNuclides = array of leaf nodes
```

## Data Types

All type definitions are in `src/types/index.ts`:

- `Nuclide` - Isotope data (Z, A, binding energy, half-life, boson/fermion type)
- `Element` - Chemical element properties
- `FusionReaction` - Two inputs → one output
- `FissionReaction` - One input → two outputs
- `TwoToTwoReaction` - Two inputs → two outputs
- `QueryFilter` - Filter parameters for reaction queries
- `QueryResult` - Standardized query response with timing
- `DecayChainNode` - Tree node for multi-generation decay sequences (nuclide, decay mode, branching ratio, children)
- `DecayChainResult` - Complete decay chain result (root node, total generations, branch count, terminal nuclides)
- `DecayData` - Individual decay record from RadioNuclides table (decay mode, radiation type, energy, intensity, half-life)

## Database Column Mapping

The database uses abbreviated column names that map to TypeScript properties:

```typescript
// Element table mappings
'P' → 'Period'
'G' → 'Group'
'MolarVol' → 'MolarVolume'
'Val' → 'Valence'
'ElectG' → 'ElectConduct'
'ThermG' → 'ThermConduct'
```

See `ShowElementData.tsx:24-34` for the complete mapping.

## Important Implementation Notes

### Database Loading Flow

1. DatabaseContext mounts
2. Checks for metered connection (Network Information API)
3. If metered and no prior consent → show MeteredConnectionWarning modal
4. Try loading from IndexedDB cache
5. If cache miss or outdated → download with progress tracking
6. Store in IndexedDB for next load
7. Set `db` in context, triggering UI to enable

### Nuclide Stability

A nuclide is considered "stable" if `LHL > 9` (log₁₀ of half-life in years > 9, meaning half-life > 1 billion years).

### Boson/Fermion Flags

Each nuclide has two boson/fermion classifications:
- `nBorF` - Nuclear: based on whether mass number A is even ('b') or odd ('f')
- `aBorF` - Atomic: based on neutron count (A-Z)

### Hydrogen Isotopes in Database

The database stores hydrogen isotopes separately with distinct element symbols:
- `H` - Protium (Hydrogen-1)
- `D` - Deuterium (Hydrogen-2)
- `T` - Tritium (Hydrogen-3)

**Important**: Users must explicitly select hydrogen isotopes (H, D, or T) in the periodic table selector - isotopes are not automatically expanded. The default Two-To-Two query uses `E1='D', E2='Ni,Li,Al,B,N', E3='C'` which returns 5 deuterium-based reactions. This explicit selection ensures the SQL preview matches the actual query execution.

### Testing Metered Connection Warning

The Network Information API has limited browser support. To test the metered warning:

1. Open `src/contexts/DatabaseContext.tsx`
2. Uncomment line 9: `return true;` in `isMeteredConnection()`
3. Clear localStorage and IndexedDB
4. Refresh page

The warning will only trigger in production on mobile browsers with cellular connections.

### Debugging Playwright Test Failures

When investigating Playwright E2E test failures:

1. **Always check the screenshots** in `test-results/` directory first
2. Screenshots show the exact state of the page when the test failed
3. Look for:
   - Viewport scrolling issues (is the target element visible?)
   - Actual vs. expected element presence in the DOM
   - Query execution status (e.g., "Showing X of Y reactions")
   - Whether pinned elements actually exist in the results
4. The screenshots can reveal issues that aren't obvious from test error messages alone (e.g., "element not found" might mean the element doesn't exist in query results, not that it's off-screen)

## File Organization

```
src/
├── components/       # Reusable UI (PeriodicTable, Cards, Banners)
├── contexts/         # React Context providers
├── pages/            # Route components (one per navigation item)
├── services/         # Data layer (database, cache, queries)
├── types/            # TypeScript type definitions
├── App.tsx           # Root component with routing
└── main.tsx          # React entry point

public/
├── parkhomov.db           # SQLite database (161MB, gitignored)
├── parkhomov.db.meta.json # Version metadata for update detection
└── sql-wasm.wasm          # sql.js WebAssembly binary
```

## Database Storage & Versioning

The SQLite database is **not stored in Git** due to its 161MB size. Instead, it's stored in a dedicated S3 bucket with explicit versioning:

### S3 Storage Structure

```
s3://db.lenr.academy/
  ├── index.html                    # Human-readable version directory
  ├── versions.json                 # Machine-readable version index
  ├── v1.0.0/
  │   ├── parkhomov.db
  │   └── parkhomov.db.meta.json
  ├── latest/                       # Always points to current version
  │   ├── parkhomov.db
  │   └── parkhomov.db.meta.json
  └── [more versions...]
```

### Updating the Database

When making changes to the database:

1. **Prepare the new version**:
   - Place updated `parkhomov.db` in `public/` directory
   - Ensure it's tested locally

2. **Upload to S3**:
   ```bash
   npm run db:upload --version=v1.2.3
   ```
   This will:
   - Calculate MD5 checksum
   - Upload to `s3://db.lenr.academy/v1.2.3/`
   - Update `latest/` symlink
   - Regenerate `index.html` and `versions.json`

3. **Update metadata in Git**:
   - The upload script creates `public/parkhomov.db.meta.json`
   - Commit this metadata file to Git for version tracking

4. **Deploy to production/staging**:
   - Production: `npm run deploy` (copies from `dist/`)
   - The database is already served from S3

### CI/CD Database Access

GitHub Actions workflows download the database from S3 during test runs:
- Uses `s3://db.lenr.academy/latest/` for current version
- No Git LFS bandwidth consumption
- Fast downloads from S3

### Local Development Setup

The database is **automatically downloaded** during `npm install` via a postinstall script. If you need to:

- **Re-download the latest version**:
  ```bash
  npm run db:download
  ```

- **Download a specific version**:
  ```bash
  bash scripts/download-db.sh v1.2.3
  ```

This places `parkhomov.db` and `parkhomov.db.meta.json` in the `public/` directory.

### Version Browser

The S3 bucket is configured for static website hosting. View all available versions at:
- **Human-readable**: https://db.lenr.academy/index.html
- **API**: https://db.lenr.academy/versions.json

## Git Workflow

The `.gitignore` excludes `*.db` files but keeps `!*.db.meta.json` for version tracking. The 161MB database file is never committed to Git - it's stored in S3 with explicit versioning.

### Git Stash

When working with stashed changes, **prefer `git stash apply` over `git stash pop`**. This preserves the stash for potential reuse and avoids losing work if something goes wrong during the apply operation.

## GitHub Issues and Pull Requests

When asked to work with GitHub issues or pull requests, **prefer using the GitHub CLI (`gh`)** via the Bash tool rather than web scraping or API calls. The `gh` CLI provides structured output and is already installed in the development environment.

Common commands:
```bash
gh issue view 123              # View issue details
gh issue list --state open     # List open issues
gh pr view 456                 # View PR details
gh pr create --title "..." --body "..."  # Create PR
gh pr checks                   # View PR status checks
```
- When considering E2E tests, let's use the DB to find which elements/nuclides we need to select to put the UI into a state which expresses what we're trying to test

## Contributor Knowledge

This section captures hard-won lessons from contributing to this project. If you're using an LLM (Claude Code, Cursor, etc.) to help contribute, this knowledge is loaded automatically.

### Automated Code Review (Greptile Bot)

Every PR is automatically reviewed by the [greptile](https://greptile.com/) bot. It consistently flags these three issues — address them proactively before submitting:

1. **Theme-aware inline styles**: Any inline `style={{}}` with colors must use `theme === 'dark'` ternaries. Legend swatches, color indicators, and background colors are all caught. Use the `useTheme()` hook.
2. **Dark mode in SVG/Canvas**: Charts, diagrams, and visualizations need full dark mode support — backgrounds, text, borders, and tooltips must all adapt.
3. **i18n completeness**: All user-visible strings must use `t()` from `useTranslation()` via react-i18next. There are 29 locales (en, de, es, fr, ja, ru, zh, it, pt, uk, pl, ko, hi, ar, nl, sv, da, nb, fi, cs, hu, tr, id, vi, sw, bn, th, fa, ur) — add translation keys to all of them (`src/i18n/locales.test.ts` enforces key and placeholder parity; see "i18n guardrails" below). English is the fallback.

**Efficient workflow**: Read ALL greptile comments before starting fixes (they follow patterns). Fix all instances in one commit, then reply to each comment with: "Fixed in `abc1234`. All N instances now use theme-aware colors."

### i18n guardrails (the `i18n` CI job)

`.github/workflows/i18n.yml` runs on every PR and push to main (no browsers, no database, ~1–2 min). Run it all locally with `npm run i18n:check`. It fails on:

1. **Hard-coded copy** (`npm run lint:i18n:ci`): eslint-plugin-i18next (`.eslintrc.i18n.cjs`, `jsx-only`) over all of `src/**/*.{ts,tsx}`. Any string not in `src/i18n/hardcoded-baseline.json` fails — wrap it in `t()`. The baseline is **shrink-only**: CI also fails when a baselined string is gone, so after fixing one run `npm run lint:i18n:baseline` (it refuses to add or grow entries unless you pass `--allow-grow`, which reviewers will see). `npm run lint:i18n` shows the raw report.
2. **Untranslated data tables** (`src/i18n/dataTables.test.ts`): every glossary entry needs an `i18nKey`, and every row of example queries, documented transmutations, citations, materials and radiation types must have its copy in en.json, **identical to the English in the data file** (edit both together). A new table rendered via `` t(`prefix.${id}.field`, { defaultValue }) `` must be registered in `TABLES`. Decay-series presets are not rendered yet; the test fails once a component imports them, as a reminder to key them.
3. **Values identical to English** (`locales.test.ts`): any non-en value equal to the en value (with real words) fails unless listed in `src/i18n/identical-allowlist.json` — `invariant` (globs, every locale: brand, symbols, units, bibliographic authors/journals), per-locale `keep` (reviewed cognates and names, e.g. fr "Type") or per-locale `baseline` (known untranslated debt, **shrink-only**: delete entries once translated; the test tells you which). Only add to `keep`/`invariant` for genuine names, symbols, units and cognates — never to silence real English.
4. **Undefined keys** (`src/i18n/keys.test.ts`): every static `t('…')` key, `<Trans i18nKey>` and `*Key`/`*Keys`/`i18nKey` data value must exist in en.json. `RussellHistoricalContext.tsx` (unmounted) is skipped explicitly pending bead beads-h7m.
5. **Stale translations** (`src/i18n/source-hashes.json`, `src/i18n/sourceHashes.test.ts`, `scripts/i18n/stale.ts`). Every en value's hash is recorded. **Blocking on PRs**: changing an en value without re-translating every locale fails the PR — there is no "defer" label. Your only options:
   - **Translate** the affected locales in the same PR, then run `npm run i18n:stamp` (it detects which locale values changed vs `origin/main`, refreshes the hashes and prints what it treated as re-translated). Fork contributors: `npm run i18n:stamp -- --base upstream/main`.
   - **Ack** an English-only edit (typo, punctuation, casing — meaning unchanged): `npm run i18n:ack -- <key-or-glob> --reason "fix typo"` (optionally `--locale de,fr`). The reason is stored in the append-only `acks` log.
   - Any en edit also needs `npm run i18n:stamp` (or an ack) or `sourceHashes.test.ts` fails.

   `npm run i18n:stale` lists unstamped en keys and the **stale ledger** (`--locale de` / `--all` to list entries). The ledger holds pre-existing debt (seeded from git history) and is shrink-only: CI fails if a PR adds entries; translating an entry and running `i18n:stamp` removes it. Renaming a key counts as a new key (fresh) and is not checked, so when a rename also changes meaning, rename in one PR and edit the English in a follow-up PR. Setting the repo variable `I18N_STALE_STRICT=1` makes a non-empty ledger fail on main. The same PR ratchet (`npm run i18n:stale -- --ci --base origin/main`) also fails if a PR drops ledger entries without translating/acking them, edits existing acks, or hand-grows `hardcoded-baseline.json` or an `identical-allowlist.json` `baseline`.

`scripts/i18n/seed-identical.ts` (re)seeds the identical-allowlist; `npx tsx scripts/i18n/stale.ts init --replay` re-seeds the hashes. Both are for maintainers only.

### CI / Playwright E2E Known Issues

- **WebKit E2E tests are flaky**: `preferences`, `query-state-persistence`, `cascade-state-persistence`, `heatmap-metrics`, and `element-data` tests fail intermittently on WebKit. These are pre-existing upstream issues — they fail on maintainer PRs too.
- **Chromium and Firefox are the reliable indicators** of real failures. If your PR passes on those two, a WebKit-only failure is almost certainly flaky.
- CI runs take ~17-37 minutes per browser (161MB database download + Playwright E2E suite).
- The database is downloaded from a static host during CI, not from S3 directly.

### Codebase Conventions (Not Obvious from Code)

- **Pre-existing lint errors are known and accepted** (mostly `no-explicit-any`) — do not fix them as part of unrelated PRs. Check the current count with `npx eslint . 2>&1 | tail -5` before assuming a new error is yours.
- **`document.execCommand('copy')` return value must be checked** — the maintainer has explicitly requested this for clipboard operations.
- **Import shared types from `src/types/index.ts`** — do not redeclare types that already exist there.
- **Query pages follow parallel structure**: `FusionQuery`, `FissionQuery`, and `TwoToTwoQuery` share the same patterns. Changes to one usually need mirroring to the other two.
- **Collapsible card pattern**: `useState(false)` + `max-h-0/max-h-[800px]` transition + ChevronDown icon rotation.
- **D3 force graphs**: Follow `CascadeNetworkDiagram` patterns (forceLink, forceManyBody, forceCenter, forceCollide).
- **Three.js / React Three Fiber**: Check `package.json` for the pinned `@react-three/fiber` and `@react-three/drei` versions before upgrading — they are constrained by the React major version in use. Use `<primitive object={...} />` for `THREE.Line` (not JSX `<line>`).
- **Always verify current type definitions** in `src/types/index.ts` before writing tests — interfaces evolve and type mismatches are a common PR issue.

### PR Strategy That Works

- **Small, focused, issue-linked PRs** have the highest acceptance rate. Link to an issue with `Fixes #NNN` or `Addresses #NNN`.
- **Test PRs land easily** — unit tests and E2E tests are merged without review comments.
- **Visualization PRs get more scrutiny** — dark mode and i18n must be addressed upfront.
- **Stacked PRs across forks**: GitHub doesn't support using a fork branch as a PR base. Instead, base on `main` and note `Depends on #NNN` in the PR body. When the parent merges, rebase to clean up the diff.

### Fork Contribution Workflow

External contributors work from a fork — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branching, and the pull request process. A few rebase tips that catch people out:

- Already-merged commits are auto-dropped by `git rebase` (or use `git rebase --skip`)
- Stash untracked files with `git stash push -u` (the `-u` flag is essential for new files)
- After force-push, GitHub may show `mergeable_state: dirty` temporarily — it recalculates in ~2 minutes

### Test Coverage

The project has substantial unit test coverage (Vitest) and E2E coverage (Playwright). To see current counts and coverage gaps:

```bash
find src -name '*.test.ts' -o -name '*.test.tsx' | wc -l   # unit test files
find tests/e2e -name '*.spec.ts' | wc -l                   # E2E spec files
npx vitest run --coverage                                  # coverage report
```

Compare the covered file list against `src/pages/` and `src/components/` to find gaps. When writing E2E tests, use the database to find which elements/nuclides to select to put the UI into the state you need to test — don't hardcode element names that might not have relevant data.
