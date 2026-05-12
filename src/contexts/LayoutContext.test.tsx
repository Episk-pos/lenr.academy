import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LayoutProvider, useLayout } from './LayoutContext'

describe('LayoutContext', () => {
  function renderLayoutHook() {
    return renderHook(() => useLayout(), {
      wrapper: ({ children }) => <LayoutProvider>{children}</LayoutProvider>,
    })
  }

  describe('LayoutProvider', () => {
    it('initializes with sidebar closed', () => {
      const { result } = renderLayoutHook()
      expect(result.current.sidebarOpen).toBe(false)
    })

    it('initializes with mobile header visible', () => {
      const { result } = renderLayoutHook()
      expect(result.current.mobileHeaderHidden).toBe(false)
    })
  })

  describe('sidebar controls', () => {
    it('opens sidebar with openSidebar()', () => {
      const { result } = renderLayoutHook()

      act(() => {
        result.current.openSidebar()
      })

      expect(result.current.sidebarOpen).toBe(true)
    })

    it('closes sidebar with closeSidebar()', () => {
      const { result } = renderLayoutHook()

      act(() => {
        result.current.openSidebar()
      })
      expect(result.current.sidebarOpen).toBe(true)

      act(() => {
        result.current.closeSidebar()
      })
      expect(result.current.sidebarOpen).toBe(false)
    })

    it('sets sidebar state directly with setSidebarOpen', () => {
      const { result } = renderLayoutHook()

      act(() => {
        result.current.setSidebarOpen(true)
      })
      expect(result.current.sidebarOpen).toBe(true)

      act(() => {
        result.current.setSidebarOpen(false)
      })
      expect(result.current.sidebarOpen).toBe(false)
    })
  })

  describe('mobile header', () => {
    it('hides mobile header', () => {
      const { result } = renderLayoutHook()

      act(() => {
        result.current.setMobileHeaderHidden(true)
      })

      expect(result.current.mobileHeaderHidden).toBe(true)
    })

    it('shows mobile header again', () => {
      const { result } = renderLayoutHook()

      act(() => {
        result.current.setMobileHeaderHidden(true)
      })

      act(() => {
        result.current.setMobileHeaderHidden(false)
      })

      expect(result.current.mobileHeaderHidden).toBe(false)
    })
  })

  describe('useLayout', () => {
    it('throws when used outside LayoutProvider', () => {
      expect(() => {
        renderHook(() => useLayout())
      }).toThrow('useLayout must be used within a LayoutProvider')
    })
  })
})
