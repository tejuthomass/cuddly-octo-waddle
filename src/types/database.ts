export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AppRole =
  | 'l1_technician'
  | 'l2_supervisor'
  | 'l3_manager'
  | 'l4_management'
  | 'l5_admin'
  | 'client_viewer'

export type ChecklistFrequency = 'once_per_shift' | 'hourly' | 'daily' | 'weekly'

export type InspectionStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type TicketSeverity = 'warning' | 'critical'

export type TicketStatus = 'open' | 'acknowledged' | 'escalated' | 'resolved'

export type PermitStatus = 'active' | 'completed'

export interface ChecklistFieldSchema {
  id: string
  label: string
  type: 'number' | 'boolean' | 'text' | 'select'
  unit?: string
  min_value?: number
  max_value?: number
  options?: string[]
  required?: boolean
  order?: number
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          logo_url?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          company_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          phone?: string | null
          company_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          company_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          client_id: string
          role: AppRole
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          role: AppRole
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          role?: AppRole
          is_active?: boolean
          created_at?: string
        }
      }
      active_sessions: {
        Row: {
          user_id: string
          session_token: string
          last_seen: string
        }
        Insert: {
          user_id: string
          session_token: string
          last_seen?: string
        }
        Update: {
          user_id?: string
          session_token?: string
          last_seen?: string
        }
      }
      shifts: {
        Row: {
          id: string
          client_id: string
          name: string
          start_time: string
          end_time: string
          crosses_midnight: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          start_time: string
          end_time: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          start_time?: string
          end_time?: string
          created_by?: string | null
          created_at?: string
        }
      }
      asset_categories: {
        Row: {
          id: string
          client_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          created_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          client_id: string
          category_id: string | null
          name: string
          location: string
          reference_image_url: string | null
          oem_specs: Json | null
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          category_id?: string | null
          name: string
          location: string
          reference_image_url?: string | null
          oem_specs?: Json | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          category_id?: string | null
          name?: string
          location?: string
          reference_image_url?: string | null
          oem_specs?: Json | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      checklist_templates: {
        Row: {
          id: string
          client_id: string
          asset_id: string | null
          shift_id: string | null
          name: string
          description: string | null
          frequency: ChecklistFrequency
          schema: Json
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          asset_id?: string | null
          shift_id?: string | null
          name: string
          description?: string | null
          frequency: ChecklistFrequency
          schema: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          asset_id?: string | null
          shift_id?: string | null
          name?: string
          description?: string | null
          frequency?: ChecklistFrequency
          schema?: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      checklist_assignments: {
        Row: {
          id: string
          client_id: string
          template_id: string
          shift_id: string | null
          assigned_user_id: string | null
          asset_category_id: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          template_id: string
          shift_id?: string | null
          assigned_user_id?: string | null
          asset_category_id?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          template_id?: string
          shift_id?: string | null
          assigned_user_id?: string | null
          asset_category_id?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      inspections: {
        Row: {
          id: string
          template_id: string
          client_id: string
          submitted_by: string
          shift_id: string | null
          status: InspectionStatus
          started_at: string
          submitted_at: string | null
          approved_by: string | null
          approved_at: string | null
          supervisor_remarks: string | null
          data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_id: string
          client_id: string
          submitted_by: string
          shift_id?: string | null
          status?: InspectionStatus
          started_at?: string
          submitted_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          supervisor_remarks?: string | null
          data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          client_id?: string
          submitted_by?: string
          shift_id?: string | null
          status?: InspectionStatus
          started_at?: string
          submitted_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          supervisor_remarks?: string | null
          data?: Json
          created_at?: string
          updated_at?: string
        }
      }
      abnormality_tickets: {
        Row: {
          id: string
          inspection_id: string
          client_id: string
          asset_id: string | null
          field_id: string
          field_label: string
          submitted_value: string | null
          threshold_info: Json
          severity: TicketSeverity
          status: TicketStatus
          assigned_to: string | null
          created_at: string
          acknowledged_at: string | null
          acknowledged_by: string | null
          escalated_at: string | null
          resolved_at: string | null
          resolution_notes: string | null
          attachment_urls: string[] | null
        }
        Insert: {
          id?: string
          inspection_id: string
          client_id: string
          asset_id?: string | null
          field_id: string
          field_label: string
          submitted_value?: string | null
          threshold_info?: Json
          severity: TicketSeverity
          status?: TicketStatus
          assigned_to?: string | null
          created_at?: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          escalated_at?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          attachment_urls?: string[] | null
        }
        Update: {
          id?: string
          inspection_id?: string
          client_id?: string
          asset_id?: string | null
          field_id?: string
          field_label?: string
          submitted_value?: string | null
          threshold_info?: Json
          severity?: TicketSeverity
          status?: TicketStatus
          assigned_to?: string | null
          created_at?: string
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          escalated_at?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          attachment_urls?: string[] | null
        }
      }
      vendor_permits: {
        Row: {
          id: string
          client_id: string
          vendor_name: string
          work_description: string
          generated_by: string | null
          status: PermitStatus
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          vendor_name: string
          work_description: string
          generated_by?: string | null
          status?: PermitStatus
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          vendor_name?: string
          work_description?: string
          generated_by?: string | null
          status?: PermitStatus
          created_at?: string
          completed_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      current_company_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      has_active_role_for_client: {
        Args: {
          p_client_id: string
        }
        Returns: boolean
      }
      has_role_for_client: {
        Args: {
          p_client_id: string
          p_roles: AppRole[]
        }
        Returns: boolean
      }
      is_l4_or_l5: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_l5: {
        Args: Record<string, never>
        Returns: boolean
      }
      same_company_client: {
        Args: {
          p_client_id: string
        }
        Returns: boolean
      }
      same_company_user: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      can_read_client: {
        Args: {
          p_client_id: string
        }
        Returns: boolean
      }
      can_manage_client: {
        Args: {
          p_client_id: string
        }
        Returns: boolean
      }
      can_supervise_client: {
        Args: {
          p_client_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: AppRole
      checklist_frequency: ChecklistFrequency
      inspection_status: InspectionStatus
      ticket_severity: TicketSeverity
      ticket_status: TicketStatus
      permit_status: PermitStatus
    }
    CompositeTypes: Record<string, never>
  }
}
