import { ReactNode, useEffect, useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Atom, Moon, Sun, ChevronLeft, ChevronRight, Home as HomeIcon, GitMerge, Scissors, ArrowLeftRight, FlaskConical, Table, TableProperties, Shield, Workflow, HelpCircle, Waves, Beaker } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { useLayout } from '../contexts/LayoutContext'
import { useLanguage } from '../contexts/LanguageContext'
import DatabaseUpdateBanner from './DatabaseUpdateBanner'
import { parkhomovLink, mfmpLink } from './ExternalLinks'
import PrivacyBanner from './PrivacyBanner'
import AppUpdateBanner from './AppUpdateBanner'
import ChangelogModal from './ChangelogModal'
import LanguageSwitcher from './LanguageSwitcher'
import LanguageSelectionModal from './LanguageSelectionModal'
import { getVersionInfo, getVersionTooltip, getGitHubReleaseUrl } from '../utils/version'
import { fetchReleaseNotes, type ReleaseNotes } from '../services/changelog'

interface LayoutProps {
  children: ReactNode
}

interface NavigationItem {
  nameKey: string
  path: string
  icon: typeof HomeIcon
}

const navigationItems: NavigationItem[] = [
  { nameKey: 'navigation.home', path: '/', icon: HomeIcon },
  { nameKey: 'navigation.showElementData', path: '/element-data', icon: FlaskConical },
  { nameKey: 'navigation.fusionReactions', path: '/fusion', icon: GitMerge },
  { nameKey: 'navigation.fissionReactions', path: '/fission', icon: Scissors },
  { nameKey: 'navigation.twoToTwoReactions', path: '/twotwo', icon: ArrowLeftRight },
  { nameKey: 'navigation.cascades', path: '/cascades', icon: Workflow },
  { nameKey: 'navigation.tablesInDetail', path: '/tables', icon: Table },
  { nameKey: 'navigation.allTables', path: '/all-tables', icon: TableProperties },
  { nameKey: 'navigation.mullerResonance', path: '/muller-resonance', icon: Waves },
  { nameKey: 'navigation.transmutations', path: '/transmutations', icon: Beaker },
  { nameKey: 'navigation.help', path: '/help', icon: HelpCircle },
]

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { sidebarOpen, setSidebarOpen, mobileHeaderHidden } = useLayout()
  const { isFirstVisit } = useLanguage()
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('desktopSidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [appUpdateVisible, setAppUpdateVisible] = useState(false)
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [changelogLoading, setChangelogLoading] = useState(false)
  const [changelogError, setChangelogError] = useState<string | null>(null)
  const [changelogNotes, setChangelogNotes] = useState<ReleaseNotes | null>(null)
  const [changelogTargetTag, setChangelogTargetTag] = useState<string | null>(null)
  const [changelogVersionLabel, setChangelogVersionLabel] = useState<string>('')
  const [fetchedTag, setFetchedTag] = useState<string | null>(null)
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const versionInfo = getVersionInfo()
  const currentVersionKey = versionInfo.fullVersion
  const currentDisplayVersion = versionInfo.displayVersion
  const releaseTag = versionInfo.isRelease ? versionInfo.version : null
  const shouldBypassAutoChangelog = typeof navigator !== 'undefined' && navigator.webdriver === true

  const CHANGELOG_SEEN_KEY = 'lenr-changelog-last-seen'
  const RELEASES_URL = 'https://github.com/Episk-pos/lenr.academy/releases'

  // Save sidebar collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('desktopSidebarCollapsed', JSON.stringify(desktopSidebarCollapsed))
  }, [desktopSidebarCollapsed])

  const closeChangelog = useCallback(() => {
    setIsChangelogOpen(false)
  }, [])

  const openChangelog = useCallback(
    (targetTag: string | null, label: string, options: { markSeen?: boolean } = {}) => {
      if (options.markSeen && currentVersionKey) {
        localStorage.setItem(CHANGELOG_SEEN_KEY, currentVersionKey)
      }

      setChangelogVersionLabel(label)

      if (targetTag !== changelogTargetTag) {
        setFetchedTag(null)
        setChangelogNotes(null)
      }

      setChangelogTargetTag(targetTag)
      setChangelogError(null)

      if (targetTag && fetchedTag === targetTag && changelogNotes) {
        setChangelogLoading(false)
      } else if (!targetTag) {
        setChangelogLoading(false)
      } else {
        setChangelogLoading(true)
      }

      setIsChangelogOpen(true)
    },
    [changelogNotes, changelogTargetTag, currentVersionKey, fetchedTag]
  )

  const handleRetryChangelog = useCallback(() => {
    if (!isChangelogOpen) return
    setFetchedTag(null)
    setChangelogNotes(null)
    setChangelogError(null)
    if (changelogTargetTag) {
      setChangelogLoading(true)
    } else {
      setChangelogLoading(false)
    }
  }, [changelogTargetTag, isChangelogOpen])

  useEffect(() => {
    if (!isChangelogOpen) {
      return
    }

    if (changelogTargetTag === null) {
      setChangelogNotes({
        tagName: changelogVersionLabel,
        name: changelogVersionLabel,
        body: 'Detailed release notes are not available for this build.',
        publishedAt: null,
        htmlUrl: RELEASES_URL,
      })
      setChangelogError(null)
      setChangelogLoading(false)
      return
    }

    if (fetchedTag === changelogTargetTag) {
      setChangelogLoading(false)
      setChangelogError(null)
      return
    }

    const controller = new AbortController()

    setChangelogLoading(true)
    setChangelogError(null)

    fetchReleaseNotes(changelogTargetTag, { signal: controller.signal })
      .then((notes) => {
        setChangelogNotes(notes)
        setFetchedTag(changelogTargetTag)
        setChangelogError(null)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Failed to load release notes.'
        setChangelogError(message)
        setChangelogNotes(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setChangelogLoading(false)
        }
      })

    return () => controller.abort()
  }, [changelogTargetTag, changelogVersionLabel, fetchedTag, isChangelogOpen])

  useEffect(() => {
    if (!currentVersionKey) return

    const autoChangelogDisabled = localStorage.getItem('lenr-changelog-disable-auto') === 'true'
    if (shouldBypassAutoChangelog || autoChangelogDisabled) {
      localStorage.setItem(CHANGELOG_SEEN_KEY, currentVersionKey)
      return
    }

    const lastSeen = localStorage.getItem(CHANGELOG_SEEN_KEY)

    if (versionInfo.isRelease) {
      if (lastSeen !== currentVersionKey && releaseTag) {
        openChangelog(releaseTag, currentDisplayVersion, { markSeen: true })
      } else if (!lastSeen) {
        localStorage.setItem(CHANGELOG_SEEN_KEY, currentVersionKey)
      }
    } else if (!lastSeen) {
      localStorage.setItem(CHANGELOG_SEEN_KEY, currentVersionKey)
    }
  }, [CHANGELOG_SEEN_KEY, currentDisplayVersion, currentVersionKey, openChangelog, releaseTag, shouldBypassAutoChangelog, versionInfo.isRelease])

  // Show language selection modal on first visit
  useEffect(() => {
    if (isFirstVisit) {
      setIsLanguageModalOpen(true)
    }
  }, [isFirstVisit])

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
      style={{
        paddingTop: 'var(--offline-banner-height, 0px)',
        transition: 'padding-top 300ms ease-out'
      }}
    >
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div
          className="fixed left-0 flex w-64 flex-col bg-white dark:bg-gray-800 overflow-hidden"
          style={{
            top: 'var(--offline-banner-height, 0px)',
            bottom: 0,
            transition: 'top 300ms ease-out'
          }}
        >
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Atom className="w-6 h-6 text-primary-600" />
              <span className="text-lg font-bold dark:text-white">{t('brand.appShortName')}</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="dark:text-gray-300" aria-label={t('navigation.closeMenu')}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium mb-1 ${
                    location.pathname === item.path
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{t(item.nameKey)}</span>
                </Link>
              )
            })}
          </nav>
          <div className="p-4 border-t dark:border-gray-700">
            <Link
              to={location.pathname === '/privacy' ? '/' : '/privacy'}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-3"
            >
              <Shield className="w-4 h-4" />
              <span>{t('navigation.privacySettings')}</span>
            </Link>
            <div className="text-xs text-gray-500 dark:text-gray-400 px-3">
              <p>
                <Trans
                  i18nKey="footer.basedOnWork"
                  components={{
                    parkhomovLink
                  }}
                />
              </p>
              <p className="mt-1">
                <Trans
                  i18nKey="footer.project"
                  components={{
                    mfmpLink
                  }}
                />
              </p>
              <a
                href={getGitHubReleaseUrl(versionInfo)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                title={getVersionTooltip(versionInfo)}
                data-testid="app-version"
              >
                {versionInfo.displayVersion}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div
        className={`hidden lg:fixed lg:flex lg:flex-col transition-all duration-300 ${desktopSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
        style={{
          top: 'var(--offline-banner-height, 0px)',
          bottom: 0,
          transition: 'top 300ms ease-out, width 300ms'
        }}
      >
        <div className="flex flex-col flex-grow border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
          {/* Collapse toggle button */}
          <button
            onClick={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
            className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={desktopSidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {desktopSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          <div className={`flex items-center py-6 border-b dark:border-gray-700 overflow-hidden transition-all duration-300 ${desktopSidebarCollapsed ? 'px-4 justify-center' : 'px-7 justify-start gap-2'}`}>
            <Atom className={`text-primary-600 flex-shrink-0 transition-all duration-300 ${desktopSidebarCollapsed ? 'w-6 h-6' : 'w-8 h-8'}`} />
            <div className={`whitespace-nowrap transition-all duration-150 overflow-hidden ${desktopSidebarCollapsed ? 'opacity-0 w-0 delay-0' : 'opacity-100 w-auto delay-150'}`}>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('brand.appName')}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('brand.appSubtitle')}</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium mb-1 overflow-hidden transition-all duration-300 ${
                    location.pathname === item.path
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${desktopSidebarCollapsed ? 'justify-center' : 'justify-start gap-3'}`}
                  title={desktopSidebarCollapsed ? t(item.nameKey) : undefined}
                >
                  <Icon className="flex-shrink-0 w-5 h-5" />
                  <span className={`whitespace-nowrap transition-all duration-150 overflow-hidden ${desktopSidebarCollapsed ? 'opacity-0 w-0 ml-0 delay-0' : 'opacity-100 w-auto ml-0 delay-150'}`}>{t(item.nameKey)}</span>
                </Link>
              )
            })}
          </nav>
          <div className={`p-4 border-t overflow-hidden ${desktopSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-2 overflow-hidden ${desktopSidebarCollapsed ? '' : 'w-full'}`}
              title={desktopSidebarCollapsed ? (theme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')) : undefined}
            >
              <div className={`flex items-center transition-all duration-300 ${desktopSidebarCollapsed ? 'gap-0' : 'gap-2'}`}>
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 flex-shrink-0" />
                    <span className={`whitespace-nowrap transition-all duration-150 overflow-hidden ${desktopSidebarCollapsed ? 'opacity-0 w-0 delay-0' : 'opacity-100 w-auto delay-150'}`}>{t('theme.lightMode')}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 flex-shrink-0" />
                    <span className={`whitespace-nowrap transition-all duration-150 overflow-hidden ${desktopSidebarCollapsed ? 'opacity-0 w-0 delay-0' : 'opacity-100 w-auto delay-150'}`}>{t('theme.darkMode')}</span>
                  </>
                )}
              </div>
            </button>
            <LanguageSwitcher className={`${desktopSidebarCollapsed ? '' : 'w-full'} mb-2`} compact={desktopSidebarCollapsed} position="above" />
            <Link
              to={location.pathname === '/privacy' ? '/' : '/privacy'}
              className={`flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3 overflow-hidden ${desktopSidebarCollapsed ? '' : 'w-full'}`}
              title={desktopSidebarCollapsed ? t('navigation.privacySettings') : undefined}
            >
              <div className={`flex items-center transition-all duration-300 ${desktopSidebarCollapsed ? 'gap-0' : 'gap-2'}`}>
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-150 overflow-hidden ${desktopSidebarCollapsed ? 'opacity-0 w-0 delay-0' : 'opacity-100 w-auto delay-150'}`}>{t('navigation.privacySettings')}</span>
              </div>
            </Link>
            <div className={`text-xs text-gray-500 dark:text-gray-400 transition-all duration-150 overflow-hidden ${desktopSidebarCollapsed ? 'opacity-0 max-h-0 delay-0' : 'opacity-100 max-h-96 delay-150'}`}>
              <p>
                <Trans
                  i18nKey="footer.basedOnWork"
                  components={{
                    parkhomovLink
                  }}
                />
              </p>
              <p className="mt-1">
                <Trans
                  i18nKey="footer.project"
                  components={{
                    mfmpLink
                  }}
                />
              </p>
              <a
                href={getGitHubReleaseUrl(versionInfo)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                title={getVersionTooltip(versionInfo)}
                data-testid="app-version"
              >
                {versionInfo.displayVersion}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${desktopSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Mobile header - hides when tabs stick */}
        <div className={`sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 lg:hidden transition-all duration-300 ${
          mobileHeaderHidden ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
        }`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300"
            aria-label={t('navigation.openMenu')}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Atom className="w-6 h-6 text-primary-600" />
            <span className="text-lg font-bold dark:text-white">{t('brand.appName')}</span>
          </div>
          <LanguageSwitcher compact position="below" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={t('theme.toggleTheme')}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Global Banners */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-8 pb-3 sm:pb-5 pointer-events-auto">
          {!appUpdateVisible && <DatabaseUpdateBanner className="rounded-lg overflow-hidden" />}
          <AppUpdateBanner
            className="rounded-lg overflow-hidden"
            onVisibilityChange={setAppUpdateVisible}
            onViewChangelog={(version) => {
              const label = version ?? 'Latest Release'
              const targetTag = version ?? releaseTag
              if (!targetTag) {
                openChangelog(null, label)
                return
              }
              openChangelog(targetTag, label)
            }}
          />
          <PrivacyBanner className="rounded-lg overflow-hidden" />
        </div>
      </div>

      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={closeChangelog}
        releaseNotes={changelogNotes}
        isLoading={changelogLoading}
        error={changelogError}
        onRetry={handleRetryChangelog}
        versionLabel={changelogVersionLabel || currentDisplayVersion}
      />

      <LanguageSelectionModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
      />
    </div>
  )
}
