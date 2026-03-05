import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowDownUp, ArrowUp, Eye, Filter, Power, Search, Trash2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { RoleCode } from '@/hooks/useAdminAccess'
import { useCompanyOptions, useFacilityOptions } from '@/hooks/useAdminAccess'
import { useAuth } from '@/hooks/useAuth'
import {
  type AdminUserRow,
  useAdminUsers,
  useCreateAdminUser,
  useHardDeleteUser,
  useToggleUserActive,
  useUpdateAdminUser,
} from '@/hooks/useAdminUsers'
import { compactDialLabel, countryPhoneOptions, detectPreferredDialCode, normalizeDialCodeValue, parseCountryOptionLabel } from '@/lib/countryPhoneOptions'
import { toHumanErrorMessage } from '@/lib/errors'

const dialCodesSorted = [...new Set(countryPhoneOptions.map((option) => normalizeDialCodeValue(option.value)))].sort(
  (a, b) => b.length - a.length,
)

const roleOptions: { value: RoleCode; label: string }[] = [
  { value: 'L1', label: 'L1 Technician' },
  { value: 'L2', label: 'L2 Supervisor' },
  { value: 'L3', label: 'L3 Manager' },
  { value: 'L4', label: 'L4 Management' },
  { value: 'L5', label: 'L5 Admin' },
  { value: 'CLIENT', label: 'Client User' },
]

const roleFilterOptions: { value: 'ALL' | RoleCode; label: string }[] = [
  { value: 'ALL', label: 'All roles' },
  ...roleOptions,
]

const statusFilterOptions: { value: 'ALL' | 'ACTIVE' | 'INACTIVE'; label: string }[] = [
  { value: 'ALL', label: 'All status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const createSchema = z.object({
  roleCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'CLIENT']),
  fullName: z.string().min(2, 'Full name is required.'),
  email: z.email('Enter a valid email.'),
  countryCode: z.string().min(1, 'Country code is required.'),
  phoneLocal: z.string().min(6, 'Enter a valid local number.'),
  roleTitle: z.string().optional(),
  companyId: z.string().optional(),
  facilityId: z.string().optional(),
})

const detailSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  email: z.email('Enter a valid email.'),
  countryCode: z.string().min(1, 'Country code is required.'),
  phoneLocal: z.string().min(6, 'Enter a valid local number.'),
  roleCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'CLIENT']),
  roleTitle: z.string().min(2, 'Role title is required.'),
  companyId: z.string().optional(),
  facilityId: z.string().optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type DetailFormValues = z.infer<typeof detailSchema>

const roleTitleByCode: Record<RoleCode, string> = {
  L1: 'Technician',
  L2: 'Supervisor',
  L3: 'Manager',
  L4: 'Management',
  L5: 'L5 Admin',
  CLIENT: 'Client User',
}

function isGlobalRole(roleCode: RoleCode) {
  return roleCode === 'L4' || roleCode === 'L5'
}

function normalizePhone(countryCode: string, local: string) {
  const sanitizedLocal = local.replace(/[^\d]/g, '')
  const sanitizedCode = normalizeDialCodeValue(countryCode).replace(/[^\d+]/g, '')
  return `${sanitizedCode}${sanitizedLocal}`
}

function splitPhone(phone: string | null): { countryCode: string; phoneLocal: string } {
  if (!phone) {
    return { countryCode: '+1', phoneLocal: '' }
  }

  const normalized = phone.replace(/\s|-/g, '')
  const matched = dialCodesSorted.find((code) => normalized.startsWith(code))

  if (!matched) {
    return { countryCode: '+1', phoneLocal: normalized.replace(/[^\d]/g, '') }
  }

  const matchedOption = countryPhoneOptions.find((option) => normalizeDialCodeValue(option.value) === matched)

  return {
    countryCode: matchedOption?.value ?? matched,
    phoneLocal: normalized.slice(matched.length).replace(/[^\d]/g, ''),
  }
}

function RequiredMark() {
  return <span className="ml-1 text-destructive">*</span>
}

type SortKey = 'user_id' | 'full_name' | 'role_code' | 'is_active' | 'created_at'
type SortDirection = 'asc' | 'desc'

