import { z } from 'zod'

export const appRoleSchema = z.enum([
  'l1_technician',
  'l2_supervisor',
  'l3_manager',
  'l4_management',
  'l5_admin',
  'client_viewer',
])

export const checklistFrequencySchema = z.enum(['once_per_shift', 'hourly', 'daily', 'weekly'])
export const inspectionStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected'])
export const ticketSeveritySchema = z.enum(['warning', 'critical'])
export const ticketStatusSchema = z.enum(['open', 'acknowledged', 'escalated', 'resolved'])
export const permitStatusSchema = z.enum(['active', 'completed'])

export const checklistFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['number', 'boolean', 'text', 'select']),
  unit: z.string().optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  order: z.number().int().nonnegative().optional(),
})

export const checklistTemplateSchemaSchema = z.array(checklistFieldSchema)

export type AppRoleSchemaType = z.infer<typeof appRoleSchema>
export type ChecklistFieldSchemaType = z.infer<typeof checklistFieldSchema>
