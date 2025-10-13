import { useSearchParams } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

export interface Tab {
  id: string
  label: string
  count?: number
}

interface TabNavigationProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  onMenuClick?: () => void
  onStuckChange?: (stuck: boolean) => void
}

export default function TabNavigation({ tabs, activeTab, onTabChange, className = '', onMenuClick, onStuckChange }: TabNavigationProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isStuck, setIsStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const isInitialMount = useRef(true)

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId)

    // Update URL with new tab, preserving other params
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', tabId)
    setSearchParams(newParams) // Remove replace: true to add to history
  }

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleTabClick(tabId)
    }
  }

  // Check if we're on mobile
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Scroll active tab into view when it changes
  useEffect(() => {
    // Skip on initial mount to avoid unwanted scrolling on page load
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const activeTabElement = tabRefs.current.get(activeTab)
    if (activeTabElement) {
      // Scroll the active tab into view with smooth behavior
      // inline: 'center' centers the tab horizontally
      // block: 'nearest' prevents vertical scrolling
      activeTabElement.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      })
    }
  }, [activeTab])

  // Detect when the component is stuck using Intersection Observer
  useEffect(() => {
    if (!sentinelRef.current || !isMobile) {
      setIsStuck(false)
      onStuckChange?.(false)
      return
    }

    // On mobile, detect when sentinel scrolls past the mobile header (64px = h-16)
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the sentinel is NOT intersecting (scrolled out of view), the tabs are stuck
        const stuck = !entry.isIntersecting
        setIsStuck(stuck)
        onStuckChange?.(stuck)
      },
      {
        threshold: [0, 1],
        rootMargin: '-64px 0px 0px 0px'
      }
    )

    observer.observe(sentinelRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isMobile, onStuckChange])

  return (
    <>
      {/* Sentinel element to detect sticking - positioned just above the sticky element */}
      <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      <div className={`sticky ${isStuck ? 'top-0' : 'top-16 lg:top-0'} z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md ${isStuck ? 'lg:rounded-none' : 'rounded-lg'} ${className} ${isStuck ? '-mx-4 sm:-mx-6 lg:-mx-8' : 'max-[425px]:-mx-4'} transition-all duration-200 ease-in-out`}>
      <div className="flex items-center">
        {/* Hamburger menu button - only visible on mobile when stuck */}
        {isMobile && isStuck && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-200"
            aria-label="Open menu"
            data-testid="tab-navigation-menu-button"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <nav className="-mb-px flex flex-1 space-x-2 sm:space-x-4 md:space-x-8 px-2 sm:px-4 md:px-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.id, el)
                } else {
                  tabRefs.current.delete(tab.id)
                }
              }}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                transition-colors duration-150
                ${isActive
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
                }
              `}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              tabIndex={isActive ? 0 : -1}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`
                  ml-2 py-0.5 px-2 rounded-full text-xs
                  ${isActive
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }
                `}>
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          )
        })}
        </nav>
      </div>
    </div>
    </>
  )
}
