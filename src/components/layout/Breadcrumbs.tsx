import { Link, useLocation } from 'react-router-dom'

const labelMap: Record<string, string> = {
  admin: 'Admin',
  users: 'Users',
  clients: 'Accounts',
  facilities: 'Sites',
  logs: 'Logs',
  sessions: 'Sessions',
  management: 'Management',
  supervisor: 'Supervisor',
  manager: 'Manager',
  technician: 'Technician',
  client: 'Client',
  settings: 'Settings',
  password: 'Password',
}

function segmentLabel(segment: string, previousSegment?: string, navigationState?: { companyCode?: string; facilityCode?: string } | null) {
  if (labelMap[segment]) return labelMap[segment]

  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)
  if (looksLikeUuid && previousSegment === 'clients') return navigationState?.companyCode ?? 'Account'
  if (looksLikeUuid && previousSegment === 'facilities') return navigationState?.facilityCode ?? 'Site'

  return segment.length > 12 ? segment.slice(0, 12).toUpperCase() : segment.toUpperCase()
}

export function Breadcrumbs() {
  const location = useLocation()
  const navigationState = location.state as { companyCode?: string; facilityCode?: string } | null

  const pathSegments = location.pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) return null

  const crumbs = pathSegments.map((segment, index) => {
    const href = `/${pathSegments.slice(0, index + 1).join('/')}`
    const isLast = index === pathSegments.length - 1
    const previousSegment = index > 0 ? pathSegments[index - 1] : undefined

    return {
      href,
      label: segmentLabel(segment, previousSegment, navigationState),
      isLast,
    }
  })

  return (
    <nav aria-label="Breadcrumb" className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground lg:px-6">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="inline-flex items-center gap-1.5">
            {crumb.isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link to={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            )}
            {!crumb.isLast ? <span className="text-muted-foreground/70">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  )
}
