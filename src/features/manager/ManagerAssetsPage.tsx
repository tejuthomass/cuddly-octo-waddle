import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateManagerAsset, useCreateManagerCategory, useManagerAssets, useManagerCategories } from '@/hooks/useManagerAssets'
import { toHumanErrorMessage } from '@/lib/errors'

const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required.'),
})

const createAssetSchema = z.object({
  name: z.string().min(2, 'Asset name is required.'),
  location: z.string().min(2, 'Location is required.'),
  categoryId: z.string().optional(),
})

type CreateCategoryFormValues = z.infer<typeof createCategorySchema>
type CreateAssetFormValues = z.infer<typeof createAssetSchema>

export default function ManagerAssetsPage() {
  const { data: categories = [] } = useManagerCategories()
  const { data: assets = [], isLoading } = useManagerAssets()
  const createCategoryMutation = useCreateManagerCategory()
  const createAssetMutation = useCreateManagerAsset()

  const {
    register: registerCategory,
    handleSubmit: handleCategorySubmit,
    reset: resetCategory,
    formState: { errors: categoryErrors },
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: '' },
  })

  const {
    register: registerAsset,
    handleSubmit: handleAssetSubmit,
    reset: resetAsset,
    formState: { errors: assetErrors },
  } = useForm<CreateAssetFormValues>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: { name: '', location: '', categoryId: '' },
  })

  const onCreateCategory = async (values: CreateCategoryFormValues) => {
    try {
      await createCategoryMutation.mutateAsync(values)
      toast.success('Category created.')
      resetCategory()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create category.'))
    }
  }

  const onCreateAsset = async (values: CreateAssetFormValues) => {
    try {
      await createAssetMutation.mutateAsync(values)
      toast.success('Asset created.')
      resetAsset()
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create asset.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Asset Categories</CardTitle>
          <CardDescription>Create categories used for asset grouping and assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCategorySubmit(onCreateCategory)}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input id="category-name" {...registerCategory('name')} />
              {categoryErrors.name ? <p className="text-xs text-destructive">{categoryErrors.name.message}</p> : null}
            </div>
            <div className="md:self-end">
              <Button className="w-full" type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Asset</CardTitle>
          <CardDescription>Add operational assets for inspection templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleAssetSubmit(onCreateAsset)}>
            <div className="space-y-2">
              <Label htmlFor="asset-name">Asset Name</Label>
              <Input id="asset-name" {...registerAsset('name')} />
              {assetErrors.name ? <p className="text-xs text-destructive">{assetErrors.name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-location">Location</Label>
              <Input id="asset-location" {...registerAsset('location')} />
              {assetErrors.location ? <p className="text-xs text-destructive">{assetErrors.location.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-category">Category (optional)</Label>
              <select
                id="asset-category"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...registerAsset('categoryId')}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={createAssetMutation.isPending}>
                {createAssetMutation.isPending ? 'Creating...' : 'Create Asset'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Current assets in the active client context.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading assets...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Location</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b">
                      <td className="p-2">{asset.name}</td>
                      <td className="p-2">{asset.location}</td>
                      <td className="p-2 text-muted-foreground">{asset.asset_categories?.[0]?.name ?? '—'}</td>
                      <td className="p-2">{asset.is_active ? 'Active' : 'Inactive'}</td>
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
