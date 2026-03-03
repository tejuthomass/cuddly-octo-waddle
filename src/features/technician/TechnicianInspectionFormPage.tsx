import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSubmitInspection, useTechnicianInspectionDetail, useUpdateDraftInspection } from '@/hooks/useTechnicianInspections'
import { toHumanErrorMessage } from '@/lib/errors'

type SchemaField = {
  id: string
  label: string
  type: 'number' | 'boolean' | 'text' | 'select'
  options?: string[]
  required?: boolean
  unit?: string
}

function parseSchema(raw: unknown): SchemaField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .filter((item): item is SchemaField => typeof item === 'object' && item !== null && 'id' in item && 'label' in item && 'type' in item)
    .map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      options: Array.isArray(item.options) ? item.options : undefined,
      required: Boolean(item.required),
      unit: typeof item.unit === 'string' ? item.unit : undefined,
    }))
}

export default function TechnicianInspectionFormPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useTechnicianInspectionDetail(inspectionId)
  const updateDraftMutation = useUpdateDraftInspection()
  const submitMutation = useSubmitInspection()
  const [workingData, setWorkingData] = useState<Record<string, unknown>>({})

  const inspection = data?.inspection
  const template = data?.template

  const schema = useMemo(() => parseSchema(template?.schema), [template?.schema])

  const values = useMemo(() => {
    const base = inspection && typeof inspection.data === 'object' && inspection.data !== null ? (inspection.data as Record<string, unknown>) : {}
    return {
      ...base,
      ...workingData,
    }
  }, [inspection, workingData])

  const setFieldValue = (fieldId: string, value: unknown) => {
    setWorkingData((previous) => ({
      ...previous,
      [fieldId]: value,
    }))
  }

  const validateRequired = () => {
    for (const field of schema) {
      if (!field.required) {
        continue
      }

      const value = values[field.id]
      if (value === undefined || value === null || value === '') {
        throw new Error(`Field \"${field.label}\" is required.`)
      }
    }
  }

  const onSaveDraft = async () => {
    if (!inspection) {
      return
    }

    try {
      await updateDraftMutation.mutateAsync({
        inspectionId: inspection.id,
        data: values,
      })
      toast.success('Draft saved.')
      setWorkingData({})
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to save draft.'))
    }
  }

  const onSubmitInspection = async () => {
    if (!inspection) {
      return
    }

    try {
      validateRequired()
      await submitMutation.mutateAsync({
        inspectionId: inspection.id,
        data: values,
      })
      toast.success('Inspection submitted.')
      navigate('/technician/inspections')
    } catch (error) {
      toast.error(toHumanErrorMessage(error, 'Unable to submit inspection.'))
    }
  }

  return (
    <main className="space-y-6 p-4 pb-24 lg:p-6 lg:pb-6">
      <Card>
        <CardHeader>
          <CardTitle>{template?.name || 'Inspection'}</CardTitle>
          <CardDescription>Complete the checklist fields and submit when ready.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !inspection || !template ? (
            <p className="text-sm text-muted-foreground">Loading inspection...</p>
          ) : inspection.status !== 'draft' ? (
            <p className="text-sm text-muted-foreground">This inspection is no longer editable.</p>
          ) : schema.length === 0 ? (
            <p className="text-sm text-muted-foreground">No schema fields found for this template.</p>
          ) : (
            <div className="space-y-4">
              {schema.map((field) => {
                const value = values[field.id]

                if (field.type === 'boolean') {
                  return (
                    <div key={field.id} className="space-y-2 rounded-lg border border-border p-3">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <select
                        id={field.id}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={typeof value === 'boolean' ? (value ? 'true' : 'false') : ''}
                        onChange={(event) => setFieldValue(field.id, event.target.value === 'true')}
                      >
                        <option value="">Select</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  )
                }

                if (field.type === 'select') {
                  return (
                    <div key={field.id} className="space-y-2 rounded-lg border border-border p-3">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <select
                        id={field.id}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) => setFieldValue(field.id, event.target.value)}
                      >
                        <option value="">Select</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                }

                if (field.type === 'number') {
                  return (
                    <div key={field.id} className="space-y-2 rounded-lg border border-border p-3">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <Input
                        id={field.id}
                        type="number"
                        value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
                        onChange={(event) => setFieldValue(field.id, Number(event.target.value))}
                      />
                      {field.unit ? <p className="text-xs text-muted-foreground">Unit: {field.unit}</p> : null}
                    </div>
                  )
                }

                return (
                  <div key={field.id} className="space-y-2 rounded-lg border border-border p-3">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input
                      id={field.id}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(event) => setFieldValue(field.id, event.target.value)}
                    />
                  </div>
                )
              })}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void onSaveDraft()} disabled={updateDraftMutation.isPending}>
                  {updateDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button type="button" onClick={() => void onSubmitInspection()} disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting...' : 'Submit Inspection'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
