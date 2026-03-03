import { Component, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(): void {
    toast.error('An unexpected error occurred. Please refresh and try again.')
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>The app hit an unexpected error and cannot continue safely.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={this.handleReload} className="w-full">
              Reload Application
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }
}
