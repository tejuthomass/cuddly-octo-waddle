import { SearchableSelect } from '@/components/ui/searchable-select'

interface PageSizeSelectProps {
  value: number
  options?: number[]
  onChange: (value: number) => void
}

export function PageSizeSelect({ value, options = [10, 20, 50], onChange }: PageSizeSelectProps) {
  return (
    <SearchableSelect
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      options={options.map((size) => ({ value: String(size), label: String(size) }))}
      placeholder={String(value)}
      searchPlaceholder="Rows..."
      className="w-[92px]"
      minDropdownWidth={92}
      renderSelectedLabel={(option) => option?.label ?? String(value)}
    />
  )
}
