import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminUsers, useCreateAdminUser, useToggleUserActive } from '@/hooks/useAdminUsers'
import { useAuth } from '@/hooks/useAuth'
import { toHumanErrorMessage } from '@/lib/errors'

const createUserSchema = z.object({
  email: z.email('Enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().min(2, 'Full name is required.'),
  phone: z.string().optional(),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

export default function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const { data: users = [], isLoading } = useAdminUsers()
  const createUserMutation = useCreateAdminUser()
  const toggleUserMutation = useToggleUserActive()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      phone: '',
    },
  })

  const onCreateUser = async (values: CreateUserFormValues) => {
    try {
      await createUserMutation.mutateAsync(values)
      toast.success('User creation requested.')
      reset()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Failed to create user.'))
    }
  }

  const onToggleUser = async (userId: string, nextIsActive: boolean) => {
    try {
      await toggleUserMutation.mutateAsync({ userId, isActive: nextIsActive })
      toast.success(nextIsActive ? 'User activated.' : 'User deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Failed to update user state.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
          <CardDescription>Uses the admin Edge Function endpoint and creates auth + profile records.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onCreateUser)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Activate or deactivate users in your company scope.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelfRow = currentUser?.id === user.id
                    const isProtectedSuperAdmin = user.is_super_admin && user.is_active
                    const actionDisabled = toggleUserMutation.isPending || (isSelfRow && user.is_active) || isProtectedSuperAdmin

                    return (
                      <tr key={user.id} className="border-b">
                        <td className="p-2">
                          {user.full_name || 'Unnamed user'}
                          {isSelfRow ? <span className="ml-2 text-xs text-muted-foreground">(You)</span> : null}
                          {user.is_super_admin ? (
                            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Super Admin</span>
                          ) : null}
                        </td>
                        <td className="p-2 text-muted-foreground">{user.phone || '—'}</td>
                        <td className="p-2">{user.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant={user.is_active ? 'destructive' : 'secondary'}
                            onClick={() => void onToggleUser(user.id, !user.is_active)}
                            disabled={actionDisabled}
                          >
                            {isProtectedSuperAdmin
                              ? 'Protected'
                              : isSelfRow && user.is_active
                                ? 'Protected'
                                : user.is_active
                                  ? 'Deactivate'
                                  : 'Activate'}
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
