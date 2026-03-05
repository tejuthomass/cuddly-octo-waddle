import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

export default function ManagerHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Manager</CardTitle>
          <CardDescription>Assets and forms.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/manager/assets" className={buttonVariants({ className: 'h-9 px-3' })}>
            Assets
          </Link>
          <Link to="/manager/templates" className={buttonVariants({ variant: 'secondary', className: 'h-9 px-3' })}>
            Forms
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
