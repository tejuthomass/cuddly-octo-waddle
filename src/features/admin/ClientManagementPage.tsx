import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowDownUp, ArrowUp, CircleHelp, Eye, Plus, Power, PowerOff, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import {
  type AdminCompanyRow,
  useAdminCompanies,
  useCreateCompany,
  useToggleCompanyActive,
} from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const createCompanySchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
})

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>
type CompanySortKey = 'company_code' | 'company_name' | 'created_at' | 'updated_at'
type SortDirection = 'asc' | 'desc'

function sortIcon(active: boolean, direction: SortDirection) {
  if (!active) return <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
  return direction === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-foreground" />
    : <ArrowDown className="h-3.5 w-3.5 text-foreground" />
}

function sortButtonClass(active: boolean) {
  return `inline-flex items-center gap-1 font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`
}

export default function ClientManagementPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: companies = [], isLoading: companiesLoading, isFetching, refetch } = useAdminCompanies()
  const createCompanyMutation = useCreateCompany()
  const toggleCompanyMutation = useToggleCompanyActive()

  const [companySearch, setCompanySearch] = useState('')
  const [companySortKey, setCompanySortKey] = useState<CompanySortKey>('created_at')
  const [companySortDirection, setCompanySortDirection] = useState<SortDirection>('desc')
  const [companyPage, setCompanyPage] = useState(1)
  const [companyPageSize, setCompanyPageSize] = useState(10)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [lastSelectedCompanyIndex, setLastSelectedCompanyIndex] = useState<number | null>(null)

  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      companyName: '',
    },
  })

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase()
    const rows = companies.filter((company) => {
      if (!query) return true
      return [company.company_code, company.company_name].join(' ').toLowerCase().includes(query)
    })

    rows.sort((a, b) => {
      const direction = companySortDirection === 'asc' ? 1 : -1
      if (companySortKey === 'created_at' || companySortKey === 'updated_at') {
        return (new Date(a[companySortKey]).getTime() - new Date(b[companySortKey]).getTime()) * direction
      }

      return `${a[companySortKey] ?? ''}`.localeCompare(`${b[companySortKey] ?? ''}`) * direction
    })

    return rows
  }, [companies, companySearch, companySortDirection, companySortKey])

  const totalCompanyPages = Math.max(1, Math.ceil(filteredCompanies.length / companyPageSize))
  const pagedCompanies = useMemo(() => {
    const start = (companyPage - 1) * companyPageSize
    return filteredCompanies.slice(start, start + companyPageSize)
  }, [companyPage, companyPageSize, filteredCompanies])
  const pageCompanyIds = useMemo(() => pagedCompanies.map((row) => row.id), [pagedCompanies])

  const selectedCompanies = useMemo(
    () => filteredCompanies.filter((row) => selectedCompanyIds.includes(row.id)),
    [filteredCompanies, selectedCompanyIds],
  )
  const allPageSelected = pageCompanyIds.length > 0 && pageCompanyIds.every((id) => selectedCompanyIds.includes(id))
  const allFilteredSelected = filteredCompanies.length > 0 && filteredCompanies.every((row) => selectedCompanyIds.includes(row.id))
  const canSelectFiltered = allPageSelected && !allFilteredSelected && filteredCompanies.length > pagedCompanies.length

  const onCompanySort = (key: CompanySortKey) => {
    if (companySortKey === key) {
      setCompanySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setCompanySortKey(key)
    setCompanySortDirection('asc')
  }

  const onTogglePageSelection = () => {
    setSelectedCompanyIds((prev) => {
      if (allPageSelected) {
        return prev.filter((id) => !pageCompanyIds.includes(id))
      }

      return Array.from(new Set([...prev, ...pageCompanyIds]))
    })
  }

  const onSelectFilteredCompanies = () => {
    setSelectedCompanyIds(filteredCompanies.map((row) => row.id))
  }

  const onSelectCompanyRow = (companyId: string, rowIndex: number, options: { shift: boolean; multi: boolean }) => {
    if (options.shift && lastSelectedCompanyIndex !== null) {
      const start = Math.min(lastSelectedCompanyIndex, rowIndex)
      const end = Math.max(lastSelectedCompanyIndex, rowIndex)
      const rangeIds = pagedCompanies.slice(start, end + 1).map((row) => row.id)

      setSelectedCompanyIds((prev) => {
        if (options.multi) {
          return Array.from(new Set([...prev, ...rangeIds]))
        }
        return rangeIds
      })
      return
    }

    if (options.multi) {
      setSelectedCompanyIds((prev) => (prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]))
      setLastSelectedCompanyIndex(rowIndex)
      return
    }

    setSelectedCompanyIds([companyId])
    setLastSelectedCompanyIndex(rowIndex)
  }

  const onBulkToggleCompanies = async (isActive: boolean) => {
    if (selectedCompanies.length === 0) {
      toast.error('No accounts selected for this action.')
      return
    }

    try {
      await Promise.all(selectedCompanies.map((company) => toggleCompanyMutation.mutateAsync({ companyId: company.id, isActive })))
      toast.success(isActive ? 'Selected accounts activated.' : 'Selected accounts deactivated.')
      setSelectedCompanyIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update selected account statuses.'))
    }
  }

  const onToggleCompanyInline = async (company: AdminCompanyRow) => {
    try {
      await toggleCompanyMutation.mutateAsync({ companyId: company.id, isActive: !company.is_active })
      toast.success(!company.is_active ? 'Account enabled.' : 'Account disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update account status.'))
    }
  }

  const onCreateCompany = async (values: CreateCompanyFormValues) => {
    try {
      await createCompanyMutation.mutateAsync(values)
      toast.success('Account created.')
      setIsCompanyOpen(false)
      reset()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create account.'))
    }
  }

  const clientFallback = (company: AdminCompanyRow) => {
    const token = company.company_name.trim() || 'C'
    return token.slice(0, 1).toUpperCase()
  }

  useEffect(() => {
    setCompanyPage(1)
  }, [companyPageSize, companySearch, companySortDirection, companySortKey])

  useEffect(() => {
    if (companyPage > totalCompanyPages) {
      setCompanyPage(totalCompanyPages)
    }
  }, [companyPage, totalCompanyPages])

  useEffect(() => {
    setSelectedCompanyIds((prev) => prev.filter((id) => filteredCompanies.some((row) => row.id === id)))
  }, [filteredCompanies])

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (tableContainerRef.current?.contains(target)) return

      setSelectedCompanyIds([])
      setLastSelectedCompanyIndex(null)
    }

    document.addEventListener('mousedown', onDocumentPointerDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown)
    }
  }, [])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader className="sticky top-0 z-20 rounded-t-xl border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl tracking-tight">Accounts</CardTitle>
              <CardDescription>Manage accounts.</CardDescription>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TooltipIconButton className="h-9 w-9" onClick={() => setIsCompanyOpen(true)} tooltip="Add account" aria-label="Add account">
                <Plus className="h-4 w-4" />
              </TooltipIconButton>
              <TooltipIconButton
                className="h-9 w-9"
                onClick={() => {
                  void refetch()
                }}
                tooltip="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </TooltipIconButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search accounts" className="pl-9 pr-10" />
              <div className="absolute right-2 top-1.5">
                <TooltipIconButton
                  className="h-7 w-7 border-transparent"
                  tooltip="Search by ID or name."
                  aria-label="Search help"
                >
                  <CircleHelp className="h-4 w-4" />
                </TooltipIconButton>
              </div>
            </div>
          </div>

          {selectedCompanies.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
              <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <span>{allFilteredSelected ? `All ${filteredCompanies.length} selected` : `${selectedCompanies.length} selected`}</span>
                {canSelectFiltered ? (
                  <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectFilteredCompanies}>
                    Select all {filteredCompanies.length}
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <TooltipIconButton
                  onClick={() => setSelectedCompanyIds([])}
                  tooltip="Clear selection"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </TooltipIconButton>
                <TooltipIconButton
                  onClick={() => void onBulkToggleCompanies(true)}
                  tooltip="Activate selected accounts"
                  aria-label="Activate selected accounts"
                  disabled={false}
                >
                  <Power className="h-4 w-4" />
                </TooltipIconButton>
                <TooltipIconButton
                  onClick={() => void onBulkToggleCompanies(false)}
                  tooltip="Deactivate selected accounts"
                  aria-label="Deactivate selected accounts"
                  disabled={false}
                >
                  <PowerOff className="h-4 w-4" />
                </TooltipIconButton>
              </div>
            </div>
          ) : null}

          {companiesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div ref={tableContainerRef} className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-12 p-3 text-left" aria-label="Select rows">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50"
                        onClick={onTogglePageSelection}
                        aria-label={allPageSelected ? 'Deselect current page' : 'Select current page'}
                      >
                        <input
                          type="checkbox"
                          checked={allPageSelected && pageCompanyIds.length > 0}
                          onChange={onTogglePageSelection}
                          onClick={(event) => event.stopPropagation()}
                          className="table-select-checkbox"
                          aria-label={allPageSelected ? 'Deselect current page' : 'Select current page'}
                        />
                      </button>
                    </th>
                    <th className="w-36 p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('company_code')} className={sortButtonClass(companySortKey === 'company_code')}>
                        Account ID
                        {sortIcon(companySortKey === 'company_code', companySortDirection)}
                      </button>
                    </th>
                    <th className="w-[30%] p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('company_name')} className={sortButtonClass(companySortKey === 'company_name')}>
                        Name
                        {sortIcon(companySortKey === 'company_name', companySortDirection)}
                      </button>
                    </th>
                    <th className="w-24 p-3 text-left">Status</th>
                    <th className="w-44 p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('created_at')} className={sortButtonClass(companySortKey === 'created_at')}>
                        Created
                        {sortIcon(companySortKey === 'created_at', companySortDirection)}
                      </button>
                    </th>
                    <th className="w-44 p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('updated_at')} className={sortButtonClass(companySortKey === 'updated_at')}>
                        Updated
                        {sortIcon(companySortKey === 'updated_at', companySortDirection)}
                      </button>
                    </th>
                    <th className="w-20 p-3 text-left" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pagedCompanies.map((company, rowIndex) => (
                    <tr
                      key={company.id}
                      className={`group border-b transition-colors ${selectedCompanyIds.includes(company.id) ? 'bg-muted/25 ring-1 ring-inset ring-border/70' : 'hover:bg-muted/20'}`}
                      onDoubleClick={() => navigate(`/admin/clients/${company.id}`, { state: { from: `${location.pathname}${location.search}`, companyCode: company.company_code, companyName: company.company_name } })}
                      onClick={(event) => {
                        if (event.shiftKey || event.ctrlKey || event.metaKey) {
                          onSelectCompanyRow(company.id, rowIndex, { shift: event.shiftKey, multi: event.ctrlKey || event.metaKey })
                          return
                        }
                        navigate(`/admin/clients/${company.id}`, { state: { from: `${location.pathname}${location.search}`, companyCode: company.company_code, companyName: company.company_name } })
                      }}
                    >
                      <td className="w-12 p-3 align-middle">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedCompanyIds((prev) => (prev.includes(company.id) ? prev.filter((id) => id !== company.id) : [...prev, company.id]))
                            }}
                            aria-label={`Select account ${company.company_code}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCompanyIds.includes(company.id)}
                              onChange={() => setSelectedCompanyIds((prev) => (prev.includes(company.id) ? prev.filter((id) => id !== company.id) : [...prev, company.id]))}
                              onClick={(event) => event.stopPropagation()}
                              className="table-select-checkbox"
                              aria-label={`Select account ${company.company_code}`}
                            />
                          </button>
                        </div>
                      </td>
                      <td className="w-36 p-3 text-sm">
                        <span className="block truncate">{company.company_code}</span>
                      </td>
                      <td className="w-[30%] p-3" title={company.company_name}>
                        <span className="inline-flex w-full items-center gap-2">
                          {company.logo_url ? (
                            <img src={company.logo_url} alt={company.company_name} className="h-6 w-6 rounded-full border border-border object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">
                              {clientFallback(company)}
                            </span>
                          )}
                          <span className="min-w-0 truncate">{company.company_name}</span>
                        </span>
                      </td>
                      <td className="w-24 p-3 text-sm">{company.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="w-44 p-3 text-sm text-muted-foreground">
                        <span className="block truncate">{new Date(company.created_at).toLocaleString()}</span>
                      </td>
                      <td className="w-44 p-3 text-sm text-muted-foreground">
                        <span className="block truncate">{new Date(company.updated_at).toLocaleString()}</span>
                      </td>
                      <td className="w-20 p-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          <TooltipIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/admin/clients/${company.id}`, { state: { from: `${location.pathname}${location.search}`, companyCode: company.company_code, companyName: company.company_name } })
                            }}
                            className="h-8 w-8"
                            tooltip="Open account details"
                            aria-label="Open account details"
                          >
                            <Eye className="h-4 w-4" />
                          </TooltipIconButton>
                          <TooltipIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              void onToggleCompanyInline(company)
                            }}
                            className="h-8 w-8"
                            tooltip={company.is_active ? 'Deactivate account' : 'Activate account'}
                            aria-label={company.is_active ? 'Deactivate account' : 'Activate account'}
                          >
                            {company.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </TooltipIconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Showing {pagedCompanies.length} of {filteredCompanies.length}</p>
            <div className="flex items-center gap-2">
              <PageSizeSelect value={companyPageSize} onChange={setCompanyPageSize} />
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCompanyPage((prev) => Math.max(1, prev - 1))} disabled={companyPage <= 1}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">{companyPage} / {totalCompanyPages}</span>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCompanyPage((prev) => Math.min(totalCompanyPages, prev + 1))} disabled={companyPage >= totalCompanyPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isCompanyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setIsCompanyOpen(false)}>
          <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="relative pr-20">
              <div>
                <CardTitle>New Account</CardTitle>
                <CardDescription>Create an account with basic details.</CardDescription>
              </div>
              <button
                type="button"
                className="absolute right-4 top-4 rounded-md p-1 hover:bg-muted/50"
                onClick={() => setIsCompanyOpen(false)}
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="pb-6">
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onCreateCompany)}>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" {...register('companyName')} placeholder="Enter name" />
                  {errors.companyName ? <p className="text-xs text-destructive">{errors.companyName.message}</p> : null}
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsCompanyOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCompanyMutation.isPending} className="h-9 px-3">
                    {createCompanyMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}


    </main>
  )
}
