import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowDownUp, ArrowLeft, ArrowUp, Eye, Pencil, Plus, Power, PowerOff, Search, Trash2, Upload, UserMinus, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import { useCompanyOptions, useFacilityOptions } from '@/hooks/useAdminAccess'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import {
  type AdminFacilityRow,
  useAdminCompanyDetails,
  useCreateFacility,
  useGrantCompanyClientAccess,
  useHardDeleteCompany,
  useHardDeleteFacility,
  useRevokeCompanyClientAccess,
  useToggleCompanyActive,
  useToggleFacilityActive,
  useUpdateCompany,
  useUpdateCompanyLogo,
  useUpdateFacility,
} from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const companySchema = z.object({
  companyName: z.string().min(2, 'Company name is required.'),
})

const facilitySchema = z.object({
  facilityName: z.string().min(2, 'Facility name is required.'),
  addressLine1: z.string().min(5, 'Address is required.'),
  city: z.string().min(2, 'City is required.'),
  state: z.string().min(2, 'State is required.'),
  country: z.string().min(2, 'Country is required.'),
})

type CompanyFormValues = z.infer<typeof companySchema>
type FacilityFormValues = z.infer<typeof facilitySchema>

type FacilitySortKey = 'facility_code' | 'facility_name' | 'city' | 'created_at' | 'updated_at'
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
  const location = useLocation()
  const params = useParams<{ companyId: string }>()
  const companyId = params.companyId
  const fromState = (location.state as { from?: string } | null)?.from
  const backTarget = typeof fromState === 'string' && fromState.length > 0 ? fromState : '/admin/clients'

  const { data, isLoading } = useAdminCompanyDetails(companyId)
  const { data: users = [] } = useAdminUsers()
  const { data: companies = [] } = useCompanyOptions()
  const { data: facilities = [] } = useFacilityOptions()
  const updateCompanyMutation = useUpdateCompany()
  const toggleCompanyMutation = useToggleCompanyActive()
  const deleteCompanyMutation = useHardDeleteCompany()
  const updateCompanyLogoMutation = useUpdateCompanyLogo()
  const grantCompanyClientAccessMutation = useGrantCompanyClientAccess()
  const revokeCompanyClientAccessMutation = useRevokeCompanyClientAccess()
  const createFacilityMutation = useCreateFacility()
  const updateFacilityMutation = useUpdateFacility()
  const toggleFacilityMutation = useToggleFacilityActive()
  const deleteFacilityMutation = useHardDeleteFacility()

  const [facilitySearch, setFacilitySearch] = useState('')
  const [facilitySortKey, setFacilitySortKey] = useState<FacilitySortKey>('created_at')
  const [facilitySortDirection, setFacilitySortDirection] = useState<SortDirection>('desc')
  const [facilityPage, setFacilityPage] = useState(1)
  const [facilityPageSize, setFacilityPageSize] = useState(10)
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
  const [lastSelectedFacilityIndex, setLastSelectedFacilityIndex] = useState<number | null>(null)
  const [selectedClientCandidateIds, setSelectedClientCandidateIds] = useState<string[]>([])

  const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false)
  const [isEditCompanySidebarOpen, setIsEditCompanySidebarOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<AdminFacilityRow | null>(null)
  const [isDeleteFacilityConfirmOpen, setIsDeleteFacilityConfirmOpen] = useState(false)
  const [deleteFacilityConfirmInput, setDeleteFacilityConfirmInput] = useState('')
  const [deleteTargetFacility, setDeleteTargetFacility] = useState<AdminFacilityRow | null>(null)
  const [isDeleteCompanyConfirmOpen, setIsDeleteCompanyConfirmOpen] = useState(false)
  const [deleteCompanyConfirmInput, setDeleteCompanyConfirmInput] = useState('')
  const [isAddClientUsersOpen, setIsAddClientUsersOpen] = useState(false)
  const [clientUserSearch, setClientUserSearch] = useState('')
  const [clientUserCompanyFilter, setClientUserCompanyFilter] = useState<string>('ALL')
  const [clientUserFacilityFilter, setClientUserFacilityFilter] = useState<string>('ALL')
  const [clientUserPage, setClientUserPage] = useState(1)
  const [clientUserPageSize, setClientUserPageSize] = useState(10)
  const sitesTableRef = useRef<HTMLDivElement | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const {
    register: registerCompany,
    handleSubmit: handleCompanySubmit,
    reset: resetCompany,
    formState: { errors: companyErrors, isDirty: isCompanyDirty },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: '',
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
      if (facilitySortKey === 'created_at' || facilitySortKey === 'updated_at') {
        return (new Date(a[facilitySortKey]).getTime() - new Date(b[facilitySortKey]).getTime()) * direction
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

  const onSelectFacilityRow = (facilityId: string, rowIndex: number, options: { shift: boolean; multi: boolean }) => {
    if (options.shift && lastSelectedFacilityIndex !== null) {
      const start = Math.min(lastSelectedFacilityIndex, rowIndex)
      const end = Math.max(lastSelectedFacilityIndex, rowIndex)
      const rangeIds = pagedFacilities.slice(start, end + 1).map((row) => row.id)

      setSelectedFacilityIds((prev) => {
        if (options.multi) {
          return Array.from(new Set([...prev, ...rangeIds]))
        }
        return rangeIds
      })
      return
    }

    if (options.multi) {
      setSelectedFacilityIds((prev) => (prev.includes(facilityId) ? prev.filter((id) => id !== facilityId) : [...prev, facilityId]))
      setLastSelectedFacilityIndex(rowIndex)
      return
    }

    setSelectedFacilityIds([facilityId])
    setLastSelectedFacilityIndex(rowIndex)
  }

  const openFacilityModal = (facility?: AdminFacilityRow) => {
    if (facility) {
      setEditingFacility(facility)
      resetFacility({
        facilityName: facility.facility_name,
        addressLine1: facility.address_line_1,
        city: facility.city,
        state: facility.state,
        country: facility.country,
      })
    } else {
      setEditingFacility(null)
      resetFacility({
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
        toast.success('Site updated.')
      } else {
        await createFacilityMutation.mutateAsync({
          companyId,
          facilityName: values.facilityName,
          addressLine1: values.addressLine1,
          city: values.city,
          state: values.state,
          country: values.country,
        })
        toast.success('Site created.')
      }

      setIsFacilityModalOpen(false)
      setEditingFacility(null)
      resetFacility()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to save site.'))
    }
  }

  const onToggleCompany = async () => {
    if (!data) return

    try {
      await toggleCompanyMutation.mutateAsync({ companyId: data.company.id, isActive: !data.company.is_active })
      toast.success(!data.company.is_active ? 'Account enabled.' : 'Account disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update account status.'))
    }
  }

  const onUpdateCompany = async (values: CompanyFormValues) => {
    if (!data) return

    try {
      await updateCompanyMutation.mutateAsync({
        companyId: data.company.id,
        companyName: values.companyName,
      })
      toast.success('Account updated.')
      resetCompany(values)
      setIsEditCompanySidebarOpen(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update account.'))
    }
  }

  const onConfirmDeleteCompany = async () => {
    if (!data) return

    if (deleteCompanyConfirmInput.trim() !== data.company.company_code) {
      toast.error('Type the exact Account ID to confirm deletion.')
      return
    }

    try {
      await deleteCompanyMutation.mutateAsync({ companyId: data.company.id })
      toast.success('Account permanently deleted.')
      navigate('/admin/clients', { replace: true })
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete account.'))
    }
  }

  const openDeleteFacilityConfirm = (facility: AdminFacilityRow) => {
    setDeleteTargetFacility(facility)
    setDeleteFacilityConfirmInput('')
    setIsDeleteFacilityConfirmOpen(true)
  }

  const onToggleFacility = async (facility: AdminFacilityRow) => {
    try {
      await toggleFacilityMutation.mutateAsync({ facilityId: facility.id, isActive: !facility.is_active })
      toast.success(!facility.is_active ? 'Site enabled.' : 'Site disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update site status.'))
    }
  }

  const onConfirmDeleteFacility = async () => {
    if (!deleteTargetFacility) return

    if (deleteFacilityConfirmInput.trim() !== deleteTargetFacility.facility_code) {
      toast.error('Type the exact Site ID to confirm deletion.')
      return
    }

    try {
      await deleteFacilityMutation.mutateAsync({ facilityId: deleteTargetFacility.id })
      toast.success('Site permanently deleted.')
      setDeleteTargetFacility(null)
      setDeleteFacilityConfirmInput('')
      setIsDeleteFacilityConfirmOpen(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete site.'))
    }
  }

  const onUploadCompanyLogo = async (file: File) => {
    if (!data) return

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/png' })
      await updateCompanyLogoMutation.mutateAsync({ companyId: data.company.id, logoBlob: blob })
      toast.success('Account logo updated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to upload account logo.'))
    }
  }

  const onRemoveCompanyLogo = async () => {
    if (!data) return

    try {
      await updateCompanyLogoMutation.mutateAsync({ companyId: data.company.id, logoBlob: null })
      toast.success('Account logo removed.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to remove account logo.'))
    }
  }

  const onGrantClientAccess = async () => {
    if (!data || selectedClientCandidateIds.length === 0) {
      toast.error('Select at least one client user to add.')
      return
    }

    try {
      await grantCompanyClientAccessMutation.mutateAsync({ companyId: data.company.id, userIds: selectedClientCandidateIds })
      setSelectedClientCandidateIds([])
      setIsAddClientUsersOpen(false)
      toast.success('Client access granted.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to grant selected client access.'))
    }
  }

  const onRevokeClientAccess = async (userId: string) => {
    if (!data) return

    try {
      await revokeCompanyClientAccessMutation.mutateAsync({ companyId: data.company.id, userId })
      toast.success('Client access removed.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to remove client access.'))
    }
  }

  useEffect(() => {
    if (!data) return

    resetCompany({
      companyName: data.company.company_name,
    })
    setIsEditCompanySidebarOpen(false)
  }, [data, resetCompany])

  useEffect(() => {
    setFacilityPage(1)
  }, [facilityPageSize, facilitySearch, facilitySortDirection, facilitySortKey])

  useEffect(() => {
    if (facilityPage > totalFacilityPages) {
      setFacilityPage(totalFacilityPages)
    }
  }, [facilityPage, totalFacilityPages])

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (sitesTableRef.current?.contains(target)) return

      setSelectedFacilityIds([])
      setLastSelectedFacilityIndex(null)
    }

    document.addEventListener('mousedown', onDocumentPointerDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown)
    }
  }, [])

  useEffect(() => {
    setSelectedClientCandidateIds([])
  }, [data?.company.id])

  const clientAccessUserIds = useMemo(() => new Set((data?.clientAccessUsers ?? []).map((user) => user.user_id)), [data?.clientAccessUsers])

  const candidateClientUsers = useMemo(() => {
    const query = clientUserSearch.trim().toLowerCase()

    return users.filter((user) => {
      if (user.role_code !== 'CLIENT') return false
      if (clientAccessUserIds.has(user.id)) return false
      if (clientUserCompanyFilter !== 'ALL' && user.company_id !== clientUserCompanyFilter) return false
      if (clientUserFacilityFilter !== 'ALL' && user.facility_id !== clientUserFacilityFilter) return false

      if (!query) return true
      return [user.user_id, user.full_name, user.email, user.phone ?? ''].join(' ').toLowerCase().includes(query)
    })
  }, [clientAccessUserIds, clientUserCompanyFilter, clientUserFacilityFilter, clientUserSearch, users])

  const clientUserFacilityOptions = useMemo(() => {
    if (clientUserCompanyFilter === 'ALL') {
      return [{ value: 'ALL', label: 'All sites' }]
    }

    return [
      { value: 'ALL', label: 'All sites' },
      ...facilities
        .filter((facility) => facility.companyId === clientUserCompanyFilter)
        .map((facility) => ({ value: facility.id, label: facility.label })),
    ]
  }, [clientUserCompanyFilter, facilities])

  const userById = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>()
    for (const user of users) {
      map.set(user.id, user)
    }
    return map
  }, [users])

  const getClientDisplayName = (user: { user_id: string; full_name: string; employee_id: string; email: string }) => {
    const linkedUser = userById.get(user.user_id)
    if (user.full_name && user.full_name !== 'Unnamed user') return user.full_name
    if (linkedUser?.full_name) return linkedUser.full_name
    if (user.email && user.email !== '-') return user.email
    if (linkedUser?.email) return linkedUser.email
    if (user.employee_id && user.employee_id !== '-') return user.employee_id
    if (linkedUser?.user_id) return linkedUser.user_id
    return user.user_id
  }

  const getClientDisplayUserId = (user: { user_id: string; employee_id: string }) => {
    const linkedUser = userById.get(user.user_id)
    if (linkedUser?.user_id) return linkedUser.user_id
    if (user.employee_id && user.employee_id !== '-') return user.employee_id
    return user.user_id
  }

  const totalClientUserPages = Math.max(1, Math.ceil(candidateClientUsers.length / clientUserPageSize))
  const pagedClientUsers = useMemo(() => {
    const start = (clientUserPage - 1) * clientUserPageSize
    return candidateClientUsers.slice(start, start + clientUserPageSize)
  }, [candidateClientUsers, clientUserPage, clientUserPageSize])

  useEffect(() => {
    setClientUserPage(1)
  }, [clientUserSearch, clientUserCompanyFilter, clientUserFacilityFilter, clientUserPageSize])

  useEffect(() => {
    if (clientUserPage > totalClientUserPages) {
      setClientUserPage(totalClientUserPages)
    }
  }, [clientUserPage, totalClientUserPages])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader className="sticky top-0 z-20 rounded-t-xl border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl tracking-tight">Account Details</CardTitle>
              <CardDescription>
                {data
                  ? `${data.company.company_name} — Users and sites.`
                  : 'Loading account details'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => navigate(backTarget)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Accounts</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data ? (
            <>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-6 md:flex-row md:items-center md:gap-8 shadow-sm">
                  <div className="flex-shrink-0">
                    {data.company.logo_url ? (
                      <img src={data.company.logo_url} alt={data.company.company_name} className="h-24 w-24 rounded-2xl border border-border/50 object-cover shadow-sm ring-4 ring-background" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border/50 bg-primary/10 text-3xl font-semibold shadow-sm text-primary ring-4 ring-background">
                        {data.company.company_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">{data.company.company_name}</h2>
                          {data.company.is_active ? (
                           <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                          ) : (
                           <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">Inactive</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground/80">
                          Account ID: <span className="font-mono text-foreground">{data.company.company_code}</span>
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <TooltipIconButton tooltip="Edit Details" onClick={() => setIsEditCompanySidebarOpen(true)}>
                          <Pencil className="h-4 w-4" />
                        </TooltipIconButton>
                        <TooltipIconButton 
                          tooltip={data.company.is_active ? 'Deactivate' : 'Activate'} 
                          onClick={() => void onToggleCompany()}
                          disabled={toggleCompanyMutation.isPending}
                          className={data.company.is_active ? 'hover:text-amber-600 hover:bg-amber-600/10' : 'hover:text-emerald-600 hover:bg-emerald-600/10'}
                        >
                          <PowerOff className="h-4 w-4" />
                        </TooltipIconButton>
                        <TooltipIconButton 
                          tooltip="Delete Permanently" 
                          onClick={() => { setDeleteCompanyConfirmInput(''); setIsDeleteCompanyConfirmOpen(true) }}
                          className="hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </TooltipIconButton>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-medium text-foreground/80">Created:</span>
                        {new Date(data.company.created_at).toLocaleString()}
                      </span>
                      <span className="text-border">•</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-medium text-foreground/80">Updated:</span>
                        {new Date(data.company.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card className="shadow-sm">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sites</CardTitle>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{data.stats.sites.active + data.stats.sites.inactive}</span>
                        <span className="text-sm text-muted-foreground">Total</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-emerald-600 dark:text-emerald-500">{data.stats.sites.active}</span>
                          <span className="text-muted-foreground text-xs">Active</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="font-medium text-rose-600 dark:text-rose-500">{data.stats.sites.inactive}</span>
                          <span className="text-muted-foreground text-xs">Inactive</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-sm">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Client Users</CardTitle>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{data.stats.clients.active + data.stats.clients.inactive}</span>
                        <span className="text-sm text-muted-foreground">Total</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-emerald-600 dark:text-emerald-500">{data.stats.clients.active}</span>
                          <span className="text-muted-foreground text-xs">Active</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="font-medium text-rose-600 dark:text-rose-500">{data.stats.clients.inactive}</span>
                          <span className="text-muted-foreground text-xs">Inactive</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ops Team</CardTitle>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{data.stats.users.active + data.stats.users.inactive}</span>
                        <span className="text-sm text-muted-foreground">Total</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-emerald-600 dark:text-emerald-500">{data.stats.users.active}</span>
                          <span className="text-muted-foreground text-xs">Active</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="font-medium text-rose-600 dark:text-rose-500">{data.stats.users.inactive}</span>
                          <span className="text-muted-foreground text-xs">Inactive</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                    <div>
                      <CardTitle className="text-sm font-semibold">Client Access</CardTitle>
                      <CardDescription className="text-xs">Clients added to this account.</CardDescription>
                    </div>
                    <Button type="button" className="h-9 px-3" onClick={() => setIsAddClientUsersOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Provide Access
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {data.clientAccessUsers.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border border-border/70">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40">
                              <th className="w-40 p-3 text-left">User ID</th>
                              <th className="p-3 text-left">Name</th>
                              <th className="w-24 p-3 text-left">Status</th>
                              <th className="w-16 p-3 text-left" aria-label="Actions" />
                            </tr>
                          </thead>
                          <tbody>
                            {data.clientAccessUsers.map((user) => (
                              <tr key={user.user_id} className="group border-b last:border-b-0 hover:bg-muted/20">
                                <td className="p-3 text-muted-foreground">{getClientDisplayUserId(user)}</td>
                                <td className="p-3">{getClientDisplayName(user)}</td>
                                <td className="p-3">
                                  {user.is_active ? (
                                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">Inactive</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                                    <TooltipIconButton className="h-8 w-8" tooltip="Remove client" onClick={() => void onRevokeClientAccess(user.user_id)}>
                                      <UserMinus className="h-4 w-4" />
                                    </TooltipIconButton>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No clients added.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3 rounded-md border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Sites</h3>
                    <p className="text-xs text-muted-foreground">Manage sites.</p>
                  </div>
                  <Button className="h-9 px-3" onClick={() => openFacilityModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Site
                  </Button>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input value={facilitySearch} onChange={(event) => setFacilitySearch(event.target.value)} placeholder="Search sites" className="pl-9" />
                </div>

                <div ref={sitesTableRef} className="overflow-x-auto rounded-md border border-border/70">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="w-36 p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('facility_code')} className={sortButtonClass(facilitySortKey === 'facility_code')}>
                            Site ID
                            {sortIcon(facilitySortKey === 'facility_code', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="w-[28%] p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('facility_name')} className={sortButtonClass(facilitySortKey === 'facility_name')}>
                            Name
                            {sortIcon(facilitySortKey === 'facility_name', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="w-28 p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('city')} className={sortButtonClass(facilitySortKey === 'city')}>
                            City
                            {sortIcon(facilitySortKey === 'city', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="w-24 p-3 text-left">Status</th>
                        <th className="w-44 p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('created_at')} className={sortButtonClass(facilitySortKey === 'created_at')}>
                            Created
                            {sortIcon(facilitySortKey === 'created_at', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="w-44 p-3 text-left">
                          <button type="button" onClick={() => onFacilitySort('updated_at')} className={sortButtonClass(facilitySortKey === 'updated_at')}>
                            Updated
                            {sortIcon(facilitySortKey === 'updated_at', facilitySortDirection)}
                          </button>
                        </th>
                        <th className="w-20 p-3 text-left" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedFacilities.map((facility, rowIndex) => (
                        <tr
                          key={facility.id}
                          className={`group border-b transition-colors ${selectedFacilityIds.includes(facility.id) ? 'bg-muted/25 ring-1 ring-inset ring-border/70' : 'hover:bg-muted/20'}`}
                          onClick={(event) => {
                            if (event.shiftKey || event.ctrlKey || event.metaKey) {
                              onSelectFacilityRow(facility.id, rowIndex, { shift: event.shiftKey, multi: event.ctrlKey || event.metaKey })
                              return
                            }
                            navigate(`/admin/clients/${companyId}/facilities/${facility.id}`, {
                              state: {
                                from: `${location.pathname}${location.search}`,
                                companyCode: data.company.company_code,
                                facilityCode: facility.facility_code,
                                companyName: data.company.company_name,
                                facilityName: facility.facility_name,
                              },
                            })
                          }}
                          onDoubleClick={() => navigate(`/admin/clients/${companyId}/facilities/${facility.id}`, {
                            state: {
                              from: `${location.pathname}${location.search}`,
                              companyCode: data.company.company_code,
                              facilityCode: facility.facility_code,
                              companyName: data.company.company_name,
                              facilityName: facility.facility_name,
                            },
                          })}
                        >
                          <td className="w-36 p-3 text-sm">
                            <span className="block truncate">{facility.facility_code}</span>
                          </td>
                          <td className="w-[28%] p-3 text-sm" title={facility.facility_name}>
                            <span className="block truncate">{facility.facility_name}</span>
                          </td>
                          <td className="w-28 p-3 text-sm text-muted-foreground">{facility.city}</td>
                          <td className="w-24 p-3 text-sm">{facility.is_active ? 'Active' : 'Inactive'}</td>
                          <td className="w-44 p-3 text-sm text-muted-foreground">
                            <span className="block truncate">{new Date(facility.created_at).toLocaleString()}</span>
                          </td>
                          <td className="w-44 p-3 text-sm text-muted-foreground">
                            <span className="block truncate">{new Date(facility.updated_at).toLocaleString()}</span>
                          </td>
                          <td className="w-20 p-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                              <TooltipIconButton
                                onClick={(event) => {
                                  event.stopPropagation()
                                  navigate(`/admin/clients/${companyId}/facilities/${facility.id}`, {
                                    state: {
                                      from: `${location.pathname}${location.search}`,
                                      companyCode: data.company.company_code,
                                      facilityCode: facility.facility_code,
                                      companyName: data.company.company_name,
                                      facilityName: facility.facility_name,
                                    },
                                  })
                                }}
                                className="h-8 w-8"
                                tooltip="Open site details"
                                aria-label="Open site details"
                              >
                                <Eye className="h-4 w-4" />
                              </TooltipIconButton>
                              <TooltipIconButton
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void onToggleFacility(facility)
                                }}
                                className="h-8 w-8"
                                tooltip={facility.is_active ? 'Deactivate site' : 'Activate site'}
                                aria-label={facility.is_active ? 'Deactivate site' : 'Activate site'}
                              >
                                {facility.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </TooltipIconButton>
                              <TooltipIconButton
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openDeleteFacilityConfirm(facility)
                                }}
                                className="h-8 w-8 hover:text-destructive"
                                tooltip="Delete site"
                                aria-label="Delete site"
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
            <p className="text-sm text-muted-foreground">Account not found.</p>
          )}
        </CardContent>
      </Card>

      {isEditCompanySidebarOpen && data ? (
        <div className="fixed inset-0 z-[65] flex justify-end bg-black/35" onClick={() => setIsEditCompanySidebarOpen(false)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border/70 bg-background p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Edit Account</h2>
                <p className="text-sm text-muted-foreground">Update account details.</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setIsEditCompanySidebarOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleCompanySubmit(onUpdateCompany)}>
              <div className="space-y-2">
                <Label htmlFor="edit-companyName">Name</Label>
                <Input id="edit-companyName" {...registerCompany('companyName')} />
                {companyErrors.companyName ? <p className="text-xs text-destructive">{companyErrors.companyName.message}</p> : null}
              </div>
              <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Account Logo</p>
                <div className="flex flex-wrap items-center gap-3">
                  {data.company.logo_url ? (
                    <img src={data.company.logo_url} alt={data.company.company_name} className="h-12 w-12 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold">
                      {data.company.company_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      void onUploadCompanyLogo(file)
                      event.currentTarget.value = ''
                    }}
                  />
                  <Button type="button" variant="outline" className="h-9 px-3" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Logo
                  </Button>
                  {data.company.logo_url ? (
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={() => void onRemoveCompanyLogo()}>
                      Remove Logo
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsEditCompanySidebarOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="h-9 px-3" disabled={!isCompanyDirty || updateCompanyMutation.isPending}>
                  {updateCompanyMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {isAddClientUsersOpen ? (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/45 p-4" onClick={() => setIsAddClientUsersOpen(false)}>
          <Card className="max-h-[90vh] w-full max-w-4xl overflow-visible" onClick={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Add Clients</CardTitle>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => setIsAddClientUsersOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={clientUserSearch}
                    onChange={(event) => setClientUserSearch(event.target.value)}
                    placeholder="Search by id, name, email"
                    className="h-9 pl-9"
                  />
                </div>
                <SearchableSelect
                  value={clientUserCompanyFilter}
                  onChange={(value) => {
                    setClientUserCompanyFilter(value)
                    setClientUserFacilityFilter('ALL')
                  }}
                  options={[{ value: 'ALL', label: 'All accounts' }, ...companies.map((company) => ({ value: company.id, label: company.label }))]}
                  placeholder="All accounts"
                />
                <SearchableSelect
                  value={clientUserFacilityFilter}
                  onChange={(value) => setClientUserFacilityFilter(value)}
                  options={clientUserFacilityOptions}
                  placeholder="All sites"
                />
              </div>

              <div className="overflow-x-auto rounded-md border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="w-10 p-3 text-left" />
                      <th className="w-32 p-3 text-left">User ID</th>
                      <th className="w-[24%] p-3 text-left">Name</th>
                      <th className="w-24 p-3 text-left">Status</th>
                      <th className="p-3 text-left">Email</th>
                      <th className="p-3 text-left">Account</th>
                      <th className="p-3 text-left">Site</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedClientUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`cursor-pointer border-b hover:bg-muted/20 ${selectedClientCandidateIds.includes(user.id) ? 'bg-muted/25' : ''}`}
                        onClick={() => {
                          setSelectedClientCandidateIds((prev) => (
                            prev.includes(user.id)
                              ? prev.filter((id) => id !== user.id)
                              : [...prev, user.id]
                          ))
                        }}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedClientCandidateIds.includes(user.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => {
                              setSelectedClientCandidateIds((prev) => (
                                prev.includes(user.id)
                                  ? prev.filter((id) => id !== user.id)
                                  : [...prev, user.id]
                              ))
                            }}
                            className="table-select-checkbox"
                          />
                        </td>
                        <td className="p-3 text-muted-foreground">{user.user_id}</td>
                        <td className="p-3">{user.full_name || user.email || user.user_id}</td>
                        <td className="p-3 text-muted-foreground">{user.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-3 text-muted-foreground">{user.email}</td>
                        <td className="p-3 text-muted-foreground">{companies.find((company) => company.id === user.company_id)?.label ?? '-'}</td>
                        <td className="p-3 text-muted-foreground">{facilities.find((site) => site.id === user.facility_id)?.label ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Showing {pagedClientUsers.length} of {candidateClientUsers.length}</p>
                <div className="flex items-center gap-2">
                  <PageSizeSelect value={clientUserPageSize} onChange={setClientUserPageSize} />
                  <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setClientUserPage((prev) => Math.max(1, prev - 1))} disabled={clientUserPage <= 1}>
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">{clientUserPage} / {totalClientUserPages}</span>
                  <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setClientUserPage((prev) => Math.min(totalClientUserPages, prev + 1))} disabled={clientUserPage >= totalClientUserPages}>
                    Next
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsAddClientUsersOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 px-3"
                  onClick={() => void onGrantClientAccess()}
                  disabled={selectedClientCandidateIds.length === 0 || grantCompanyClientAccessMutation.isPending}
                >
                  {grantCompanyClientAccessMutation.isPending ? 'Adding...' : 'Add Clients'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isFacilityModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => setIsFacilityModalOpen(false)}>
          <Card className="w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{editingFacility ? 'Edit Site' : 'New Site'}</CardTitle>
                <CardDescription>{data?.company.company_name}</CardDescription>
              </div>
              <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsFacilityModalOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-3" onSubmit={handleFacilitySubmit(onSaveFacility)}>
                <div className="space-y-2 md:col-span-3">
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
              <CardDescription>Type {deleteTargetFacility.facility_code} to permanently delete this site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={deleteFacilityConfirmInput}
                onChange={(event) => setDeleteFacilityConfirmInput(event.target.value)}
                placeholder="Enter Site ID"
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
              <CardDescription>Type {data.company.company_code} to permanently delete this account and all child sites.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={deleteCompanyConfirmInput}
                onChange={(event) => setDeleteCompanyConfirmInput(event.target.value)}
                placeholder="Enter Account ID"
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
