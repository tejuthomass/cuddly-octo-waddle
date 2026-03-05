import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminPasswordReset } from '@/hooks/useAdminPasswordReset'
import { toHumanErrorMessage } from '@/lib/errors'

const passwordResetSchema = z.object({
  email: z.email('Enter a valid email.'),
})

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>

export default function PasswordResetPage() {
  const passwordResetMutation = useAdminPasswordReset()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSendReset = async (values: PasswordResetFormValues) => {
    try {
      await passwordResetMutation.mutateAsync(values)
      toast.success('Password reset email sent.')
      reset()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to send reset email.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Send a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSendReset)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" className="h-9" {...register('email')} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <Button type="submit" className="h-9 px-3" disabled={passwordResetMutation.isPending}>
              {passwordResetMutation.isPending ? 'Sending...' : 'Send'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
