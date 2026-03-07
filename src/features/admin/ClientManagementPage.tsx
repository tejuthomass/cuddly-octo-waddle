import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowDownUp, ArrowUp, Eye, Plus, Power, PowerOff, Search, Trash2 } from 'lucide-react'
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
  useHardDeleteCompany,
  useToggleCompanyActive,
} from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const createCompanySchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  billingAddress: z.string().min(5, 'Billing address is required.'),
})

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>
type CompanySortKey = 'company_code' | 'company_name' | 'scoped_user_count' | 'created_at'
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
  const { data: companies = [], isLoading: companiesLoading } = useAdminCompanies()
  const createCompanyMutation = useCreateCompany()
  const toggleCompanyMutation = useToggleCompanyActive()
  const deleteCompanyMutation = useHardDeleteCompany()

  const [companySearch, setCompanySearch] = useState('')
  const [companySortKey, setCompanySortKey] = useState<CompanySortKey>('created_at')
  const [companySortDirection, setCompanySortDirection] = useState<SortDirection>('desc')
  const [companyPage, setCompanyPage] = useState(1)
  const [companyPageSize, setCompanyPageSize] = useState(10)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])

  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteTargetCompany, setDeleteTargetCompany] = useState<AdminCompanyRow | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      companyName: '',
      billingAddress: '',
    },
  })

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase()
    const rows = companies.filter((company) => {
      if (!query) return true
      return [company.company_code, company.company_name, company.billing_address].join(' ').toLowerCase().includes(query)
    })

    rows.sort((a, b) => {
      const direction = companySortDirection === 'asc' ? 1 : -1
      if (companySortKey === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction
      }

      if (companySortKey === 'scoped_user_count') {
        return (a.scoped_user_count - b.scoped_user_count) * direction
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

  const onBulkToggleCompanies = async (isActive: boolean) => {
    if (selectedCompanies.length === 0) {
      toast.error('No clients selected for this action.')
      return
    }

    try {
      await Promise.all(selectedCompanies.map((company) => toggleCompanyMutation.mutateAsync({ companyId: company.id, isActive })))
      toast.success(isActive ? 'Selected clients activated.' : 'Selected clients deactivated.')
      setSelectedCompanyIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update selected client statuses.'))
    }
  }

  const onToggleCompanyInline = async (company: AdminCompanyRow) => {
    try {
      await toggleCompanyMutation.mutateAsync({ companyId: company.id, isActive: !company.is_active })
      toast.success(!company.is_active ? 'Client enabled.' : 'Client disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update client status.'))
    }
  }

  const onCreateCompany = async (values: CreateCompanyFormValues) => {
    try {
      await createCompanyMutation.mutateAsync(values)
      toast.success('Client created.')
      setIsCompanyOpen(false)
      reset()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create client.'))
    }
  }

  const openDeleteCompanyConfirm = (company: AdminCompanyRow) => {
    setDeleteTargetCompany(company)
    setDeleteConfirmInput('')
    setIsDeleteConfirmOpen(true)
  }

  const onConfirmHardDelete = async () => {
    if (!deleteTargetCompany) return

    if (deleteConfirmInput.trim() !== deleteTargetCompany.company_code) {
      toast.error('Type the exact Client ID to confirm deletion.')
      return
    }

    try {
      await deleteCompanyMutation.mutateAsync({ companyId: deleteTargetCompany.id })
      toast.success('Client permanently deleted.')
      setDeleteConfirmInput('')
      setDeleteTargetCompany(null)
      setIsDeleteConfirmOpen(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete client.'))
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

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl tracking-tight">Clients</CardTitle>
              <CardDescription>Create, search, sort, and open full client details.</CardDescription>
            </div>
            <Button className="inline-flex h-9 items-center justify-center gap-2 px-3" onClick={() => setIsCompanyOpen(true)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} className="h-9 pl-9" placeholder="Search by id, name" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
            <p className="px-1 text-sm text-muted-foreground">{selectedCompanies.length} selected</p>
            <div className="flex items-center gap-1.5">
              <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleCompanies(true)} disabled={selectedCompanies.length === 0} tooltip="Activate selected clients">
                <Power className="h-4 w-4" />
              </TooltipIconButton>
              <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleCompanies(false)} disabled={selectedCompanies.length === 0} tooltip="Deactivate selected clients">
                <PowerOff className="h-4 w-4" />
              </TooltipIconButton>
            </div>
          </div>

          {canSelectFiltered ? (
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              All {pageCompanyIds.length} clients on this page are selected.
              <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectFilteredCompanies}>
                Select all {filteredCompanies.length} clients
              </Button>
            </div>
          ) : null}

          {allFilteredSelected && selectedCompanyIds.length > 0 ? (
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              All {filteredCompanies.length} clients are selected.
              <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={() => setSelectedCompanyIds([])}>
                Clear selection
              </Button>
            </div>
          ) : null}

          {companiesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-10 p-3 text-left" aria-label="Select rows">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                        onClick={onTogglePageSelection}
                        aria-label={allPageSelected ? 'Deselect current page' : 'Select current page'}
                      >
                        <input
                          type="checkbox"
                          checked={allPageSelected && pageCompanyIds.length > 0}
                          onChange={() => undefined}
                          className="pointer-events-none table-select-checkbox"
                        />
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('company_code')} className={sortButtonClass(companySortKey === 'company_code')}>
                        Client ID
                        {sortIcon(companySortKey === 'company_code', companySortDirection)}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('company_name')} className={sortButtonClass(companySortKey === 'company_name')}>
                        Name
                        {sortIcon(companySortKey === 'company_name', companySortDirection)}
                      </button>
                    </th>
                    <th className="p-3 text-left">Facilities</th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('scoped_user_count')} className={sortButtonClass(companySortKey === 'scoped_user_count')}>
                        Users
                        {sortIcon(companySortKey === 'scoped_user_count', companySortDirection)}
                      </button>
                    </th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onCompanySort('created_at')} className={sortButtonClass(companySortKey === 'created_at')}>
                        Created
                        {sortIcon(companySortKey === 'created_at', companySortDirection)}
                      </button>
                    </th>
                    <th className="w-[120px] p-3 text-left" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pagedCompanies.map((company) => (
                    <tr
                      key={company.id}
                      className="group border-b transition-colors hover:bg-muted/20"
                      onDoubleClick={() => navigate(`/admin/clients/${company.id}`)}
                      onClick={(event) => {
                        if (event.ctrlKey || event.metaKey) {
                          setSelectedCompanyIds((prev) => (prev.includes(company.id) ? prev.filter((id) => id !== company.id) : [...prev, company.id]))
                        }
                      }}
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedCompanyIds((prev) => (prev.includes(company.id) ? prev.filter((id) => id !== company.id) : [...prev, company.id]))
                          }}
                          aria-label={`Select client ${company.company_code}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCompanyIds.includes(company.id)}
                            onChange={() => undefined}
                            className="pointer-events-none table-select-checkbox"
                          />
                        </button>
                      </td>
                      <td className="p-3">{company.company_code}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2">
                          {company.logo_url ? (
                            <img src={company.logo_url} alt={company.company_name} className="h-6 w-6 rounded-full border border-border object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">
                              {clientFallback(company)}
                            </span>
                          )}
                          <span>{company.company_name}</span>
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{company.facility_count}</td>
                      <td className="p-3 text-muted-foreground">{company.scoped_user_count}</td>
                      <td className="p-3">{company.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="p-3 text-muted-foreground">{new Date(company.created_at).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          <TooltipIconButton
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/admin/clients/${company.id}`)
                            }}
                            tooltip="Open client details"
                          >
                            <Eye className="h-4 w-4" />
                          </TooltipIconButton>
                          <TooltipIconButton
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.stopPropagation()
                              void onToggleCompanyInline(company)
                            }}
                            tooltip="Toggle client status"
                          >
                            <Power className="h-4 w-4" />
                          </TooltipIconButton>
                          <TooltipIconButton
                            className="h-7 w-7 hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation()
                              openDeleteCompanyConfirm(company)
                            }}
                            tooltip="Delete client"
                          >
                            <Trash2 className="h-4 w-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>New Client</CardTitle>
                <CardDescription>Create a client.</CardDescription>
              </div>
              <Button className="h-9 px-3" variant="outline" onClick={() => setIsCompanyOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onCreateCompany)}>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" {...register('companyName')} />
                  {errors.companyName ? <p className="text-xs text-destructive">{errors.companyName.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Input id="billingAddress" {...register('billingAddress')} />
                  {errors.billingAddress ? <p className="text-xs text-destructive">{errors.billingAddress.message}</p> : null}
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsCompanyOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createCompanyMutation.isPending}>
                    {createCompanyMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isDeleteConfirmOpen && deleteTargetCompany ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Confirm Permanent Delete</CardTitle>
              <CardDescription>
                Type {deleteTargetCompany.company_code} to permanently delete this client and all child facilities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
                This action cannot be undone.
              </p>
              <Input
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                placeholder="Enter Client ID"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 px-3"
                  onClick={() => void onConfirmHardDelete()}
                  disabled={deleteCompanyMutation.isPending || deleteConfirmInput.trim() !== deleteTargetCompany.company_code}
                >
                  {deleteCompanyMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  )
}
