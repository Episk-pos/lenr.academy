# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LENR Academy is a React/TypeScript SPA that provides interactive tools for exploring Low Energy Nuclear Reactions (LENR) and cold fusion transmutation pathways. It's a modern reimplementation of the original [Nanosoft Package](https://nanosoft.co.nz) PHP application developed by R.W. Greenyer and P.W. Power.

The application operates entirely client-side using a 154MB SQLite database (parkhomov.db) containing Dr. Alexander Parkhomov's nuclear reaction tables:
- 1,389 fusion reactions
- 817 fission reactions
- 516,789 two-to-two reactions

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
npm run deploy:cache # Invalidate CloudFront distribution
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

1. **First Load**: Downloads parkhomov.db (154MB) from `/public/parkhomov.db` with streaming fetch and progress tracking
2. **Caching**: Stores database in IndexedDB via `dbCache.ts` with version metadata
3. **Subsequent Loads**: Loads from IndexedDB cache instantly
4. **Updates**: Checks `/parkhomov.db.meta.json` for version changes and shows update banner when available

**Key tables**:
- `NuclidesPlus` - Nuclide properties (Z, A, binding energy, half-life, boson/fermion flags)
- `ElementPropertiesPlus` - Element properties (melting point, density, electronegativity, etc.)
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
- **Metered Connection Detection**: Uses Network Information API to warn before 154MB download on cellular connections (localStorage key: `lenr-metered-download-consent`)

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

## Data Types

All type definitions are in `src/types/index.ts`:

- `Nuclide` - Isotope data (Z, A, binding energy, half-life, boson/fermion type)
- `Element` - Chemical element properties
- `FusionReaction` - Two inputs → one output
- `FissionReaction` - One input → two outputs
- `TwoToTwoReaction` - Two inputs → two outputs
- `QueryFilter` - Filter parameters for reaction queries
- `QueryResult` - Standardized query response with timing

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

### Testing Metered Connection Warning

The Network Information API has limited browser support. To test the metered warning:

1. Open `src/contexts/DatabaseContext.tsx`
2. Uncomment line 9: `return true;` in `isMeteredConnection()`
3. Clear localStorage and IndexedDB
4. Refresh page

The warning will only trigger in production on mobile browsers with cellular connections.

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
├── parkhomov.db           # SQLite database (154MB, gitignored)
├── parkhomov.db.meta.json # Version metadata for update detection
└── sql-wasm.wasm          # sql.js WebAssembly binary
```

## Database Storage & Versioning

The SQLite database is **not stored in Git** due to its 154MB size. Instead, it's stored in a dedicated S3 bucket with explicit versioning:

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

The `.gitignore` excludes `*.db` files but keeps `!*.db.meta.json` for version tracking. The 154MB database file is never committed to Git - it's stored in S3 with explicit versioning.
