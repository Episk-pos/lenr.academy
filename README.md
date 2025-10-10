# LENR Academy - Nanosoft Suite

[![E2E Tests](https://github.com/Episk-pos/lenr.academy/actions/workflows/e2e-main.yml/badge.svg)](https://github.com/Episk-pos/lenr.academy/actions/workflows/e2e-main.yml)
[![Deploy to Production](https://github.com/Episk-pos/lenr.academy/actions/workflows/deploy.yml/badge.svg)](https://github.com/Episk-pos/lenr.academy/actions/workflows/deploy.yml)

A modern web application for exploring Low Energy Nuclear Reactions (LENR) and cold fusion transmutation pathways. Built on Dr. Alexander Parkhomov's nuclear reaction databases, this tool provides interactive queries and analysis of thermodynamically favorable nuclear transmutations.

**🌐 Live Application**: [lenr.academy](https://lenr.academy)

**💬 Community**: [GitHub Discussions](https://github.com/Episk-pos/lenr.academy/discussions)

**📊 Analytics Dashboard**: [Public Usage Statistics](https://cloud.umami.is/share/JGkYeKU60K9D1t4U)

## About

This application provides interactive tools for querying and analyzing a SQLite nuclear reaction database originally compiled by Dr. Alexander Parkhomov. The Parkhomov tables contain:

- **1,389 fusion reactions** - combining lighter nuclei
- **817 fission reactions** - splitting heavier nuclei
- **516,789 two-to-two reactions** - transforming pairs of nuclides

All reactions are exothermic (energy-producing) and represent thermodynamically favorable pathways for nuclear transmutation.

## Features

### Core Query Tools ("Big Three")
- **Fusion Reactions**: Query reactions where two nuclei combine to form a heavier nucleus
- **Fission Reactions**: Query reactions where heavy nuclei split into lighter products
- **Two-To-Two Reactions**: Query 2-2 transmutation reactions

### Supporting Tools
- **Show Element Data**: Interactive periodic table and element property viewer with isotope selection
- **Tables in Detail**: Database schema browser
- **All Tables**: Advanced SQL query builder for custom queries
- **Cascade Simulations**: Model chain reactions and predict reaction products

### Advanced Features
- **Dark/Light Theme**: Toggle between themes with system preference detection
- **Offline SQLite Database Caching**: IndexedDB caching for faster load times and offline access
- **Download Progress**: Real-time progress indicators during database loading
- **Automatic Updates**: Version checking and update notifications
- **Interactive Periodic Table**: Click-to-select elements with visual feedback
- **Nuclide/Isotope Details**: Comprehensive quantum and nuclear properties
- **Element vs Nuclide Views**: Context-aware detail cards on query pages
- **Multi-element Selection**: Query multiple elements simultaneously
- **CSV Export**: Export query results to spreadsheets
- **Error Tracking**: Privacy-focused error monitoring with Sentry (GDPR-compliant, EU hosting)

## Screenshots

### Desktop Views

<img src="docs/screenshots/desktop/home-light.png" alt="Home page with feature overview" width="600"/>

*Home page with feature overview*

<img src="docs/screenshots/desktop/fusion-query-light.png" alt="Fusion Reactions query interface" width="600"/>

*Fusion Reactions query interface*

<img src="docs/screenshots/desktop/element-data-dark.png" alt="Show Element Data with interactive periodic table (dark mode)" width="600"/>

*Show Element Data with interactive periodic table (dark mode)*

### Mobile Views

<p>
  <img src="docs/screenshots/mobile/sidebar-open-dark.png" alt="Mobile navigation sidebar (dark mode)" width="250"/>
  <img src="docs/screenshots/mobile/fusion-query-light.png" alt="Fusion Reactions query interface" width="250"/>
  <img src="docs/screenshots/mobile/element-data-light.png" alt="Show Element Data page" width="250"/>
</p>

*Mobile views: Navigation sidebar (dark mode), Fusion Reactions query, and Show Element Data*

> 📸 **Screenshots are auto-generated** using Playwright. To regenerate: `npm run screenshots`

## Database

The application uses a **154MB SQLite database** (`parkhomov.db`) containing all nuclear reaction data. The database is:

- **Format**: SQLite 3.x
- **Size**: 154 MB (uncompressed)
- **Tables**: NuclidesPlus, ElementPropertiesPlus, FusionReactions, FissionReactions, TwoToTwoReactions
- **Hosted**: [db.lenr.academy](https://db.lenr.academy/) - versioned storage with S3
- **Download**: Available in [GitHub release assets](https://github.com/Episk-pos/lenr.academy/releases/latest) for offline use or external analysis

The database runs entirely client-side in your browser using [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly). It's automatically cached in IndexedDB for faster subsequent loads.

### Database Versions

All database versions are available at **[db.lenr.academy](https://db.lenr.academy/)** with:
- Human-readable version browser
- API access at [versions.json](https://db.lenr.academy/versions.json)
- Direct downloads of any version
- MD5 checksums for verification

## Data Sources

Based on the groundbreaking work of:
- **Dr. Alexander Parkhomov** - Original Parkhomov tables (2018)
- **Martin Fleischmann Memorial Project** - Data compilation and research
- **R.W. Greenyer and P.W. Power** - Original [Nanosoft Package](https://nanosoft.co.nz) (PHP application)

## Credits & Attribution

This is a modern reimplementation of the original **Nanosoft Package** PHP web application developed by **R.W. Greenyer** and **P.W. Power**. We are grateful for their pioneering work in making LENR research accessible to the scientific community.

**Original Application**: [nanosoft.co.nz](https://nanosoft.co.nz)

## For Developers

Interested in contributing or running locally?

- 📖 **[Contributing Guide](CONTRIBUTING.md)** - How to contribute, setup instructions, development workflow
- 🛠️ **[Developer Documentation](docs/DEVELOPMENT.md)** - Architecture, technology stack, deployment guides
- 💬 **[GitHub Discussions](https://github.com/Episk-pos/lenr.academy/discussions)** - Ask questions and share ideas

## Initial Development Roadmap

### Phase 1-4 Complete ✅

- ✅ Project setup with Vite + React + TypeScript + TailwindCSS
- ✅ Core TypeScript interfaces and data models
- ✅ Responsive layout with sidebar navigation and dark mode
- ✅ "Big Three" query tools (Fusion, Fission, TwoToTwo)
- ✅ Supporting pages (Element Data, Tables, All Tables, Cascades)
- ✅ **sql.js integration** with client-side SQLite database
- ✅ **Complete Parkhomov data loaded** (1,389 fusion + 817 fission + 516,789 two-to-two reactions)
- ✅ **IndexedDB caching** with version management and offline support
- ✅ **Streaming download** with real-time progress indicators
- ✅ **Real SQL query execution** across all query pages
- ✅ **PeriodicTableSelector component** with multi-select
- ✅ **Periodic table element selector** on Show Element Data page
- ✅ **Element and Nuclide detail cards** with comprehensive properties
- ✅ **Isotope selection interface** with B/F badges and stability indicators
- ✅ Advanced filtering (multi-element, energy ranges, neutrino types)
- ✅ Dynamic SQL preview and query execution timing
- ✅ CSV export functionality
- ✅ **Privacy-focused error tracking** with Sentry (GDPR-compliant, EU hosting)
- ✅ **Deployed to production** at [lenr.academy](https://lenr.academy)

### Phase 5: Next Steps

- [ ] **Data Visualization**
  - Energy distribution charts (histogram/density plots)
  - Reaction network diagrams (force-directed graphs)
  - Isotope chart (Segré chart visualization)
  - 3D periodic table visualization

- [ ] **Cascade Simulations**
  - Implement cascade algorithm (iterative reaction chains)
  - Visualize reaction pathways and products
  - Probabilistic branching support
  - Export cascade results

- [ ] **Query History & Bookmarks**
  - Save frequently used queries
  - Query history with timestamps
  - Share queries via URL parameters
  - Export/import query sets

- [ ] **Performance Optimizations**
  - Web Workers for heavy computations
  - Virtual scrolling for large result sets
  - Lazy loading of isotope data
  - Query result caching

- [ ] **PWA Features**
  - Service worker for true offline support
  - App manifest for installability
  - Background sync for database updates
  - Push notifications for new data

- [ ] **Educational Content**
  - Interactive tutorials
  - Glossary of nuclear physics terms
  - Video explanations
  - Example queries and use cases

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE.md](LICENSE.md) file for details.

This is an open science project. All data and code are publicly available to advance LENR research.
