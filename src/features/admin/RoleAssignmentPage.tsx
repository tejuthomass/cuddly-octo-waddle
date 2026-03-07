import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import {
  useAssignRole,
  useAssignUserCompany,
  useAssignUserFacility,
  useCompanyOptions,
  useFacilityOptions,
  useRoleAssignments,
  useRoleFormUsers,
  useToggleRoleActive,
  useToggleUserCompany,
  useToggleUserFacility,
  useUserCompanies,
  useUserFacilities,
} from '@/hooks/useAdminAccess'
import { toHumanErrorMessage } from '@/lib/errors'

const roleAssignmentSchema = z.object({
  userId: z.string().min(1, 'Select a user.'),
  roleCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'CLIENT']),
  roleTitle: z.string().min(2, 'Role title is required.'),
})

type RoleAssignmentFormValues = z.infer<typeof roleAssignmentSchema>

const userCompanySchema = z.object({
  userId: z.string().min(1, 'Select a user.'),
  companyId: z.string().min(1, 'Select a company.'),
})

const userFacilitySchema = z.object({
  userId: z.string().min(1, 'Select a user.'),
  facilityId: z.string().min(1, 'Select a facility.'),
})

type UserCompanyFormValues = z.infer<typeof userCompanySchema>
type UserFacilityFormValues = z.infer<typeof userFacilitySchema>

