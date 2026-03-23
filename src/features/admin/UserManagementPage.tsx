import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, CircleHelp, Eye, Filter, Minus, Pencil, Plus, Power, PowerOff, RefreshCw, RotateCcw, Search, Trash2, Upload, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageSizeSelect } from '@/components/ui/page-size-select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import type { RoleCode } from '@/hooks/useAdminAccess'
import { useCompanyOptions, useFacilityOptions } from '@/hooks/useAdminAccess'
import { useAuth } from '@/hooks/useAuth'
import {
  type AdminUserRow,
  useAdminUpdateUserAvatar,
  useAdminUsers,
  useCreateAdminUser,
  useHardDeleteUser,
  useResetAdminUserPassword,
  useToggleUserActive,
  useUpdateAdminUser,
} from '@/hooks/useAdminUsers'
import { compactDialLabel, countryPhoneOptions, detectPreferredDialCode, normalizeDialCodeValue, parseCountryOptionLabel } from '@/lib/countryPhoneOptions'
import { toHumanErrorMessage } from '@/lib/errors'

const dialCodesSorted = [...new Set(countryPhoneOptions.map((option) => normalizeDialCodeValue(option.value)))].sort(
  (a, b) => b.length - a.length,
)

const roleOptions: { value: RoleCode; label: string }[] = [
  { value: 'L1', label: 'L1 Technician' },
  { value: 'L2', label: 'L2 Supervisor' },
  { value: 'L3', label: 'L3 Manager' },
  { value: 'L4', label: 'L4 Management' },
  { value: 'L5', label: 'L5 Admin' },
  { value: 'CLIENT', label: 'Client' },
]

const roleFilterOptions: { value: 'ALL' | RoleCode; label: string }[] = [
  { value: 'ALL', label: 'All roles' },
  ...roleOptions,
]

const statusFilterOptions: { value: 'ALL' | 'ACTIVE' | 'INACTIVE'; label: string }[] = [
  { value: 'ALL', label: 'All status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const createSchema = z.object({
  roleCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'CLIENT']),
  fullName: z.string().min(2, 'Full name is required.'),
  email: z.email('Enter a valid email.'),
  countryCode: z.string().min(1, 'Country code is required.'),
  phoneLocal: z.string().min(6, 'Enter a valid local number.'),
  roleTitle: z.string().optional(),
  companyIds: z.array(z.string()).optional(),
  facilityIds: z.array(z.string()).optional(),
})

const detailSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  email: z.email('Enter a valid email.'),
  countryCode: z.string().min(1, 'Country code is required.'),
  phoneLocal: z.string().min(6, 'Enter a valid local number.'),
  roleCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'CLIENT']),
  roleTitle: z.string().min(2, 'Role title is required.'),
  companyIds: z.array(z.string()).optional(),
  facilityIds: z.array(z.string()).optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type DetailFormValues = z.infer<typeof detailSchema>

type AvatarDraft = {
  sourceUrl: string | null
  uploadedObjectUrl: string | null
  hasNewUpload: boolean
  markedForRemoval: boolean
  zoom: number
  panX: number
  panY: number
}

type AvatarImageSize = {
  width: number
  height: number
}

const avatarEditorViewportSize = 320
const avatarZoomMin = 1
const avatarZoomMax = 3

const roleTitleByCode: Record<RoleCode, string> = {
  L1: 'Technician',
  L2: 'Supervisor',
  L3: 'Manager',
  L4: 'Management',
  L5: 'L5 Admin',
  CLIENT: 'Client',
}

function isGlobalRole(roleCode: RoleCode) {
  return roleCode === 'L4' || roleCode === 'L5'
}

function isScopedOpsRole(roleCode: RoleCode) {
  return roleCode === 'L1' || roleCode === 'L2' || roleCode === 'L3'
}

function normalizePhone(countryCode: string, local: string) {
  const sanitizedLocal = local.replace(/[^\d]/g, '')
  const sanitizedCode = normalizeDialCodeValue(countryCode).replace(/[^\d+]/g, '')
  return `${sanitizedCode}${sanitizedLocal}`
}

function splitPhone(phone: string | null): { countryCode: string; phoneLocal: string } {
  if (!phone) {
    return { countryCode: '+1', phoneLocal: '' }
  }

  const normalized = phone.replace(/\s|-/g, '')
  const matched = dialCodesSorted.find((code) => normalized.startsWith(code))

  if (!matched) {
    return { countryCode: '+1', phoneLocal: normalized.replace(/[^\d]/g, '') }
  }

  const matchedOption = countryPhoneOptions.find((option) => normalizeDialCodeValue(option.value) === matched)

  return {
    countryCode: matchedOption?.value ?? matched,
    phoneLocal: normalized.slice(matched.length).replace(/[^\d]/g, ''),
  }
}

const defaultAvatarDraft: AvatarDraft = {
  sourceUrl: null,
  uploadedObjectUrl: null,
  hasNewUpload: false,
  markedForRemoval: false,
  zoom: 1,
  panX: 0,
  panY: 0,
}

function buildAvatarDraftFromUrl(url: string | null): AvatarDraft {
  return {
    ...defaultAvatarDraft,
    sourceUrl: url,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getAvatarRenderMetrics(draft: AvatarDraft, imageSize: AvatarImageSize, viewportSize: number) {
  // Calculate base scale to fit image in viewport while maintaining aspect ratio
  const baseScale = Math.min(viewportSize / imageSize.width, viewportSize / imageSize.height)
  const zoom = clamp(draft.zoom, avatarZoomMin, avatarZoomMax)
  const scale = baseScale * zoom
  
  // Calculate actual rendered dimensions
  const drawWidth = imageSize.width * scale
  const drawHeight = imageSize.height * scale
  
  // Calculate how much room there is to pan
  const panRoomX = Math.max(0, drawWidth - viewportSize)
  const panRoomY = Math.max(0, drawHeight - viewportSize)
  
  // Clamp pan values
  const panXClamped = clamp(draft.panX, -100, 100)
  const panYClamped = clamp(draft.panY, -100, 100)
  
  // Calculate position
  // When panRoom = 0, center the image
  // When panRoom > 0, pan from -panRoom/2 to +panRoom/2 based on normalized pan values
  let left: number
  let top: number
  
  if (panRoomX === 0) {
    left = (viewportSize - drawWidth) / 2
  } else {
    // panX: -100 (left edge) to +100 (right edge)
    // Convert to: 0 (left edge) to panRoomX (right edge), centered at panRoomX/2
    const normalizedPan = (panXClamped + 100) / 200 // 0 to 1
    left = -normalizedPan * panRoomX
  }
  
  if (panRoomY === 0) {
    top = (viewportSize - drawHeight) / 2
  } else {
    const normalizedPan = (panYClamped + 100) / 200 // 0 to 1
    top = -normalizedPan * panRoomY
  }

  return {
    drawWidth,
    drawHeight,
    panRoomX,
    panRoomY,
    left,
    top,
  }
}

function normalizeAvatarDraft(draft: AvatarDraft): AvatarDraft {
  return {
    ...draft,
    zoom: clamp(draft.zoom, avatarZoomMin, avatarZoomMax),
    panX: clamp(draft.panX, -100, 100),
    panY: clamp(draft.panY, -100, 100),
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to read image.'))
    image.src = url
  })
}

async function buildAvatarBlobFromDraft(draft: AvatarDraft): Promise<Blob> {
  if (!draft.sourceUrl) {
    throw new Error('No avatar selected.')
  }

  const image = await loadImage(draft.sourceUrl)
  const targetSize = 512

  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to process image.')
  }

  const { drawWidth, drawHeight, left, top } = getAvatarRenderMetrics(normalizeAvatarDraft(draft), { width: image.width, height: image.height }, targetSize)

  context.drawImage(image, left, top, drawWidth, drawHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/webp', 0.82)
  })

  if (!blob) {
    throw new Error('Unable to compress image.')
  }

  return blob
}

function RequiredMark() {
  return <span className="ml-1 text-destructive">*</span>
}

