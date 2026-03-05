import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminHomePage() {
  return (
    <main className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Users, clients, and logs.</CardDescription>
        </CardHeader>
        <CardContent>Scoped access is active.</CardContent>
      </Card>
    </main>
  )
}
