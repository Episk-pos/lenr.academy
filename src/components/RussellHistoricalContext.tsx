import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Section {
  titleKey: string
  contentKeys: string[]
  /** Optional highlight box at end of section */
  highlightKey?: string
}

const SECTIONS: Section[] = [
  {
    titleKey: 'russellHistory.whoWasRussell.title',
    contentKeys: [
      'russellHistory.whoWasRussell.p1',
      'russellHistory.whoWasRussell.p2',
      'russellHistory.whoWasRussell.p3',
    ],
    highlightKey: 'russellHistory.whoWasRussell.highlight',
  },
  {
    titleKey: 'russellHistory.nineOctaveStructure.title',
    contentKeys: [
      'russellHistory.nineOctaveStructure.p1',
      'russellHistory.nineOctaveStructure.p2',
      'russellHistory.nineOctaveStructure.p3',
    ],
  },
  {
    titleKey: 'russellHistory.westinghouse.title',
    contentKeys: [
      'russellHistory.westinghouse.p1',
      'russellHistory.westinghouse.p2',
      'russellHistory.westinghouse.p3',
    ],
    highlightKey: 'russellHistory.westinghouse.highlight',
  },
  {
    titleKey: 'russellHistory.modernReplication.title',
    contentKeys: [
      'russellHistory.modernReplication.p1',
      'russellHistory.modernReplication.p2',
      'russellHistory.modernReplication.p3',
    ],
    highlightKey: 'russellHistory.modernReplication.highlight',
  },
  {
    titleKey: 'russellHistory.vortexCone.title',
    contentKeys: [
      'russellHistory.vortexCone.p1',
      'russellHistory.vortexCone.p2',
      'russellHistory.vortexCone.p3',
    ],
  },
]

function CollapsibleSection({
  section,
  isOpen,
  onToggle,
}: {
  section: Section
  isOpen: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t(section.titleKey)}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      <div
        className={`transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="px-4 pb-4 space-y-3">
          {section.contentKeys.map((key) => (
            <p key={key} className="text-sm text-gray-600 dark:text-gray-400">
              {t(key)}
            </p>
          ))}
          {section.highlightKey && (
            <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t(section.highlightKey)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RussellHistoricalContext() {
  const { t } = useTranslation()
  const [openSections, setOpenSections] = useState<Set<number>>(new Set())

  const toggleSection = (index: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const allOpen = openSections.size === SECTIONS.length
  const toggleAll = () => {
    if (allOpen) {
      setOpenSections(new Set())
    } else {
      setOpenSections(new Set(SECTIONS.map((_, i) => i)))
    }
  }

  return (
    <div className="card p-6" data-testid="russell-historical-context">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('russellHistory.title')}
        </h3>
        <button
          onClick={toggleAll}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          {allOpen ? t('russellHistory.collapseAll') : t('russellHistory.expandAll')}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('russellHistory.subtitle')}
      </p>
      <div className="space-y-2">
        {SECTIONS.map((section, index) => (
          <CollapsibleSection
            key={section.titleKey}
            section={section}
            isOpen={openSections.has(index)}
            onToggle={() => toggleSection(index)}
          />
        ))}
      </div>
    </div>
  )
}
