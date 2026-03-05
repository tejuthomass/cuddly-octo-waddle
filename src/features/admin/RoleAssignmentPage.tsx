import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading roles...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Role</th>
                    <th className="p-2 text-left">Role Title</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((roleRow) => {
                    const isOnlyL5Candidate = roleRow.role_code === 'L5' && roleRow.is_active

                    return (
                      <tr key={roleRow.id} className="border-b">
                        <td className="p-2">{roleRow.profiles?.[0]?.full_name ?? 'Unknown user'} ({roleRow.profiles?.[0]?.employee_id ?? 'N/A'})</td>
                        <td className="p-2">{roleRow.role_code}</td>
                        <td className="p-2">{roleRow.role_title}</td>
                        <td className="p-2">{roleRow.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            variant={roleRow.is_active ? 'destructive' : 'secondary'}
                            size="sm"
                            disabled={toggleRoleMutation.isPending}
                            onClick={() => void onToggleRole(roleRow.id, !roleRow.is_active)}
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
            {userCompaniesLoading ? (
              <p className="text-sm text-muted-foreground">Loading company mappings...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Company</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userCompanies.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-2">{row.profiles?.[0]?.full_name ?? 'Unknown user'} ({row.profiles?.[0]?.employee_id ?? 'N/A'})</td>
                        <td className="p-2">{row.companies?.[0]?.company_name ?? 'Unknown company'} ({row.companies?.[0]?.company_code ?? 'N/A'})</td>
                        <td className="p-2">{row.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant={row.is_active ? 'destructive' : 'secondary'}
                            disabled={toggleUserCompanyMutation.isPending}
                            onClick={() => void onToggleUserCompany(row.id, !row.is_active)}
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
            {userFacilitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading facility mappings...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Facility</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userFacilities.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-2">{row.profiles?.[0]?.full_name ?? 'Unknown user'} ({row.profiles?.[0]?.employee_id ?? 'N/A'})</td>
                        <td className="p-2">{row.facilities?.[0]?.facility_name ?? 'Unknown facility'} ({row.facilities?.[0]?.facility_code ?? 'N/A'})</td>
                        <td className="p-2">{row.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant={row.is_active ? 'destructive' : 'secondary'}
                            disabled={toggleUserFacilityMutation.isPending}
                            onClick={() => void onToggleUserFacility(row.id, !row.is_active)}
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
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
