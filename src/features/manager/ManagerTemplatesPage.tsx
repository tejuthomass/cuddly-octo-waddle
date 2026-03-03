import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateManagerTemplate, useManagerTemplates, useToggleManagerTemplateActive } from '@/hooks/useManagerTemplates'
import { toHumanErrorMessage } from '@/lib/errors'
import { checklistFrequencySchema } from '@/types/schemas'

const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name is required.'),
  description: z.string().optional(),
  frequency: checklistFrequencySchema,
  schemaText: z.string().min(2, 'Schema JSON is required.'),
})

type CreateTemplateFormValues = z.infer<typeof createTemplateSchema>

export default function ManagerTemplatesPage() {
  const { data: templates = [], isLoading } = useManagerTemplates()
  const createTemplateMutation = useCreateManagerTemplate()
  const toggleTemplateMutation = useToggleManagerTemplateActive()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateFormValues>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      frequency: 'once_per_shift',
      schemaText: JSON.stringify(
        [
          {
            id: 'temperature',
            label: 'Temperature',
            type: 'number',
            unit: '°C',
            min_value: 10,
            max_value: 25,
            required: true,
            order: 1,
          },
        ],
        null,
        2,
      ),
    },
  })

  const onCreateTemplate = async (values: CreateTemplateFormValues) => {
    try {
      const parsedSchema = JSON.parse(values.schemaText) as Record<string, unknown>[]
      if (!Array.isArray(parsedSchema)) {
        throw new Error('Schema must be a JSON array of field definitions.')
      }

      await createTemplateMutation.mutateAsync({
        name: values.name,
        description: values.description,
        frequency: values.frequency,
        schema: parsedSchema,
      })

      toast.success('Checklist template created.')
      reset({ ...values, name: '', description: '' })
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to create checklist template.'))
    }
  }

  const onToggleTemplate = async (templateId: string, nextIsActive: boolean) => {
    try {
      await toggleTemplateMutation.mutateAsync({ templateId, isActive: nextIsActive })
      toast.success(nextIsActive ? 'Template activated.' : 'Template deactivated.')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to update template status.'))
    }
  }

  return (
    <main className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Form Builder</CardTitle>
          <CardDescription>Create checklist templates with JSON field schema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onCreateTemplate)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input id="template-name" {...register('name')} />
                {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-frequency">Frequency</Label>
                <select
                  id="template-frequency"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...register('frequency')}
                >
                  <option value="once_per_shift">Once per Shift</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description (optional)</Label>
              <Input id="template-description" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-schema">Template Schema (JSON array)</Label>
              <textarea
                id="template-schema"
                className="min-h-52 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('schemaText')}
              />
              {errors.schemaText ? <p className="text-xs text-destructive">{errors.schemaText.message}</p> : null}
            </div>

            <Button type="submit" disabled={createTemplateMutation.isPending}>
              {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist Templates</CardTitle>
          <CardDescription>Activate or deactivate templates used by assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Frequency</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Updated</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b">
                      <td className="p-2">{template.name}</td>
                      <td className="p-2">{template.frequency}</td>
                      <td className="p-2">{template.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="p-2 text-muted-foreground">{new Date(template.updated_at).toLocaleString()}</td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant={template.is_active ? 'destructive' : 'secondary'}
                          onClick={() => void onToggleTemplate(template.id, !template.is_active)}
                          disabled={toggleTemplateMutation.isPending}
                        >
                          {template.is_active ? 'Deactivate' : 'Activate'}
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
