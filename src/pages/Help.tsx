import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, Beaker, ArrowRight } from 'lucide-react'
import { GLOSSARY, GLOSSARY_CATEGORIES, GlossaryEntry } from '../data/glossary'
import { EXAMPLE_QUERIES, ExampleQuery } from '../data/exampleQueries'

export default function Help() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredGlossary = useMemo(() => {
    let entries = GLOSSARY;
    if (selectedCategory !== 'all') {
      entries = entries.filter(e => e.category === selectedCategory);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      entries = entries.filter(
        e => e.term.toLowerCase().includes(lower) || e.definition.toLowerCase().includes(lower)
      );
    }
    return entries.sort((a, b) => a.term.localeCompare(b.term));
  }, [searchTerm, selectedCategory]);

  const handleTryQuery = (query: ExampleQuery) => {
    const params = new URLSearchParams();

    // Reaction query types (fusion, fission, twotwo)
    if (query.queryType === 'fusion' || query.queryType === 'fission' || query.queryType === 'twotwo') {
      if (query.element1List?.length) params.set('e1', query.element1List.join(','));
      if (query.element2List?.length) params.set('e2', query.element2List.join(','));
      if (query.outputElementList?.length) params.set('e', query.outputElementList.join(','));
      if (query.filter.elements?.length) params.set('e', query.filter.elements.join(','));
      if (query.filter.minMeV !== undefined) params.set('minMeV', String(query.filter.minMeV));
      if (query.filter.maxMeV !== undefined) params.set('maxMeV', String(query.filter.maxMeV));

      const routes = { fusion: '/fusion', fission: '/fission', twotwo: '/twotwo' } as const;
      const search = params.toString();
      navigate(`${routes[query.queryType]}${search ? `?${search}` : ''}`);
      return;
    }

    // Element data links
    if (query.queryType === 'element-data') {
      if (query.elementZ !== undefined) params.set('Z', String(query.elementZ));
      if (query.elementA !== undefined) params.set('A', String(query.elementA));
      navigate(`/element-data?${params.toString()}`);
      return;
    }

    // Cascades links
    if (query.queryType === 'cascades') {
      if (query.materialId) params.set('material', query.materialId);
      navigate(`/cascades?${params.toString()}`);
      return;
    }

    // Muller Resonance links
    if (query.queryType === 'muller-resonance') {
      if (query.mullerParams) {
        for (const [key, val] of Object.entries(query.mullerParams)) {
          params.set(key, val);
        }
      }
      navigate(`/muller-resonance?${params.toString()}`);
      return;
    }

    // Exhaustiveness check — ensures all queryType values are handled
    const _exhaustive: never = query.queryType;
    console.warn(`Unhandled query type: ${_exhaustive}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('help.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('help.subtitle')}
        </p>
      </div>

      {/* Example Queries Section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Beaker className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('help.exampleQueries')}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('help.exampleQueriesDescription')}
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXAMPLE_QUERIES.map((query, index) => (
            <button
              key={index}
              className="card p-4 hover:border-primary-300 dark:hover:border-primary-600 focus:border-primary-300 dark:focus:border-primary-600 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-colors cursor-pointer group text-left"
              onClick={() => handleTryQuery(query)}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  {query.name}
                </h3>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 shrink-0 ml-2">
                  {{ fusion: 'fusion', fission: 'fission', twotwo: '2→2', 'element-data': 'element', cascades: 'cascade', 'muller-resonance': 'resonance' }[query.queryType]}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {query.description}
              </p>
              <span className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                {t('help.tryQuery')} <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Glossary Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('help.glossary')}
          </h2>
        </div>

        {/* Search and filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('help.searchGlossary')}
              aria-label={t('help.searchGlossary')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <CategoryButton
              label={t('help.allCategories')}
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
            />
            {Object.entries(GLOSSARY_CATEGORIES).map(([key, label]) => (
              <CategoryButton
                key={key}
                label={t(label)}
                active={selectedCategory === key}
                onClick={() => setSelectedCategory(key)}
              />
            ))}
          </div>
        </div>

        {/* Glossary entries */}
        <div className="space-y-2">
          {filteredGlossary.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              {t('help.noResults')}
            </p>
          ) : (
            filteredGlossary.map((entry) => (
              <GlossaryItem key={entry.term} entry={entry} />
            ))
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
          {t('help.glossaryCount', { count: GLOSSARY.length })}
        </p>
      </section>
    </div>
  );
}

function CategoryButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
  );
}

function GlossaryItem({ entry }: { entry: GlossaryEntry }) {
  const { t } = useTranslation()
  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {entry.term}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {entry.definition}
          </p>
          {entry.relatedTerms && entry.relatedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.relatedTerms.map((term) => (
                <span
                  key={term}
                  className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  {term}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
          {t(GLOSSARY_CATEGORIES[entry.category])}
        </span>
      </div>
    </div>
  );
}
