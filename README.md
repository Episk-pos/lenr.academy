# LENR Academy - Nanosoft Suite

A modern React SPA reimplementation of the [Nanosoft Package](https://nanosoft.co.nz) for exploring Low Energy Nuclear Reactions (LENR) and cold fusion transmutation pathways. This is a complete rebuild in React/TypeScript of the original PHP web application developed by R.W. Greenyer and P.W. Power.

**🌐 Live Application**: [lenr.academy](https://lenr.academy)

## About

This application provides interactive tools for querying and analyzing nuclear reaction databases originally compiled by Dr. Alexander Parkhomov. The Parkhomov tables contain:

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
- **Offline Database Caching**: IndexedDB caching for faster load times and offline access
- **Download Progress**: Real-time progress indicators during database loading
- **Automatic Updates**: Version checking and update notifications
- **Interactive Periodic Table**: Click-to-select elements with visual feedback
- **Nuclide/Isotope Details**: Comprehensive quantum and nuclear properties
- **Element vs Nuclide Views**: Context-aware detail cards on query pages
- **Multi-element Selection**: Query multiple elements simultaneously
- **CSV Export**: Export query results to spreadsheets

## Technology Stack

- **React 18** + **TypeScript** - Modern UI framework with strict typing
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first styling with dark mode support
- **React Router** - Client-side routing
- **sql.js** - Client-side SQLite database (WebAssembly)
- **IndexedDB** - Browser database caching for offline access
- **Lucide React** - Icon library
- **Context API** - State management (Database, Theme)

## Getting Started

### Prerequisites
- Node.js 18+ or Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Layout.tsx       # Main app layout with sidebar
│   ├── PeriodicTable.tsx            # Standalone periodic table
│   ├── PeriodicTableSelector.tsx    # Multi-select periodic table
│   ├── ElementDetailsCard.tsx       # Element properties display
│   ├── NuclideDetailsCard.tsx       # Nuclide/isotope details
│   ├── DatabaseLoadingCard.tsx      # Download progress UI
│   └── DatabaseUpdateBanner.tsx     # Version update notifications
├── pages/               # Route pages
│   ├── Home.tsx
│   ├── FusionQuery.tsx
│   ├── FissionQuery.tsx
│   ├── TwoToTwoQuery.tsx
│   ├── ShowElementData.tsx
│   ├── TablesInDetail.tsx
│   ├── AllTables.tsx
│   └── CascadesAll.tsx
├── services/            # Data layer
│   ├── database.ts      # Database initialization with streaming download
│   ├── dbCache.ts       # IndexedDB caching and version management
│   ├── queryService.ts  # SQL query execution engine
│   └── mockData.ts      # Sample data for development
├── contexts/            # React contexts
│   ├── DatabaseContext.tsx  # Global database state
│   └── ThemeContext.tsx     # Theme (dark/light) management
├── types/               # TypeScript type definitions
│   └── index.ts
├── App.tsx              # Main app component with routing
├── main.tsx             # Application entry point
└── index.css            # Global styles with theme support
```

## Current Status

**Phase 1-4 Complete** ✅:
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
- ✅ **Deployed to production** at [lenr.academy](https://lenr.academy)

**Next Steps**:
- [ ] Add data visualization components (charts, graphs)
- [ ] Implement cascade simulation logic
- [ ] Add query history and saved queries
- [ ] Performance optimization with web workers
- [ ] Enhanced PWA support with service workers

## Data Sources

Based on the groundbreaking work of:
- **Dr. Alexander Parkhomov** - Original Parkhomov tables (2018)
- **Martin Fleischmann Memorial Project** - Data compilation and research
- **R.W. Greenyer and P.W. Power** - Original [Nanosoft Package](https://nanosoft.co.nz) (PHP application)

## Credits & Attribution

This is a modern React/TypeScript reimplementation of the original Nanosoft Package PHP web application. We are grateful to **R.W. Greenyer** and **P.W. Power** for their pioneering work in making this important LENR research accessible to the scientific community.

**Original Application**: [nanosoft.co.nz](https://nanosoft.co.nz)

The original PHP application and comprehensive documentation remain available at the link above. This React version aims to provide enhanced interactivity, modern web features (offline caching, responsive design, dark mode), and improved user experience while preserving the scientific integrity of the original work.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** - see the [LICENSE.md](LICENSE.md) file for details.

This is an open science project. Data tables are publicly available from the Martin Fleischmann Memorial Project.

### Repository

- **GitHub**: [Episk-pos/lenr.academy](https://github.com/Episk-pos/lenr.academy)
- **Bug Reports**: [Submit an issue](https://github.com/Episk-pos/lenr.academy/issues)
- **Feature Requests**: [Request a feature](https://github.com/Episk-pos/lenr.academy/issues/new?labels=enhancement)

## Analytics

This project uses **Umami Analytics** - a privacy-friendly analytics solution that is GDPR compliant and doesn't use cookies.

### Setting Up Umami Cloud (Recommended)

1. **Create a Free Umami Cloud Account**
   - Visit: https://cloud.umami.is
   - Sign up for a free account (includes 100k events/month)

2. **Add Your Website**
   - Go to Settings → Websites → Add Website
   - Enter your domain (e.g., "lenr.academy")
   - Copy the **Website ID** (a UUID string)
   - Copy the tracking script URL (e.g., `https://cloud.umami.is/script.js`)

3. **Update the Analytics Script**
   - Open `index.html` in the project
   - Replace `YOUR-UMAMI-URL` with `https://cloud.umami.is`
   - Replace `YOUR-WEBSITE-ID` with the Website ID from step 2
   - Save and deploy

4. **View Your Analytics**
   - Go to your Umami Cloud dashboard: https://cloud.umami.is
   - See real-time visitors, pageviews, referrers, devices, and countries

### What Gets Tracked

- Page views
- Unique visitors
- Referral sources
- Countries and regions
- Devices and browsers
- **No personal data**, **no cookies**, fully GDPR compliant

## Contributing

Contributions welcome! This is an educational tool for exploring LENR theory and data.
