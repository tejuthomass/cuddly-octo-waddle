import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminClients, useCreateClient } from '@/hooks/useAdminClients'
import { toHumanErrorMessage } from '@/lib/errors'

const createClientSchema = z.object({
  name: z.string().min(2, 'Client name is required.'),
  logoUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
})

type CreateClientFormValues = z.infer<typeof createClientSchema>

export default function ClientManagementPage() {
  const { data: clients = [], isLoading } = useAdminClients()
  const createClientMutation = useCreateClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '',
      logoUrl: '',
    },
  })

  const onCreateClient = async (values: CreateClientFormValues) => {
    try {
      await createClientMutation.mutateAsync({
        name: values.name,
        logoUrl: values.logoUrl || undefined,
      })
      toast.success('Client created successfully.')
      reset()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create client.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Client</CardTitle>
          <CardDescription>Add a facility client account under your company.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onCreateClient)}>
            <div className="space-y-2">
              <Label htmlFor="name">Client Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input id="logoUrl" {...register('logoUrl')} />
              {errors.logoUrl ? <p className="text-xs text-destructive">{errors.logoUrl.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? 'Creating...' : 'Create Client'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Managed clients under your operator company.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading clients...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Created</th>
                    <th className="p-2 text-left">Logo</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b">
                      <td className="p-2">{client.name}</td>
                      <td className="p-2 text-muted-foreground">{new Date(client.created_at).toLocaleString()}</td>
                      <td className="p-2 text-muted-foreground">{client.logo_url ? 'Configured' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
