import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdminCompanies, useAdminFacilities, useCreateCompany, useCreateFacility } from '@/hooks/useAdminOrganizations'
import { toHumanErrorMessage } from '@/lib/errors'

const createCompanySchema = z.object({
  companyCode: z.string().min(4, 'Company code must be at least 4 characters.').max(20).optional().or(z.literal('')),
  companyName: z.string().min(2, 'Company name is required.'),
  billingAddress: z.string().min(5, 'Billing address is required.'),
})

const createFacilitySchema = z.object({
  facilityCode: z.string().min(4, 'Facility code must be at least 4 characters.').max(20).optional().or(z.literal('')),
  companyId: z.string().min(1, 'Select a company.'),
  facilityName: z.string().min(2, 'Facility name is required.'),
  addressLine1: z.string().min(5, 'Address is required.'),
  city: z.string().min(2, 'City is required.'),
  state: z.string().min(2, 'State is required.'),
  country: z.string().min(2, 'Country is required.'),
})

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>
type CreateFacilityFormValues = z.infer<typeof createFacilitySchema>

export default function ClientManagementPage() {
  const { data: companies = [], isLoading: companiesLoading } = useAdminCompanies()
  const { data: facilities = [], isLoading: facilitiesLoading } = useAdminFacilities()
  const createCompanyMutation = useCreateCompany()
  const createFacilityMutation = useCreateFacility()
  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [isFacilityOpen, setIsFacilityOpen] = useState(false)

  const {
    register: registerCompany,
    handleSubmit: handleCompanySubmit,
    reset: resetCompany,
    formState: { errors: companyErrors },
  } = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      companyCode: '',
      companyName: '',
      billingAddress: '',
    },
  })

  const {
    register: registerFacility,
    handleSubmit: handleFacilitySubmit,
    reset: resetFacility,
    formState: { errors: facilityErrors },
  } = useForm<CreateFacilityFormValues>({
    resolver: zodResolver(createFacilitySchema),
    defaultValues: {
      facilityCode: '',
      companyId: '',
      facilityName: '',
      addressLine1: '',
      city: '',
      state: '',
      country: '',
    },
  })

  const onCreateCompany = async (values: CreateCompanyFormValues) => {
    try {
      await createCompanyMutation.mutateAsync({
        companyCode: values.companyCode || undefined,
        companyName: values.companyName,
        billingAddress: values.billingAddress,
      })
      toast.success('Company created successfully.')
      setIsCompanyOpen(false)
      resetCompany()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create company.'))
    }
  }

  const onCreateFacility = async (values: CreateFacilityFormValues) => {
    try {
      await createFacilityMutation.mutateAsync({
        facilityCode: values.facilityCode || undefined,
        companyId: values.companyId,
        facilityName: values.facilityName,
        addressLine1: values.addressLine1,
        city: values.city,
        state: values.state,
        country: values.country,
      })
      toast.success('Facility created successfully.')
      setIsFacilityOpen(false)
      resetFacility()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create facility.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Companies and facilities.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button className="h-9 px-3" variant="outline" onClick={() => setIsCompanyOpen(true)}>Company</Button>
            <Button className="h-9 px-3" onClick={() => setIsFacilityOpen(true)}>Facility</Button>
          </div>
        </CardHeader>
      </Card>

      {isCompanyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>New Company</CardTitle>
                <CardDescription>Create a company.</CardDescription>
              </div>
              <Button className="h-9 px-3" variant="outline" onClick={() => setIsCompanyOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCompanySubmit(onCreateCompany)}>
                <div className="space-y-2">
                  <Label htmlFor="companyCode">Company Code (optional)</Label>
                  <Input id="companyCode" placeholder="CMP-0001" {...registerCompany('companyCode')} />
                  {companyErrors.companyCode ? <p className="text-xs text-destructive">{companyErrors.companyCode.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" {...registerCompany('companyName')} />
                  {companyErrors.companyName ? <p className="text-xs text-destructive">{companyErrors.companyName.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Input id="billingAddress" {...registerCompany('billingAddress')} />
                  {companyErrors.billingAddress ? <p className="text-xs text-destructive">{companyErrors.billingAddress.message}</p> : null}
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsCompanyOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createCompanyMutation.isPending}>
                    {createCompanyMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isFacilityOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>New Facility</CardTitle>
                <CardDescription>Create a facility.</CardDescription>
              </div>
              <Button className="h-9 px-3" variant="outline" onClick={() => setIsFacilityOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-3" onSubmit={handleFacilitySubmit(onCreateFacility)}>
                <div className="space-y-2">
                  <Label htmlFor="facilityCode">Facility Code (optional)</Label>
                  <Input id="facilityCode" placeholder="FAC-000001" {...registerFacility('facilityCode')} />
                  {facilityErrors.facilityCode ? <p className="text-xs text-destructive">{facilityErrors.facilityCode.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyId">Company</Label>
                  <select id="companyId" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...registerFacility('companyId')}>
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.company_name} ({company.company_code})</option>
                    ))}
                  </select>
                  {facilityErrors.companyId ? <p className="text-xs text-destructive">{facilityErrors.companyId.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facilityName">Facility Name</Label>
                  <Input id="facilityName" {...registerFacility('facilityName')} />
                  {facilityErrors.facilityName ? <p className="text-xs text-destructive">{facilityErrors.facilityName.message}</p> : null}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressLine1">Address</Label>
                  <Input id="addressLine1" {...registerFacility('addressLine1')} />
                  {facilityErrors.addressLine1 ? <p className="text-xs text-destructive">{facilityErrors.addressLine1.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...registerFacility('city')} />
                  {facilityErrors.city ? <p className="text-xs text-destructive">{facilityErrors.city.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" {...registerFacility('state')} />
                  {facilityErrors.state ? <p className="text-xs text-destructive">{facilityErrors.state.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...registerFacility('country')} />
                  {facilityErrors.country ? <p className="text-xs text-destructive">{facilityErrors.country.message}</p> : null}
                </div>
                <div className="md:col-span-3 flex justify-end gap-2">
                  <Button className="h-9 px-3" type="button" variant="outline" onClick={() => setIsFacilityOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createFacilityMutation.isPending}>
                    {createFacilityMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>All companies.</CardDescription>
        </CardHeader>
        <CardContent>
          {companiesLoading ? (
            <p className="text-sm text-muted-foreground">Loading companies...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Company</th>
                    <th className="p-3 text-left">Billing Address</th>
                    <th className="p-3 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b">
                      <td className="p-3 text-xs">{company.company_code}</td>
                      <td className="p-3">{company.company_name}</td>
                      <td className="p-3 text-muted-foreground">{company.billing_address}</td>
                      <td className="p-3 text-muted-foreground">{new Date(company.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facilities</CardTitle>
          <CardDescription>All facilities.</CardDescription>
        </CardHeader>
        <CardContent>
          {facilitiesLoading ? (
            <p className="text-sm text-muted-foreground">Loading facilities...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Facility</th>
                    <th className="p-3 text-left">Company</th>
                    <th className="p-3 text-left">Location</th>
                    <th className="p-3 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((facility) => (
                    <tr key={facility.id} className="border-b">
                      <td className="p-3 text-xs">{facility.facility_code}</td>
                      <td className="p-3">{facility.facility_name}</td>
                      <td className="p-3">{facility.companies?.[0]?.company_name ?? 'Unknown company'}</td>
                      <td className="p-3 text-muted-foreground">{facility.city}, {facility.state}, {facility.country}</td>
                      <td className="p-3 text-muted-foreground">{new Date(facility.created_at).toLocaleString()}</td>
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
