import { useEffect, useMemo, useState } from 'react'
import { PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import { useActiveSessions, useClearActiveSession } from '@/hooks/useActiveSessions'
import { toHumanErrorMessage } from '@/lib/errors'

export default function ActiveSessionsPage() {
  const { data: sessions = [], isLoading } = useActiveSessions()
  const clearSessionMutation = useClearActiveSession()
  const [selectedSessionUserIds, setSelectedSessionUserIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize))
  const pagedSessions = useMemo(() => {
    const start = (page - 1) * pageSize
    return sessions.slice(start, start + pageSize)
  }, [page, pageSize, sessions])
  const pageSessionIds = useMemo(() => pagedSessions.map((session) => session.user_id), [pagedSessions])

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionUserIds.includes(session.user_id)),
    [selectedSessionUserIds, sessions],
  )
  const allPageSelected = pageSessionIds.length > 0 && pageSessionIds.every((id) => selectedSessionUserIds.includes(id))
  const allSessionsSelected = sessions.length > 0 && sessions.every((session) => selectedSessionUserIds.includes(session.user_id))
  const canSelectAllSessions = allPageSelected && !allSessionsSelected && sessions.length > pagedSessions.length

  const toggleSessionSelection = (userId: string) => {
    setSelectedSessionUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const onTogglePageSelection = () => {
    setSelectedSessionUserIds((prev) => {
      if (allPageSelected) {
        return prev.filter((id) => !pageSessionIds.includes(id))
      }

      return Array.from(new Set([...prev, ...pageSessionIds]))
    })
  }

  const onSelectAllSessions = () => {
    setSelectedSessionUserIds(sessions.map((session) => session.user_id))
  }

  const onClearSession = async (userId: string) => {
    try {
      await clearSessionMutation.mutateAsync({ userId })
      toast.success('Session cleared successfully.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to clear session.'))
    }
  }

  const onBulkClear = async () => {
    if (selectedSessions.length === 0) {
      toast.error('No sessions selected.')
      return
    }

    try {
      await Promise.all(selectedSessions.map((session) => clearSessionMutation.mutateAsync({ userId: session.user_id })))
      toast.success('Selected sessions cleared.')
      setSelectedSessionUserIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to clear selected sessions.'))
    }
  }

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setSelectedSessionUserIds((prev) => prev.filter((id) => sessions.some((row) => row.user_id === id)))
  }, [sessions])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Active user sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
            <p className="px-1 text-sm text-muted-foreground">{selectedSessions.length} selected</p>
            <div className="flex items-center gap-1.5">
              <TooltipIconButton className="h-8 w-8" onClick={() => void onBulkClear()} disabled={selectedSessions.length === 0} tooltip="Clear selected sessions">
                <PowerOff className="h-4 w-4" />
              </TooltipIconButton>
            </div>
          </div>

          {canSelectAllSessions ? (
            <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              All {pageSessionIds.length} sessions on this page are selected.
              <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectAllSessions}>
                Select all {sessions.length} sessions
              </Button>
            </div>
          ) : null}

          {allSessionsSelected && selectedSessionUserIds.length > 0 ? (
            <div className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              All {sessions.length} sessions are selected.
              <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={() => setSelectedSessionUserIds([])}>
                Clear selection
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-10 p-3 text-left" aria-label="Select rows">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                        onClick={onTogglePageSelection}
                        aria-label={allPageSelected ? 'Deselect current page' : 'Select current page'}
                      >
                        <input
                          type="checkbox"
                          checked={allPageSelected && pageSessionIds.length > 0}
                          onChange={() => undefined}
                          className="pointer-events-none table-select-checkbox"
                        />
                      </button>
                    </th>
                    <th className="p-3 text-left">User</th>
                    <th className="p-3 text-left">Last Seen</th>
                    <th className="p-3 text-left">Act</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSessions.map((session) => (
                    <tr
                      key={session.user_id}
                      className="group border-b transition-colors hover:bg-muted/20"
                      onClick={(event) => {
                        if (event.ctrlKey || event.metaKey) {
                          toggleSessionSelection(session.user_id)
                        }
                      }}
                    >
                      <td className="p-3">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border/70"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleSessionSelection(session.user_id)
                          }}
                          aria-label={`Select session ${session.user_id}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSessionUserIds.includes(session.user_id)}
                            onChange={() => undefined}
                            className="pointer-events-none table-select-checkbox"
                          />
                        </button>
                      </td>
                      <td className="p-3">{session.profiles?.[0]?.full_name ?? session.user_id}</td>
                      <td className="p-3 text-muted-foreground">{new Date(session.last_seen).toLocaleString()}</td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 px-3"
                          disabled={clearSessionMutation.isPending}
                          onClick={(event) => {
                            event.stopPropagation()
                            void onClearSession(session.user_id)
                          }}
                        >
                          Clear
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Showing {pagedSessions.length} of {sessions.length}</p>
            <div className="flex items-center gap-2">
              <PageSizeSelect value={pageSize} onChange={setPageSize} />
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
