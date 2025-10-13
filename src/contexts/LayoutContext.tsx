import { createContext, useContext, useState, ReactNode } from 'react'

interface LayoutContextType {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  openSidebar: () => void
  closeSidebar: () => void
  mobileHeaderHidden: boolean
  setMobileHeaderHidden: (hidden: boolean) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false)

  const openSidebar = () => setSidebarOpen(true)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, openSidebar, closeSidebar, mobileHeaderHidden, setMobileHeaderHidden }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
