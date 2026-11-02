import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import type { Database } from 'sql.js'
import type { DecayChainResult } from '../types'
import { traceDecayChain } from '../services/decayChainService'
import DecayChainDiagram from './DecayChainDiagram'

interface DecayChainSectionProps {
  db: Database | null
  Z: number
  A: number
}

/**
 * Collapsible "Decay Chain Visualization" section with depth / branching
 * controls, chain metadata and the decay tree diagram. Renders nothing when
 * the nuclide has no decay chain (stable or no decay data).
 */
export default function DecayChainSection({ db, Z, A }: DecayChainSectionProps) {
  const { t } = useTranslation()
  const [decayChain, setDecayChain] = useState<DecayChainResult | null>(null)
  const [showDecayChain, setShowDecayChain] = useState(false)
  const [chainDepth, setChainDepth] = useState(5)
  const [minBranchingRatio, setMinBranchingRatio] = useState(10)

  useEffect(() => {
    if (!db) {
      setDecayChain(null)
      return
    }

    try {
      setDecayChain(traceDecayChain(db, Z, A, {
        maxDepth: chainDepth,
        minBranchingRatio
      }))
    } catch (error) {
      console.error('Error tracing decay chain:', error)
      setDecayChain(null)
    }
  }, [db, Z, A, chainDepth, minBranchingRatio])

  if (!decayChain || decayChain.totalGenerations === 0) {
    return null
  }

  return (
    <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg" data-testid="decay-chain-section">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
          {t('elements.decayChainVisualization')}
        </h3>
        <button
          onClick={() => setShowDecayChain(!showDecayChain)}
          className="btn btn-secondary p-2"
          title={showDecayChain ? t('elements.collapseDecayChain') : t('elements.expandDecayChain')}
          aria-label={showDecayChain ? t('elements.collapseDecayChain') : t('elements.expandDecayChain')}
        >
          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showDecayChain ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showDecayChain ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {/* Controls */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
              {t('elements.maxDepthGenerations', { depth: chainDepth })}
            </label>
            <input
              type="range"
              min="1"
              max="15"
              value={chainDepth}
              onChange={(e) => setChainDepth(parseInt(e.target.value))}
              className="w-full h-2 bg-purple-200 dark:bg-purple-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
              {t('elements.minBranchingRatio', { ratio: minBranchingRatio })}
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={minBranchingRatio}
              onChange={(e) => setMinBranchingRatio(parseInt(e.target.value))}
              className="w-full h-2 bg-purple-200 dark:bg-purple-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Chain Info */}
        <div className="text-xs text-purple-800 dark:text-purple-300 mb-4 space-y-1">
          <div><strong>{t('elements.totalGenerations')}:</strong> {decayChain.totalGenerations}</div>
          <div><strong>{t('elements.branchCount')}:</strong> {decayChain.branchCount}</div>
          <div data-testid="decay-chain-terminals">
            <strong>{t('elements.terminalNuclides')}:</strong> {decayChain.terminalNuclides.map(n => `${n.E}-${n.A}`).join(', ')}
            {' '}
            ({decayChain.terminalNuclides.filter(n => n.isStable).length} {t('elements.stableCount')},{' '}
            {decayChain.terminalNuclides.filter(n => !n.isStable && !n.stabilityUnknown).length} {t('elements.radioactiveCount')})
          </div>
        </div>

        {/* Diagram */}
        <DecayChainDiagram root={decayChain.root} maxHeight={300} />
      </div>
    </div>
  )
}
