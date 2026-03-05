import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  searchText?: string
}

interface SearchableSelectProps {
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  minDropdownWidth?: number
  renderSelectedLabel?: (option: SearchableSelectOption | undefined) => string
  renderOption?: (option: SearchableSelectOption, isSelected: boolean) => React.ReactNode
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search...',
  className,
  disabled = false,
  minDropdownWidth,
  renderSelectedLabel,
  renderOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 })

  const updateMenuPosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setMenuPosition({
      left: Math.max(8, rect.left),
      top: rect.bottom + 8,
      width: Math.max(minDropdownWidth ?? 0, rect.width),
    })
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      const target = event.target as Node
      const insideRoot = rootRef.current.contains(target)
      const insideMenu = menuRef.current?.contains(target) ?? false

      if (!insideRoot && !insideMenu) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()

    const onResize = () => updateMenuPosition()
    const onScroll = () => updateMenuPosition()

    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, minDropdownWidth])

  const selected = options.find((option) => option.value === value)

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) => {
      const haystack = `${option.label} ${option.searchText ?? ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [options, query])

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => !prev)
          setQuery('')
          setTimeout(updateMenuPosition, 0)
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm transition-colors',
          'hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? (renderSelectedLabel ? renderSelectedLabel(selected) : selected.label) : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[80] rounded-md border border-border bg-popover p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width,
                maxHeight: Math.max(220, window.innerHeight - menuPosition.top - 16),
              }}
            >
          <div className="mb-2 flex items-center gap-2 rounded-md border border-input bg-background px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted-foreground">No results</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={`${option.value}-${option.label}-${index}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm',
                    option.value === value ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                  )}
                >
                  <span className="truncate">
                    {renderOption ? renderOption(option, option.value === value) : option.label}
                  </span>
                  {option.value === value ? <Check className="h-4 w-4" /> : null}
                </button>
              ))
            )}
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
