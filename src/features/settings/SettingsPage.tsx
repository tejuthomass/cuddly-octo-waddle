import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Moon, Monitor, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useCurrentProfile } from '@/hooks/useCurrentProfile'
import { useTheme, type ThemeMode } from '@/store/ThemeContext'

const modeCards: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
  {
    value: 'light',
    label: 'Light',
    description: 'Always use light mode for this browser.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Always use dark mode for this browser.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Auto',
    description: 'Follow your operating system appearance.',
    icon: Monitor,
  },
]

type SettingsSection = 'profile' | 'preferences' | 'facility-defaults'

const sectionItems: Array<{ id: SettingsSection; label: string; helper: string }> = [
  { id: 'profile', label: 'Profile', helper: '' },
  { id: 'preferences', label: 'Theme', helper: '' },
  { id: 'facility-defaults', label: 'Defaults', helper: '' },
]

interface SettingsLocationState {
  from?: string
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, resolvedTheme, setMode } = useTheme()
  const { data: profile } = useCurrentProfile()
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')

  const [defaultFacility, setDefaultFacility] = useState('main-facility')
  const [defaultShift, setDefaultShift] = useState('day')
  const [showInactiveAssets, setShowInactiveAssets] = useState(false)

  const locationState = (location.state as SettingsLocationState | null) ?? null

  const initials = useMemo(() => {
    const fullName = profile?.full_name?.trim() ?? ''
    if (fullName) {
      return fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    }

    const emailLocal = profile?.email?.split('@')[0] ?? 'U'
    return emailLocal.slice(0, 2).toUpperCase()
  }, [profile?.email, profile?.full_name])

  const onBack = () => {
    const currentPath = `${location.pathname}${location.search}`
    const from = locationState?.from

    if (from && from !== currentPath && !from.startsWith('/settings')) {
      navigate(from)
      return
    }

    navigate('/admin')
  }

  const sectionTitle = sectionItems.find((item) => item.id === activeSection)?.label ?? 'Settings'

  return (
    <main className="space-y-4 p-6 text-[15px]">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid min-h-[560px] grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="border-b border-border/70 bg-muted/20 p-4 md:border-b-0 md:border-r">
              <div className="mb-4">
                <h2 className="text-base font-semibold">Settings</h2>
              </div>

              <nav className="space-y-1" aria-label="Settings sections">
                {sectionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={[
                      'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                      activeSection === item.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted/60',
                    ].join(' ')}
                  >
                    <div className="font-medium text-foreground">{item.label}</div>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="p-5 md:p-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold">{sectionTitle}</h3>
              </div>

              {activeSection === 'profile' ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-border/70">
                    <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-4">
                      <div>
                        <p className="text-sm font-medium">Photo</p>
                      </div>
                    </div>
                    <div className="space-y-4 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-4">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="Profile avatar" className="h-14 w-14 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted text-base font-semibold">
                            {initials}
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-sm">Photo Management</Label>
                          <p className="text-xs text-muted-foreground">Admin-managed.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border/70">
                    <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Security</p>
                        <p className="mt-1 text-sm text-muted-foreground">Password management.</p>
                      </div>
                      <Button size="sm" className="h-9 px-3" onClick={() => navigate('/settings/password')}>
                        Password
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSection === 'preferences' ? (
                <div className="rounded-md border border-border/70">
                  <div className="border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-medium">Theme</p>
                    <p className="mt-1 text-sm text-muted-foreground">Current: <span className="font-medium capitalize text-foreground">{resolvedTheme}</span></p>
                  </div>
                  <div className="px-4 py-4">
                    <div className="inline-flex rounded-md border border-border/70 bg-muted/20 p-1">
                    {modeCards.map((themeOption) => {
                      const Icon = themeOption.icon
                      const active = mode === themeOption.value

                      return (
                        <button
                          key={themeOption.value}
                          type="button"
                          className={`inline-flex h-9 items-center gap-1 rounded px-3 text-sm ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setMode(themeOption.value)}
                          aria-pressed={active}
                        >
                          <Icon className="h-4 w-4" />
                          {themeOption.label}
                        </button>
                      )
                    })}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Auto follows your device mode.</p>
                  </div>
                </div>
              ) : null}

              {activeSection === 'facility-defaults' ? (
                <div className="rounded-md border border-border/70">
                  <div className="divide-y divide-border/70">
                    <div className="px-4 py-3">
                      <Label htmlFor="defaultFacility" className="text-sm font-medium">Default Facility</Label>
                      <p className="mt-1 text-sm text-muted-foreground">Used for new records.</p>
                      <select
                        id="defaultFacility"
                        value={defaultFacility}
                        onChange={(event) => setDefaultFacility(event.target.value)}
                        className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="main-facility">Main Facility</option>
                        <option value="utility-plant">Utility Plant</option>
                        <option value="warehouse">Warehouse</option>
                      </select>
                    </div>

                    <div className="px-4 py-3">
                      <Label htmlFor="defaultShift" className="text-sm font-medium">Default Shift</Label>
                      <p className="mt-1 text-sm text-muted-foreground">Applied on create.</p>
                      <select
                        id="defaultShift"
                        value={defaultShift}
                        onChange={(event) => setDefaultShift(event.target.value)}
                        className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="day">Day Shift</option>
                        <option value="evening">Evening Shift</option>
                        <option value="night">Night Shift</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Inactive Assets</p>
                        <p className="mt-1 text-sm text-muted-foreground">Show archived assets in lists.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={showInactiveAssets ? 'secondary' : 'outline'}
                        className="h-9 min-w-[82px] px-3"
                        onClick={() => setShowInactiveAssets((prev) => !prev)}
                        aria-pressed={showInactiveAssets}
                      >
                        {showInactiveAssets ? 'On' : 'Off'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