function roleBadgeClass(roleCode: RoleCode | null) {
  const map: Record<RoleCode, string> = {
    L1: 'bg-zinc-500/12 text-zinc-700 border-zinc-400/40 dark:text-zinc-200',
    L2: 'bg-slate-500/12 text-slate-700 border-slate-400/40 dark:text-slate-200',
    L3: 'bg-stone-500/12 text-stone-700 border-stone-400/40 dark:text-stone-200',
    L4: 'bg-neutral-500/12 text-neutral-700 border-neutral-400/40 dark:text-neutral-100',
    L5: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40 dark:text-emerald-300',
    CLIENT: 'bg-blue-500/12 text-blue-700 border-blue-400/40 dark:text-blue-300',
  }

  if (!roleCode) {
    return 'bg-muted text-muted-foreground border-border/50'
  }

  return map[roleCode]
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const { data: users = [], isLoading } = useAdminUsers()
  const { data: companies = [] } = useCompanyOptions()
  const { data: facilities = [] } = useFacilityOptions()

  const createUserMutation = useCreateAdminUser()
  const updateUserMutation = useUpdateAdminUser()
  const toggleUserMutation = useToggleUserActive()
  const hardDeleteUserMutation = useHardDeleteUser()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleCode>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [detailSnapshot, setDetailSnapshot] = useState<DetailFormValues | null>(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)
  const [pendingDiscardAction, setPendingDiscardAction] = useState<'close' | 'cancel-edit' | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    setValue: setCreateValue,
    watch: watchCreate,
    trigger: triggerCreate,
    formState: { errors: createErrors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      roleCode: 'L1',
      fullName: '',
      email: '',
      countryCode: detectPreferredDialCode(),
      phoneLocal: '',
      roleTitle: roleTitleByCode.L1,
      companyId: '',
      facilityId: '',
    },
  })

  const {
    register: registerDetail,
    handleSubmit: handleDetailSubmit,
    reset: resetDetail,
    setValue: setDetailValue,
    watch: watchDetail,
    formState: { errors: detailErrors, isDirty: detailIsDirty },
  } = useForm<DetailFormValues>({
    resolver: zodResolver(detailSchema),
    defaultValues: {
      fullName: '',
      email: '',
      countryCode: detectPreferredDialCode(),
      phoneLocal: '',
      roleCode: 'L1',
      roleTitle: roleTitleByCode.L1,
      companyId: '',
      facilityId: '',
    },
  })

  const createRoleCode = watchCreate('roleCode')
  const createCompanyId = watchCreate('companyId')
  const createCountryCode = watchCreate('countryCode')
  const detailRoleCode = watchDetail('roleCode')
  const detailCompanyId = watchDetail('companyId')
  const detailCountryCode = watchDetail('countryCode')
  const detailFacilityId = watchDetail('facilityId')

  const createRoleIsGlobal = isGlobalRole(createRoleCode)
  const detailRoleIsGlobal = isGlobalRole(detailRoleCode)

  const isSelfSelected = Boolean(selectedUser && currentUser?.id === selectedUser.id)

  const renderCountryOption = (optionLabel: string) => {
    const parsed = parseCountryOptionLabel(optionLabel)

    return (
      <span className="flex items-center gap-2">
        <span>{parsed.flag}</span>
        <span className="truncate">{parsed.countryName}</span>
        <span className="text-muted-foreground">{parsed.code}</span>
      </span>
    )
  }

  const fieldChanged = (field: keyof DetailFormValues): boolean => {
    if (!detailSnapshot) return false
    const currentValue = `${watchDetail(field) ?? ''}`
    const oldValue = `${detailSnapshot[field] ?? ''}`
    return currentValue !== oldValue
  }

  const oldValueHint = (field: keyof DetailFormValues) => {
    if (!isEditingDetails || !fieldChanged(field) || !detailSnapshot) return null
    const oldValue = `${detailSnapshot[field] ?? ''}` || 'Not assigned'
    return <p className="text-xs text-muted-foreground">Previous: {oldValue}</p>
  }

  const createFacilityOptions = useMemo(() => {
    if (!createCompanyId) return facilities
    return facilities.filter((facility) => facility.companyId === createCompanyId)
  }, [createCompanyId, facilities])

  const detailFacilityOptions = useMemo(() => {
    if (!detailCompanyId) return facilities
    return facilities.filter((facility) => facility.companyId === detailCompanyId)
  }, [detailCompanyId, facilities])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return users.filter((row) => {
      if (roleFilter !== 'ALL' && row.role_code !== roleFilter) return false
      if (statusFilter === 'ACTIVE' && !row.is_active) return false
      if (statusFilter === 'INACTIVE' && row.is_active) return false
      if (!query) return true

      return [row.user_id, row.full_name, row.email, row.phone ?? '', row.role_title ?? '', row.role_code ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [roleFilter, search, statusFilter, users])

  const sortedUsers = useMemo(() => {
    const rows = [...filteredUsers]

    rows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      if (sortKey === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction
      }

      if (sortKey === 'is_active') {
        const av = a.is_active ? 1 : 0
        const bv = b.is_active ? 1 : 0
        return (av - bv) * direction
      }

      const av = `${a[sortKey] ?? ''}`.toLowerCase()
      const bv = `${b[sortKey] ?? ''}`.toLowerCase()
      return av.localeCompare(bv) * direction
    })

    return rows
  }, [filteredUsers, sortDirection, sortKey])

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const detailReadOnlyClass = !isEditingDetails ? 'cursor-not-allowed opacity-70' : ''

  const companyOptions = useMemo(
    () => [{ value: '', label: 'Not assigned' }, ...companies.map((company) => ({ value: company.id, label: company.label }))],
    [companies],
  )

  const createFacilitySelectOptions = useMemo(
    () => [{ value: '', label: 'Not assigned' }, ...createFacilityOptions.map((facility) => ({ value: facility.id, label: facility.label }))],
    [createFacilityOptions],
  )

  const detailFacilitySelectOptions = useMemo(
    () => [{ value: '', label: 'Not assigned' }, ...detailFacilityOptions.map((facility) => ({ value: facility.id, label: facility.label }))],
    [detailFacilityOptions],
  )

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setCreateStep(1)
    resetCreate({
      roleCode: 'L1',
      fullName: '',
      email: '',
      countryCode: detectPreferredDialCode(),
      phoneLocal: '',
      roleTitle: roleTitleByCode.L1,
      companyId: '',
      facilityId: '',
    })
  }

  const openCreateModal = () => {
    closeCreateModal()
    setIsCreateOpen(true)
  }

  const onNextCreateStep = async () => {
    const valid = await triggerCreate(['roleCode', 'fullName', 'email', 'countryCode', 'phoneLocal'])
    if (!valid) return

    const email = watchCreate('email').trim().toLowerCase()
    const phone = normalizePhone(watchCreate('countryCode'), watchCreate('phoneLocal'))

    const duplicateEmail = users.find((row) => row.email.trim().toLowerCase() === email)
    if (duplicateEmail) {
      toast.error(`Email already exists for user ${duplicateEmail.user_id}.`)
      return
    }

    const duplicatePhone = users.find((row) => (row.phone ?? '').replace(/\s|-/g, '') === phone)
    if (duplicatePhone) {
      toast.error(`Phone already exists for user ${duplicatePhone.user_id}.`)
      return
    }

    const roleCode = watchCreate('roleCode')
    setCreateValue('roleTitle', roleTitleByCode[roleCode])
    setCreateStep(2)
  }

  const onCreateUser = async (values: CreateFormValues) => {
    if (createStep !== 2) {
      return
    }

    try {
      const phone = normalizePhone(values.countryCode, values.phoneLocal)
      await createUserMutation.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone,
        roleCode: values.roleCode,
        roleTitle: values.roleTitle,
        companyId: createRoleIsGlobal ? undefined : values.companyId || undefined,
        facilityId: createRoleIsGlobal ? undefined : values.facilityId || undefined,
      })
      toast.success('User created successfully. Initial password is set to phone number.')
      closeCreateModal()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Create user failed.'))
    }
  }

  const openUserDetails = (row: AdminUserRow) => {
    const split = splitPhone(row.phone)
    setSelectedUser(row)
    const nextValues: DetailFormValues = {
      fullName: row.full_name,
      email: row.email,
      countryCode: split.countryCode,
      phoneLocal: split.phoneLocal,
      roleCode: row.role_code ?? 'L1',
      roleTitle: row.role_title ?? roleTitleByCode[row.role_code ?? 'L1'],
      companyId: row.company_id ?? '',
      facilityId: row.facility_id ?? '',
    }

    resetDetail(nextValues)
    setDetailSnapshot(nextValues)
    setIsEditingDetails(false)
  }

  const onSaveUserDetails = async (values: DetailFormValues) => {
    if (!selectedUser) return
    try {
      const phone = normalizePhone(values.countryCode, values.phoneLocal)
      await updateUserMutation.mutateAsync({
        userId: selectedUser.id,
        email: values.email,
        fullName: values.fullName,
        phone,
        roleCode: values.roleCode,
        roleTitle: values.roleTitle,
        companyId: detailRoleIsGlobal ? undefined : values.companyId || undefined,
        facilityId: detailRoleIsGlobal ? undefined : values.facilityId || undefined,
      })
      toast.success('User updated.')
      const nextSnapshot: DetailFormValues = {
        ...values,
        companyId: values.companyId ?? '',
        facilityId: values.facilityId ?? '',
      }
      setDetailSnapshot(nextSnapshot)
      resetDetail(nextSnapshot)
      setIsEditingDetails(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update user.'))
    }
  }

  const runDiscardAction = () => {
    if (pendingDiscardAction === 'close') {
      setSelectedUser(null)
      setIsEditingDetails(false)
    }

    if (pendingDiscardAction === 'cancel-edit') {
      if (detailSnapshot) {
        resetDetail(detailSnapshot)
      }
      setIsEditingDetails(false)
    }

    setPendingDiscardAction(null)
    setIsDiscardConfirmOpen(false)
  }

  const requestDiscardConfirmation = (action: 'close' | 'cancel-edit') => {
    setPendingDiscardAction(action)
    setIsDiscardConfirmOpen(true)
  }

  const onAttemptCloseDetails = () => {
    if (isEditingDetails && detailIsDirty) {
      requestDiscardConfirmation('close')
      return
    }

    setSelectedUser(null)
    setIsEditingDetails(false)
  }

  const onToggleUser = async () => {
    if (!selectedUser) return
    try {
      await toggleUserMutation.mutateAsync({ userId: selectedUser.id, isActive: !selectedUser.is_active })
      setSelectedUser((prev) => (prev ? { ...prev, is_active: !prev.is_active } : prev))
      toast.success(!selectedUser.is_active ? 'User activated.' : 'User deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update user status.'))
    }
  }

  const onToggleUserInline = async (row: AdminUserRow) => {
    if (currentUser?.id === row.id) return
    try {
      await toggleUserMutation.mutateAsync({ userId: row.id, isActive: !row.is_active })
      toast.success(!row.is_active ? 'User activated.' : 'User deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update user status.'))
    }
  }

  const onHardDelete = async () => {
    if (!deleteTargetUser) return

    if (deleteConfirmInput.trim() !== deleteTargetUser.user_id) {
      toast.error('Type the exact User ID to confirm deletion.')
      return
    }

    try {
      await hardDeleteUserMutation.mutateAsync({ userId: deleteTargetUser.id })
      toast.success('User permanently deleted.')
      setIsDeleteConfirmOpen(false)
      setDeleteConfirmInput('')
      if (selectedUser?.id === deleteTargetUser.id) {
        setSelectedUser(null)
      }
      setDeleteTargetUser(null)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to permanently delete user.'))
    }
  }

  const openDeleteConfirm = (row: AdminUserRow) => {
    setDeleteTargetUser(row)
    setDeleteConfirmInput('')
    setIsDeleteConfirmOpen(true)
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
    }

    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-foreground" />
      : <ArrowDown className="h-3.5 w-3.5 text-foreground" />
  }

  useEffect(() => {
    if (!selectedUser) return
    const refreshed = users.find((row) => row.id === selectedUser.id)
    if (refreshed) setSelectedUser(refreshed)
  }, [selectedUser, users])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl tracking-tight">Users</CardTitle>
              <CardDescription>Create, filter, sort.</CardDescription>
            </div>
            <Button className="h-9 px-3" onClick={openCreateModal}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by id, name, email, phone" className="pl-9" />
            </div>
            <Button variant="outline" className="h-9 px-3" onClick={() => setIsFilterOpen((p) => !p)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {isFilterOpen ? (
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="roleFilter">Role</Label>
                <SearchableSelect
                  value={roleFilter}
                  onChange={(value) => setRoleFilter(value as 'ALL' | RoleCode)}
                  options={roleFilterOptions}
                  placeholder="All roles"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="statusFilter">Status</Label>
                <SearchableSelect
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                  options={statusFilterOptions}
                  placeholder="All status"
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="h-9 px-3" onClick={() => { setSearch(''); setRoleFilter('ALL'); setStatusFilter('ALL') }}>Reset</Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onSort('user_id')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'user_id' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        User ID
                        {sortIcon('user_id')}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onSort('full_name')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'full_name' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Name
                        {sortIcon('full_name')}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onSort('role_code')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'role_code' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Type
                        {sortIcon('role_code')}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onSort('is_active')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'is_active' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Status
                        {sortIcon('is_active')}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button type="button" onClick={() => onSort('created_at')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'created_at' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Created
                        {sortIcon('created_at')}
                      </button>
                    </th>
                    <th className="w-[120px] p-3 text-left" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((row) => (
                    <tr key={row.id} onDoubleClick={() => openUserDetails(row)} className="group border-b transition-colors hover:bg-muted/20">
                      <td className="p-3 text-sm">{row.user_id}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2">
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt={row.full_name || row.user_id} className="h-6 w-6 rounded-full border border-border object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">
                              {(row.full_name || row.user_id).slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span>{row.full_name || 'Unnamed user'}</span>
                          {currentUser?.id === row.id ? (
                            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">You</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeClass(row.role_code)}`}>
                          {row.role_code ?? '-'}
                        </span>
                      </td>
                      <td className="p-3">{row.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="p-3 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => openUserDetails(row)}
                            aria-label="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {currentUser?.id !== row.id ? (
                            <>
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => void onToggleUserInline(row)}
                                aria-label={row.is_active ? 'Deactivate user' : 'Activate user'}
                              >
                                <Power className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openDeleteConfirm(row)}
                                aria-label="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={closeCreateModal}>
          <Card className="max-h-[90vh] w-full max-w-4xl overflow-visible" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="relative pr-20">
              <div>
                <CardTitle>Create User</CardTitle>
                <CardDescription>Step {createStep} of 2. Password is derived from phone.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={closeCreateModal}
                aria-label="Close"
                className="absolute right-6 top-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[calc(90vh-9rem)] overflow-y-auto">
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                }}
              >
                {createStep === 1 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-roleCode">User Type<RequiredMark /></Label>
                      <SearchableSelect
                        value={createRoleCode}
                        onChange={(value) => {
                          const next = value as RoleCode
                          setCreateValue('roleCode', next, { shouldValidate: true })
                          setCreateValue('roleTitle', roleTitleByCode[next])
                        }}
                        options={roleOptions}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-fullName">Full Name<RequiredMark /></Label>
                      <Input id="create-fullName" {...registerCreate('fullName')} />
                      {createErrors.fullName ? <p className="text-xs text-destructive">{createErrors.fullName.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-email">Email<RequiredMark /></Label>
                      <Input id="create-email" type="email" {...registerCreate('email')} />
                      {createErrors.email ? <p className="text-xs text-destructive">{createErrors.email.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Phone<RequiredMark /></Label>
                      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
                        <SearchableSelect
                          value={createCountryCode}
                          onChange={(value) => setCreateValue('countryCode', value, { shouldValidate: true })}
                          options={countryPhoneOptions}
                          placeholder="Code"
                          searchPlaceholder="Search country or code"
                          minDropdownWidth={380}
                          renderSelectedLabel={(option) => compactDialLabel(option?.label ?? '')}
                          renderOption={(option) => renderCountryOption(option.label)}
                        />
                        <Input placeholder="Local number" {...registerCreate('phoneLocal')} />
                      </div>
                      <p className="text-xs text-muted-foreground">Spaces and dashes are cleaned automatically.</p>
                      {createErrors.phoneLocal ? <p className="text-xs text-destructive">{createErrors.phoneLocal.message}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-roleTitle">Role Title</Label>
                      <Input id="create-roleTitle" placeholder={roleTitleByCode[createRoleCode]} {...registerCreate('roleTitle')} />
                    </div>
                    {!createRoleIsGlobal ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="create-companyId">Company</Label>
                          <SearchableSelect
                            value={createCompanyId ?? ''}
                            onChange={(value) => setCreateValue('companyId', value, { shouldDirty: true })}
                            options={companyOptions}
                            placeholder="Not assigned"
                            searchPlaceholder="Search company"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="create-facilityId">Facility</Label>
                          <SearchableSelect
                            value={watchCreate('facilityId') ?? ''}
                            onChange={(value) => setCreateValue('facilityId', value, { shouldDirty: true })}
                            options={createFacilitySelectOptions}
                            placeholder="Not assigned"
                            searchPlaceholder="Search facility"
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground md:col-span-2">L4/L5 are global users; scope fields are hidden.</p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {createStep === 2 ? <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCreateStep(1)}>Back</Button> : <span className="text-xs text-muted-foreground">* required fields</span>}
                  {createStep === 1 ? (
                    <Button type="button" className="h-9 px-3" onClick={() => void onNextCreateStep()}>Next</Button>
                  ) : (
                    <Button type="button" className="h-9 px-3" disabled={createUserMutation.isPending} onClick={() => void handleCreateSubmit(onCreateUser)()}>
                      {createUserMutation.isPending ? 'Creating...' : 'Save'}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {selectedUser ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={onAttemptCloseDetails}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border/70 bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">User Details</h2>
                <p className="text-sm text-muted-foreground">View metadata and update editable fields.</p>
              </div>
              <div className="flex items-center gap-2">
                {isEditingDetails ? (
                  <Button
                    variant="outline"
                    className="h-9 px-3"
                    type="button"
                    onClick={() => {
                      if (detailIsDirty) {
                        requestDiscardConfirmation('cancel-edit')
                        return
                      }
                      setIsEditingDetails(false)
                    }}
                  >
                    Cancel Edit
                  </Button>
                ) : (
                  <Button variant="outline" className="h-9 px-3" type="button" onClick={() => setIsEditingDetails(true)}>
                    Edit
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={onAttemptCloseDetails} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mb-6 grid gap-3 rounded-md border border-border/70 bg-muted/30 p-4 text-sm">
              <div><span className="text-muted-foreground">User ID:</span> <span className="font-medium">{selectedUser.user_id}</span></div>
              <div><span className="text-muted-foreground">Created At:</span> {new Date(selectedUser.created_at).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Status:</span> {selectedUser.is_active ? 'Active' : 'Inactive'}</div>
            </div>
            <form className="space-y-4" onSubmit={handleDetailSubmit(onSaveUserDetails)}>
              <div className="space-y-2">
                <Label htmlFor="detail-fullName">Full Name<RequiredMark /></Label>
                <Input id="detail-fullName" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('fullName')} />
                {oldValueHint('fullName')}
                {detailErrors.fullName ? <p className="text-xs text-destructive">{detailErrors.fullName.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-email">Email<RequiredMark /></Label>
                <Input id="detail-email" type="email" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('email')} />
                {oldValueHint('email')}
                {detailErrors.email ? <p className="text-xs text-destructive">{detailErrors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Phone<RequiredMark /></Label>
                <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
                  <SearchableSelect
                    value={detailCountryCode}
                    onChange={(value) => setDetailValue('countryCode', value, { shouldValidate: true })}
                    options={countryPhoneOptions}
                    className={detailReadOnlyClass}
                    placeholder="Code"
                    searchPlaceholder="Search country or code"
                    minDropdownWidth={380}
                    renderSelectedLabel={(option) => compactDialLabel(option?.label ?? '')}
                    renderOption={(option) => renderCountryOption(option.label)}
                    disabled={!isEditingDetails}
                  />
                  <Input placeholder="Local number" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('phoneLocal')} />
                </div>
                {oldValueHint('countryCode')}
                {oldValueHint('phoneLocal')}
                {detailErrors.phoneLocal ? <p className="text-xs text-destructive">{detailErrors.phoneLocal.message}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="detail-roleCode">User Type<RequiredMark /></Label>
                  <SearchableSelect
                    value={detailRoleCode}
                    onChange={(value) => {
                      if (!isEditingDetails) return
                      const next = value as RoleCode
                      setDetailValue('roleCode', next, { shouldValidate: true })
                      setDetailValue('roleTitle', roleTitleByCode[next])
                      if (isGlobalRole(next)) {
                        setDetailValue('companyId', '')
                        setDetailValue('facilityId', '')
                      }
                    }}
                    className={detailReadOnlyClass}
                    options={roleOptions}
                    disabled={!isEditingDetails}
                  />
                  {oldValueHint('roleCode')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detail-roleTitle">Role Title<RequiredMark /></Label>
                  <Input id="detail-roleTitle" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('roleTitle')} />
                  {oldValueHint('roleTitle')}
                  {detailErrors.roleTitle ? <p className="text-xs text-destructive">{detailErrors.roleTitle.message}</p> : null}
                </div>
              </div>
              {!detailRoleIsGlobal ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="detail-companyId">Company</Label>
                    <SearchableSelect
                      value={detailCompanyId ?? ''}
                      onChange={(value) => {
                        if (!isEditingDetails) return
                        setDetailValue('companyId', value, { shouldDirty: true })
                      }}
                      options={companyOptions}
                      className={detailReadOnlyClass}
                      placeholder="Not assigned"
                      searchPlaceholder="Search company"
                      disabled={!isEditingDetails}
                    />
                    {oldValueHint('companyId')}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detail-facilityId">Facility</Label>
                    <SearchableSelect
                      value={detailFacilityId ?? ''}
                      onChange={(value) => {
                        if (!isEditingDetails) return
                        setDetailValue('facilityId', value, { shouldDirty: true })
                      }}
                      options={detailFacilitySelectOptions}
                      className={detailReadOnlyClass}
                      placeholder="Not assigned"
                      searchPlaceholder="Search facility"
                      disabled={!isEditingDetails}
                    />
                    {oldValueHint('facilityId')}
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" className="h-9 px-3" disabled={!isEditingDetails || !detailIsDirty || updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
            {!isSelfSelected ? (
              <div className="mt-8 space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="text-sm font-semibold">User Lifecycle Actions</h3>
                <p className="text-xs text-muted-foreground">Deactivate for leavers. Permanent delete for mistaken users only.</p>
                <div className="flex flex-wrap gap-3">
                  <Button className="h-9 px-3" variant={selectedUser.is_active ? 'destructive' : 'secondary'} onClick={() => void onToggleUser()} disabled={toggleUserMutation.isPending}>
                    {selectedUser.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => {
                      setDeleteConfirmInput('')
                      setIsDeleteConfirmOpen(true)
                    }}
                    disabled={hardDeleteUserMutation.isPending}
                  >
                    Delete Permanently
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                <span className="mr-2 inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium">You</span>
                Self actions are hidden.
              </div>
            )}

            {isDiscardConfirmOpen ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDiscardConfirmOpen(false)}>
                <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-base">Discard Unsaved Changes?</CardTitle>
                    <CardDescription>You have unsaved edits. If you exit now, those changes will be lost.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-end gap-2">
                    <Button variant="outline" className="h-9 px-3" onClick={() => setIsDiscardConfirmOpen(false)}>
                      Keep
                    </Button>
                    <Button variant="destructive" className="h-9 px-3" onClick={runDiscardAction}>
                      Discard
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : null}

          </aside>
        </div>
      ) : null}

      {isDeleteConfirmOpen && deleteTargetUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
                <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-base">Confirm Permanent Delete</CardTitle>
                    <CardDescription>
                      Type <span className="font-medium">{deleteTargetUser.user_id}</span> to permanently delete this user.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input value={deleteConfirmInput} onChange={(event) => setDeleteConfirmInput(event.target.value)} placeholder="Enter User ID" />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteConfirmOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-9 px-3"
                        onClick={() => void onHardDelete()}
                        disabled={hardDeleteUserMutation.isPending || deleteConfirmInput.trim() !== deleteTargetUser.user_id}
                      >
                        {hardDeleteUserMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
        </div>
      ) : null}
    </main>
  )
}
