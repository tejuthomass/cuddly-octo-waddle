import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowDownUp, ArrowUp, Eye, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import {
  type AdminFacilityWithUserStats,
  useAdminCompanyDetails,
  useCreateFacility,
  useHardDeleteCompany,
  useHardDeleteFacility,
  useToggleCompanyActive,
  useToggleFacilityActive,
  useUpdateCompany,
  useUpdateFacility,
} from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const companySchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
  billingAddress: z.string().min(5, 'Billing address is required.'),
})

const facilitySchema = z.object({
  facilityCode: z.string().min(4, 'Facility code must be at least 4 characters.').max(20).optional().or(z.literal('')),
  facilityName: z.string().min(2, 'Facility name is required.'),
  addressLine1: z.string().min(5, 'Address is required.'),
  city: z.string().min(2, 'City is required.'),
  state: z.string().min(2, 'State is required.'),
  country: z.string().min(2, 'Country is required.'),
})

type CompanyFormValues = z.infer<typeof companySchema>
type FacilityFormValues = z.infer<typeof facilitySchema>

type FacilitySortKey = 'facility_code' | 'facility_name' | 'city' | 'total_user_count' | 'created_at'
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

export default function ClientDetailsPage() {
  const navigate = useNavigate()
  const params = useParams<{ companyId: string }>()
  const companyId = params.companyId

  const { data, isLoading } = useAdminCompanyDetails(companyId)
  const updateCompanyMutation = useUpdateCompany()
  const toggleCompanyMutation = useToggleCompanyActive()
  const deleteCompanyMutation = useHardDeleteCompany()
  const createFacilityMutation = useCreateFacility()
  const updateFacilityMutation = useUpdateFacility()
  const toggleFacilityMutation = useToggleFacilityActive()
  const deleteFacilityMutation = useHardDeleteFacility()

  const [facilitySearch, setFacilitySearch] = useState('')
  const [facilitySortKey, setFacilitySortKey] = useState<FacilitySortKey>('created_at')
  const [facilitySortDirection, setFacilitySortDirection] = useState<SortDirection>('desc')
  const [facilityPage, setFacilityPage] = useState(1)
  const [facilityPageSize, setFacilityPageSize] = useState(10)

  const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<AdminFacilityWithUserStats | null>(null)
  const [isDeleteFacilityConfirmOpen, setIsDeleteFacilityConfirmOpen] = useState(false)
  const [deleteFacilityConfirmInput, setDeleteFacilityConfirmInput] = useState('')
  const [deleteTargetFacility, setDeleteTargetFacility] = useState<AdminFacilityWithUserStats | null>(null)
  const [isDeleteCompanyConfirmOpen, setIsDeleteCompanyConfirmOpen] = useState(false)
  const [deleteCompanyConfirmInput, setDeleteCompanyConfirmInput] = useState('')

  const {
    register: registerCompany,
    handleSubmit: handleCompanySubmit,
    reset: resetCompany,
    formState: { errors: companyErrors, isDirty: isCompanyDirty },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: '',
      billingAddress: '',
    },
  })

  const {
    register: registerFacility,
    handleSubmit: handleFacilitySubmit,
    reset: resetFacility,
    formState: { errors: facilityErrors },
  } = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      facilityCode: '',
      facilityName: '',
      addressLine1: '',
      city: '',
      state: '',
      country: '',
    },
  })

  const filteredFacilities = useMemo(() => {
    const query = facilitySearch.trim().toLowerCase()
    const rows = [...(data?.facilities ?? [])].filter((facility) => {
      if (!query) return true
      return [facility.facility_code, facility.facility_name, facility.city, facility.state, facility.country]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })

    rows.sort((a, b) => {
      const direction = facilitySortDirection === 'asc' ? 1 : -1
      if (facilitySortKey === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction
      }

      if (facilitySortKey === 'total_user_count') {
        return (a.total_user_count - b.total_user_count) * direction
      }

      return `${a[facilitySortKey] ?? ''}`.localeCompare(`${b[facilitySortKey] ?? ''}`) * direction
    })

    return rows
  }, [data?.facilities, facilitySearch, facilitySortDirection, facilitySortKey])

  const totalFacilityPages = Math.max(1, Math.ceil(filteredFacilities.length / facilityPageSize))
  const pagedFacilities = useMemo(() => {
    const start = (facilityPage - 1) * facilityPageSize
    return filteredFacilities.slice(start, start + facilityPageSize)
  }, [facilityPage, facilityPageSize, filteredFacilities])

  const onFacilitySort = (key: FacilitySortKey) => {
    if (facilitySortKey === key) {
      setFacilitySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setFacilitySortKey(key)
    setFacilitySortDirection('asc')
  }

  const openFacilityModal = (facility?: AdminFacilityWithUserStats) => {
    if (facility) {
      setEditingFacility(facility)
      resetFacility({
        facilityCode: facility.facility_code,
        facilityName: facility.facility_name,
        addressLine1: facility.address_line_1,
        city: facility.city,
        state: facility.state,
        country: facility.country,
      })
    } else {
      setEditingFacility(null)
      resetFacility({
        facilityCode: '',
        facilityName: '',
        addressLine1: '',
        city: '',
        state: '',
        country: '',
      })
    }
    setIsFacilityModalOpen(true)
  }

  const onSaveFacility = async (values: FacilityFormValues) => {
    if (!companyId) return

    try {
      if (editingFacility) {
        await updateFacilityMutation.mutateAsync({
          facilityId: editingFacility.id,
          facilityName: values.facilityName,
          addressLine1: values.addressLine1,
          city: values.city,
          state: values.state,
          country: values.country,
        })
        toast.success('Facility updated.')
      } else {
        await createFacilityMutation.mutateAsync({
          facilityCode: values.facilityCode || undefined,
          companyId,
          facilityName: values.facilityName,
          addressLine1: values.addressLine1,
          city: values.city,
          state: values.state,
          country: values.country,
        })
        toast.success('Facility created.')
      }

      setIsFacilityModalOpen(false)
      setEditingFacility(null)
      resetFacility()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to save facility.'))
    }
  }

  const onToggleCompany = async () => {
    if (!data) return

    try {
      await toggleCompanyMutation.mutateAsync({ companyId: data.company.id, isActive: !data.company.is_active })
      toast.success(!data.company.is_active ? 'Client enabled.' : 'Client disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update client status.'))
    }
  }

  const onUpdateCompany = async (values: CompanyFormValues) => {
    if (!data) return

    try {
      await updateCompanyMutation.mutateAsync({
        companyId: data.company.id,
        companyName: values.companyName,
        billingAddress: values.billingAddress,
      })
      toast.success('Client updated.')
      resetCompany(values)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update client.'))
    }
  }

  const onConfirmDeleteCompany = async () => {
    if (!data) return

    if (deleteCompanyConfirmInput.trim() !== data.company.company_code) {
      toast.error('Type the exact Client ID to confirm deletion.')
      return
    }

    try {
      await deleteCompanyMutation.mutateAsync({ companyId: data.company.id })
      toast.success('Client permanently deleted.')
      navigate('/admin/clients')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete client.'))
    }
  }

  const openDeleteFacilityConfirm = (facility: AdminFacilityWithUserStats) => {
    setDeleteTargetFacility(facility)
    setDeleteFacilityConfirmInput('')
    setIsDeleteFacilityConfirmOpen(true)
  }

  const onToggleFacility = async (facility: AdminFacilityWithUserStats) => {
    try {
      await toggleFacilityMutation.mutateAsync({ facilityId: facility.id, isActive: !facility.is_active })
      toast.success(!facility.is_active ? 'Facility enabled.' : 'Facility disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update facility status.'))
    }
  }

  const onConfirmDeleteFacility = async () => {
    if (!deleteTargetFacility) return

    if (deleteFacilityConfirmInput.trim() !== deleteTargetFacility.facility_code) {
      toast.error('Type the exact Facility ID to confirm deletion.')
      return
    }

    try {
      await deleteFacilityMutation.mutateAsync({ facilityId: deleteTargetFacility.id })
      toast.success('Facility permanently deleted.')
      setDeleteTargetFacility(null)
      setDeleteFacilityConfirmInput('')
      setIsDeleteFacilityConfirmOpen(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete facility.'))
    }
  }

  useEffect(() => {
    if (!data) return

    resetCompany({
      companyName: data.company.company_name,
      billingAddress: data.company.billing_address,
    })
  }, [data, resetCompany])

  useEffect(() => {
    setFacilityPage(1)
  }, [facilityPageSize, facilitySearch, facilitySortDirection, facilitySortKey])

  useEffect(() => {
    if (facilityPage > totalFacilityPages) {
      setFacilityPage(totalFacilityPages)
    }
  }, [facilityPage, totalFacilityPages])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Client Details</CardTitle>
              <CardDescription>
                {data ? `${data.company.company_code} - full metadata, calculated user counts, and facilities` : 'Loading client details'}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="h-9 px-3" onClick={() => navigate('/admin/clients')}>
              Back
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data ? (
            <>
              <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Client ID</p>
                  <p className="text-sm font-medium">{data.company.company_code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(data.company.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm">{data.company.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>

              <form className="grid gap-4 rounded-md border border-border/70 p-4 md:grid-cols-2" onSubmit={handleCompanySubmit(onUpdateCompany)}>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Name</Label>
                  <Input id="companyName" {...registerCompany('companyName')} />
                  {companyErrors.companyName ? <p className="text-xs text-destructive">{companyErrors.companyName.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Input id="billingAddress" {...registerCompany('billingAddress')} />
                  {companyErrors.billingAddress ? <p className="text-xs text-destructive">{companyErrors.billingAddress.message}</p> : null}
                </div>
                <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                  <Button type="button" variant={data.company.is_active ? 'destructive' : 'secondary'} className="h-9 px-3" onClick={() => void onToggleCompany()} disabled={toggleCompanyMutation.isPending}>
                    {data.company.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button type="submit" className="h-9 px-3" disabled={!isCompanyDirty || updateCompanyMutation.isPending}>
                    {updateCompanyMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="h-9 px-3" onClick={() => { setDeleteCompanyConfirmInput(''); setIsDeleteCompanyConfirmOpen(true) }}>
                    Delete Permanently
                  </Button>
                </div>
              </form>

              <div className="grid gap-3 md:grid-cols-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Users</CardDescription>
                    <CardTitle className="text-lg">{data.stats.total_user_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>L1</CardDescription>
                    <CardTitle className="text-lg">{data.stats.l1_user_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>L2</CardDescription>
                    <CardTitle className="text-lg">{data.stats.l2_user_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>L3</CardDescription>
                    <CardTitle className="text-lg">{data.stats.l3_user_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Client Users</CardDescription>
                    <CardTitle className="text-lg">{data.stats.client_user_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Facilities</CardDescription>
                    <CardTitle className="text-lg">{data.company.facility_count}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="space-y-3 rounded-md border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Facilities</h3>
                    <p className="text-xs text-muted-foreground">Detailed facility list with scoped user counts. Open a facility for deeper details.</p>
                  </div>
                  <Button className="inline-flex h-9 items-center justify-center gap-2 px-3" onClick={() => openFacilityModal()}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                <div className="relative">
                  <Input value={facilitySearch} onChange={(event) => setFacilitySearch(event.target.value)} className="h-9" placeholder="Search facilities" />
                </div>

                <div className="overflow-x-auto rounded-md border border-border/70">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('facility_code')} className={sortButtonClass(facilitySortKey === 'facility_code')}>
                            ID
                            {sortIcon(facilitySortKey === 'facility_code', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('facility_name')} className={sortButtonClass(facilitySortKey === 'facility_name')}>
                            Name
                            {sortIcon(facilitySortKey === 'facility_name', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('city')} className={sortButtonClass(facilitySortKey === 'city')}>
                            City
                            {sortIcon(facilitySortKey === 'city', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('total_user_count')} className={sortButtonClass(facilitySortKey === 'total_user_count')}>
                            Users
                            {sortIcon(facilitySortKey === 'total_user_count', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="p-3 text-left">L1</th>
                        <th className="p-3 text-left">L2</th>
                        <th className="p-3 text-left">L3</th>
                        <th className="p-3 text-left">Client</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('created_at')} className={sortButtonClass(facilitySortKey === 'created_at')}>
                            Created
                            {sortIcon(facilitySortKey === 'created_at', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="w-[120px] p-3 text-left" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedFacilities.map((facility) => (
                        <tr key={facility.id} className="group border-b transition-colors hover:bg-muted/20">
                          <td className="p-3">{facility.facility_code}</td>
                          <td className="p-3">{facility.facility_name}</td>
                          <td className="p-3 text-muted-foreground">{facility.city}</td>
                          <td className="p-3 text-muted-foreground">{facility.total_user_count}</td>
                          <td className="p-3 text-muted-foreground">{facility.l1_user_count}</td>
                          <td className="p-3 text-muted-foreground">{facility.l2_user_count}</td>
                          <td className="p-3 text-muted-foreground">{facility.l3_user_count}</td>
                          <td className="p-3 text-muted-foreground">{facility.client_user_count}</td>
                          <td className="p-3">{facility.is_active ? 'Active' : 'Inactive'}</td>
                          <td className="p-3 text-muted-foreground">{new Date(facility.created_at).toLocaleString()}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                              <TooltipIconButton className="h-7 w-7" onClick={() => navigate(`/admin/facilities/${facility.id}`)} tooltip="Open facility page">
                                <Eye className="h-4 w-4" />
                              </TooltipIconButton>
                              <TooltipIconButton className="h-7 w-7" onClick={() => openFacilityModal(facility)} tooltip="Edit facility">
                                <Pencil className="h-4 w-4" />
                              </TooltipIconButton>
                              <TooltipIconButton className="h-7 w-7" onClick={() => void onToggleFacility(facility)} tooltip="Toggle facility status">
                                <Power className="h-4 w-4" />
                              </TooltipIconButton>
                              <TooltipIconButton className="h-7 w-7 hover:text-destructive" onClick={() => openDeleteFacilityConfirm(facility)} tooltip="Delete facility">
                                <Trash2 className="h-4 w-4" />
                              </TooltipIconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Showing {pagedFacilities.length} of {filteredFacilities.length}</p>
                  <div className="flex items-center gap-2">
                    <PageSizeSelect value={facilityPageSize} onChange={setFacilityPageSize} />
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setFacilityPage((prev) => Math.max(1, prev - 1))} disabled={facilityPage <= 1}>
                      Prev
                    </Button>
                    <span className="text-sm text-muted-foreground">{facilityPage} / {totalFacilityPages}</span>
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setFacilityPage((prev) => Math.min(totalFacilityPages, prev + 1))} disabled={facilityPage >= totalFacilityPages}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Client not found.</p>
          )}
        </CardContent>
      </Card>

      {isFacilityModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => setIsFacilityModalOpen(false)}>
          <Card className="w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{editingFacility ? 'Edit Facility' : 'New Facility'}</CardTitle>
                <CardDescription>{data?.company.company_name}</CardDescription>
              </div>
              <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsFacilityModalOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-3" onSubmit={handleFacilitySubmit(onSaveFacility)}>
                <div className="space-y-2">
                  <Label htmlFor="facilityCode">Facility ID (optional)</Label>
                  <Input id="facilityCode" placeholder="Auto" readOnly={Boolean(editingFacility)} className={editingFacility ? 'cursor-not-allowed opacity-70' : ''} {...registerFacility('facilityCode')} />
                  {facilityErrors.facilityCode ? <p className="text-xs text-destructive">{facilityErrors.facilityCode.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="facilityName">Name</Label>
                  <Input id="facilityName" {...registerFacility('facilityName')} />
                  {facilityErrors.facilityName ? <p className="text-xs text-destructive">{facilityErrors.facilityName.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="addressLine1">Address</Label>
                  <Input id="addressLine1" {...registerFacility('addressLine1')} />
                  {facilityErrors.addressLine1 ? <p className="text-xs text-destructive">{facilityErrors.addressLine1.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...registerFacility('city')} />
                  {facilityErrors.city ? <p className="text-xs text-destructive">{facilityErrors.city.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" {...registerFacility('state')} />
                  {facilityErrors.state ? <p className="text-xs text-destructive">{facilityErrors.state.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...registerFacility('country')} />
                  {facilityErrors.country ? <p className="text-xs text-destructive">{facilityErrors.country.message}</p> : null}
                </div>
                <div className="md:col-span-3 flex justify-end gap-2">
                  <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsFacilityModalOpen(false)}>Cancel</Button>
                  <Button className="h-9 px-3" type="submit" disabled={createFacilityMutation.isPending || updateFacilityMutation.isPending}>
                    {createFacilityMutation.isPending || updateFacilityMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isDeleteFacilityConfirmOpen && deleteTargetFacility ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteFacilityConfirmOpen(false)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Confirm Permanent Delete</CardTitle>
              <CardDescription>Type {deleteTargetFacility.facility_code} to permanently delete this facility.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={deleteFacilityConfirmInput}
                onChange={(event) => setDeleteFacilityConfirmInput(event.target.value)}
                placeholder="Enter Facility ID"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteFacilityConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 px-3"
                  onClick={() => void onConfirmDeleteFacility()}
                  disabled={deleteFacilityMutation.isPending || deleteFacilityConfirmInput.trim() !== deleteTargetFacility.facility_code}
                >
                  {deleteFacilityMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isDeleteCompanyConfirmOpen && data ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteCompanyConfirmOpen(false)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Confirm Permanent Delete</CardTitle>
              <CardDescription>Type {data.company.company_code} to permanently delete this client and all child facilities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={deleteCompanyConfirmInput}
                onChange={(event) => setDeleteCompanyConfirmInput(event.target.value)}
                placeholder="Enter Client ID"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteCompanyConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 px-3"
                  onClick={() => void onConfirmDeleteCompany()}
                  disabled={deleteCompanyMutation.isPending || deleteCompanyConfirmInput.trim() !== data.company.company_code}
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