export default function RoleAssignmentPage() {
  const { data: roles = [], isLoading } = useRoleAssignments()
  const { data: userCompanies = [], isLoading: userCompaniesLoading } = useUserCompanies()
  const { data: userFacilities = [], isLoading: userFacilitiesLoading } = useUserFacilities()
  const { data: users = [] } = useRoleFormUsers()
  const { data: companies = [] } = useCompanyOptions()
  const { data: facilities = [] } = useFacilityOptions()
  const assignRoleMutation = useAssignRole()
  const assignUserCompanyMutation = useAssignUserCompany()
  const assignUserFacilityMutation = useAssignUserFacility()
  const toggleRoleMutation = useToggleRoleActive()
  const toggleUserCompanyMutation = useToggleUserCompany()
  const toggleUserFacilityMutation = useToggleUserFacility()
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [selectedUserCompanyIds, setSelectedUserCompanyIds] = useState<string[]>([])
  const [selectedUserFacilityIds, setSelectedUserFacilityIds] = useState<string[]>([])
  const [rolePage, setRolePage] = useState(1)
  const [rolePageSize, setRolePageSize] = useState(10)
  const [companyPage, setCompanyPage] = useState(1)
  const [companyPageSize, setCompanyPageSize] = useState(10)
  const [facilityPage, setFacilityPage] = useState(1)
  const [facilityPageSize, setFacilityPageSize] = useState(10)

  const roleTotalPages = Math.max(1, Math.ceil(roles.length / rolePageSize))
  const pagedRoles = useMemo(() => {
    const start = (rolePage - 1) * rolePageSize
    return roles.slice(start, start + rolePageSize)
  }, [rolePage, rolePageSize, roles])
  const rolePageIds = useMemo(() => pagedRoles.map((row) => row.id), [pagedRoles])

  const companyTotalPages = Math.max(1, Math.ceil(userCompanies.length / companyPageSize))
  const pagedUserCompanies = useMemo(() => {
    const start = (companyPage - 1) * companyPageSize
    return userCompanies.slice(start, start + companyPageSize)
  }, [companyPage, companyPageSize, userCompanies])
  const companyPageIds = useMemo(() => pagedUserCompanies.map((row) => row.id), [pagedUserCompanies])

  const facilityTotalPages = Math.max(1, Math.ceil(userFacilities.length / facilityPageSize))
  const pagedUserFacilities = useMemo(() => {
    const start = (facilityPage - 1) * facilityPageSize
    return userFacilities.slice(start, start + facilityPageSize)
  }, [facilityPage, facilityPageSize, userFacilities])
  const facilityPageIds = useMemo(() => pagedUserFacilities.map((row) => row.id), [pagedUserFacilities])

  const selectedRoles = useMemo(() => roles.filter((row) => selectedRoleIds.includes(row.id)), [roles, selectedRoleIds])
  const selectedUserCompanies = useMemo(
    () => userCompanies.filter((row) => selectedUserCompanyIds.includes(row.id)),
    [selectedUserCompanyIds, userCompanies],
  )
  const selectedUserFacilities = useMemo(
    () => userFacilities.filter((row) => selectedUserFacilityIds.includes(row.id)),
    [selectedUserFacilityIds, userFacilities],
  )
  const allRolePageSelected = rolePageIds.length > 0 && rolePageIds.every((id) => selectedRoleIds.includes(id))
  const allRolesSelected = roles.length > 0 && roles.every((row) => selectedRoleIds.includes(row.id))
  const canSelectAllRoles = allRolePageSelected && !allRolesSelected && roles.length > pagedRoles.length

  const allCompanyPageSelected = companyPageIds.length > 0 && companyPageIds.every((id) => selectedUserCompanyIds.includes(id))
  const allCompaniesSelected = userCompanies.length > 0 && userCompanies.every((row) => selectedUserCompanyIds.includes(row.id))
  const canSelectAllCompanies = allCompanyPageSelected && !allCompaniesSelected && userCompanies.length > pagedUserCompanies.length

  const allFacilityPageSelected = facilityPageIds.length > 0 && facilityPageIds.every((id) => selectedUserFacilityIds.includes(id))
  const allFacilitiesSelected = userFacilities.length > 0 && userFacilities.every((row) => selectedUserFacilityIds.includes(row.id))
  const canSelectAllFacilities = allFacilityPageSelected && !allFacilitiesSelected && userFacilities.length > pagedUserFacilities.length

  const onToggleRolePageSelection = () => {
    setSelectedRoleIds((prev) => {
      if (allRolePageSelected) {
        return prev.filter((id) => !rolePageIds.includes(id))
      }

      return Array.from(new Set([...prev, ...rolePageIds]))
    })
  }

  const onToggleCompanyPageSelection = () => {
    setSelectedUserCompanyIds((prev) => {
      if (allCompanyPageSelected) {
        return prev.filter((id) => !companyPageIds.includes(id))
      }

      return Array.from(new Set([...prev, ...companyPageIds]))
    })
  }

  const onToggleFacilityPageSelection = () => {
    setSelectedUserFacilityIds((prev) => {
      if (allFacilityPageSelected) {
        return prev.filter((id) => !facilityPageIds.includes(id))
      }

      return Array.from(new Set([...prev, ...facilityPageIds]))
    })
  }

  const onSelectAllRoles = () => setSelectedRoleIds(roles.map((row) => row.id))
  const onSelectAllCompanies = () => setSelectedUserCompanyIds(userCompanies.map((row) => row.id))
  const onSelectAllFacilities = () => setSelectedUserFacilityIds(userFacilities.map((row) => row.id))

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleAssignmentFormValues>({
    resolver: zodResolver(roleAssignmentSchema),
    defaultValues: {
      userId: '',
      roleCode: 'L1',
      roleTitle: 'Technician',
    },
  })

  const {
    register: registerUserCompany,
    handleSubmit: handleUserCompanySubmit,
    reset: resetUserCompany,
    formState: { errors: userCompanyErrors },
  } = useForm<UserCompanyFormValues>({
    resolver: zodResolver(userCompanySchema),
    defaultValues: {
      userId: '',
      companyId: '',
    },
  })

  const {
    register: registerUserFacility,
    handleSubmit: handleUserFacilitySubmit,
    reset: resetUserFacility,
    formState: { errors: userFacilityErrors },
  } = useForm<UserFacilityFormValues>({
    resolver: zodResolver(userFacilitySchema),
    defaultValues: {
      userId: '',
      facilityId: '',
    },
  })

  const onAssignRole = async (values: RoleAssignmentFormValues) => {
    try {
      await assignRoleMutation.mutateAsync(values)
      toast.success('Role assigned successfully.')
      reset({ ...values })
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to assign role.'))
    }
  }

  const onAssignCompany = async (values: UserCompanyFormValues) => {
    try {
      await assignUserCompanyMutation.mutateAsync(values)
      toast.success('Company access assigned.')
      resetUserCompany(values)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to assign company access.'))
    }
  }

  const onAssignFacility = async (values: UserFacilityFormValues) => {
    try {
      await assignUserFacilityMutation.mutateAsync(values)
      toast.success('Facility access assigned.')
      resetUserFacility(values)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to assign facility access.'))
    }
  }

  const onToggleRole = async (assignmentId: string, nextActive: boolean) => {
    try {
      await toggleRoleMutation.mutateAsync({ assignmentId, isActive: nextActive })
      toast.success(nextActive ? 'Role activated.' : 'Role deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update role status.'))
    }
  }

  const onToggleUserCompany = async (rowId: string, nextActive: boolean) => {
    try {
      await toggleUserCompanyMutation.mutateAsync({ rowId, isActive: nextActive })
      toast.success(nextActive ? 'Company access activated.' : 'Company access deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update company access.'))
    }
  }

  const onToggleUserFacility = async (rowId: string, nextActive: boolean) => {
    try {
      await toggleUserFacilityMutation.mutateAsync({ rowId, isActive: nextActive })
      toast.success(nextActive ? 'Facility access activated.' : 'Facility access deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update facility access.'))
    }
  }

  const onBulkToggleRoles = async (nextActive: boolean) => {
    if (selectedRoles.length === 0) {
      toast.error('No role entries selected.')
      return
    }

    try {
      await Promise.all(
        selectedRoles
          .filter((row) => row.is_active !== nextActive)
          .map((row) => toggleRoleMutation.mutateAsync({ assignmentId: row.id, isActive: nextActive })),
      )
      toast.success(nextActive ? 'Selected roles activated.' : 'Selected roles deactivated.')
      setSelectedRoleIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update selected roles.'))
    }
  }

  const onBulkToggleUserCompanies = async (nextActive: boolean) => {
    if (selectedUserCompanies.length === 0) {
      toast.error('No company mappings selected.')
      return
    }

    try {
      await Promise.all(
        selectedUserCompanies
          .filter((row) => row.is_active !== nextActive)
          .map((row) => toggleUserCompanyMutation.mutateAsync({ rowId: row.id, isActive: nextActive })),
      )
      toast.success(nextActive ? 'Selected company mappings activated.' : 'Selected company mappings deactivated.')
      setSelectedUserCompanyIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update selected company mappings.'))
    }
  }

  const onBulkToggleUserFacilities = async (nextActive: boolean) => {
    if (selectedUserFacilities.length === 0) {
      toast.error('No facility mappings selected.')
      return
    }

    try {
      await Promise.all(
        selectedUserFacilities
          .filter((row) => row.is_active !== nextActive)
          .map((row) => toggleUserFacilityMutation.mutateAsync({ rowId: row.id, isActive: nextActive })),
      )
      toast.success(nextActive ? 'Selected facility mappings activated.' : 'Selected facility mappings deactivated.')
      setSelectedUserFacilityIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update selected facility mappings.'))
    }
  }

  useEffect(() => {
    if (rolePage > roleTotalPages) setRolePage(roleTotalPages)
  }, [rolePage, roleTotalPages])

  useEffect(() => {
    if (companyPage > companyTotalPages) setCompanyPage(companyTotalPages)
  }, [companyPage, companyTotalPages])

  useEffect(() => {
    if (facilityPage > facilityTotalPages) setFacilityPage(facilityTotalPages)
  }, [facilityPage, facilityTotalPages])

  useEffect(() => {
    setSelectedRoleIds((prev) => prev.filter((id) => roles.some((row) => row.id === id)))
  }, [roles])

  useEffect(() => {
    setSelectedUserCompanyIds((prev) => prev.filter((id) => userCompanies.some((row) => row.id === id)))
  }, [userCompanies])

  useEffect(() => {
    setSelectedUserFacilityIds((prev) => prev.filter((id) => userFacilities.some((row) => row.id === id)))
  }, [userFacilities])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Role</CardTitle>
          <CardDescription>Assign one active role per user. L4/L5 are global roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onAssignRole)}>
            <div className="space-y-2">
              <Label htmlFor="userId">User</Label>
              <select id="userId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register('userId')}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.label}</option>
                ))}
              </select>
              {errors.userId ? <p className="text-xs text-destructive">{errors.userId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleCode">Role</Label>
              <select id="roleCode" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register('roleCode')}>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
                <option value="L4">L4</option>
                <option value="L5">L5</option>
                <option value="CLIENT">CLIENT</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleTitle">Role Title</Label>
              <input
                id="roleTitle"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('roleTitle')}
              />
              {errors.roleTitle ? <p className="text-xs text-destructive">{errors.roleTitle.message}</p> : null}
            </div>

            <div className="md:col-span-3">
              <Button type="submit" disabled={assignRoleMutation.isPending}>
                {assignRoleMutation.isPending ? 'Assigning...' : 'Assign Role'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Roles</CardTitle>
          <CardDescription>Enable or disable role access entries. System prevents removing the last active L5.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
            <p className="px-1 text-sm text-muted-foreground">{selectedRoles.length} selected</p>
            <div className="flex items-center gap-1.5">
              <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleRoles(true)} disabled={selectedRoles.length === 0} tooltip="Activate selected roles">
                <Power className="h-4 w-4" />
              </TooltipIconButton>
              <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleRoles(false)} disabled={selectedRoles.length === 0} tooltip="Deactivate selected roles">
                <PowerOff className="h-4 w-4" />
              </TooltipIconButton>
            </div>
          </div>

          {canSelectAllRoles ? (
            <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              All {rolePageIds.length} role mappings on this page are selected.
              <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectAllRoles}>
                Select all {roles.length} role mappings
              </Button>
            </div>
          ) : null}

          {allRolesSelected && selectedRoleIds.length > 0 ? (
            <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              All {roles.length} role mappings are selected.
              <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={() => setSelectedRoleIds([])}>
                Clear selection
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading roles...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 p-2 text-left" aria-label="Select rows">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                        onClick={onToggleRolePageSelection}
                        aria-label={allRolePageSelected ? 'Deselect current page' : 'Select current page'}
                      >
                        <input
                          type="checkbox"
                          checked={allRolePageSelected && rolePageIds.length > 0}
                          onChange={() => undefined}
                          className="pointer-events-none table-select-checkbox"
                        />
                      </button>
                    </th>
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Role</th>
                    <th className="p-2 text-left">Role Title</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRoles.map((roleRow) => {
                    const isOnlyL5Candidate = roleRow.role_code === 'L5' && roleRow.is_active

                    return (
                      <tr
                        key={roleRow.id}
                        className="group border-b transition-colors hover:bg-muted/20"
                        onClick={(event) => {
                          if (event.ctrlKey || event.metaKey) {
                            setSelectedRoleIds((prev) =>
                              prev.includes(roleRow.id) ? prev.filter((id) => id !== roleRow.id) : [...prev, roleRow.id],
                            )
                          }
                        }}
                      >
                        <td className="p-2">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedRoleIds((prev) =>
                                prev.includes(roleRow.id) ? prev.filter((id) => id !== roleRow.id) : [...prev, roleRow.id],
                              )
                            }}
                            aria-label={`Select role assignment ${roleRow.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRoleIds.includes(roleRow.id)}
                              onChange={() => undefined}
                              className="pointer-events-none table-select-checkbox"
                            />
                          </button>
                        </td>
                        <td className="p-2">{roleRow.profiles?.[0]?.full_name ?? 'Unknown user'} ({roleRow.profiles?.[0]?.employee_id ?? 'N/A'})</td>
                        <td className="p-2">{roleRow.role_code}</td>
                        <td className="p-2">{roleRow.role_title}</td>
                        <td className="p-2">{roleRow.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            variant={roleRow.is_active ? 'destructive' : 'secondary'}
                            size="sm"
                            disabled={toggleRoleMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void onToggleRole(roleRow.id, !roleRow.is_active)
                            }}
                          >
                            {roleRow.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          {isOnlyL5Candidate ? <p className="mt-1 text-xs text-muted-foreground">Cannot remove last active L5.</p> : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Showing {pagedRoles.length} of {roles.length}</p>
            <div className="flex items-center gap-2">
              <PageSizeSelect value={rolePageSize} onChange={setRolePageSize} />
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setRolePage((prev) => Math.max(1, prev - 1))} disabled={rolePage <= 1}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">{rolePage} / {roleTotalPages}</span>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setRolePage((prev) => Math.min(roleTotalPages, prev + 1))} disabled={rolePage >= roleTotalPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign Company Access</CardTitle>
          <CardDescription>Map users to companies they can access.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleUserCompanySubmit(onAssignCompany)}>
            <div className="space-y-2">
              <Label htmlFor="uc-userId">User</Label>
              <select id="uc-userId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...registerUserCompany('userId')}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.label}</option>
                ))}
              </select>
              {userCompanyErrors.userId ? <p className="text-xs text-destructive">{userCompanyErrors.userId.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="uc-companyId">Company</Label>
              <select id="uc-companyId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...registerUserCompany('companyId')}>
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.label}</option>
                ))}
              </select>
              {userCompanyErrors.companyId ? <p className="text-xs text-destructive">{userCompanyErrors.companyId.message}</p> : null}
            </div>
            <div className="md:self-end">
              <Button type="submit" disabled={assignUserCompanyMutation.isPending}>
                {assignUserCompanyMutation.isPending ? 'Assigning...' : 'Assign Company'}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
              <p className="px-1 text-sm text-muted-foreground">{selectedUserCompanies.length} selected</p>
              <div className="flex items-center gap-1.5">
                <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleUserCompanies(true)} disabled={selectedUserCompanies.length === 0} tooltip="Activate selected company mappings">
                  <Power className="h-4 w-4" />
                </TooltipIconButton>
                <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleUserCompanies(false)} disabled={selectedUserCompanies.length === 0} tooltip="Deactivate selected company mappings">
                  <PowerOff className="h-4 w-4" />
                </TooltipIconButton>
              </div>
            </div>

            {canSelectAllCompanies ? (
              <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                All {companyPageIds.length} company mappings on this page are selected.
                <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectAllCompanies}>
                  Select all {userCompanies.length} company mappings
                </Button>
              </div>
            ) : null}

            {allCompaniesSelected && selectedUserCompanyIds.length > 0 ? (
              <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                All {userCompanies.length} company mappings are selected.
                <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={() => setSelectedUserCompanyIds([])}>
                  Clear selection
                </Button>
              </div>
            ) : null}

            {userCompaniesLoading ? (
              <p className="text-sm text-muted-foreground">Loading company mappings...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="w-10 p-2 text-left" aria-label="Select rows">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                          onClick={onToggleCompanyPageSelection}
                          aria-label={allCompanyPageSelected ? 'Deselect current page' : 'Select current page'}
                        >
                          <input
                            type="checkbox"
                            checked={allCompanyPageSelected && companyPageIds.length > 0}
                            onChange={() => undefined}
                            className="pointer-events-none table-select-checkbox"
                          />
                        </button>
                      </th>
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Company</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUserCompanies.map((row) => (
                      <tr
                        key={row.id}
                        className="group border-b transition-colors hover:bg-muted/20"
                        onClick={(event) => {
                          if (event.ctrlKey || event.metaKey) {
                            setSelectedUserCompanyIds((prev) =>
                              prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
                            )
                          }
                        }}
                      >
                        <td className="p-2">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedUserCompanyIds((prev) =>
                                prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
                              )
                            }}
                            aria-label={`Select company assignment ${row.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUserCompanyIds.includes(row.id)}
                              onChange={() => undefined}
                              className="pointer-events-none table-select-checkbox"
                            />
                          </button>
                        </td>
                        <td className="p-2">{row.profiles?.[0]?.full_name ?? 'Unknown user'} ({row.profiles?.[0]?.employee_id ?? 'N/A'})</td>
                        <td className="p-2">{row.companies?.[0]?.company_name ?? 'Unknown company'} ({row.companies?.[0]?.company_code ?? 'N/A'})</td>
                        <td className="p-2">{row.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant={row.is_active ? 'destructive' : 'secondary'}
                            disabled={toggleUserCompanyMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void onToggleUserCompany(row.id, !row.is_active)
                            }}
                          >
                            {row.is_active ? 'Disable' : 'Enable'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Showing {pagedUserCompanies.length} of {userCompanies.length}</p>
              <div className="flex items-center gap-2">
                <PageSizeSelect value={companyPageSize} onChange={setCompanyPageSize} />
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCompanyPage((prev) => Math.max(1, prev - 1))} disabled={companyPage <= 1}>
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">{companyPage} / {companyTotalPages}</span>
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCompanyPage((prev) => Math.min(companyTotalPages, prev + 1))} disabled={companyPage >= companyTotalPages}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign Facility Access</CardTitle>
          <CardDescription>Map L1/L2/L3 users to facilities after company mapping.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleUserFacilitySubmit(onAssignFacility)}>
            <div className="space-y-2">
              <Label htmlFor="uf-userId">User</Label>
              <select id="uf-userId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...registerUserFacility('userId')}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.label}</option>
                ))}
              </select>
              {userFacilityErrors.userId ? <p className="text-xs text-destructive">{userFacilityErrors.userId.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf-facilityId">Facility</Label>
              <select id="uf-facilityId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...registerUserFacility('facilityId')}>
                <option value="">Select facility</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>{facility.label}</option>
                ))}
              </select>
              {userFacilityErrors.facilityId ? <p className="text-xs text-destructive">{userFacilityErrors.facilityId.message}</p> : null}
            </div>
            <div className="md:self-end">
              <Button type="submit" disabled={assignUserFacilityMutation.isPending}>
                {assignUserFacilityMutation.isPending ? 'Assigning...' : 'Assign Facility'}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
              <p className="px-1 text-sm text-muted-foreground">{selectedUserFacilities.length} selected</p>
              <div className="flex items-center gap-1.5">
                <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleUserFacilities(true)} disabled={selectedUserFacilities.length === 0} tooltip="Activate selected facility mappings">
                  <Power className="h-4 w-4" />
                </TooltipIconButton>
                <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkToggleUserFacilities(false)} disabled={selectedUserFacilities.length === 0} tooltip="Deactivate selected facility mappings">
                  <PowerOff className="h-4 w-4" />
                </TooltipIconButton>
              </div>
            </div>

            {canSelectAllFacilities ? (
              <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                All {facilityPageIds.length} facility mappings on this page are selected.
                <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectAllFacilities}>
                  Select all {userFacilities.length} facility mappings
                </Button>
              </div>
            ) : null}

            {allFacilitiesSelected && selectedUserFacilityIds.length > 0 ? (
              <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                All {userFacilities.length} facility mappings are selected.
                <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={() => setSelectedUserFacilityIds([])}>
                  Clear selection
                </Button>
              </div>
            ) : null}

            {userFacilitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading facility mappings...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="w-10 p-2 text-left" aria-label="Select rows">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                          onClick={onToggleFacilityPageSelection}
                          aria-label={allFacilityPageSelected ? 'Deselect current page' : 'Select current page'}
                        >
                          <input
                            type="checkbox"
                            checked={allFacilityPageSelected && facilityPageIds.length > 0}
                            onChange={() => undefined}
                            className="pointer-events-none table-select-checkbox"
                          />
                        </button>
                      </th>
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Facility</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUserFacilities.map((row) => (
                      <tr
                        key={row.id}
                        className="group border-b transition-colors hover:bg-muted/20"
                        onClick={(event) => {
                          if (event.ctrlKey || event.metaKey) {
                            setSelectedUserFacilityIds((prev) =>
                              prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
                            )
                          }
                        }}
                      >
                        <td className="p-2">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedUserFacilityIds((prev) =>
                                prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
                              )
                            }}
                            aria-label={`Select facility assignment ${row.id}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUserFacilityIds.includes(row.id)}
                              onChange={() => undefined}
                              className="pointer-events-none table-select-checkbox"
                            />
                          </button>
                        </td>
                        <td className="p-2">{row.profiles?.[0]?.full_name ?? 'Unknown user'} ({row.profiles?.[0]?.employee_id ?? 'N/A'})</td>
                        <td className="p-2">{row.facilities?.[0]?.facility_name ?? 'Unknown facility'} ({row.facilities?.[0]?.facility_code ?? 'N/A'})</td>
                        <td className="p-2">{row.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant={row.is_active ? 'destructive' : 'secondary'}
                            disabled={toggleUserFacilityMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void onToggleUserFacility(row.id, !row.is_active)
                            }}
                          >
                            {row.is_active ? 'Disable' : 'Enable'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Showing {pagedUserFacilities.length} of {userFacilities.length}</p>
              <div className="flex items-center gap-2">
                <PageSizeSelect value={facilityPageSize} onChange={setFacilityPageSize} />
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setFacilityPage((prev) => Math.max(1, prev - 1))} disabled={facilityPage <= 1}>
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">{facilityPage} / {facilityTotalPages}</span>
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setFacilityPage((prev) => Math.min(facilityTotalPages, prev + 1))} disabled={facilityPage >= facilityTotalPages}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
