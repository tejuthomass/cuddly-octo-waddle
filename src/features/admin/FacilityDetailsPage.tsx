import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, X, UserMinus, Search, UserPlus, ArrowLeft, CircleHelp, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useAdminFacilityMembers,
  useAssignFacilityUsers,
  useHardDeleteFacility,
  useRemoveFacilityUser,
  useToggleFacilityActive,
  useUpdateFacility,
} from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const facilityDetailsSchema = z.object({
  facilityName: z.string().min(2, 'Facility name is required.'),
  addressLine1: z.string().min(5, 'Address is required.'),
  city: z.string().min(2, 'City is required.'),
  state: z.string().min(2, 'State is required.'),
  country: z.string().min(2, 'Country is required.'),
})

type FacilityDetailsFormValues = z.infer<typeof facilityDetailsSchema>

export default function FacilityDetailsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ companyId: string; facilityId: string }>()
  const companyId = params.companyId
  const facilityId = params.facilityId
  const fromState = (location.state as { from?: string } | null)?.from

  const { data: facilityData, isLoading, refetch } = useAdminFacilityMembers(facilityId)
  const facility = facilityData?.facility
  
  const siteCompany = useMemo(() => {
    if (!facility?.companies) return null
    const c = facility.companies as any
    return Array.isArray(c) ? c[0] : c
  }, [facility?.companies])

  const updateFacilityMutation = useUpdateFacility()
  const toggleFacilityMutation = useToggleFacilityActive()
  const deleteFacilityMutation = useHardDeleteFacility()
  const assignFacilityUsersMutation = useAssignFacilityUsers()
  const removeFacilityUserMutation = useRemoveFacilityUser()
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  
  const [isAssignUsersOpen, setIsAssignUsersOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignRoleFilter, setAssignRoleFilter] = useState<string>('ALL')
  const [assignStatusFilter, setAssignStatusFilter] = useState<string>('ALL')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [selectedAssignedUserIds, setSelectedAssignedUserIds] = useState<string[]>([])
  const [lastSelectedAssignedUserRowIndex, setLastSelectedAssignedUserRowIndex] = useState<number | null>(null)
  const [isRemoveAssignedUserConfirmOpen, setIsRemoveAssignedUserConfirmOpen] = useState(false)
  const [assignedUserToRemove, setAssignedUserToRemove] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [siteUserSearch, setSiteUserSearch] = useState('')
  const [siteUserRoleFilter, setSiteUserRoleFilter] = useState<string>('ALL')
  const [siteUserStatusFilter, setSiteUserStatusFilter] = useState<string>('ALL')
  const [siteUserPage, setSiteUserPage] = useState(1)
  const [siteUserPageSize, setSiteUserPageSize] = useState(10)
  
  const [assignPage, setAssignPage] = useState(1)
  const ASSIGN_PAGE_SIZE = 5

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FacilityDetailsFormValues>({
    resolver: zodResolver(facilityDetailsSchema),
    defaultValues: {
      facilityName: '',
      addressLine1: '',
      city: '',
      state: '',
      country: '',
    },
  })

  useEffect(() => {
    if (!facility) return

    reset({
      facilityName: facility.facility_name,
      addressLine1: facility.address_line_1,
      city: facility.city,
      state: facility.state,
      country: facility.country,
    })
    setIsEditing(false)
  }, [facility, reset])

  useEffect(() => {
    setSelectedCandidateIds([])
  }, [facilityId, facilityData?.assignedUsers.length, isAssignUsersOpen])

  useEffect(() => {
    if (!isAssignUsersOpen) {
      setAssignSearch('')
    }
  }, [isAssignUsersOpen])

  const assignableUsers = useMemo(() => {
    let users = (facilityData?.companyAssignableUsers ?? []).filter((user) => !user.assigned)
    
    if (assignRoleFilter !== 'ALL') {
      users = users.filter((u) => u.role_code === assignRoleFilter)
    }

    if (assignStatusFilter !== 'ALL') {
      const wantActive = assignStatusFilter === 'ACTIVE'
      users = users.filter((u) => u.is_active === wantActive)
    }

    if (assignSearch.trim()) {
      const q = assignSearch.toLowerCase()
      users = users.filter((u) => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) || 
        (u.employee_id && u.employee_id.toLowerCase().includes(q))
      )
    }
    return users
  }, [facilityData?.companyAssignableUsers, assignSearch, assignRoleFilter, assignStatusFilter])

  const totalAssignPages = Math.max(1, Math.ceil(assignableUsers.length / ASSIGN_PAGE_SIZE))
  const pagedAssignableUsers = assignableUsers.slice((assignPage - 1) * ASSIGN_PAGE_SIZE, assignPage * ASSIGN_PAGE_SIZE)

  useEffect(() => {
    setAssignPage(1)
  }, [assignSearch, assignRoleFilter, assignStatusFilter])

  const filteredAssignedUsers = useMemo(() => {
    let users = facilityData?.assignedUsers ?? []
    if (siteUserRoleFilter !== 'ALL') {
      users = users.filter((u) => u.role_code === siteUserRoleFilter)
    }
    if (siteUserStatusFilter !== 'ALL') {
      const wantActive = siteUserStatusFilter === 'ACTIVE'
      users = users.filter((u) => u.is_active === wantActive)
    }
    if (siteUserSearch.trim()) {
      const q = siteUserSearch.toLowerCase()
      users = users.filter((u) =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.employee_id && u.employee_id.toLowerCase().includes(q))
      )
    }
    return users
  }, [facilityData?.assignedUsers, siteUserSearch, siteUserRoleFilter, siteUserStatusFilter])

  const totalSiteUserPages = Math.max(1, Math.ceil(filteredAssignedUsers.length / siteUserPageSize))
  const pagedAssignedUsers = filteredAssignedUsers.slice((siteUserPage - 1) * siteUserPageSize, siteUserPage * siteUserPageSize)

  useEffect(() => {
    setSiteUserPage(1)
  }, [siteUserSearch, siteUserRoleFilter, siteUserStatusFilter, siteUserPageSize])

  const onAssignSelectedUsers = async () => {
    if (!facility || selectedCandidateIds.length === 0) {
      toast.error('Select at least one user to assign.')
      return
    }

    try {
      await assignFacilityUsersMutation.mutateAsync({
        facilityId: facility.id,
        userIds: selectedCandidateIds,
      })
      toast.success('Users assigned to site.')
      setSelectedCandidateIds([])
      setIsAssignUsersOpen(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to assign selected users.'))
    }
  }

  const onConfirmRemoveAssignedUser = async () => {
    if (!facility) return
    const idsToRemove = assignedUserToRemove ? [assignedUserToRemove] : selectedAssignedUserIds
    if (idsToRemove.length === 0) return

    try {
      await Promise.all(idsToRemove.map((id) => removeFacilityUserMutation.mutateAsync({ facilityId: facility.id, userId: id })))
      toast.success(idsToRemove.length === 1 ? 'User removed from site.' : `${idsToRemove.length} users removed from site.`)
      setSelectedAssignedUserIds([])
      setIsRemoveAssignedUserConfirmOpen(false)
      setAssignedUserToRemove(null)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to remove user(s) from site.'))
    }
  }

  const onSelectAssignedUserRow = (userId: string, rowIndex: number, options: { shift: boolean; multi: boolean }) => {
    if (!facilityData?.assignedUsers) return

    if (options.shift && lastSelectedAssignedUserRowIndex !== null) {
      const start = Math.min(lastSelectedAssignedUserRowIndex, rowIndex)
      const end = Math.max(lastSelectedAssignedUserRowIndex, rowIndex)
      const rangeIds = facilityData.assignedUsers.slice(start, end + 1).map((u) => u.user_id)
      setSelectedAssignedUserIds((prev) => Array.from(new Set([...prev, ...rangeIds])))
    } else {
      setSelectedAssignedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
      setLastSelectedAssignedUserRowIndex(rowIndex)
    }
  }

  const onSave = async (values: FacilityDetailsFormValues) => {
    if (!facility) return

    try {
      await updateFacilityMutation.mutateAsync({
        facilityId: facility.id,
        facilityName: values.facilityName,
        addressLine1: values.addressLine1,
        city: values.city,
        state: values.state,
        country: values.country,
      })
      toast.success('Site updated.')
      setIsEditing(false)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update site.'))
    }
  }

  const onToggle = async () => {
    if (!facility) return

    try {
      await toggleFacilityMutation.mutateAsync({ facilityId: facility.id, isActive: !facility.is_active })
      toast.success(!facility.is_active ? 'Site enabled.' : 'Site disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update site status.'))
    }
  }

  const onDelete = async () => {
    if (!facility) return

    if (deleteConfirmInput.trim() !== facility.facility_code) {
      toast.error('Type the exact Site ID to confirm deletion.')
      return
    }

    try {
      await deleteFacilityMutation.mutateAsync({ facilityId: facility.id })
      toast.success('Site permanently deleted.')
      setIsDeleteConfirmOpen(false)
      setDeleteConfirmInput('')
      if (fromState) {
        navigate(fromState, { replace: true })
      } else if (companyId) {
        navigate(`/admin/clients/${companyId}`, { replace: true })
      } else if (siteCompany?.id) {
        navigate(`/admin/clients/${siteCompany.id}`, { replace: true })
      } else {
        navigate('/admin/clients', { replace: true })
      }
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete site.'))
    }
  }

  return (
    <main className="space-y-6 lg:p-6 p-4">
      <Card>
        <CardHeader className="sticky top-0 z-20 rounded-t-xl border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight truncate">Site Details</h1>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {facility
                  ? `${facility.facility_name} (${facility.facility_code}) — ${siteCompany?.company_name ?? 'Unknown account'}`
                  : 'Loading site details...'}
              </p>
            </div>
            {facility ? (
              <Button
                type="button"
                variant="outline"
                className="inline-flex h-9 items-center gap-2 px-3"
                onClick={() => {
                  if (fromState) {
                    navigate(fromState)
                  } else if (companyId) {
                    navigate(`/admin/clients/${companyId}`)
                  } else if (siteCompany?.id) {
                    navigate(`/admin/clients/${siteCompany.id}`)
                  } else {
                    navigate('/admin/clients')
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0 space-y-8 mt-6">
          {isLoading ? (
            <div className="px-6 pb-6">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : facility ? (
            <>
              {/* Site Information */}
              <section className="px-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Site Profile</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <TooltipIconButton tooltip="Edit Details" aria-label="Edit Details" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-4 w-4" />
                      </TooltipIconButton>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 text-sm max-w-4xl">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Status</p>
                    <div>
                      {facility.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">Disabled</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">City & State</p>
                    <p className="font-medium truncate">{facility.city ? `${facility.city}, ${facility.state}` : '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Country</p>
                    <p className="font-medium truncate">{facility.country || '-'}</p>
                  </div>
                  <div className="space-y-1 lg:col-span-1">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium truncate">{facility.address_line_1 || '-'}</p>
                  </div>
                </div>
              </section>

              {/* Assigned Users Table */}
              <section className="px-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Assigned Personnel</h2>
                    <p className="text-sm text-muted-foreground mt-1">L1–L3 users assigned to this site.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAssignedUserIds.length > 0 ? (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="px-1 text-sm text-muted-foreground">{selectedAssignedUserIds.length} selected</span>
                        <Button
                          variant="destructive"
                          className="h-9 px-3"
                          onClick={() => {
                            setAssignedUserToRemove(null)
                            setIsRemoveAssignedUserConfirmOpen(true)
                          }}
                        >
                          Remove access
                        </Button>
                      </div>
                    ) : null}
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => void refetch()} title="Refresh assigned users">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" className="h-9 px-3 gap-2" onClick={() => setIsAssignUsersOpen(true)}>
                      <UserPlus className="h-4 w-4" />
                      Assign Users
                    </Button>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={siteUserSearch}
                      onChange={(e) => setSiteUserSearch(e.target.value)}
                      className="h-9 pl-9 pr-10"
                    />
                    <div className="absolute right-2 top-1">
                      <TooltipIconButton
                        className="h-7 w-7 border-transparent"
                        tooltip="Search by user ID or name."
                        aria-label="Search help"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </TooltipIconButton>
                    </div>
                  </div>
                  <SearchableSelect
                    value={siteUserRoleFilter}
                    onChange={(val) => setSiteUserRoleFilter(val)}
                    options={[
                      { value: 'ALL', label: 'All Roles' },
                      { value: 'L1', label: 'L1' },
                      { value: 'L2', label: 'L2' },
                      { value: 'L3', label: 'L3' },
                    ]}
                    placeholder="All Roles"
                    className="w-[130px]"
                  />
                  <SearchableSelect
                    value={siteUserStatusFilter}
                    onChange={(val) => setSiteUserStatusFilter(val)}
                    options={[
                      { value: 'ALL', label: 'All Status' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                    placeholder="All Status"
                    className="w-[140px]"
                  />
                </div>

                {/* Table */}
                <div className="rounded-md border border-border/70 overflow-x-auto">
                  <Table className="table-fixed text-sm">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-12 px-4 py-3" aria-label="Select rows">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50"
                            onClick={() => {
                              const allIds = pagedAssignedUsers.map((u) => u.user_id)
                              const allSelected = allIds.length > 0 && allIds.every((id) => selectedAssignedUserIds.includes(id))
                              if (allSelected) {
                                setSelectedAssignedUserIds((prev) => prev.filter((id) => !allIds.includes(id)))
                              } else {
                                setSelectedAssignedUserIds((prev) => Array.from(new Set([...prev, ...allIds])))
                              }
                            }}
                            aria-label="Toggle page selection"
                          >
                            <input
                              type="checkbox"
                              checked={pagedAssignedUsers.length > 0 && pagedAssignedUsers.every((u) => selectedAssignedUserIds.includes(u.user_id))}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                              className="table-select-checkbox"
                              readOnly
                            />
                          </button>
                        </TableHead>
                        <TableHead className="w-32 px-4 py-3">User ID</TableHead>
                        <TableHead className="w-[30%] px-4 py-3">Name</TableHead>
                        <TableHead className="w-20 px-4 py-3">Type</TableHead>
                        <TableHead className="w-24 px-4 py-3">Status</TableHead>
                        <TableHead className="w-44 px-4 py-3">Created</TableHead>
                        <TableHead className="w-20 px-4 py-3" aria-label="Actions" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAssignedUsers.length > 0 ? (
                        pagedAssignedUsers.map((user, rowIndex) => (
                          <TableRow
                            key={user.user_id}
                            data-state={selectedAssignedUserIds.includes(user.user_id) ? 'selected' : undefined}
                            className="group transition-colors"
                            onClick={(event) => {
                              if (event.shiftKey || event.ctrlKey || event.metaKey) {
                                onSelectAssignedUserRow(user.user_id, rowIndex, { shift: event.shiftKey, multi: event.ctrlKey || event.metaKey })
                              }
                            }}
                          >
                            <TableCell className="w-12 px-4 py-3 align-middle">
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onSelectAssignedUserRow(user.user_id, rowIndex, { shift: false, multi: true })
                                }}
                                aria-label={`Select user ${user.employee_id}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAssignedUserIds.includes(user.user_id)}
                                  onChange={() => onSelectAssignedUserRow(user.user_id, rowIndex, { shift: false, multi: true })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="table-select-checkbox"
                                  aria-label={`Select user ${user.employee_id}`}
                                />
                              </button>
                            </TableCell>
                            <TableCell className="w-32 px-4 py-3 text-sm font-medium">
                              <span className="block truncate">{user.employee_id}</span>
                            </TableCell>
                            <TableCell className="w-[30%] px-4 py-3 text-sm font-medium">
                              <span className="block truncate">{user.full_name}</span>
                            </TableCell>
                            <TableCell className="w-20 px-4 py-3">
                              <span className="inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                {user.role_code}
                              </span>
                            </TableCell>
                            <TableCell className="w-24 px-4 py-3">
                              {user.is_active ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">Inactive</span>
                              )}
                            </TableCell>
                            <TableCell className="w-44 px-4 py-3 text-[13px] text-muted-foreground">
                              <span className="block truncate">{new Date(user.created_at).toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="w-20 px-4 py-3">
                              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                <TooltipIconButton
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAssignedUserToRemove(user.user_id)
                                    setIsRemoveAssignedUserConfirmOpen(true)
                                  }}
                                  disabled={removeFacilityUserMutation.isPending}
                                  className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                                  tooltip="Remove access"
                                  aria-label="Remove access"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </TooltipIconButton>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-1">
                  <p className="text-xs text-muted-foreground">Showing {pagedAssignedUsers.length} of {filteredAssignedUsers.length}</p>
                  <div className="flex items-center gap-2">
                    <PageSizeSelect value={siteUserPageSize} onChange={setSiteUserPageSize} />
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setSiteUserPage((prev) => Math.max(1, prev - 1))} disabled={siteUserPage <= 1}>
                      Prev
                    </Button>
                    <span className="text-sm text-muted-foreground">{siteUserPage} / {totalSiteUserPages}</span>
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setSiteUserPage((prev) => Math.min(totalSiteUserPages, prev + 1))} disabled={siteUserPage >= totalSiteUserPages}>
                      Next
                    </Button>
                  </div>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="px-6 pb-6 mt-6">
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-5">
                  <h2 className="text-lg font-semibold tracking-tight text-destructive">Danger Zone</h2>
                  <p className="text-sm text-destructive/80 mt-1 mb-4">
                    Irreversible actions for this site.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-9 px-4 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive" 
                      onClick={onToggle} 
                      disabled={toggleFacilityMutation.isPending}
                    >
                      {facility.is_active ? 'Deactivate Site' : 'Activate Site'}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-9 px-4"
                      onClick={() => {
                        setDeleteConfirmInput('')
                        setIsDeleteConfirmOpen(true)
                      }}
                    >
                      Delete Permanently
                    </Button>
                  </div>
                </div>
              </section>

            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Site data could not be loaded.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {isDeleteConfirmOpen && facility ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
          <Card className="w-full max-w-md border-destructive/20" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-destructive">Confirm Permanent Delete</CardTitle>
              <CardDescription>
                Type <strong>{facility.facility_code}</strong> to permanently delete this site. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <Input
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                placeholder="Enter Facility ID"
                className="focus-visible:ring-destructive"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 px-3"
                  onClick={() => void onDelete()}
                  disabled={deleteFacilityMutation.isPending || deleteConfirmInput.trim() !== facility.facility_code}
                >
                  {deleteFacilityMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isRemoveAssignedUserConfirmOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsRemoveAssignedUserConfirmOpen(false)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Remove Site Access</CardTitle>
              <CardDescription>
                Are you sure you want to remove access for {assignedUserToRemove ? 'this user' : `${selectedAssignedUserIds.length} selected users`} from this site?
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsRemoveAssignedUserConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 px-3 focus:bg-destructive focus:text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground"
                variant="destructive"
                onClick={() => void onConfirmRemoveAssignedUser()}
                disabled={removeFacilityUserMutation.isPending}
              >
                {removeFacilityUserMutation.isPending ? 'Removing...' : 'Remove'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isAssignUsersOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsAssignUsersOpen(false)}>
          <Card className="max-h-[90vh] w-full max-w-4xl overflow-visible" onClick={(event) => event.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Assign L1-L3 Users</CardTitle>
                <CardDescription>Grant site access to internal operations team members.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => void refetch()} title="Refresh users list">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => setIsAssignUsersOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={assignSearch}
                    onChange={(event) => setAssignSearch(event.target.value)}
                    placeholder="Search users..."
                    className="h-9 pl-9 w-full"
                  />
                </div>
                <SearchableSelect
                  value={assignRoleFilter}
                  onChange={setAssignRoleFilter}
                  options={[
                    { label: 'All Roles', value: 'ALL' },
                    { label: 'L1', value: 'L1' },
                    { label: 'L2', value: 'L2' },
                    { label: 'L3', value: 'L3' },
                  ]}
                  placeholder="Role"
                  className="w-[120px]"
                />
                <SearchableSelect
                  value={assignStatusFilter}
                  onChange={setAssignStatusFilter}
                  options={[
                    { label: 'All Status', value: 'ALL' },
                    { label: 'Active', value: 'ACTIVE' },
                    { label: 'Inactive', value: 'INACTIVE' },
                  ]}
                  placeholder="Status"
                  className="w-[130px]"
                />
              </div>

              <div className="overflow-x-auto rounded-md border border-border/70">
                <Table className="w-full min-w-[650px] text-sm table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-12 px-4 py-3 align-middle" aria-label="Select rows">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/60"
                          onClick={() => {
                            const allSelected = assignableUsers.length > 0 && selectedCandidateIds.length === assignableUsers.length
                            if (allSelected) {
                              setSelectedCandidateIds([])
                            } else {
                              setSelectedCandidateIds(assignableUsers.map((u) => u.user_id))
                            }
                          }}
                          aria-label="Select all"
                        >
                          <input
                            type="checkbox"
                            className="table-select-checkbox pointer-events-none"
                            checked={assignableUsers.length > 0 && selectedCandidateIds.length === assignableUsers.length}
                            readOnly
                          />
                        </button>
                      </TableHead>
                      <TableHead className="w-36 px-4 py-3">User ID</TableHead>
                      <TableHead className="w-[30%] px-4 py-3">Name</TableHead>
                      <TableHead className="w-20 px-4 py-3">Type</TableHead>
                      <TableHead className="w-24 px-4 py-3">Status</TableHead>
                      <TableHead className="w-40 px-4 py-3">Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedAssignableUsers.map((user) => (
                      <TableRow
                        key={user.user_id}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        data-state={selectedCandidateIds.includes(user.user_id) ? 'selected' : undefined}
                        onClick={() => {
                          setSelectedCandidateIds((prev) =>
                            prev.includes(user.user_id)
                              ? prev.filter((id) => id !== user.user_id)
                              : [...prev, user.user_id]
                          )
                        }}
                      >
                        <TableCell className="w-12 px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50"
                            onClick={() => {
                              setSelectedCandidateIds((prev) =>
                                prev.includes(user.user_id)
                                  ? prev.filter((id) => id !== user.user_id)
                                  : [...prev, user.user_id]
                              )
                            }}
                          >
                            <input
                              type="checkbox"
                              className="table-select-checkbox pointer-events-none"
                              checked={selectedCandidateIds.includes(user.user_id)}
                              readOnly
                            />
                          </button>
                        </TableCell>
                        <TableCell className="w-36 px-4 py-3 text-muted-foreground">
                          <span className="block truncate">{user.employee_id}</span>
                        </TableCell>
                        <TableCell className="w-[30%] px-4 py-3 font-medium">
                          <span className="block truncate">{user.full_name}</span>
                        </TableCell>
                        <TableCell className="w-20 px-4 py-3">
                          <span className="inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                            {user.role_code}
                          </span>
                        </TableCell>
                        <TableCell className="w-24 px-4 py-3">
                          {user.is_active ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">Inactive</span>
                          )}
                        </TableCell>
                        <TableCell className="w-40 px-4 py-3 text-muted-foreground text-xs">
                          <span className="block truncate">{user.phone_number || '-'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagedAssignableUsers.length === 0 && (
                       <TableRow className="hover:bg-transparent">
                         <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                           No additional eligible users found.
                         </TableCell>
                       </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {assignableUsers.length > 0 ? `Showing ${pagedAssignableUsers.length} of ${assignableUsers.length} users` : 'No users'}
                  </p>
                  <div className="flex items-center gap-2 ml-4">
                    <Button type="button" variant="outline" className="h-8 px-2" onClick={() => setAssignPage((prev) => Math.max(1, prev - 1))} disabled={assignPage <= 1}>
                      Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">{assignPage} / {totalAssignPages}</span>
                    <Button type="button" variant="outline" className="h-8 px-2" onClick={() => setAssignPage((prev) => Math.min(totalAssignPages, prev + 1))} disabled={assignPage >= totalAssignPages}>
                      Next
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 items-center">
                  <p className="text-sm font-medium mr-2">
                    {selectedCandidateIds.length > 0 ? `${selectedCandidateIds.length} selected` : null}
                  </p>
                  <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsAssignUsersOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="h-9 px-3"
                    onClick={() => void onAssignSelectedUsers()}
                    disabled={selectedCandidateIds.length === 0 || assignFacilityUsersMutation.isPending}
                  >
                    {assignFacilityUsersMutation.isPending ? 'Assigning...' : 'Assign Users'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {isEditing && facility ? (
        <div className="fixed inset-0 z-[65] flex justify-end bg-black/35" onClick={() => setIsEditing(false)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border/70 bg-background p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Edit Site Settings</h2>
                <p className="text-sm text-muted-foreground">Update standard site metadata.</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setIsEditing(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
              <div className="space-y-2">
                <Label htmlFor="facilityCode">Facility ID</Label>
                <Input id="facilityCode" value={facility.facility_code} readOnly className="cursor-not-allowed opacity-70" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityName">Name</Label>
                <Input id="facilityName" {...register('facilityName')} />
                {errors.facilityName ? <p className="text-xs text-destructive">{errors.facilityName.message}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine1">Address</Label>
                <Input id="addressLine1" {...register('addressLine1')} />
                {errors.addressLine1 ? <p className="text-xs text-destructive">{errors.addressLine1.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
                {errors.city ? <p className="text-xs text-destructive">{errors.city.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register('state')} />
                {errors.state ? <p className="text-xs text-destructive">{errors.state.message}</p> : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} />
                {errors.country ? <p className="text-xs text-destructive">{errors.country.message}</p> : null}
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() => {
                    reset({
                      facilityName: facility.facility_name,
                      addressLine1: facility.address_line_1,
                      city: facility.city,
                      state: facility.state,
                      country: facility.country,
                    })
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-9 px-3" disabled={!isDirty || updateFacilityMutation.isPending}>
                  {updateFacilityMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

    </main>
  )
}
