import { Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { Atom, Beaker, Zap, Database, Activity } from 'lucide-react'
import { parkhomovLink, nanosoftLink } from '../components/ExternalLinks'

export default function Home() {
  const { t } = useTranslation()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Atom className="w-16 h-16 text-primary-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {t('home.title')}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          {t('home.subtitle')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          <Trans
            i18nKey="home.basedOn"
            components={{
              parkhomovLink,
              nanosoftLink
            }}
          />
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Beaker className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('home.queryReactions.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {t('home.queryReactions.description')}
              </p>
              <div className="space-y-2">
                <Link to="/fusion" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.queryReactions.fusionReactions')}
                </Link>
                <Link to="/fission" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.queryReactions.fissionReactions')}
                </Link>
                <Link to="/twotwo" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.queryReactions.twoToTwoReactions')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('home.cascadeSimulations.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {t('home.cascadeSimulations.description')}
              </p>
              <div className="space-y-2">
                <Link to="/cascades" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.cascadeSimulations.runSimulations')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('home.elementData.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {t('home.elementData.description')}
              </p>
              <div className="space-y-2">
                <Link to="/element-data" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.elementData.showElementData')}
                </Link>
                <Link to="/tables" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.elementData.tablesInDetail')}
                </Link>
                <Link to="/all-tables" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.elementData.allTables')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('home.mullerResonance.title')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {t('home.mullerResonance.description')}
              </p>
              <div className="space-y-2">
                <Link to="/muller-resonance" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → {t('home.mullerResonance.explore')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          {t('home.aboutData.title')}
        </h2>
        <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
          <p className="mb-3">
            <Trans
              i18nKey="home.aboutData.description"
              components={{
                strong: <strong />,
                nanosoftLink
              }}
            />
          </p>
        </div>
        <a
          href="https://nanosoft.co.nz"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          → {t('home.aboutData.visitNanosoft')}
        </a>
      </div>

      <div className="card p-6 mt-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          {t('home.openSource.title')}
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          {t('home.openSource.description')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/Episk-pos/lenr.academy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            {t('home.openSource.viewGitHub')}
          </a>
          <a
            href="https://github.com/Episk-pos/lenr.academy/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            {t('home.openSource.joinDiscussions')}
          </a>
          <a
            href="https://github.com/Episk-pos/lenr.academy/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            {t('home.openSource.reportIssue')}
          </a>
        </div>
      </div>
    </div>
  )
}
