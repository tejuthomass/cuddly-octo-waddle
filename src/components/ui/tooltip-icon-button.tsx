import { type ButtonHTMLAttributes, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type TooltipIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string
}

export function TooltipIconButton({ tooltip, className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }: TooltipIconButtonProps) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  const updatePos = () => {
    if (!ref.current || !tooltipRef.current) return

    const rect = ref.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const margin = 10
    const viewportPadding = 8

    const canPlaceTop = rect.top - tooltipRect.height - margin >= viewportPadding
    const canPlaceBottom = rect.bottom + tooltipRect.height + margin <= window.innerHeight - viewportPadding

    let top = canPlaceTop
      ? rect.top - tooltipRect.height - margin
      : rect.bottom + margin

    if (!canPlaceTop && !canPlaceBottom) {
      top = Math.max(viewportPadding, Math.min(rect.bottom + margin, window.innerHeight - tooltipRect.height - viewportPadding))
    }

    const preferredLeft = rect.left + rect.width / 2 - tooltipRect.width / 2
    const left = Math.max(viewportPadding, Math.min(preferredLeft, window.innerWidth - tooltipRect.width - viewportPadding))

    setPos({ left, top })
  }

  useEffect(() => {
    if (!open) return
    updatePos()
    const rafId = window.requestAnimationFrame(() => updatePos())
    const onWindowChange = () => updatePos()
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('scroll', onWindowChange, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={ref}
        type="button"
        {...props}
        onMouseEnter={(event) => {
          setOpen(true)
          updatePos()
          onMouseEnter?.(event)
        }}
        onMouseLeave={(event) => {
          setOpen(false)
          onMouseLeave?.(event)
        }}
        onFocus={(event) => {
          setOpen(true)
          updatePos()
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setOpen(false)
          onBlur?.(event)
        }}
        aria-label={props['aria-label'] ?? tooltip}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/80 text-muted-foreground transition-colors',
          'hover:border-ring/45 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          className,
        )}
      >
        {children}
      </button>

      {open
        ? createPortal(
            <div
              ref={tooltipRef}
              className="fixed z-[200] rounded-md border border-border/80 bg-popover/95 px-2 py-1 text-xs text-popover-foreground shadow-lg backdrop-blur-sm"
              style={{ left: pos.left, top: pos.top }}
              role="tooltip"
            >
              {tooltip}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
