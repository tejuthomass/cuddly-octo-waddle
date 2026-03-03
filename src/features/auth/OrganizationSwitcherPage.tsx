import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { contextId, roleLabel } from '@/lib/auth'
import { toHumanErrorMessage } from '@/lib/errors'
import type { AppRole } from '@/types/database'

const organizationSwitcherSchema = z.object({
  context: z.string().min(1, 'Select a client and role to continue.'),
})

type OrganizationSwitcherFormValues = z.infer<typeof organizationSwitcherSchema>

export function OrganizationSwitcherPage() {
  const { roles, selectOrganization } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const options = useMemo(
    () =>
      roles.map((roleAssignment) => ({
        id: contextId(roleAssignment.clientId, roleAssignment.role),
        clientId: roleAssignment.clientId,
        role: roleAssignment.role,
        label: `${roleAssignment.clientName} · ${roleLabel(roleAssignment.role)}`,
      })),
    [roles],
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationSwitcherFormValues>({
    resolver: zodResolver(organizationSwitcherSchema),
    defaultValues: {
      context: '',
    },
  })

  const onSubmit = async (values: OrganizationSwitcherFormValues) => {
    setIsSubmitting(true)

    try {
      const selectedOption = options.find((option) => option.id === values.context)
      if (!selectedOption) {
        throw new Error('Selected organization is no longer available.')
      }

      selectOrganization({
        clientId: selectedOption.clientId,
        role: selectedOption.role as AppRole,
      })

      toast.success('Organization context selected.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to set organization context.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-border/60 bg-card/90 backdrop-blur">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-5 w-5" />
            <span className="text-sm font-medium">Organization Switcher</span>
          </div>
          <CardTitle>Select your active organization</CardTitle>
          <CardDescription>
            You have access to multiple client contexts. Choose one to continue.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="context">Client and role</Label>
              <select
                id="context"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('context')}
              >
                <option value="">Select organization...</option>
                {options.map((option) => (
                  <option value={option.id} key={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.context ? <p className="text-sm text-destructive">{errors.context.message}</p> : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Applying...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
