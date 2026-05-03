import { useMemo, useState } from 'react'
import { AlertTriangle, FlaskConical, Search, BookOpen, Loader2 } from 'lucide-react'
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

  const handleFindPathways = async (t: DocumentedTransmutation) => {
    if (!db) return
    setSearches(prev => ({ ...prev, [t.id]: { status: 'loading' } }))

    try {
      // Resolve atomic numbers from element symbols.
      const fromElem = getElementBySymbol(db, t.fromElement)
      const toElem = getElementBySymbol(db, t.toElement)

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
      let fromA = t.fromA
      let toA = t.toA

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
}

function TransmutationCard({ transmutation: t, search, dbReady, onFindPathways }: CardProps) {
  const isLoading = search?.status === 'loading'
  const hasResults = search?.status === 'done'
  const hasError = search?.status === 'error'

  return (
    <div className="card p-4">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left: arrow + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <TransmutationArrow
              fromSymbol={t.fromElement}
              fromA={t.fromA}
              toSymbol={t.toElement}
              toA={t.toA}
            />
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {CATEGORY_LABELS[t.category]}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              ΔZ = {t.deltaZ >= 0 ? `+${t.deltaZ}` : t.deltaZ}
              {t.deltaA !== undefined && (
                <>{' '}· ΔA = {t.deltaA >= 0 ? `+${t.deltaA}` : t.deltaA}</>
              )}
            </span>
          </div>

          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <p>
              <span className="font-medium">Source:</span>{' '}
              {t.doiOrUrl ? (
                <a
                  href={t.doiOrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t.source}
                </a>
              ) : (
                t.source
              )}
            </p>
            <p>
              <span className="font-medium">Setup:</span> {t.setup}
            </p>
            {t.hypothesizedMechanism && (
              <p>
                <span className="font-medium">Hypothesized mechanism:</span>{' '}
                <span className="font-mono text-xs">{t.hypothesizedMechanism}</span>
              </p>
            )}
            {t.replicatedBy && t.replicatedBy.length > 0 && (
              <p>
                <span className="font-medium">Replicated by:</span>{' '}
                {t.replicatedBy.join(', ')}
              </p>
            )}
            {t.notes && (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {t.notes}
              </p>
            )}
          </div>
        </div>

        {/* Right: action button */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={onFindPathways}
            disabled={!dbReady || isLoading}
            className="btn btn-primary flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
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
      </div>

      {/* Pathway results */}
      {hasError && (
        <div className="mt-4 p-3 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-200">
          {search?.error}
        </div>
      )}

      {hasResults && search?.pathways && (
        <PathwayResults pathways={search.pathways} />
      )}
    </div>
  )
}

function PathwayResults({ pathways }: { pathways: Pathway[] }) {
  if (pathways.length === 0) {
    return (
      <div className="mt-4 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span>No 1- or 2-step pathway found in the Parkhomov database for the listed isotopes.</span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          A reported transmutation can still be valid via routes outside the
          Parkhomov tabulation (multi-step beyond depth 2, neutron capture
          chains, beta-decay branches).
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
        Candidate pathways ({pathways.length}):
      </p>
      <ul className="space-y-1.5 text-sm">
        {pathways.map((p, i) => (
          <li
            key={i}
            className="font-mono text-xs p-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {p.steps.length === 1 ? '1-step' : `${p.steps.length}-step`}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                ΣMeV = {p.totalMeV.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 break-all">{formatPathway(p)}</div>
          </li>
        ))}
      </ul>
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

