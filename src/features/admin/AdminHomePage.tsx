import { useAdminDashboardStats } from '@/hooks/useAdminDashboardStats'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import { formatAuditLogAction } from '@/utils/auditLogUtils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Building2, 
  MapPin, 
  Activity, 
  ArrowRight, 
  UserPlus, 
  PlusCircle, 
  FileText,
  Clock
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#4f46e5', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b']

export default function AdminHomePage() {
  const navigate = useNavigate()
  const { data: stats, isLoading: isLoadingStats } = useAdminDashboardStats()
  const { data: auditLogs = [], isLoading: isLoadingLogs } = useAuditLogs(5)

  const isLoading = isLoadingStats

  return (
    <main className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 px-4 gap-2 border-border/50 shadow-sm" onClick={() => window.location.reload()}>
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">System Live</span>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value={isLoading ? '-' : stats?.totalUsers ?? 0} 
          description={`${stats?.activeUsers ?? 0} active profiles`}
          icon={<Users className="w-5 h-5" />}
          color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard 
          title="Managed Accounts" 
          value={isLoading ? '-' : stats?.totalCompanies ?? 0} 
          description="Total client entities"
          icon={<Building2 className="w-5 h-5" />}
          color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        />
        <StatCard 
          title="Service Sites" 
          value={isLoading ? '-' : stats?.totalFacilities ?? 0} 
          description="Operational locations"
          icon={<MapPin className="w-5 h-5" />}
          color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <StatCard 
          title="Live Sessions" 
          value={isLoading ? '-' : stats?.activeSessions ?? 0} 
          description="Users currently online"
          icon={<Activity className="w-5 h-5" />}
          color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <Card className="lg:col-span-2 shadow-sm border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">System Access Distribution</CardTitle>
            <CardDescription>Breakdown of active user accounts by role level</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pb-4">
            {isLoadingStats ? (
              <div className="w-full h-full flex items-center justify-center animate-pulse bg-muted/10 rounded-2xl" />
            ) : stats?.roleDistribution && stats.roleDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.roleDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.roleDistribution.map((_entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        className="hover:opacity-80 transition-opacity outline-none"
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid rgba(var(--border), 0.1)', 
                      backgroundColor: 'rgba(var(--card), 0.9)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                Insufficient data to render distribution chart.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-sm border-border/40 bg-gradient-to-b from-card to-muted/30">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">Quick Actions</CardTitle>
            <CardDescription>Shortcut to vital admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActionButton 
              icon={<UserPlus className="w-4 h-4" />} 
              label="Onboard New User" 
              onClick={() => navigate('/admin/users')} 
              description="Invite staff or client members"
            />
            <ActionButton 
              icon={<PlusCircle className="w-4 h-4" />} 
              label="Register New Account" 
              onClick={() => navigate('/admin/clients')} 
              description="Create a primary client entity"
            />
            <ActionButton 
              icon={<FileText className="w-4 h-4" />} 
              label="Review System Logs" 
              onClick={() => navigate('/admin/logs')} 
              description="Inspect recent authentication acts"
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="shadow-sm border-border/40 overflow-hidden bg-card/60 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">Recent Activity</CardTitle>
            <CardDescription>Real-time audit stream from platform actors</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-3 gap-2 text-xs font-semibold hover:bg-primary/5 transition-colors" onClick={() => navigate('/admin/logs')}>
            View All History <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-0.5">
            {isLoadingLogs ? (
               <div className="flex flex-col gap-2">
                 {[1,2,3].map(i => <div key={i} className="h-14 w-full animate-pulse bg-muted/20 rounded-xl" />)}
               </div>
            ) : auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/40 transition-all group cursor-default">
                  <div className="mt-1 p-2.5 rounded-xl bg-primary/5 text-primary group-hover:bg-primary/10 group-hover:scale-105 transition-all">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[13.5px] font-medium leading-none">
                        <span className="text-foreground font-bold">{log.profiles?.[0]?.full_name || 'System'}</span>
                        <span className="text-muted-foreground/80 mx-1.5 font-normal tracking-tight">performed</span>
                        <span className="text-primary/90 font-semibold underline decoration-primary/20 underline-offset-4 decoration-2">
                          {formatAuditLogAction(log).toLowerCase()}
                        </span>
                        <span className="text-muted-foreground/80 mx-1.5 font-normal tracking-tight">on</span>
                        <span className="text-foreground/90 font-medium italic">{log.entity_type}</span>
                      </p>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-md">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleDateString()}
                      <span className="mx-1 opacity-30">•</span>
                      <span>Target ID: {log.entity_id?.slice(0, 8) || 'N/A'}...</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
                <FileText className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground italic">No recent activity found on the platform.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function StatCard({ title, value, description, icon, color }: { title: string; value: number | string; description: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="overflow-hidden border-border/40 shadow-sm transition-all hover:shadow-lg hover:border-primary/20 group relative">
      <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tighter text-foreground tabular-nums">
                {value}
              </h3>
            </div>
          </div>
          <div className={`p-3 rounded-2xl ${color} shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
            {icon}
          </div>
        </div>
        <p className="text-[11px] font-medium text-muted-foreground/80 mt-4 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

function ActionButton({ icon, label, onClick, description }: { icon: React.ReactNode; label: string; onClick: () => void; description: string }) {
  return (
    <Button 
      variant="outline" 
      className="w-full h-auto py-3.5 px-4 justify-between border-border/40 bg-card/40 hover:bg-card hover:border-primary/30 transition-all group overflow-hidden relative"
      onClick={onClick}
    >
      <div className="flex items-center gap-4 relative z-10 text-left">
        <div className="p-2.5 rounded-xl bg-primary/5 text-primary group-hover:bg-primary/10 group-hover:rotate-12 transition-all duration-300">
          {icon}
        </div>
        <div>
          <span className="block text-sm font-bold tracking-tight">{label}</span>
          <span className="block text-[10px] text-muted-foreground mt-0.5">{description}</span>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 relative z-10" />
      <div className="absolute top-0 right-0 h-full w-1.5 bg-primary/0 group-hover:bg-primary/20 transition-all" />
    </Button>
  )
}
