import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2, X, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TooltipIconButton } from '@/components/ui/tooltip-icon-button'
import {
  useAdminFacilityMembers,
  useAssignFacilityUsers,
  useHardDeleteFacility,
  useRemoveFacilityUser,
  useToggleFacilityActive,
  useUpdateFacility,
} from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const facilityDetailsSchema = z.object({
  facilityName: z.string().min(2, 'Facility name is required.'),
  addressLine1: z.string().min(5, 'Address is required.'),
  city: z.string().min(2, 'City is required.'),
  state: z.string().min(2, 'State is required.'),
  country: z.string().min(2, 'Country is required.'),
})

type FacilityDetailsFormValues = z.infer<typeof facilityDetailsSchema>

export default function FacilityDetailsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ companyId: string; facilityId: string }>()
  const companyId = params.companyId
  const facilityId = params.facilityId
  const fromState = (location.state as { from?: string } | null)?.from

  const { data: facilityData, isLoading } = useAdminFacilityMembers(facilityId)
  const facility = facilityData?.facility
  const updateFacilityMutation = useUpdateFacility()
  const toggleFacilityMutation = useToggleFacilityActive()
  const deleteFacilityMutation = useHardDeleteFacility()
  const assignFacilityUsersMutation = useAssignFacilityUsers()
  const removeFacilityUserMutation = useRemoveFacilityUser()
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FacilityDetailsFormValues>({
    resolver: zodResolver(facilityDetailsSchema),
    defaultValues: {
      facilityName: '',
      addressLine1: '',
      city: '',
      state: '',
      country: '',
    },
  })

  useEffect(() => {
    if (!facility) return

    reset({
      facilityName: facility.facility_name,
      addressLine1: facility.address_line_1,
      city: facility.city,
      state: facility.state,
      country: facility.country,
    })
    setIsEditing(false)
  }, [facility, reset])

  useEffect(() => {
    setSelectedCandidateIds([])
  }, [facilityId, facilityData?.assignedUsers.length])

  const assignableUsers = (facilityData?.companyAssignableUsers ?? []).filter((user) => !user.assigned)

  const onAssignSelectedUsers = async () => {
    if (!facility || selectedCandidateIds.length === 0) {
      toast.error('Select at least one user to assign.')
      return
    }

    try {
      await assignFacilityUsersMutation.mutateAsync({
        facilityId: facility.id,
        userIds: selectedCandidateIds,
      })
      toast.success('Users assigned to site.')
      setSelectedCandidateIds([])
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to assign selected users.'))
    }
  }

  const onRemoveAssignedUser = async (userId: string) => {
    if (!facility) return

    try {
      await removeFacilityUserMutation.mutateAsync({ facilityId: facility.id, userId })
      toast.success('User removed from site.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to remove user from site.'))
    }
  }

  const onSave = async (values: FacilityDetailsFormValues) => {
    if (!facility) return

    try {
      await updateFacilityMutation.mutateAsync({
        facilityId: facility.id,
        facilityName: values.facilityName,
        addressLine1: values.addressLine1,
        city: values.city,
        state: values.state,
        country: values.country,
      })
      toast.success('Site updated.')
      reset(values)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update site.'))
    }
  }

  const onToggle = async () => {
    if (!facility) return

    try {
      await toggleFacilityMutation.mutateAsync({ facilityId: facility.id, isActive: !facility.is_active })
      toast.success(!facility.is_active ? 'Site enabled.' : 'Site disabled.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update site status.'))
    }
  }

  const onDelete = async () => {
    if (!facility) return

    if (deleteConfirmInput.trim() !== facility.facility_code) {
      toast.error('Type the exact Site ID to confirm deletion.')
      return
    }

    try {
      await deleteFacilityMutation.mutateAsync({ facilityId: facility.id })
      toast.success('Site permanently deleted.')
      setIsDeleteConfirmOpen(false)
      setDeleteConfirmInput('')
      if (fromState) {
        navigate(fromState, { replace: true })
      } else if (companyId) {
        navigate(`/admin/clients/${companyId}`, { replace: true })
      } else if (facility.companies?.[0]?.id) {
        navigate(`/admin/clients/${facility.companies[0].id}`, { replace: true })
      } else {
        navigate('/admin/clients', { replace: true })
      }
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete site.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader className="sticky top-0 z-20 rounded-t-xl border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl tracking-tight">Site Details</CardTitle>
              <CardDescription>
                {facility
                  ? `${facility.facility_code} — ${facility.companies?.[0]?.company_name ?? 'Unknown account'}`
                  : 'Loading site details'}
              </CardDescription>
            </div>
            <button
              type="button"
              className="ml-auto rounded-md p-2 hover:bg-muted/50"
              onClick={() => {
                if (fromState) {
                  navigate(fromState)
                  return
                }
                if (companyId) {
                  navigate(`/admin/clients/${companyId}`)
                  return
                }
                if (facility?.companies?.[0]?.id) {
                  navigate(`/admin/clients/${facility.companies[0].id}`)
                  return
                }
                navigate('/admin/clients')
              }}
              aria-label="Go back"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : facility ? (
            <>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSave)}>
                <div className="md:col-span-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Site metadata</p>
                  {isEditing ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex h-9 items-center gap-2 px-3"
                      onClick={() => {
                        if (!facility) return
                        reset({
                          facilityName: facility.facility_name,
                          addressLine1: facility.address_line_1,
                          city: facility.city,
                          state: facility.state,
                          country: facility.country,
                        })
                        setIsEditing(false)
                      }}
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  ) : (
                    <TooltipIconButton className="h-8 w-8" tooltip="Edit site metadata" onClick={() => setIsEditing(true)}>
                      <Pencil className="h-4 w-4" />
                    </TooltipIconButton>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facilityCode">Facility ID</Label>
                  <Input id="facilityCode" value={facility.facility_code} readOnly className="cursor-not-allowed opacity-70" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facilityStatus">Status</Label>
                  <Input id="facilityStatus" value={facility.is_active ? 'Active' : 'Disabled'} readOnly className="cursor-not-allowed opacity-70" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="facilityName">Name</Label>
                  <Input id="facilityName" readOnly={!isEditing} className={!isEditing ? 'cursor-not-allowed opacity-70' : ''} {...register('facilityName')} />
                  {errors.facilityName ? <p className="text-xs text-destructive">{errors.facilityName.message}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressLine1">Address</Label>
                  <Input id="addressLine1" readOnly={!isEditing} className={!isEditing ? 'cursor-not-allowed opacity-70' : ''} {...register('addressLine1')} />
                  {errors.addressLine1 ? <p className="text-xs text-destructive">{errors.addressLine1.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" readOnly={!isEditing} className={!isEditing ? 'cursor-not-allowed opacity-70' : ''} {...register('city')} />
                  {errors.city ? <p className="text-xs text-destructive">{errors.city.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" readOnly={!isEditing} className={!isEditing ? 'cursor-not-allowed opacity-70' : ''} {...register('state')} />
                  {errors.state ? <p className="text-xs text-destructive">{errors.state.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" readOnly={!isEditing} className={!isEditing ? 'cursor-not-allowed opacity-70' : ''} {...register('country')} />
                  {errors.country ? <p className="text-xs text-destructive">{errors.country.message}</p> : null}
                </div>

                <div className="md:col-span-2 flex flex-wrap justify-between gap-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="h-9 px-3" onClick={onToggle} disabled={toggleFacilityMutation.isPending}>
                      {facility.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3"
                      onClick={() => {
                        setDeleteConfirmInput('')
                        setIsDeleteConfirmOpen(true)
                      }}
                      disabled={deleteFacilityMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                  <Button type="submit" className="h-9 px-3" disabled={!isEditing || !isDirty || updateFacilityMutation.isPending}>
                    {updateFacilityMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Assigned Site Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {facilityData?.assignedUsers.length ? (
                      <div className="space-y-2">
                        {facilityData.assignedUsers.map((user) => (
                          <div
                            key={user.user_id}
                            className="flex cursor-pointer items-center justify-between rounded-md border border-border/70 px-3 py-2 hover:bg-muted/20"
                            onDoubleClick={() => navigate(`/admin/users?userId=${user.user_id}`)}
                          >
                            <div>
                              <p className="text-sm font-medium">{user.full_name}</p>
                              <p className="text-xs text-muted-foreground">{user.employee_id} - {user.role_code}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void onRemoveAssignedUser(user.user_id)}
                              disabled={removeFacilityUserMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No users assigned to this site.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Add Existing Company Users</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assignableUsers.length > 0 ? (
                      <>
                        <div className="max-h-56 space-y-2 overflow-auto pr-1">
                          {assignableUsers.map((user) => (
                            <label key={user.user_id} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedCandidateIds.includes(user.user_id)}
                                onChange={() => {
                                  setSelectedCandidateIds((prev) => (
                                    prev.includes(user.user_id)
                                      ? prev.filter((id) => id !== user.user_id)
                                      : [...prev, user.user_id]
                                  ))
                                }}
                                className="table-select-checkbox"
                              />
                              <span className="text-sm">{user.full_name}</span>
                              <span className="text-xs text-muted-foreground">{user.employee_id} - {user.role_code}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 px-3"
                            onClick={() => setSelectedCandidateIds(assignableUsers.map((user) => user.user_id))}
                          >
                            Select all
                          </Button>
                          <Button
                            type="button"
                            className="h-9 px-3"
                            onClick={() => void onAssignSelectedUsers()}
                            disabled={selectedCandidateIds.length === 0 || assignFacilityUsersMutation.isPending}
                          >
                            {assignFacilityUsersMutation.isPending ? 'Assigning...' : 'Assign selected'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No additional eligible users available.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Site not found.</p>
          )}
        </CardContent>
      </Card>

      {isDeleteConfirmOpen && facility ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Confirm Permanent Delete</CardTitle>
              <CardDescription>Type {facility.facility_code} to permanently delete this site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                placeholder="Enter Facility ID"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setIsDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 px-3"
                  onClick={() => void onDelete()}
                  disabled={deleteFacilityMutation.isPending || deleteConfirmInput.trim() !== facility.facility_code}
                >
                  {deleteFacilityMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  )
}
