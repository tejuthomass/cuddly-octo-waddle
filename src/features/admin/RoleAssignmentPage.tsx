import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAdminRoles, useAssignRole, useRoleFormClients, useRoleFormUsers, useToggleRoleActive } from '@/hooks/useAdminRoles'
import { toHumanErrorMessage } from '@/lib/errors'
import { appRoleSchema } from '@/types/schemas'

const roleAssignmentSchema = z.object({
  userId: z.string().min(1, 'Select a user.'),
  clientId: z.string().min(1, 'Select a client.'),
  role: appRoleSchema,
})

type RoleAssignmentFormValues = z.infer<typeof roleAssignmentSchema>

export default function RoleAssignmentPage() {
  const { data: roles = [], isLoading } = useAdminRoles()
  const { data: users = [] } = useRoleFormUsers()
  const { data: clients = [] } = useRoleFormClients()
  const assignRoleMutation = useAssignRole()
  const toggleRoleMutation = useToggleRoleActive()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleAssignmentFormValues>({
    resolver: zodResolver(roleAssignmentSchema),
    defaultValues: {
      userId: '',
      clientId: '',
      role: 'l1_technician',
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

  const onToggleRole = async (roleId: string, nextActive: boolean) => {
    try {
      await toggleRoleMutation.mutateAsync({ roleId, isActive: nextActive })
      toast.success(nextActive ? 'Role activated.' : 'Role deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update role status.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Role</CardTitle>
          <CardDescription>Assign roles per user and client context.</CardDescription>
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
              <Label htmlFor="clientId">Client</Label>
              <select id="clientId" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register('clientId')}>
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.label}</option>
                ))}
              </select>
              {errors.clientId ? <p className="text-xs text-destructive">{errors.clientId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register('role')}>
                <option value="l1_technician">L1 Technician</option>
                <option value="l2_supervisor">L2 Supervisor</option>
                <option value="l3_manager">L3 Manager</option>
                <option value="l4_management">L4 Management</option>
                <option value="l5_admin">L5 Admin</option>
                <option value="client_viewer">Client Viewer</option>
              </select>
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
          <CardDescription>Enable or disable role access entries.</CardDescription>
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
                    <th className="p-2 text-left">Client</th>
                    <th className="p-2 text-left">Role</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((roleRow) => {
                    const isProtectedSuperAdminRole = roleRow.role === 'l5_admin' && roleRow.is_active

                    return (
                      <tr key={roleRow.id} className="border-b">
                        <td className="p-2">{roleRow.profiles?.[0]?.full_name ?? 'Unknown user'}</td>
                        <td className="p-2">{roleRow.clients?.[0]?.name ?? 'Unknown client'}</td>
                        <td className="p-2">{roleRow.role}</td>
                        <td className="p-2">{roleRow.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            variant={roleRow.is_active ? 'destructive' : 'secondary'}
                            size="sm"
                            disabled={toggleRoleMutation.isPending || isProtectedSuperAdminRole}
                            onClick={() => void onToggleRole(roleRow.id, !roleRow.is_active)}
                          >
                            {isProtectedSuperAdminRole ? 'Protected' : roleRow.is_active ? 'Disable' : 'Enable'}
                          </Button>
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
    </main>
  )
}
