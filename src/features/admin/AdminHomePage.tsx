import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminHomePage() {
  return (
    <main className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>User and role administration surfaces are next in sequence.</CardDescription>
        </CardHeader>
        <CardContent>Route access control is active for L5 admin users.</CardContent>
      </Card>
    </main>
  )
}
