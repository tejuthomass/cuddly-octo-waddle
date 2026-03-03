import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveSessions, useClearActiveSession } from '@/hooks/useActiveSessions'
import { toHumanErrorMessage } from '@/lib/errors'

export default function ActiveSessionsPage() {
  const { data: sessions = [], isLoading } = useActiveSessions()
  const clearSessionMutation = useClearActiveSession()

  const onClearSession = async (userId: string) => {
    try {
      await clearSessionMutation.mutateAsync({ userId })
      toast.success('Session cleared successfully.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to clear session.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions Monitor</CardTitle>
          <CardDescription>Force logout by clearing a user's active session token.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading active sessions...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">User</th>
                    <th className="p-2 text-left">Last Seen</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.user_id} className="border-b">
                      <td className="p-2">{session.profiles?.[0]?.full_name ?? session.user_id}</td>
                      <td className="p-2 text-muted-foreground">{new Date(session.last_seen).toLocaleString()}</td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={clearSessionMutation.isPending}
                          onClick={() => void onClearSession(session.user_id)}
                        >
                          Clear Session
                        </Button>
                      </td>
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
