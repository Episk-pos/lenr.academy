import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  FlaskConical,
  Search,
  BookOpen,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import {
  DOCUMENTED_TRANSMUTATIONS,
  type DocumentedTransmutation,
  type TransmutationCategory,
} from '../data/documentedTransmutations'
import { getElementBySymbol } from '../services/queryService'
import {
  findPathways,
  formatPathway,
  type Pathway,
} from '../services/transmutationPathwayService'
import TransmutationArrow from '../components/TransmutationArrow'
import NuclideEquation from '../components/NuclideEquation'

const CATEGORY_LABELS: Record<TransmutationCategory, string> = {
  'solid-state': 'Solid-state',
  'biological': 'Biological',
  'glow-discharge': 'Glow discharge',
  'thin-film': 'Thin film',
  'co-deposition': 'Co-deposition',
}

interface PathwaySearchState {
  status: 'idle' | 'loading' | 'done' | 'error'
  pathways?: Pathway[]
  error?: string
}

export default function Transmutations() {
  const { db, isLoading: dbLoading } = useDatabase()
  const [categoryFilter, setCategoryFilter] = useState<'all' | TransmutationCategory>('all')
  const [labFilter, setLabFilter] = useState<string>('all')
  const [searches, setSearches] = useState<Record<string, PathwaySearchState>>({})

  const allLabs = useMemo(() => {
    const set = new Set<string>()
    DOCUMENTED_TRANSMUTATIONS.forEach(t => {
      // First word(s) before "et al" or "(" — coarse but works for current dataset.
      const lab = t.source.split(/,| \(/)[0].trim()
      set.add(lab)
    })
    return Array.from(set).sort()
  }, [])

  const filteredTransmutations = useMemo(() => {
    return DOCUMENTED_TRANSMUTATIONS.filter(t => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (labFilter !== 'all' && !t.source.startsWith(labFilter)) return false
      return true
    })
  }, [categoryFilter, labFilter])

  // Hydrogen isotopes are stored in NuclidesPlus but not as separate
  // entries in ElementPropertiesPlus (all share Z=1 = elemental H), so
  // getElementBySymbol returns null for 'D' / 'T'. Map them directly here.
  const HYDROGEN_ISOTOPES: Record<string, { Z: number; defaultA: number }> = {
    H: { Z: 1, defaultA: 1 },
    D: { Z: 1, defaultA: 2 },
    T: { Z: 1, defaultA: 3 },
  }

  const resolveSymbol = (
    symbol: string
  ): { Z: number; defaultA?: number } | null => {
    if (HYDROGEN_ISOTOPES[symbol]) return HYDROGEN_ISOTOPES[symbol]
    const elem = getElementBySymbol(db!, symbol)
    return elem ? { Z: elem.Z } : null
  }

  const handleClearPathways = (id: string) => {
    setSearches(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleFindPathways = async (t: DocumentedTransmutation) => {
    if (!db) return
    setSearches(prev => ({ ...prev, [t.id]: { status: 'loading' } }))

    try {
      // Resolve atomic numbers from element symbols.
      const fromElem = resolveSymbol(t.fromElement)
      const toElem = resolveSymbol(t.toElement)

      if (!fromElem || !toElem) {
        setSearches(prev => ({
          ...prev,
          [t.id]: {
            status: 'error',
            error: `Element ${!fromElem ? t.fromElement : t.toElement} not found in database.`,
          },
        }))
        return
      }

      // Resolve mass numbers — fall back to most-abundant isotope when unspecified.
      let fromA = t.fromA ?? fromElem.defaultA
      let toA = t.toA ?? toElem.defaultA

      if (fromA === undefined) {
        const candidate = inferMassNumber(db, t.fromElement)
        if (candidate !== null) fromA = candidate
      }
      if (toA === undefined) {
        const candidate = inferMassNumber(db, t.toElement)
        if (candidate !== null) toA = candidate
      }

      if (fromA === undefined || toA === undefined) {
        setSearches(prev => ({
          ...prev,
          [t.id]: {
            status: 'error',
            error: 'Could not resolve a specific isotope for this transmutation.',
          },
        }))
        return
      }

      // Defer the actual query to next tick so the loading spinner renders.
      await new Promise(resolve => setTimeout(resolve, 0))

      const pathways = findPathways(db, fromElem.Z, fromA, toElem.Z, toA, {
        maxResults: 20,
      })

      setSearches(prev => ({
        ...prev,
        [t.id]: { status: 'done', pathways },
      }))
    } catch (err) {
      setSearches(prev => ({
        ...prev,
        [t.id]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      }))
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-6 h-6 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Transmutation Pathway Explorer
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Documented LENR transmutation claims from primary sources, paired with
          candidate two-step pathways from the Parkhomov reaction database.
        </p>
      </div>

      {/* Disclaimer banner */}
      <div className="card p-4 mb-6 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-medium mb-1">Documented claims, not verified mechanisms.</p>
            <p>
              The transmutations listed below were reported in primary literature.
              The Parkhomov database may show A+B → C+D pathways permitting these
              net transformations; this does <strong>not</strong> prove the
              originally hypothesized mechanism is correct. Pathways are
              candidate routes through allowed elementary reactions, not
              experimental evidence.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex flex-wrap gap-1.5">
          <FilterButton
            label="All categories"
            active={categoryFilter === 'all'}
            onClick={() => setCategoryFilter('all')}
          />
          {(Object.keys(CATEGORY_LABELS) as TransmutationCategory[]).map(cat => (
            <FilterButton
              key={cat}
              label={CATEGORY_LABELS[cat]}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            />
          ))}
        </div>
        <select
          value={labFilter}
          onChange={e => setLabFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          aria-label="Filter by source lab"
        >
          <option value="all">All sources</option>
          {allLabs.map(lab => (
            <option key={lab} value={lab}>{lab}</option>
          ))}
        </select>
      </div>

      {/* Transmutation cards */}
      <div className="space-y-4">
        {filteredTransmutations.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No transmutations match the current filters.
          </p>
        ) : (
          filteredTransmutations.map(t => (
            <TransmutationCard
              key={t.id}
              transmutation={t}
              search={searches[t.id]}
              dbReady={!!db && !dbLoading}
              onFindPathways={() => handleFindPathways(t)}
              onClearPathways={() => handleClearPathways(t.id)}
            />
          ))
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-8 text-center">
        Curated from the{' '}
        <a
          href="https://humanscholars.online/research/lenr-low-energy-nuclear-reactions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-600 dark:hover:text-primary-400 underline"
        >
          HumanScholars LENR literature review
        </a>
        . {DOCUMENTED_TRANSMUTATIONS.length} entries.
      </p>
    </div>
  )
}

function inferMassNumber(db: import('sql.js').Database, elementSymbol: string): number | null {
  // Use a reasonable default — the most abundant isotope in NuclidesPlus.
  // This is a coarse fallback for entries that report only an element-level claim.
  const sql = `
    SELECT A FROM NuclidesPlus
    WHERE E = ?
    ORDER BY pcaNCrust DESC, A ASC
    LIMIT 1
  `
  const results = db.exec(sql, [elementSymbol])
  if (results.length === 0 || results[0].values.length === 0) return null
  return results[0].values[0][0] as number
}

interface CardProps {
  transmutation: DocumentedTransmutation
  search?: PathwaySearchState
  dbReady: boolean
  onFindPathways: () => void
  onClearPathways: () => void
}

/**
 * Split a hypothesized-mechanism string into a leading prose description and
 * the equation that follows, using the first ":" as the delimiter. When no
 * ":" is present the entire string is treated as prose with no equation.
 */
function splitMechanism(raw: string): { prose: string; equation: string | null } {
  const idx = raw.indexOf(':')
  if (idx === -1) return { prose: raw.trim(), equation: null }
  const prose = raw.slice(0, idx).trim()
  const equation = raw.slice(idx + 1).trim()
  return { prose, equation: equation.length > 0 ? equation : null }
}

function TransmutationCard({ transmutation: t, search, dbReady, onFindPathways, onClearPathways }: CardProps) {
  const isLoading = search?.status === 'loading'
  const hasResults = search?.status === 'done'
  const hasError = search?.status === 'error'

  const mechanism = t.hypothesizedMechanism
    ? splitMechanism(t.hypothesizedMechanism)
    : null

  return (
    <div className="card p-4 sm:p-5">
      {/* ZONE A — Header: arrow + identity chips */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <TransmutationArrow
          fromSymbol={t.fromElement}
          fromA={t.fromA}
          toSymbol={t.toElement}
          toA={t.toA}
        />
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
          {CATEGORY_LABELS[t.category]}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          ΔZ = {t.deltaZ >= 0 ? `+${t.deltaZ}` : t.deltaZ}
        </span>
        {t.deltaA !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            ΔA = {t.deltaA >= 0 ? `+${t.deltaA}` : t.deltaA}
          </span>
        )}
      </div>

      {/* ZONE B — Citation block */}
      <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 border-l-4 border-l-primary-200 dark:border-l-primary-800 bg-gray-50 dark:bg-gray-800/50 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm text-gray-800 dark:text-gray-200 min-w-0">
            <BookOpen className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5 text-gray-400 dark:text-gray-500" />
            {t.source}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {t.sourceTag && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300">
                {t.sourceTag}
              </span>
            )}
            {t.doiOrUrl && (
              <a
                href={t.doiOrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <span>View source</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
        {t.replicatedBy && t.replicatedBy.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Replicated by
            </span>
            {t.replicatedBy.map((lab) => (
              <span
                key={lab}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                {lab}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ZONE C — Mechanism + setup definition list */}
      <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm mb-4">
        <dt className="text-[11px] uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 pt-0.5">
          Setup
        </dt>
        <dd className="text-gray-700 dark:text-gray-300">{t.setup}</dd>

        {mechanism && (
          <>
            <dt className="text-[11px] uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 pt-0.5">
              Mechanism
            </dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {mechanism.prose && (
                <span className="block sm:inline">{mechanism.prose}</span>
              )}
              {mechanism.equation && (
                <>
                  {mechanism.prose && <span className="hidden sm:inline">: </span>}
                  <NuclideEquation
                    input={mechanism.equation}
                    className="font-mono"
                  />
                </>
              )}
            </dd>
          </>
        )}
      </dl>

      {t.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-4">
          {t.notes}
        </p>
      )}

      {/* ZONE D — CTA footer */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={onFindPathways}
          disabled={!dbReady || isLoading}
          className="btn btn-primary inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          data-testid={`find-pathways-${t.id}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Searching...' : 'Find Parkhomov pathways'}</span>
        </button>
      </div>

      {/* Pathway results */}
      {hasError && (
        <div className="mt-4 p-3 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-200 flex items-start justify-between gap-3">
          <span>{search?.error}</span>
          <button
            onClick={onClearPathways}
            className="text-red-700 dark:text-red-300 hover:underline text-xs flex-shrink-0"
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {hasResults && search?.pathways && (
        <PathwayResults pathways={search.pathways} onClear={onClearPathways} />
      )}
    </div>
  )
}

function PathwayResults({ pathways, onClear }: { pathways: Pathway[]; onClear: () => void }) {
  if (pathways.length === 0) {
    return (
      <div className="mt-4 p-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500" />
            <div>
              <p className="font-medium">
                No 1- or 2-step pathway found in the Parkhomov database for the listed isotopes.
              </p>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                A reported transmutation can still be valid via routes outside the
                Parkhomov tabulation (multi-step beyond depth 2, neutron capture
                chains, beta-decay branches). For multi-step pathways with
                cycling intermediates, try the{' '}
                <Link
                  to="/cycles"
                  className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  Cycle Discovery
                </Link>{' '}
                tool.
              </p>
            </div>
          </div>
          <button
            onClick={onClear}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs flex-shrink-0"
            type="button"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Candidate pathways ({pathways.length})
        </p>
        <button
          onClick={onClear}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs"
          type="button"
          aria-label="Dismiss pathway results"
        >
          ✕
        </button>
      </div>
      <ol className="space-y-2 text-sm">
        {pathways.map((p, i) => {
          // formatPathway emits multi-step segments joined by " | ".
          const segments = formatPathway(p).split(' | ')
          return (
            <li
              key={i}
              className="flex items-start gap-2.5 p-2.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <span className="inline-flex items-center justify-center flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 text-xs font-semibold">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                {segments.map((seg, j) => (
                  <NuclideEquation
                    key={j}
                    input={seg}
                    className="block font-mono text-xs sm:text-sm text-gray-800 dark:text-gray-100"
                  />
                ))}
              </div>
              <span className="inline-flex items-center flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200">
                ΣMeV {p.totalMeV.toFixed(2)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
        active
          ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  )
}