function ThemedHoverText({ text, className }: { text: string; className?: string }) {
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  const updatePos = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ left: rect.left + rect.width / 2, top: Math.max(8, rect.top - 8) })
  }

  useEffect(() => {
    if (!open) return
    updatePos()
    const onWindowChange = () => updatePos()
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
    return () => {
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('scroll', onWindowChange, true)
    }
  }, [open])

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        onMouseEnter={() => {
          setOpen(true)
          updatePos()
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          setOpen(true)
          updatePos()
        }}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        {text}
      </span>

      {open
        ? createPortal(
            <div
              className="fixed z-[200] -translate-x-1/2 -translate-y-full rounded-md border border-border/80 bg-popover/95 px-2 py-1 text-xs text-popover-foreground shadow-lg backdrop-blur-sm"
              style={{ left: pos.left, top: pos.top }}
              role="tooltip"
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

type SortKey = 'user_id' | 'full_name' | 'role_code' | 'is_active' | 'created_at'
type SortDirection = 'asc' | 'desc'

function roleBadgeClass(roleCode: RoleCode | null) {
  const map: Record<RoleCode, string> = {
    L1: 'bg-zinc-500/12 text-zinc-700 border-zinc-400/40 dark:text-zinc-200',
    L2: 'bg-slate-500/12 text-slate-700 border-slate-400/40 dark:text-slate-200',
    L3: 'bg-stone-500/12 text-stone-700 border-stone-400/40 dark:text-stone-200',
    L4: 'bg-neutral-500/12 text-neutral-700 border-neutral-400/40 dark:text-neutral-100',
    L5: 'bg-emerald-500/12 text-emerald-700 border-emerald-400/40 dark:text-emerald-300',
    CLIENT: 'bg-blue-500/12 text-blue-700 border-blue-400/40 dark:text-blue-300',
  }

  if (!roleCode) {
    return 'bg-muted text-muted-foreground border-border/50'
  }

  return map[roleCode]
}

export default function UserManagementPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: currentUser } = useAuth()
  const { data: users = [], isLoading, isFetching, refetch } = useAdminUsers()
  const { data: companies = [] } = useCompanyOptions()
  const { data: facilities = [] } = useFacilityOptions()

  const createUserMutation = useCreateAdminUser()
  const updateUserMutation = useUpdateAdminUser()
  const toggleUserMutation = useToggleUserActive()
  const hardDeleteUserMutation = useHardDeleteUser()
  const resetPasswordMutation = useResetAdminUserPassword()
  const updateUserAvatarMutation = useAdminUpdateUserAvatar()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleCode>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [companyFilter, setCompanyFilter] = useState<string>('ALL')
  const [facilityFilter, setFacilityFilter] = useState<string>('ALL')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [detailSnapshot, setDetailSnapshot] = useState<DetailFormValues | null>(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)
  const [pendingDiscardAction, setPendingDiscardAction] = useState<'close' | 'cancel-edit' | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(10)
  const [pendingBulkAction, setPendingBulkAction] = useState<'activate' | 'deactivate' | null>(null)
  const [pendingUserStatusAction, setPendingUserStatusAction] = useState<{ user: AdminUserRow; nextIsActive: boolean } | null>(null)
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number | null>(null)
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>(defaultAvatarDraft)
  const [avatarEditorDraft, setAvatarEditorDraft] = useState<AvatarDraft | null>(null)
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false)
  const [avatarEditorImageSize, setAvatarEditorImageSize] = useState<AvatarImageSize | null>(null)
  const [isAvatarEditorConfirmOpen, setIsAvatarEditorConfirmOpen] = useState(false)
  const lastSelfSelectToastAtRef = useRef(0)
  const detailAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const detailsPaneRef = useRef<HTMLElement | null>(null)
  const avatarEditorViewportRef = useRef<HTMLDivElement | null>(null)
  const avatarEditorDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const avatarEditorTouchRef = useRef<{ touch1: Touch; touch2?: Touch; startZoom: number; startPanX: number; startPanY: number } | null>(null)

  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const getMidpoint = (touch1: Touch, touch2: Touch): { x: number; y: number } => ({
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  })

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    setValue: setCreateValue,
    watch: watchCreate,
    trigger: triggerCreate,
    formState: { errors: createErrors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      roleCode: 'L1',
      fullName: '',
      email: '',
      countryCode: detectPreferredDialCode(),
      phoneLocal: '',
      roleTitle: roleTitleByCode.L1,
      companyIds: [],
      facilityIds: [],
    },
  })

  const {
    register: registerDetail,
    handleSubmit: handleDetailSubmit,
    reset: resetDetail,
    setValue: setDetailValue,
    watch: watchDetail,
    formState: { errors: detailErrors, isDirty: detailIsDirty },
  } = useForm<DetailFormValues>({
    resolver: zodResolver(detailSchema),
    defaultValues: {
      fullName: '',
      email: '',
      countryCode: detectPreferredDialCode(),
      phoneLocal: '',
      roleCode: 'L1',
      roleTitle: roleTitleByCode.L1,
      companyIds: [],
      facilityIds: [],
    },
  })

  const createRoleCode = watchCreate('roleCode')
  const createCountryCode = watchCreate('countryCode')
  const detailRoleCode = watchDetail('roleCode')
  const detailCompanyIds = watchDetail('companyIds') ?? []
  const detailCountryCode = watchDetail('countryCode')
  const detailFacilityIds = watchDetail('facilityIds') ?? []

  const createRoleIsGlobal = isGlobalRole(createRoleCode)
  const detailRoleIsGlobal = isGlobalRole(detailRoleCode)
  const createCanAssignSites = isScopedOpsRole(createRoleCode)
  const detailCanAssignSites = isScopedOpsRole(detailRoleCode)

  const isSelfSelected = Boolean(selectedUser && currentUser?.id === selectedUser.id)
  const avatarDirty = Boolean(
    selectedUser
    && (
      avatarDraft.hasNewUpload
      || (avatarDraft.markedForRemoval && Boolean(selectedUser.avatar_url))
    ),
  )
  const hasUnsavedDetailChanges = detailIsDirty || avatarDirty

  const avatarEditorMetrics = useMemo(() => {
    if (!avatarEditorDraft || !avatarEditorImageSize) {
      return null
    }

    return getAvatarRenderMetrics(avatarEditorDraft, avatarEditorImageSize, avatarEditorViewportSize)
  }, [avatarEditorDraft, avatarEditorImageSize])

  useEffect(() => {
    if (!isAvatarEditorOpen) return
    avatarEditorViewportRef.current?.focus()
  }, [isAvatarEditorOpen])

  const openAvatarEditorWithDraft = async (draft: AvatarDraft) => {
    if (!draft.sourceUrl) {
      return
    }

    try {
      const image = await loadImage(draft.sourceUrl)
      const normalizedDraft = normalizeAvatarDraft(draft)
      setAvatarEditorDraft((previous) => {
        if (previous?.uploadedObjectUrl && previous.uploadedObjectUrl !== avatarDraft.uploadedObjectUrl && previous.uploadedObjectUrl !== normalizedDraft.uploadedObjectUrl) {
          URL.revokeObjectURL(previous.uploadedObjectUrl)
        }
        return normalizedDraft
      })
      setAvatarEditorImageSize({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
      setIsAvatarEditorOpen(true)
    } catch {
      toast.error('Unable to open image editor.')
    }
  }

  const closeAvatarEditor = () => {
    // Check if there are unsaved changes
    if (
      avatarEditorDraft
      && (
        avatarEditorDraft.panX !== avatarDraft.panX
        || avatarEditorDraft.panY !== avatarDraft.panY
        || avatarEditorDraft.zoom !== avatarDraft.zoom
      )
    ) {
      // Show confirmation dialog
      setIsAvatarEditorConfirmOpen(true)
      return
    }

    setIsAvatarEditorOpen(false)
    setAvatarEditorImageSize(null)
    setAvatarEditorDraft((previous) => {
      if (previous?.uploadedObjectUrl && previous.uploadedObjectUrl !== avatarDraft.uploadedObjectUrl) {
        URL.revokeObjectURL(previous.uploadedObjectUrl)
      }
      return null
    })
  }

  const applyAvatarEditor = () => {
    if (!avatarEditorDraft) {
      closeAvatarEditor()
      return
    }

    setAvatarDraft((previous) => {
      if (previous.uploadedObjectUrl && previous.uploadedObjectUrl !== avatarEditorDraft.uploadedObjectUrl) {
        URL.revokeObjectURL(previous.uploadedObjectUrl)
      }

      return normalizeAvatarDraft(avatarEditorDraft)
    })

    setIsAvatarEditorOpen(false)
    setAvatarEditorImageSize(null)
    setAvatarEditorDraft(null)
  }

  const nudgeAvatarPan = (axis: 'x' | 'y', delta: number) => {
    setAvatarEditorDraft((previous) => {
      if (!previous) return previous
      
      // Calculate new pan value
      const newPanX = axis === 'x' ? clamp(previous.panX + delta, -100, 100) : previous.panX
      const newPanY = axis === 'y' ? clamp(previous.panY + delta, -100, 100) : previous.panY
      
      return {
        ...previous,
        panX: newPanX,
        panY: newPanY,
      }
    })
  }

  const nudgeAvatarZoom = (delta: number) => {
    setAvatarEditorDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        zoom: clamp(previous.zoom + delta, avatarZoomMin, avatarZoomMax),
      }
    })
  }

  const onAvatarEditorWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    if (!avatarEditorDraft || !avatarEditorMetrics) return

    // Always prevent default scrolling on the viewport to avoid page zoom
    event.preventDefault()

    if (!event.ctrlKey) {
      return
    }

    const zoomDelta = event.deltaY > 0 ? -0.04 : 0.04
    nudgeAvatarZoom(zoomDelta)
  }

  const onAvatarEditorPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!avatarEditorDraft) return
    avatarEditorDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: avatarEditorDraft.panX,
      panY: avatarEditorDraft.panY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onAvatarEditorPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!avatarEditorDraft || !avatarEditorMetrics || !avatarEditorDragRef.current) return

    const drag = avatarEditorDragRef.current
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    
    // Convert pixel movement to pan changes
    // Dragging right should show more of the image's left side (pan increases)
    // If panRoomX pixels of drag = 200 units of pan, then:
    const panXDelta = avatarEditorMetrics.panRoomX > 0 ? (deltaX / avatarEditorMetrics.panRoomX) * 200 : 0
    const panYDelta = avatarEditorMetrics.panRoomY > 0 ? (deltaY / avatarEditorMetrics.panRoomY) * 200 : 0

    setAvatarEditorDraft((previous) => {
      if (!previous) return previous

      return {
        ...previous,
        panX: clamp(drag.panX + panXDelta, -100, 100),
        panY: clamp(drag.panY + panYDelta, -100, 100),
      }
    })
  }

  const onAvatarEditorPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    avatarEditorDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onAvatarEditorKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!avatarEditorDraft) return

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudgeAvatarPan('x', -4)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudgeAvatarPan('x', 4)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      nudgeAvatarPan('y', -4)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      nudgeAvatarPan('y', 4)
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      nudgeAvatarZoom(0.06)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      nudgeAvatarZoom(-0.06)
    }
  }

  const onAvatarEditorTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!avatarEditorDraft || event.touches.length < 2) return

    const touch1 = event.touches[0]
    const touch2 = event.touches[1]

    avatarEditorTouchRef.current = {
      touch1,
      touch2,
      startZoom: avatarEditorDraft.zoom,
      startPanX: avatarEditorDraft.panX,
      startPanY: avatarEditorDraft.panY,
    }

    event.preventDefault()
  }

  const onAvatarEditorTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!avatarEditorDraft || !avatarEditorMetrics || !avatarEditorTouchRef.current || event.touches.length < 2) return

    const touchState = avatarEditorTouchRef.current
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const currentDistance = getDistance(touch1, touch2)
    const startDistance = getDistance(touchState.touch1, touchState.touch2 || touchState.touch1)

    if (startDistance > 0) {
      const zoomFactor = currentDistance / startDistance
      const nextZoom = clamp(touchState.startZoom * zoomFactor, avatarZoomMin, avatarZoomMax)
      setAvatarEditorDraft((previous) => {
        if (!previous) return previous
        return { ...previous, zoom: nextZoom }
      })
    }

    event.preventDefault()
  }

  const onAvatarEditorTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (event.touches.length < 2) {
      avatarEditorTouchRef.current = null
    }
  }

  const renderCountryOption = (optionLabel: string) => {
    const parsed = parseCountryOptionLabel(optionLabel)

    return (
      <span className="flex items-center gap-2">
        <span>{parsed.flag}</span>
        <span className="truncate">{parsed.countryName}</span>
        <span className="text-muted-foreground">{parsed.code}</span>
      </span>
    )
  }

  const fieldChanged = (field: keyof DetailFormValues): boolean => {
    if (!detailSnapshot) return false
    const currentValue = `${watchDetail(field) ?? ''}`
    const oldValue = `${detailSnapshot[field] ?? ''}`
    return currentValue !== oldValue
  }

  const oldValueHint = (field: keyof DetailFormValues) => {
    if (!isEditingDetails || !fieldChanged(field) || !detailSnapshot) return null
    const snapshotValue = detailSnapshot[field]
    let oldValue = 'Not assigned'

    if (Array.isArray(snapshotValue)) {
      if (snapshotValue.length === 0) {
        oldValue = 'Not assigned'
      } else if (field === 'companyIds') {
        oldValue = snapshotValue.map((id) => companyById.get(id) ?? id).join(', ')
      } else if (field === 'facilityIds') {
        oldValue = snapshotValue.map((id) => facilityById.get(id) ?? id).join(', ')
      } else {
        oldValue = snapshotValue.join(', ')
      }
    } else {
      oldValue = `${snapshotValue ?? ''}` || 'Not assigned'
    }

    return <p className="text-xs text-muted-foreground">Previous: {oldValue}</p>
  }

  const createFacilityOptions = useMemo(() => facilities, [facilities])

  const detailFacilityOptions = useMemo(() => facilities, [facilities])

  const companyById = useMemo(() => {
    const map = new Map<string, string>()
    companies.forEach((company) => map.set(company.id, company.label))
    return map
  }, [companies])

  const facilityById = useMemo(() => {
    const map = new Map<string, string>()
    facilities.forEach((facility) => map.set(facility.id, facility.label))
    return map
  }, [facilities])

  const companyIdByFacilityId = useMemo(() => {
    const map = new Map<string, string>()
    facilities.forEach((facility) => {
      if (facility.companyId) {
        map.set(facility.id, facility.companyId)
      }
    })
    return map
  }, [facilities])

  const facilityIdsByCompanyId = useMemo(() => {
    const map = new Map<string, string[]>()
    facilities.forEach((facility) => {
      if (!facility.companyId) return
      const list = map.get(facility.companyId) ?? []
      list.push(facility.id)
      map.set(facility.companyId, list)
    })
    return map
  }, [facilities])

  const derivedAccountIdsByUserId = useMemo(() => {
    const map = new Map<string, string[]>()

    users.forEach((row) => {
      const accountIds = new Set((row.company_ids ?? []).filter(Boolean))

      if (isScopedOpsRole(row.role_code ?? 'CLIENT')) {
        ;(row.facility_ids ?? []).forEach((facilityId) => {
          const companyId = companyIdByFacilityId.get(facilityId)
          if (companyId) {
            accountIds.add(companyId)
          }
        })
      }

      map.set(row.id, Array.from(accountIds))
    })

    return map
  }, [companyIdByFacilityId, users])

  const derivedFacilityIdsByUserId = useMemo(() => {
    const map = new Map<string, string[]>()

    users.forEach((row) => {
      const facilityIds = new Set((row.facility_ids ?? []).filter(Boolean))

      if (row.role_code === 'CLIENT') {
        const derivedAccountIds = derivedAccountIdsByUserId.get(row.id) ?? []
        derivedAccountIds.forEach((companyId) => {
          const companyFacilityIds = facilityIdsByCompanyId.get(companyId) ?? []
          companyFacilityIds.forEach((facilityId) => facilityIds.add(facilityId))
        })
      }

      map.set(row.id, Array.from(facilityIds))
    })

    return map
  }, [derivedAccountIdsByUserId, facilityIdsByCompanyId, users])

  const companyFilterOptions = useMemo(
    () => [{ value: 'ALL', label: 'All accounts' }, ...companies.map((company) => ({ value: company.id, label: company.label }))],
    [companies],
  )

  const facilityFilterOptions = useMemo(() => {
    if (companyFilter === 'ALL') {
      return [{ value: 'ALL', label: 'Select account first' }]
    }

    return [
      { value: 'ALL', label: 'All sites' },
      ...facilities
        .filter((facility) => facility.companyId === companyFilter)
        .map((facility) => ({ value: facility.id, label: facility.label })),
    ]
  }, [companyFilter, facilities])

  const notifySelfSelectionBlocked = () => {
    const now = Date.now()
    if (now - lastSelfSelectToastAtRef.current < 1400) return
    lastSelfSelectToastAtRef.current = now
    toast.info('You cannot select your own account.')
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const selectedFacilityCompanyId = facilityFilter === 'ALL' ? null : (companyIdByFacilityId.get(facilityFilter) ?? null)

    return users.filter((row) => {
      const derivedAccountIds = derivedAccountIdsByUserId.get(row.id) ?? []
      const derivedFacilityIds = derivedFacilityIdsByUserId.get(row.id) ?? []
      const hasScopeFilter = companyFilter !== 'ALL' || facilityFilter !== 'ALL'

      if (roleFilter !== 'ALL' && row.role_code !== roleFilter) return false
      if (statusFilter === 'ACTIVE' && !row.is_active) return false
      if (statusFilter === 'INACTIVE' && row.is_active) return false
      if (hasScopeFilter && (row.role_code === 'L4' || row.role_code === 'L5')) return false
      if (companyFilter !== 'ALL' && !derivedAccountIds.includes(companyFilter)) return false

      if (facilityFilter !== 'ALL') {
        const hasDirectOrDerivedFacility = derivedFacilityIds.includes(facilityFilter)
        const hasMappedAccountFromSelectedSite = Boolean(selectedFacilityCompanyId && derivedAccountIds.includes(selectedFacilityCompanyId))

        if (!hasDirectOrDerivedFacility && !hasMappedAccountFromSelectedSite) {
          return false
        }
      }

      if (!query) return true

      const companyText = derivedAccountIds.map((id) => companyById.get(id) ?? id).join(' ')
      const facilityText = derivedFacilityIds.map((id) => facilityById.get(id) ?? id).join(' ')
      const statusText = row.is_active ? 'active' : 'inactive'

      return [row.user_id, row.full_name, row.email, row.phone ?? '', row.role_title ?? '', row.role_code ?? '', companyText, facilityText, statusText]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [companyById, companyFilter, companyIdByFacilityId, derivedAccountIdsByUserId, derivedFacilityIdsByUserId, facilityById, facilityFilter, roleFilter, search, statusFilter, users])

  const sortedUsers = useMemo(() => {
    const rows = [...filteredUsers]

    rows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      if (sortKey === 'created_at') {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction
      }

      if (sortKey === 'is_active') {
        const av = a.is_active ? 1 : 0
        const bv = b.is_active ? 1 : 0
        return (av - bv) * direction
      }

      const av = `${a[sortKey] ?? ''}`.toLowerCase()
      const bv = `${b[sortKey] ?? ''}`.toLowerCase()
      return av.localeCompare(bv) * direction
    })

    return rows
  }, [filteredUsers, sortDirection, sortKey])

  const totalUserPages = Math.max(1, Math.ceil(sortedUsers.length / userPageSize))
  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize
    return sortedUsers.slice(start, start + userPageSize)
  }, [sortedUsers, userPage, userPageSize])
  const pageUserIds = useMemo(
    () => pagedUsers.filter((row) => row.id !== currentUser?.id).map((row) => row.id),
    [currentUser?.id, pagedUsers],
  )

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const toggleUserSelection = (rowId: string) => {
    if (rowId === currentUser?.id) {
      notifySelfSelectionBlocked()
      return
    }

    setSelectedUserIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]))
  }

  const onSelectUserRow = (rowId: string, options: { shift: boolean; multi: boolean }) => {
    if (rowId === currentUser?.id) {
      notifySelfSelectionBlocked()
      return
    }

    const selectableRows = pagedUsers.filter((row) => row.id !== currentUser?.id)
    const selectableIndex = selectableRows.findIndex((row) => row.id === rowId)

    if (selectableIndex === -1) {
      return
    }

    if (options.shift && lastSelectedRowIndex !== null) {
      const start = Math.min(lastSelectedRowIndex, selectableIndex)
      const end = Math.max(lastSelectedRowIndex, selectableIndex)
      const rangeIds = selectableRows.slice(start, end + 1).map((row) => row.id)

      setSelectedUserIds((prev) => {
        if (options.multi) {
          return Array.from(new Set([...prev, ...rangeIds]))
        }
        return rangeIds
      })
      return
    }

    if (options.multi) {
      toggleUserSelection(rowId)
      setLastSelectedRowIndex(selectableIndex)
      return
    }

    setSelectedUserIds([rowId])
    setLastSelectedRowIndex(selectableIndex)
  }

  const selectedUsers = useMemo(
    () => sortedUsers.filter((row) => selectedUserIds.includes(row.id)),
    [selectedUserIds, sortedUsers],
  )
  const eligibleFilteredUsers = useMemo(
    () => sortedUsers.filter((row) => row.id !== currentUser?.id),
    [currentUser?.id, sortedUsers],
  )
  const allPageSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selectedUserIds.includes(id))
  const allFilteredSelected = eligibleFilteredUsers.length > 0 && eligibleFilteredUsers.every((row) => selectedUserIds.includes(row.id))
  const canSelectFiltered = allPageSelected && !allFilteredSelected && eligibleFilteredUsers.length > pageUserIds.length

  const onTogglePageSelection = () => {
    setSelectedUserIds((prev) => {
      if (allPageSelected) {
        return prev.filter((id) => !pageUserIds.includes(id))
      }

      return Array.from(new Set([...prev, ...pageUserIds]))
    })
  }

  const onSelectFilteredUsers = () => {
    const filteredIds = eligibleFilteredUsers.map((row) => row.id)
    if (filteredIds.length < sortedUsers.length) {
      notifySelfSelectionBlocked()
    }
    setSelectedUserIds(filteredIds)
  }

  const summarizeAssignments = (ids: string[], labelById: Map<string, string>, fallback: string) => {
    if (ids.length === 0) return '-'
    const labels = ids.map((id) => labelById.get(id) ?? fallback)
    if (labels.length <= 2) return labels.join(', ')
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  }

  const onBulkToggleUsers = async (isActive: boolean) => {
    const targets = selectedUsers.filter((row) => !(currentUser?.id === row.id && !isActive))
    if (targets.length === 0) {
      toast.error('No eligible users selected for this action.')
      return
    }

    try {
      await Promise.all(targets.map((row) => toggleUserMutation.mutateAsync({ userId: row.id, isActive, expectedUpdatedAt: row.updated_at })))
      toast.success(isActive ? 'Selected users activated.' : 'Selected users deactivated.')
      setSelectedUserIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update selected user statuses.'))
    }
  }

  const onOpenBulkActionConfirm = (isActive: boolean) => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected.')
      return
    }

    setPendingBulkAction(isActive ? 'activate' : 'deactivate')
  }

  const onConfirmBulkAction = async () => {
    if (!pendingBulkAction || toggleUserMutation.isPending) return
    await onBulkToggleUsers(pendingBulkAction === 'activate')
    setPendingBulkAction(null)
    await refetch()
  }

  const detailReadOnlyClass = !isEditingDetails ? 'cursor-not-allowed opacity-70 pointer-events-none focus-visible:ring-0' : ''

  const accountOptions = useMemo(
    () => companies.map((company) => ({ value: company.id, label: company.label })),
    [companies],
  )

  const createSiteSelectOptions = useMemo(
    () => createFacilityOptions.map((facility) => ({
      value: facility.id,
      label: `${facility.label} - ${companyById.get(facility.companyId ?? '') ?? 'Unknown account'}`,
      searchText: `${facility.id} ${facility.label} ${companyById.get(facility.companyId ?? '') ?? ''}`,
    })),
    [companyById, createFacilityOptions],
  )

  const detailSiteSelectOptions = useMemo(
    () => detailFacilityOptions.map((facility) => ({
      value: facility.id,
      label: `${facility.label} - ${companyById.get(facility.companyId ?? '') ?? 'Unknown account'}`,
      searchText: `${facility.id} ${facility.label} ${companyById.get(facility.companyId ?? '') ?? ''}`,
    })),
    [companyById, detailFacilityOptions],
  )

  const removeOne = (source: string[], value: string) => source.filter((item) => item !== value)

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setCreateStep(1)
    resetCreate({
      roleCode: 'L1',
      fullName: '',
      email: '',
      countryCode: detectPreferredDialCode(),
      phoneLocal: '',
      roleTitle: roleTitleByCode.L1,
      companyIds: [],
      facilityIds: [],
    })
  }

  const openCreateModal = () => {
    closeCreateModal()
    setIsCreateOpen(true)
  }

  const onNextCreateStep = async () => {
    const valid = await triggerCreate(['roleCode', 'fullName', 'email', 'countryCode', 'phoneLocal'])
    if (!valid) return

    const email = watchCreate('email').trim().toLowerCase()
    const phone = normalizePhone(watchCreate('countryCode'), watchCreate('phoneLocal'))

    const duplicateEmail = users.find((row) => row.email.trim().toLowerCase() === email)
    if (duplicateEmail) {
      toast.error(`Email already exists for user ${duplicateEmail.user_id}.`)
      return
    }

    const duplicatePhone = users.find((row) => (row.phone ?? '').replace(/\s|-/g, '') === phone)
    if (duplicatePhone) {
      toast.error(`Phone already exists for user ${duplicatePhone.user_id}.`)
      return
    }

    const roleCode = watchCreate('roleCode')
    setCreateValue('roleTitle', roleTitleByCode[roleCode])
    setCreateStep(2)
  }

  const onCreateUser = async (values: CreateFormValues) => {
    if (createStep !== 2) {
      return
    }

    try {
      const phone = normalizePhone(values.countryCode, values.phoneLocal)
      await createUserMutation.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone,
        roleCode: values.roleCode,
        roleTitle: values.roleTitle,
        companyIds: values.roleCode === 'CLIENT' ? (values.companyIds ?? []) : [],
        facilityIds: isScopedOpsRole(values.roleCode) ? (values.facilityIds ?? []) : [],
      })
      toast.success('User created successfully. Initial password is set to phone number.')
      closeCreateModal()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Create user failed.'))
    }
  }

  const openUserDetails = (row: AdminUserRow) => {
    const split = splitPhone(row.phone)
    setSelectedUser(row)
    const nextValues: DetailFormValues = {
      fullName: row.full_name,
      email: row.email,
      countryCode: split.countryCode,
      phoneLocal: split.phoneLocal,
      roleCode: row.role_code ?? 'L1',
      roleTitle: row.role_title ?? roleTitleByCode[row.role_code ?? 'L1'],
      companyIds: row.company_ids ?? (row.company_id ? [row.company_id] : []),
      facilityIds: row.facility_ids ?? (row.facility_id ? [row.facility_id] : []),
    }

    resetDetail(nextValues)
    setDetailSnapshot(nextValues)
    setAvatarDraft(buildAvatarDraftFromUrl(row.avatar_url))
    setIsEditingDetails(false)
  }

  const onSaveUserDetails = async (values: DetailFormValues) => {
    if (!selectedUser) return

    try {
      if (!hasUnsavedDetailChanges) {
        setIsEditingDetails(false)
        return
      }

      let nextUpdatedAt = selectedUser.updated_at
      let nextAvatarUrl = selectedUser.avatar_url

      if (detailIsDirty) {
        const phone = normalizePhone(values.countryCode, values.phoneLocal)
        const detailResult = await updateUserMutation.mutateAsync({
          userId: selectedUser.id,
          email: values.email,
          fullName: values.fullName,
          phone,
          expectedUpdatedAt: nextUpdatedAt,
          roleCode: values.roleCode,
          roleTitle: values.roleTitle,
          companyIds: values.roleCode === 'CLIENT' ? (values.companyIds ?? []) : [],
          facilityIds: isScopedOpsRole(values.roleCode) ? (values.facilityIds ?? []) : [],
        })

        nextUpdatedAt = detailResult.updated_at

        const nextSnapshot: DetailFormValues = {
          ...values,
          companyIds: values.companyIds ?? [],
          facilityIds: values.facilityIds ?? [],
        }

        setDetailSnapshot(nextSnapshot)
        resetDetail(nextSnapshot)
      }

      if (avatarDirty) {
        const avatarBlob = avatarDraft.markedForRemoval
          ? null
          : await buildAvatarBlobFromDraft(avatarDraft)

        const avatarResult = await updateUserAvatarMutation.mutateAsync({
          userId: selectedUser.id,
          avatarBlob,
          expectedUpdatedAt: nextUpdatedAt,
        })

        nextUpdatedAt = avatarResult.updated_at
        nextAvatarUrl = avatarResult.avatar_url
      }

      setSelectedUser((prev) => (prev && prev.id === selectedUser.id
        ? {
          ...prev,
          avatar_url: nextAvatarUrl,
          updated_at: nextUpdatedAt,
        }
        : prev))
      setAvatarDraft(buildAvatarDraftFromUrl(nextAvatarUrl))
      setIsEditingDetails(false)
      toast.success('User updated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update user.'))
    }
  }

  const runDiscardAction = () => {
    if (pendingDiscardAction === 'close') {
      setSelectedUser(null)
      setIsEditingDetails(false)
      setIsAvatarEditorOpen(false)
      setAvatarEditorDraft(null)
      setAvatarEditorImageSize(null)
      setAvatarDraft(defaultAvatarDraft)
    }

    if (pendingDiscardAction === 'cancel-edit') {
      if (detailSnapshot) {
        resetDetail(detailSnapshot)
      }
      if (selectedUser) {
        setAvatarDraft(buildAvatarDraftFromUrl(selectedUser.avatar_url))
      } else {
        setAvatarDraft(defaultAvatarDraft)
      }
      setIsAvatarEditorOpen(false)
      setAvatarEditorDraft(null)
      setAvatarEditorImageSize(null)
      setIsEditingDetails(false)
    }

    setPendingDiscardAction(null)
    setIsDiscardConfirmOpen(false)
  }

  const requestDiscardConfirmation = (action: 'close' | 'cancel-edit') => {
    setPendingDiscardAction(action)
    setIsDiscardConfirmOpen(true)
  }

  const onAttemptCloseDetails = () => {
    if (isEditingDetails && hasUnsavedDetailChanges) {
      requestDiscardConfirmation('close')
      return
    }

    setSelectedUser(null)
    setIsEditingDetails(false)
    setIsAvatarEditorOpen(false)
    setAvatarEditorDraft(null)
    setAvatarEditorImageSize(null)
    setAvatarDraft(defaultAvatarDraft)
  }

  const onOpenUserStatusConfirm = (row: AdminUserRow, nextIsActive: boolean) => {
    if (toggleUserMutation.isPending) return

    if (!nextIsActive && currentUser?.id === row.id) {
      toast.error('You cannot deactivate your own account.')
      return
    }

    setPendingUserStatusAction({ user: row, nextIsActive })
  }

  const onConfirmUserStatusAction = async () => {
    if (!pendingUserStatusAction || toggleUserMutation.isPending) return

    const { user, nextIsActive } = pendingUserStatusAction

    try {
      await toggleUserMutation.mutateAsync({ userId: user.id, isActive: nextIsActive, expectedUpdatedAt: user.updated_at })
      setSelectedUser((prev) => (prev && prev.id === user.id ? { ...prev, is_active: nextIsActive } : prev))
      await refetch()
      toast.success(nextIsActive ? 'User activated.' : 'User deactivated.')
      setPendingUserStatusAction(null)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update user status.'))
    }
  }

  const onResetPasswordToPhone = async (row: AdminUserRow) => {
    try {
      await resetPasswordMutation.mutateAsync({ userId: row.id })
      toast.success('Password reset to the user phone number.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to reset password for this user.'))
    }
  }

  const onSelectDetailAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedUser) return

    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Select a valid image file.')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image is too large. Use a file under 15MB.')
      event.currentTarget.value = ''
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const nextDraft: AvatarDraft = {
      sourceUrl: objectUrl,
      uploadedObjectUrl: objectUrl,
      hasNewUpload: true,
      markedForRemoval: false,
      zoom: 1,
      panX: 0,
      panY: 0,
    }

    void openAvatarEditorWithDraft(nextDraft)
    event.currentTarget.value = ''
  }

  const onOpenAvatarEditor = () => {
    if (!avatarDraft.sourceUrl || avatarDraft.markedForRemoval) {
      return
    }

    void openAvatarEditorWithDraft({ ...avatarDraft })
  }

  const onRemoveDetailAvatar = () => {
    setAvatarDraft((previous) => {
      if (previous.uploadedObjectUrl) {
        URL.revokeObjectURL(previous.uploadedObjectUrl)
      }

      return {
        ...previous,
        uploadedObjectUrl: null,
        markedForRemoval: true,
        hasNewUpload: false,
        sourceUrl: null,
      }
    })
  }

  const onToggleUserInline = (row: AdminUserRow) => {
    onOpenUserStatusConfirm(row, !row.is_active)
  }

  const onHardDelete = async () => {
    if (!deleteTargetUser) return

    if (deleteConfirmInput.trim() !== deleteTargetUser.user_id) {
      toast.error('Type the exact User ID to confirm deletion.')
      return
    }

    try {
      await hardDeleteUserMutation.mutateAsync({ userId: deleteTargetUser.id })
      toast.success('User permanently deleted.')
      setIsDeleteConfirmOpen(false)
      setDeleteConfirmInput('')
      if (selectedUser?.id === deleteTargetUser.id) {
        setSelectedUser(null)
      }
      setDeleteTargetUser(null)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to permanently delete user.'))
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
    }

    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-foreground" />
      : <ArrowDown className="h-3.5 w-3.5 text-foreground" />
  }

  useEffect(() => {
    if (!selectedUser) return
    const refreshed = users.find((row) => row.id === selectedUser.id)
    if (!refreshed) return

    setSelectedUser(refreshed)

    // Keep read-only details view fresh when another admin edits this user.
    if (!isEditingDetails) {
      const split = splitPhone(refreshed.phone)
      const nextValues: DetailFormValues = {
        fullName: refreshed.full_name,
        email: refreshed.email,
        countryCode: split.countryCode,
        phoneLocal: split.phoneLocal,
        roleCode: refreshed.role_code ?? 'L1',
        roleTitle: refreshed.role_title ?? roleTitleByCode[refreshed.role_code ?? 'L1'],
        companyIds: refreshed.company_ids ?? (refreshed.company_id ? [refreshed.company_id] : []),
        facilityIds: refreshed.facility_ids ?? (refreshed.facility_id ? [refreshed.facility_id] : []),
      }

      setDetailSnapshot(nextValues)
      resetDetail(nextValues)
      setAvatarDraft((previous) => {
        if (previous.uploadedObjectUrl) {
          URL.revokeObjectURL(previous.uploadedObjectUrl)
        }
        return buildAvatarDraftFromUrl(refreshed.avatar_url)
      })
    }
  }, [isEditingDetails, resetDetail, selectedUser, users])

  useEffect(() => {
    return () => {
      if (avatarDraft.uploadedObjectUrl) {
        URL.revokeObjectURL(avatarDraft.uploadedObjectUrl)
      }
    }
  }, [avatarDraft.uploadedObjectUrl])

  useEffect(() => {
    setUserPage(1)
  }, [search, roleFilter, statusFilter, companyFilter, facilityFilter, sortKey, sortDirection, userPageSize])

  useEffect(() => {
    if (userPage > totalUserPages) {
      setUserPage(totalUserPages)
    }
  }, [totalUserPages, userPage])

  useEffect(() => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== currentUser?.id && sortedUsers.some((row) => row.id === id)))
  }, [currentUser?.id, sortedUsers])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const targetUserId = params.get('userId')
    if (!targetUserId) return

    const row = users.find((item) => item.id === targetUserId)
    if (!row) return

    openUserDetails(row)
    params.delete('userId')
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate, users])

  useEffect(() => {
    if (!selectedUser) {
      return
    }

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
    }
  }, [selectedUser])

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader className="sticky top-0 z-20 border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl tracking-tight">Users</CardTitle>
              <CardDescription>Create, search, filter, sort, assign.</CardDescription>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <TooltipIconButton className="h-9 w-9" onClick={openCreateModal} tooltip="Add user" aria-label="Add user">
                <UserPlus className="h-4 w-4" />
              </TooltipIconButton>
              <TooltipIconButton
                className="h-9 w-9"
                onClick={() => {
                  void refetch()
                }}
                tooltip="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </TooltipIconButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" className="pl-9 pr-10" />
              <div className="absolute right-2 top-1.5">
                <TooltipIconButton
                  className="h-7 w-7 border-transparent"
                  tooltip="Search by ID, name, email, phone, role, status, account, or site."
                  aria-label="Search help"
                >
                  <CircleHelp className="h-4 w-4" />
                </TooltipIconButton>
              </div>
            </div>
            <TooltipIconButton
              className={`h-9 w-9 ${isFilterOpen ? 'border-ring/60 bg-muted/60 text-foreground' : ''}`}
              onClick={() => setIsFilterOpen((p) => !p)}
              tooltip="Filters"
              aria-label="Filters"
            >
              <Filter className="h-4 w-4" />
            </TooltipIconButton>
          </div>

          {isFilterOpen ? (
            <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="roleFilter">Role</Label>
                <SearchableSelect
                  value={roleFilter}
                  onChange={(value) => setRoleFilter(value as 'ALL' | RoleCode)}
                  options={roleFilterOptions}
                  placeholder="All roles"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="statusFilter">Status</Label>
                <SearchableSelect
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                  options={statusFilterOptions}
                  placeholder="All status"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="companyFilter">Account</Label>
                <SearchableSelect
                  value={companyFilter}
                  onChange={(value) => {
                    setCompanyFilter(value)
                    setFacilityFilter('ALL')
                  }}
                  options={companyFilterOptions}
                  placeholder="All accounts"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="facilityFilter">Site</Label>
                <SearchableSelect
                  value={facilityFilter}
                  onChange={(value) => setFacilityFilter(value)}
                  options={facilityFilterOptions}
                  placeholder={companyFilter === 'ALL' ? 'Select account' : 'All sites'}
                  disabled={companyFilter === 'ALL'}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="h-9 px-3" onClick={() => { setSearch(''); setRoleFilter('ALL'); setStatusFilter('ALL'); setCompanyFilter('ALL'); setFacilityFilter('ALL') }}>Reset</Button>
              </div>
            </div>
          ) : null}

          {selectedUsers.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5">
              <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <span>{allFilteredSelected ? `All ${eligibleFilteredUsers.length} selected` : `${selectedUsers.length} selected`}</span>
                {canSelectFiltered ? (
                  <Button type="button" variant="link" className="h-auto px-1 text-sm" onClick={onSelectFilteredUsers}>
                    Select all {eligibleFilteredUsers.length}
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <TooltipIconButton
                  onClick={() => {
                    setSelectedUserIds([])
                    setLastSelectedRowIndex(null)
                  }}
                  tooltip="Clear selection"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </TooltipIconButton>
                <TooltipIconButton
                  onClick={() => onOpenBulkActionConfirm(true)}
                  tooltip="Activate selected users"
                  aria-label="Activate selected users"
                  disabled={toggleUserMutation.isPending}
                >
                  <Power className="h-4 w-4" />
                </TooltipIconButton>
                <TooltipIconButton
                  onClick={() => onOpenBulkActionConfirm(false)}
                  tooltip="Deactivate selected users"
                  aria-label="Deactivate selected users"
                  disabled={toggleUserMutation.isPending}
                >
                  <PowerOff className="h-4 w-4" />
                </TooltipIconButton>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-12 p-3 align-middle text-left" aria-label="Select rows">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50"
                        onClick={onTogglePageSelection}
                        aria-label={allPageSelected ? 'Deselect current page' : 'Select current page'}
                      >
                        <input
                          type="checkbox"
                          checked={allPageSelected && pageUserIds.length > 0}
                          onChange={onTogglePageSelection}
                          onClick={(event) => event.stopPropagation()}
                          className="table-select-checkbox"
                          aria-label={allPageSelected ? 'Deselect current page' : 'Select current page'}
                        />
                      </button>
                    </th>
                    <th className="w-[180px] p-3 text-left">
                      <button type="button" onClick={() => onSort('user_id')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'user_id' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        User ID
                        {sortIcon('user_id')}
                      </button>
                    </th>
                    <th className="w-[220px] p-3 text-left">
                      <button type="button" onClick={() => onSort('full_name')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'full_name' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Name
                        {sortIcon('full_name')}
                      </button>
                    </th>
                    <th className="w-[100px] p-3 text-left">
                      <button type="button" onClick={() => onSort('role_code')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'role_code' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Type
                        {sortIcon('role_code')}
                      </button>
                    </th>
                    <th className="w-[100px] p-3 text-left">
                      <button type="button" onClick={() => onSort('is_active')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'is_active' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Status
                        {sortIcon('is_active')}
                      </button>
                    </th>
                    <th className="w-[320px] p-3 text-left">
                      <span className="font-medium text-muted-foreground">Account</span>
                    </th>
                    <th className="w-[220px] p-3 text-left">
                      <span className="font-medium text-muted-foreground">Site</span>
                    </th>
                    <th className="w-[240px] p-3 text-left">
                      <button type="button" onClick={() => onSort('created_at')} className={`inline-flex items-center gap-1 font-medium ${sortKey === 'created_at' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        Created
                        {sortIcon('created_at')}
                      </button>
                    </th>
                    <th className="w-[96px] p-3 text-left" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((row) => (
                    <tr
                      key={row.id}
                      onDoubleClick={() => openUserDetails(row)}
                      onClick={(event) => {
                        if (event.shiftKey || event.ctrlKey || event.metaKey) {
                          onSelectUserRow(row.id, { shift: event.shiftKey, multi: event.ctrlKey || event.metaKey })
                          return
                        }

                        openUserDetails(row)
                      }}
                      className={`group border-b transition-colors ${selectedUserIds.includes(row.id) ? 'bg-muted/25 ring-1 ring-inset ring-border/70' : 'hover:bg-muted/20'}`}
                    >
                      <td className="w-12 p-3 align-middle">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50">
                          {currentUser?.id === row.id ? null : (
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleUserSelection(row.id)
                              }}
                              aria-label={`Select user ${row.user_id}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(row.id)}
                                onChange={() => toggleUserSelection(row.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="table-select-checkbox"
                                aria-label={`Select user ${row.user_id}`}
                              />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        <ThemedHoverText text={row.user_id} className="block truncate" />
                      </td>
                      <td className="p-3" title={row.full_name || 'Unnamed user'}>
                        <span className="inline-flex items-center gap-2">
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt={row.full_name || row.user_id} className="h-6 w-6 rounded-full border border-border object-cover" />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold">
                              {(row.full_name || row.user_id).slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate">{row.full_name || 'Unnamed user'}</span>
                          {currentUser?.id === row.id ? (
                            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">You</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeClass(row.role_code)}`}>
                          {row.role_code ?? '-'}
                        </span>
                      </td>
                      <td className="p-3">{row.is_active ? 'Active' : 'Inactive'}</td>
                      <td
                        className="p-3 text-muted-foreground"
                      >
                        <ThemedHoverText
                          text={(derivedAccountIdsByUserId.get(row.id) ?? []).map((id) => companyById.get(id) ?? 'Unknown account').join(', ') || '-'}
                          className="block truncate"
                        />
                      </td>
                      <td
                        className="p-3 text-muted-foreground"
                      >
                        <ThemedHoverText
                          text={(derivedFacilityIdsByUserId.get(row.id) ?? []).map((id) => facilityById.get(id) ?? 'Unknown site').join(', ') || '-'}
                          className="block truncate"
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <ThemedHoverText text={new Date(row.created_at).toLocaleString()} className="block truncate" />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          <TooltipIconButton
                            onClick={(event) => {
                              event.stopPropagation()
                              openUserDetails(row)
                            }}
                            className="h-8 w-8"
                            tooltip="Open user details"
                            aria-label="Open user details"
                          >
                            <Eye className="h-4 w-4" />
                          </TooltipIconButton>

                          {currentUser?.id !== row.id ? (
                            <>
                              <TooltipIconButton
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onToggleUserInline(row)
                                }}
                                className="h-8 w-8"
                                tooltip={row.is_active ? 'Deactivate user' : 'Activate user'}
                                aria-label={row.is_active ? 'Deactivate user' : 'Activate user'}
                                disabled={toggleUserMutation.isPending}
                              >
                                {row.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </TooltipIconButton>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Showing {pagedUsers.length} of {sortedUsers.length}</p>
            <div className="flex items-center gap-2">
              <PageSizeSelect value={userPageSize} onChange={setUserPageSize} />
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setUserPage((prev) => Math.max(1, prev - 1))} disabled={userPage <= 1}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">{userPage} / {totalUserPages}</span>
              <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setUserPage((prev) => Math.min(totalUserPages, prev + 1))} disabled={userPage >= totalUserPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={closeCreateModal}>
          <Card className="max-h-[90vh] w-full max-w-4xl overflow-visible" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="relative pr-20">
              <div>
                <CardTitle>Create User</CardTitle>
                <CardDescription>Step {createStep} of 2. Password is derived from phone.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={closeCreateModal}
                aria-label="Close"
                className="absolute right-6 top-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[calc(90vh-9rem)] overflow-y-auto">
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                }}
              >
                {createStep === 1 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-roleCode">User Type<RequiredMark /></Label>
                      <SearchableSelect
                        value={createRoleCode}
                        onChange={(value) => {
                          const next = value as RoleCode
                          setCreateValue('roleCode', next, { shouldValidate: true })
                          setCreateValue('roleTitle', roleTitleByCode[next])
                          if (isGlobalRole(next)) {
                            setCreateValue('companyIds', [])
                            setCreateValue('facilityIds', [])
                          } else if (next === 'CLIENT') {
                            setCreateValue('facilityIds', [])
                          } else {
                            setCreateValue('companyIds', [])
                          }
                        }}
                        options={roleOptions}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-fullName">Full Name<RequiredMark /></Label>
                      <Input id="create-fullName" {...registerCreate('fullName')} />
                      {createErrors.fullName ? <p className="text-xs text-destructive">{createErrors.fullName.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-email">Email<RequiredMark /></Label>
                      <Input id="create-email" type="email" {...registerCreate('email')} />
                      {createErrors.email ? <p className="text-xs text-destructive">{createErrors.email.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Phone<RequiredMark /></Label>
                      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
                        <SearchableSelect
                          value={createCountryCode}
                          onChange={(value) => setCreateValue('countryCode', value, { shouldValidate: true })}
                          options={countryPhoneOptions}
                          placeholder="Code"
                          searchPlaceholder="Search country or code"
                          minDropdownWidth={380}
                          renderSelectedLabel={(option) => compactDialLabel(option?.label ?? '')}
                          renderOption={(option) => renderCountryOption(option.label)}
                        />
                        <Input placeholder="Local number" {...registerCreate('phoneLocal')} />
                      </div>
                      <p className="text-xs text-muted-foreground">Spaces and dashes are cleaned automatically.</p>
                      {createErrors.phoneLocal ? <p className="text-xs text-destructive">{createErrors.phoneLocal.message}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-roleTitle">Role Title</Label>
                      <Input id="create-roleTitle" placeholder={roleTitleByCode[createRoleCode]} {...registerCreate('roleTitle')} />
                    </div>
                    {!createRoleIsGlobal ? (
                      <>
                        {createRoleCode === 'CLIENT' ? (
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="create-companyIds">Accounts</Label>
                            <div className="w-full">
                              <SearchableSelect
                                value=""
                                values={watchCreate('companyIds') ?? []}
                                onChange={() => undefined}
                                onValuesChange={(next) => setCreateValue('companyIds', next, { shouldDirty: true })}
                                options={accountOptions}
                                placeholder=""
                                searchPlaceholder="Search account"
                                multiSelect
                                wrapOptions
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(watchCreate('companyIds') ?? []).length > 0 ? (
                                (watchCreate('companyIds') ?? []).map((id) => (
                                  <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-xs">
                                    {companyById.get(id) ?? id}
                                    <button
                                      type="button"
                                      onClick={() => setCreateValue('companyIds', removeOne(watchCreate('companyIds') ?? [], id), { shouldDirty: true })}
                                      aria-label="Remove account"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">No account assigned.</p>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {createCanAssignSites ? (
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="create-facilityIds">Sites</Label>
                          <div className="w-full">
                            <SearchableSelect
                              value=""
                              values={watchCreate('facilityIds') ?? []}
                              onChange={() => undefined}
                              onValuesChange={(next) => setCreateValue('facilityIds', next, { shouldDirty: true })}
                              options={createSiteSelectOptions}
                              placeholder=""
                              searchPlaceholder="Search site"
                              multiSelect
                              wrapOptions
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(watchCreate('facilityIds') ?? []).length > 0 ? (
                              (watchCreate('facilityIds') ?? []).map((id) => (
                                <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-xs">
                                  {facilityById.get(id) ?? id}
                                  <button
                                    type="button"
                                    onClick={() => setCreateValue('facilityIds', removeOne(watchCreate('facilityIds') ?? [], id), { shouldDirty: true })}
                                    aria-label="Remove site"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">No site assigned.</p>
                            )}
                          </div>
                        </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground md:col-span-2">L4/L5 are global users; scope fields are hidden.</p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {createStep === 2 ? <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setCreateStep(1)}>Back</Button> : <span className="text-xs text-muted-foreground">* required fields</span>}
                  {createStep === 1 ? (
                    <Button type="button" className="h-9 px-3" onClick={() => void onNextCreateStep()}>Next</Button>
                  ) : (
                    <Button type="button" className="h-9 px-3" disabled={createUserMutation.isPending} onClick={() => void handleCreateSubmit(onCreateUser)()}>
                      {createUserMutation.isPending ? 'Creating...' : 'Save'}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {selectedUser ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={onAttemptCloseDetails}>
          <aside ref={detailsPaneRef} className="flex h-full w-full max-w-xl flex-col border-l border-border/70 bg-background" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b border-border/70 bg-background px-6 pb-4 pt-6">
              <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">User Details</h2>
                <p className="text-sm text-muted-foreground">View metadata and update editable fields.</p>
              </div>
              <div className="flex items-center gap-2">
                {isEditingDetails ? (
                  <Button
                    variant="outline"
                    className="h-9 px-3"
                    type="button"
                    onClick={() => {
                      if (hasUnsavedDetailChanges) {
                        requestDiscardConfirmation('cancel-edit')
                        return
                      }
                      setIsEditingDetails(false)
                    }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <TooltipIconButton className="h-8 w-8" type="button" onClick={() => setIsEditingDetails(true)} tooltip="Edit user details" aria-label="Edit user details">
                    <Pencil className="h-4 w-4" />
                  </TooltipIconButton>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={onAttemptCloseDetails} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-4">
            <div className="mb-6 grid gap-3 rounded-md border border-border/70 bg-muted/30 p-4 text-sm">
              <div><span className="text-muted-foreground">User ID:</span> <span className="font-medium">{selectedUser.user_id}</span></div>
              <div><span className="text-muted-foreground">Created At:</span> {new Date(selectedUser.created_at).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Last Updated:</span> {new Date(selectedUser.updated_at).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Status:</span> {selectedUser.is_active ? 'Active' : 'Inactive'}</div>
              <div>
                <span className="text-muted-foreground">Accounts:</span>{' '}
                {summarizeAssignments(derivedAccountIdsByUserId.get(selectedUser.id) ?? [], companyById, 'Unknown account')}
              </div>
              <div>
                <span className="text-muted-foreground">Sites:</span>{' '}
                {summarizeAssignments(derivedFacilityIdsByUserId.get(selectedUser.id) ?? [], facilityById, 'Unknown site')}
              </div>
            </div>
            <div className="mb-6 rounded-md border border-border/70 p-4">
              <p className="mb-3 text-sm font-medium">Profile Photo</p>
              <div className="flex flex-wrap items-center gap-4">
                {avatarDraft.sourceUrl && !avatarDraft.markedForRemoval ? (
                  <img src={avatarDraft.sourceUrl} alt={selectedUser.full_name || selectedUser.user_id} className="h-14 w-14 rounded-full border border-border object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted text-base font-semibold">
                    {(selectedUser.full_name || selectedUser.user_id).slice(0, 1).toUpperCase()}
                  </div>
                )}

                {isEditingDetails ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={detailAvatarInputRef}
                      id="detail-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        void onSelectDetailAvatar(event)
                      }}
                      className="hidden"
                    />
                    <TooltipIconButton
                      type="button"
                      onClick={() => detailAvatarInputRef.current?.click()}
                      disabled={updateUserMutation.isPending || updateUserAvatarMutation.isPending}
                      tooltip="Upload photo"
                      aria-label="Upload photo"
                    >
                      <Upload className="h-4 w-4" />
                    </TooltipIconButton>
                    <TooltipIconButton
                      type="button"
                      onClick={onOpenAvatarEditor}
                      disabled={(!avatarDraft.sourceUrl || avatarDraft.markedForRemoval) || updateUserMutation.isPending || updateUserAvatarMutation.isPending}
                      tooltip="Adjust photo"
                      aria-label="Adjust photo"
                    >
                      <Pencil className="h-4 w-4" />
                    </TooltipIconButton>
                    <TooltipIconButton
                      type="button"
                      onClick={() => void onRemoveDetailAvatar()}
                      disabled={(!avatarDraft.sourceUrl && !selectedUser.avatar_url) || updateUserMutation.isPending || updateUserAvatarMutation.isPending}
                      tooltip="Remove photo"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </TooltipIconButton>
                    <TooltipIconButton
                      type="button"
                      onClick={() => {
                        setAvatarDraft((previous) => {
                          if (previous.uploadedObjectUrl) {
                            URL.revokeObjectURL(previous.uploadedObjectUrl)
                          }
                          return buildAvatarDraftFromUrl(selectedUser.avatar_url)
                        })
                      }}
                      disabled={!avatarDirty || updateUserMutation.isPending || updateUserAvatarMutation.isPending}
                      tooltip="Reset photo edits"
                      aria-label="Reset photo edits"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </TooltipIconButton>
                  </div>
                ) : null}
              </div>
            </div>
            {isAvatarEditorOpen && avatarEditorDraft?.sourceUrl ? (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" onClick={() => closeAvatarEditor()}>
                <Card className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-base">Adjust Photo</CardTitle>
                    <CardDescription>Drag to move. Pinch or Ctrl+scroll to zoom.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      ref={avatarEditorViewportRef}
                      tabIndex={0}
                      className="relative mx-auto h-80 w-80 cursor-grab overflow-hidden rounded-full border border-border bg-muted/40 outline-none active:cursor-grabbing"
                      onWheel={onAvatarEditorWheel}
                      onPointerDown={onAvatarEditorPointerDown}
                      onPointerMove={onAvatarEditorPointerMove}
                      onPointerUp={onAvatarEditorPointerUp}
                      onPointerCancel={onAvatarEditorPointerUp}
                      onTouchStart={onAvatarEditorTouchStart}
                      onTouchMove={onAvatarEditorTouchMove}
                      onTouchEnd={onAvatarEditorTouchEnd}
                      onKeyDown={onAvatarEditorKeyDown}
                    >
                      {avatarEditorMetrics ? (
                        <img
                          src={avatarEditorDraft.sourceUrl}
                          alt={selectedUser.full_name || selectedUser.user_id}
                          className="pointer-events-none absolute select-none"
                          draggable={false}
                          style={{
                            width: `${avatarEditorMetrics.drawWidth}px`,
                            height: `${avatarEditorMetrics.drawHeight}px`,
                            left: `${avatarEditorMetrics.left}px`,
                            top: `${avatarEditorMetrics.top}px`,
                            objectFit: 'cover',
                            imageRendering: 'auto',
                          }}
                        />
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      <span>Zoom {Math.round((avatarEditorDraft.zoom ?? 1) * 100)}%</span>
                      <span>Arrows move, +/- zoom</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeAvatarZoom(-0.08)} aria-label="Zoom out">
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgeAvatarZoom(0.08)} aria-label="Zoom in">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => nudgeAvatarPan('x', -6)}>
                        Left
                      </Button>
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => nudgeAvatarPan('x', 6)}>
                        Right
                      </Button>
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => nudgeAvatarPan('y', -6)}>
                        Up
                      </Button>
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => nudgeAvatarPan('y', 6)}>
                        Down
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={() => {
                          setAvatarEditorDraft((previous) => (previous
                            ? {
                              ...previous,
                              zoom: 1,
                              panX: 0,
                              panY: 0,
                            }
                            : previous))
                        }}
                      >
                        Reset
                      </Button>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" className="h-9 px-3" onClick={closeAvatarEditor}>
                        Cancel
                      </Button>
                      <Button type="button" className="h-9 px-3" onClick={applyAvatarEditor} disabled={!avatarEditorImageSize}>
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
            {isAvatarEditorConfirmOpen ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4">
                <Card className="w-full max-w-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Discard Changes?</CardTitle>
                    <CardDescription>You have unsaved adjustments to the photo. Do you want to discard them?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 px-3"
                        onClick={() => setIsAvatarEditorConfirmOpen(false)}
                      >
                        Keep Editing
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-9 px-3"
                        onClick={() => {
                          setIsAvatarEditorConfirmOpen(false)
                          setIsAvatarEditorOpen(false)
                          setAvatarEditorImageSize(null)
                          setAvatarEditorDraft((previous) => {
                            if (previous?.uploadedObjectUrl && previous.uploadedObjectUrl !== avatarDraft.uploadedObjectUrl) {
                              URL.revokeObjectURL(previous.uploadedObjectUrl)
                            }
                            return null
                          })
                        }}
                      >
                        Discard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleDetailSubmit(onSaveUserDetails)}>
              <div className="space-y-2">
                <Label htmlFor="detail-fullName">Full Name<RequiredMark /></Label>
                <Input id="detail-fullName" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('fullName')} />
                {oldValueHint('fullName')}
                {detailErrors.fullName ? <p className="text-xs text-destructive">{detailErrors.fullName.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-email">Email<RequiredMark /></Label>
                <Input id="detail-email" type="email" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('email')} />
                {oldValueHint('email')}
                {detailErrors.email ? <p className="text-xs text-destructive">{detailErrors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Phone<RequiredMark /></Label>
                <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
                  <SearchableSelect
                    value={detailCountryCode}
                    onChange={(value) => setDetailValue('countryCode', value, { shouldValidate: true })}
                    options={countryPhoneOptions}
                    className={detailReadOnlyClass}
                    placeholder="Code"
                    searchPlaceholder="Search country or code"
                    minDropdownWidth={380}
                    renderSelectedLabel={(option) => compactDialLabel(option?.label ?? '')}
                    renderOption={(option) => renderCountryOption(option.label)}
                    disabled={!isEditingDetails}
                  />
                  <Input placeholder="Local number" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('phoneLocal')} />
                </div>
                {oldValueHint('countryCode')}
                {oldValueHint('phoneLocal')}
                {detailErrors.phoneLocal ? <p className="text-xs text-destructive">{detailErrors.phoneLocal.message}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="detail-roleCode">User Type<RequiredMark /></Label>
                  <SearchableSelect
                    value={detailRoleCode}
                    onChange={(value) => {
                      if (!isEditingDetails) return
                      const next = value as RoleCode
                      setDetailValue('roleCode', next, { shouldValidate: true })
                      setDetailValue('roleTitle', roleTitleByCode[next])
                      if (isGlobalRole(next)) {
                        setDetailValue('companyIds', [])
                        setDetailValue('facilityIds', [])
                      } else if (next === 'CLIENT') {
                        setDetailValue('facilityIds', [])
                      } else {
                        setDetailValue('companyIds', [])
                      }
                    }}
                    className={detailReadOnlyClass}
                    options={roleOptions}
                    disabled={!isEditingDetails}
                  />
                  {oldValueHint('roleCode')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detail-roleTitle">Role Title<RequiredMark /></Label>
                  <Input id="detail-roleTitle" className={detailReadOnlyClass} readOnly={!isEditingDetails} {...registerDetail('roleTitle')} />
                  {oldValueHint('roleTitle')}
                  {detailErrors.roleTitle ? <p className="text-xs text-destructive">{detailErrors.roleTitle.message}</p> : null}
                </div>
              </div>
              {!detailRoleIsGlobal ? (
                <div className="space-y-4">
                  {detailRoleCode === 'CLIENT' ? (
                    <div className="space-y-2">
                      <Label htmlFor="detail-companyIds">Accounts</Label>
                      <div className="w-full">
                        <SearchableSelect
                          value=""
                          values={detailCompanyIds ?? []}
                          onChange={() => undefined}
                          onValuesChange={(next) => {
                            if (!isEditingDetails) return
                            setDetailValue('companyIds', next, { shouldDirty: true })
                          }}
                          options={accountOptions}
                          className={detailReadOnlyClass}
                          placeholder=""
                          searchPlaceholder="Search account"
                          disabled={!isEditingDetails}
                          multiSelect
                          wrapOptions
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(detailCompanyIds ?? []).length > 0 ? (
                          (detailCompanyIds ?? []).map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-xs">
                              {companyById.get(id) ?? id}
                              {isEditingDetails ? (
                                <button
                                  type="button"
                                  onClick={() => setDetailValue('companyIds', removeOne(detailCompanyIds ?? [], id), { shouldDirty: true })}
                                  aria-label="Remove account"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No account assigned.</p>
                        )}
                      </div>
                      {oldValueHint('companyIds')}
                    </div>
                  ) : null}

                  {detailCanAssignSites ? (
                  <div className="space-y-2">
                    <Label htmlFor="detail-facilityIds">Sites</Label>
                    <div className="w-full">
                      <SearchableSelect
                        value=""
                        values={detailFacilityIds ?? []}
                        onChange={() => undefined}
                        onValuesChange={(next) => {
                          if (!isEditingDetails) return
                          setDetailValue('facilityIds', next, { shouldDirty: true })
                        }}
                        options={detailSiteSelectOptions}
                        className={detailReadOnlyClass}
                        placeholder=""
                        searchPlaceholder="Search site"
                        disabled={!isEditingDetails}
                        multiSelect
                        wrapOptions
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(detailFacilityIds ?? []).length > 0 ? (
                        (detailFacilityIds ?? []).map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-xs">
                            {facilityById.get(id) ?? id}
                            {isEditingDetails ? (
                              <button
                                type="button"
                                onClick={() => setDetailValue('facilityIds', removeOne(detailFacilityIds ?? [], id), { shouldDirty: true })}
                                aria-label="Remove site"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            ) : null}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No site assigned.</p>
                      )}
                    </div>
                    {oldValueHint('facilityIds')}
                  </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="h-9 px-3"
                  disabled={!isEditingDetails || !hasUnsavedDetailChanges || updateUserMutation.isPending || updateUserAvatarMutation.isPending}
                >
                  {updateUserMutation.isPending || updateUserAvatarMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
            {!isSelfSelected ? (
              <div className="mt-8 space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="text-sm font-semibold">User Lifecycle Actions</h3>
                <p className="text-xs text-muted-foreground">Deactivate for leavers. Permanent delete for mistaken users only.</p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="h-9 px-3"
                    variant="outline"
                    onClick={() => void onResetPasswordToPhone(selectedUser)}
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset PW'}
                  </Button>
                  <Button
                    className="h-9 px-3"
                    variant={selectedUser.is_active ? 'destructive' : 'secondary'}
                    onClick={() => onOpenUserStatusConfirm(selectedUser, !selectedUser.is_active)}
                    disabled={toggleUserMutation.isPending}
                  >
                    {selectedUser.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => {
                      setDeleteTargetUser(selectedUser)
                      setDeleteConfirmInput('')
                      setIsDeleteConfirmOpen(true)
                    }}
                    disabled={hardDeleteUserMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                <span className="mr-2 inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium">You</span>
                Self actions are hidden.
              </div>
            )}

            {isDiscardConfirmOpen ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDiscardConfirmOpen(false)}>
                <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-base">Discard Unsaved Changes?</CardTitle>
                    <CardDescription>You have unsaved edits. If you exit now, those changes will be lost.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-end gap-2">
                    <Button variant="outline" className="h-9 px-3" onClick={() => setIsDiscardConfirmOpen(false)}>
                      Keep
                    </Button>
                    <Button variant="destructive" className="h-9 px-3" onClick={runDiscardAction}>
                      Discard
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : null}
            </div>

          </aside>
        </div>
      ) : null}

      {isDeleteConfirmOpen && deleteTargetUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
                <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="text-base">Confirm Permanent Delete</CardTitle>
                    <CardDescription>
                      Type <span className="font-medium">{deleteTargetUser.user_id}</span> to permanently delete this user.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input value={deleteConfirmInput} onChange={(event) => setDeleteConfirmInput(event.target.value)} placeholder="Enter User ID" />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteConfirmOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-9 px-3"
                        onClick={() => void onHardDelete()}
                        disabled={hardDeleteUserMutation.isPending || deleteConfirmInput.trim() !== deleteTargetUser.user_id}
                      >
                        {hardDeleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
        </div>
      ) : null}

      {pendingBulkAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingBulkAction(null)}>
          <Card
            className={`w-full max-w-md bg-card ${pendingBulkAction === 'deactivate' ? 'border-destructive/50' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-base ${pendingBulkAction === 'deactivate' ? 'text-destructive' : ''}`}>
                {pendingBulkAction === 'deactivate' ? <AlertTriangle className="h-4 w-4" /> : null}
                Confirm Bulk {pendingBulkAction === 'activate' ? 'Activation' : 'Deactivation'}
              </CardTitle>
              <CardDescription>
                {pendingBulkAction === 'deactivate'
                  ? `This will deactivate ${selectedUsers.length} users and block access.`
                  : `This will activate ${selectedUsers.length} users.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" className="h-9 px-3" onClick={() => setPendingBulkAction(null)} disabled={toggleUserMutation.isPending}>
                Cancel
              </Button>
              <Button
                className="h-9 px-3"
                variant={pendingBulkAction === 'deactivate' ? 'destructive' : 'default'}
                onClick={() => void onConfirmBulkAction()}
                disabled={toggleUserMutation.isPending}
              >
                {toggleUserMutation.isPending ? 'Updating...' : 'Confirm'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {pendingUserStatusAction ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (toggleUserMutation.isPending) return
            setPendingUserStatusAction(null)
          }}
        >
          <Card
            className={`w-full max-w-md bg-card ${pendingUserStatusAction.nextIsActive ? '' : 'border-destructive/50'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-base ${pendingUserStatusAction.nextIsActive ? '' : 'text-destructive'}`}>
                {pendingUserStatusAction.nextIsActive ? null : <AlertTriangle className="h-4 w-4" />}
                Confirm {pendingUserStatusAction.nextIsActive ? 'Activation' : 'Deactivation'}
              </CardTitle>
              <CardDescription>
                {pendingUserStatusAction.nextIsActive
                  ? `This will activate ${pendingUserStatusAction.user.full_name || pendingUserStatusAction.user.user_id}.`
                  : `This will deactivate ${pendingUserStatusAction.user.full_name || pendingUserStatusAction.user.user_id} and block access.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="h-9 px-3"
                onClick={() => setPendingUserStatusAction(null)}
                disabled={toggleUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="h-9 px-3"
                variant={pendingUserStatusAction.nextIsActive ? 'default' : 'destructive'}
                onClick={() => void onConfirmUserStatusAction()}
                disabled={toggleUserMutation.isPending}
              >
                {toggleUserMutation.isPending ? 'Updating...' : 'Confirm'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  )
}
