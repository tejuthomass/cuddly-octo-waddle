import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useAdminFacility,
  useHardDeleteFacility,
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
  const params = useParams<{ facilityId: string }>()
  const facilityId = params.facilityId

  const { data: facility, isLoading } = useAdminFacility(facilityId)
  const updateFacilityMutation = useUpdateFacility()
  const toggleFacilityMutation = useToggleFacilityActive()
  const deleteFacilityMutation = useHardDeleteFacility()
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')

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
  }, [facility, reset])

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
      toast.success('Facility updated.')
      reset(values)
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update facility.'))
    }
  }

  const onToggle = async () => {
    if (!facility) return

    try {
      await toggleFacilityMutation.mutateAsync({ facilityId: facility.id, isActive: !facility.is_active })
      toast.success(!facility.is_active ? 'Facility enabled.' : 'Facility disabled.')
      navigate('/admin/clients')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update facility status.'))
    }
  }

  const onDelete = async () => {
    if (!facility) return

    if (deleteConfirmInput.trim() !== facility.facility_code) {
      toast.error('Type the exact Facility ID to confirm deletion.')
      return
    }

    try {
      await deleteFacilityMutation.mutateAsync({ facilityId: facility.id })
      toast.success('Facility permanently deleted.')
      setIsDeleteConfirmOpen(false)
      setDeleteConfirmInput('')
      navigate('/admin/clients')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to delete facility.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Facility</CardTitle>
              <CardDescription>
                {facility
                  ? `${facility.facility_code} - ${facility.companies?.[0]?.company_name ?? 'Unknown client'}`
                  : 'Edit facility details'}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="h-9 px-3" onClick={() => navigate('/admin/clients')}>
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : facility ? (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSave)}>
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
                <Input id="facilityName" {...register('facilityName')} />
                {errors.facilityName ? <p className="text-xs text-destructive">{errors.facilityName.message}</p> : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine1">Address</Label>
                <Input id="addressLine1" {...register('addressLine1')} />
                {errors.addressLine1 ? <p className="text-xs text-destructive">{errors.addressLine1.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
                {errors.city ? <p className="text-xs text-destructive">{errors.city.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register('state')} />
                {errors.state ? <p className="text-xs text-destructive">{errors.state.message}</p> : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} />
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
                <Button type="submit" className="h-9 px-3" disabled={!isDirty || updateFacilityMutation.isPending}>
                  {updateFacilityMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Facility not found.</p>
          )}
        </CardContent>
      </Card>

      {isDeleteConfirmOpen && facility ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDeleteConfirmOpen(false)}>
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle>Confirm Permanent Delete</CardTitle>
              <CardDescription>Type {facility.facility_code} to permanently delete this facility.</CardDescription>
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
