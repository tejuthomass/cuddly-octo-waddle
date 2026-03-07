import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { toHumanErrorMessage } from '@/lib/errors'
import { useTheme } from '@/store/ThemeContext'

const loginSchema = z.object({
  userId: z.string().min(3, 'Enter a valid user ID.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const { mode, setMode } = useTheme()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userId: '',
      password: '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true)

    try {
      await login(values.userId, values.password)
      toast.success('Welcome back.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to sign in. Please verify your credentials.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60 bg-card/90 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/60">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Facility CMMS</CardTitle>
            <CardDescription>Sign in with your user ID and password.</CardDescription>
          </div>

          <div className="mx-auto flex w-full max-w-[220px] items-center justify-center gap-2 rounded-lg border border-border/70 p-1">
            <button
              type="button"
              onClick={() => setMode('light')}
              className={`h-8 flex-1 rounded-md text-xs font-medium transition-colors ${mode === 'light' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setMode('dark')}
              className={`h-8 flex-1 rounded-md text-xs font-medium transition-colors ${mode === 'dark' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setMode('system')}
              className={`h-8 flex-1 rounded-md text-xs font-medium transition-colors ${mode === 'system' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Auto
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" autoComplete="username" {...register('userId')} />
              {errors.userId ? <p className="text-sm text-destructive">{errors.userId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
              {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
