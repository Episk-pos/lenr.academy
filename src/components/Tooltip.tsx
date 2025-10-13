import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content?: ReactNode  // Make content optional
  children: ReactNode
  className?: string
}

export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  // If no content, just return the children without tooltip functionality
  if (!content) {
    return <>{children}</>
  }
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate tooltip position
  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    // Default position: above the trigger, centered
    let top = triggerRect.top + scrollY - tooltipRect.height - 8
    let left = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2)

    // If tooltip goes off the top, show below
    if (top < scrollY) {
      top = triggerRect.bottom + scrollY + 8
    }

    // If tooltip goes off the left, align to left edge with padding
    if (left < scrollX + 8) {
      left = scrollX + 8
    }

    // If tooltip goes off the right, align to right edge with padding
    if (left + tooltipRect.width > scrollX + viewportWidth - 8) {
      left = scrollX + viewportWidth - tooltipRect.width - 8
    }

    // If tooltip goes off the bottom (when shown below trigger)
    if (top + tooltipRect.height > scrollY + viewportHeight - 8) {
      top = triggerRect.top + scrollY - tooltipRect.height - 8
    }

    setPosition({ top, left })
  }

  // Handle click/tap
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setIsOpen(prev => !prev)
  }

  // Handle mouse enter (desktop)
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true)
    }, 200)
  }

  // Handle mouse leave (desktop)
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 100)
  }

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }
  }, [isOpen])

  // Update position when opened
  useEffect(() => {
    if (isOpen) {
      updatePosition()
      // Recalculate on scroll/resize
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleClick}
        onTouchStart={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`cursor-help inline-block ${className}`}
      >
        {children}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 9999
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="max-w-xs sm:max-w-sm md:max-w-md bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl p-3 animate-fade-in pointer-events-auto"
          >
            {content}
            {/* Arrow indicator */}
            <div
              className="absolute w-2 h-2 bg-gray-900 dark:bg-gray-800 transform rotate-45"
              style={{
                bottom: '-4px',
                left: '50%',
                marginLeft: '-4px'
              }}
            />
          </div>,
          document.body
        )}
    </>
  )
}
