import { ReactNode, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Atom, Moon, Sun, ChevronLeft, ChevronRight, Home as HomeIcon, GitMerge, Scissors, ArrowLeftRight, FlaskConical, Table, TableProperties } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import DatabaseUpdateBanner from './DatabaseUpdateBanner'

interface LayoutProps {
  children: ReactNode
}

interface NavigationItem {
  name: string
  path: string
  icon: typeof HomeIcon
}

const navigation: NavigationItem[] = [
  { name: 'Home', path: '/', icon: HomeIcon },
  { name: 'Fusion Reactions', path: '/fusion', icon: GitMerge },
  { name: 'Fission Reactions', path: '/fission', icon: Scissors },
  { name: 'Two-To-Two Reactions', path: '/twotwo', icon: ArrowLeftRight },
  { name: 'Show Element Data', path: '/element-data', icon: FlaskConical },
  { name: 'Tables in Detail', path: '/tables', icon: Table },
  { name: 'All Tables', path: '/all-tables', icon: TableProperties },
  // { name: 'Cascades', path: '/cascades', icon: Workflow },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('desktopSidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  const { theme, toggleTheme } = useTheme()

  // Save sidebar collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('desktopSidebarCollapsed', JSON.stringify(desktopSidebarCollapsed))
  }, [desktopSidebarCollapsed])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Atom className="w-6 h-6 text-primary-600" />
              <span className="text-lg font-bold dark:text-white">Nanosoft</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="dark:text-gray-300">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            {navigation.map((item) => {
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
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${desktopSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}>
        <div className="flex flex-col flex-grow border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
          {/* Collapse toggle button */}
          <button
            onClick={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
            className="absolute -right-3 top-20 z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={desktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {desktopSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          <div className={`flex items-center gap-2 p-6 border-b dark:border-gray-700 ${desktopSidebarCollapsed ? 'justify-center' : ''}`}>
            <Atom className={`text-primary-600 flex-shrink-0 ${desktopSidebarCollapsed ? 'w-6 h-6' : 'w-8 h-8'}`} />
            {!desktopSidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nanosoft Suite</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">LENR Academy</p>
              </div>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium mb-1 ${
                    location.pathname === item.path
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${desktopSidebarCollapsed ? 'justify-center' : ''}`}
                  title={desktopSidebarCollapsed ? item.name : undefined}
                >
                  <Icon className={`flex-shrink-0 ${desktopSidebarCollapsed ? 'w-5 h-5' : 'w-5 h-5'}`} />
                  {!desktopSidebarCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>
          <div className={`p-4 border-t ${desktopSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-3 ${desktopSidebarCollapsed ? 'justify-center' : 'w-full justify-center'}`}
              title={desktopSidebarCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  {!desktopSidebarCollapsed && <span>Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  {!desktopSidebarCollapsed && <span>Dark Mode</span>}
                </>
              )}
            </button>
            {!desktopSidebarCollapsed && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>Based on work by Dr. Alexander Parkhomov</p>
                <p className="mt-1">Martin Fleischmann Memorial Project</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${desktopSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Atom className="w-6 h-6 text-primary-600" />
            <span className="text-lg font-bold dark:text-white">Nanosoft Suite</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Database Update Banner */}
      <DatabaseUpdateBanner />
    </div>
  )
}
