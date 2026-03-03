import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

export default function ManagerHomePage() {
  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Manager Dashboard</CardTitle>
          <CardDescription>Use manager modules to maintain assets and inspection templates.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/manager/assets" className={buttonVariants()}>
            Asset Management
          </Link>
          <Link to="/manager/templates" className={buttonVariants({ variant: 'secondary' })}>
            Form Builder
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
