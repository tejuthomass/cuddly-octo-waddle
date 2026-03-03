-- 001_init_schema.sql
-- CMMS multi-tenant foundation schema (idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'l1_technician',
      'l2_supervisor',
      'l3_manager',
      'l4_management',
      'l5_admin',
      'client_viewer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checklist_frequency') THEN
    CREATE TYPE public.checklist_frequency AS ENUM (
      'once_per_shift',
      'hourly',
      'daily',
      'weekly'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status') THEN
    CREATE TYPE public.inspection_status AS ENUM (
      'draft',
      'submitted',
      'approved',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_severity') THEN
    CREATE TYPE public.ticket_severity AS ENUM ('warning', 'critical');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE public.ticket_status AS ENUM (
      'open',
      'acknowledged',
      'escalated',
      'resolved'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permit_status') THEN
    CREATE TYPE public.permit_status AS ENUM ('active', 'completed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, client_id, role)
);

CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  crosses_midnight BOOLEAN GENERATED ALWAYS AS (start_time > end_time) STORED,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (client_id, name)
);

CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (client_id, name)
);

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  reference_image_url TEXT,
  oem_specs JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (client_id, name)
);

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  frequency public.checklist_frequency NOT NULL,
  schema JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.checklist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  asset_category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  status public.inspection_status NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  supervisor_remarks TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.abnormality_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  field_id TEXT NOT NULL,
  field_label TEXT NOT NULL,
  submitted_value TEXT,
  threshold_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity public.ticket_severity NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  attachment_urls TEXT[],
  UNIQUE (inspection_id, field_id)
);

CREATE TABLE IF NOT EXISTS public.vendor_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  work_description TEXT NOT NULL,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.permit_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_client_id ON public.user_roles(client_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_shifts_client_id ON public.shifts(client_id);
CREATE INDEX IF NOT EXISTS idx_assets_client_id ON public.assets(client_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_client_id ON public.checklist_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_asset_id ON public.checklist_templates(asset_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_shift_id ON public.checklist_templates(shift_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_client_id ON public.checklist_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_template_id ON public.checklist_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_inspections_client_id ON public.inspections(client_id);
CREATE INDEX IF NOT EXISTS idx_inspections_template_id ON public.inspections(template_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_submitted_by ON public.inspections(submitted_by);
CREATE INDEX IF NOT EXISTS idx_abnormality_tickets_client_id ON public.abnormality_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_abnormality_tickets_status ON public.abnormality_tickets(status);
CREATE INDEX IF NOT EXISTS idx_abnormality_tickets_severity ON public.abnormality_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_abnormality_tickets_created_at ON public.abnormality_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_permits_client_id ON public.vendor_permits(client_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_checklist_templates_updated_at ON public.checklist_templates;
CREATE TRIGGER trg_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inspections_updated_at ON public.inspections;
CREATE TRIGGER trg_inspections_updated_at
BEFORE UPDATE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.company_id
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_active_role_for_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.client_id = p_client_id
      AND ur.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_for_client(p_client_id UUID, p_roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.client_id = p_client_id
      AND ur.role = ANY (p_roles)
      AND ur.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_l4_or_l5()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = TRUE
      AND ur.role IN ('l4_management', 'l5_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_l5()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = TRUE
      AND ur.role = 'l5_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.same_company_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = p_client_id
      AND p.company_id IS NOT NULL
      AND c.company_id = p.company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.same_company_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles target
    JOIN public.profiles me ON me.id = auth.uid()
    WHERE target.id = p_user_id
      AND me.company_id IS NOT NULL
      AND target.company_id = me.company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_active_role_for_client(p_client_id)
    OR (public.is_l4_or_l5() AND public.same_company_client(p_client_id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role_for_client(p_client_id, ARRAY['l3_manager', 'l5_admin']::public.app_role[])
    OR (public.is_l5() AND public.same_company_client(p_client_id));
$$;

CREATE OR REPLACE FUNCTION public.can_supervise_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role_for_client(p_client_id, ARRAY['l2_supervisor', 'l5_admin']::public.app_role[])
    OR (public.is_l5() AND public.same_company_client(p_client_id));
$$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abnormality_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_permits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_own_company ON public.companies;
CREATE POLICY companies_select_own_company ON public.companies
FOR SELECT USING (
  auth.role() = 'authenticated'
  AND id = public.current_company_id()
);

DROP POLICY IF EXISTS companies_admin_update ON public.companies;
CREATE POLICY companies_admin_update ON public.companies
FOR UPDATE USING (
  public.is_l5()
  AND id = public.current_company_id()
)
WITH CHECK (
  public.is_l5()
  AND id = public.current_company_id()
);

DROP POLICY IF EXISTS clients_select_policy ON public.clients;
CREATE POLICY clients_select_policy ON public.clients
FOR SELECT USING (
  public.can_read_client(id)
);

DROP POLICY IF EXISTS clients_admin_insert ON public.clients;
CREATE POLICY clients_admin_insert ON public.clients
FOR INSERT WITH CHECK (
  public.is_l5()
  AND company_id = public.current_company_id()
);

DROP POLICY IF EXISTS clients_admin_update ON public.clients;
CREATE POLICY clients_admin_update ON public.clients
FOR UPDATE USING (
  public.is_l5()
  AND company_id = public.current_company_id()
)
WITH CHECK (
  public.is_l5()
  AND company_id = public.current_company_id()
);

DROP POLICY IF EXISTS clients_admin_delete ON public.clients;
CREATE POLICY clients_admin_delete ON public.clients
FOR DELETE USING (
  public.is_l5()
  AND company_id = public.current_company_id()
);

DROP POLICY IF EXISTS profiles_read_authenticated ON public.profiles;
CREATE POLICY profiles_read_authenticated ON public.profiles
FOR SELECT USING (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
FOR UPDATE USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);

DROP POLICY IF EXISTS profiles_admin_update_company ON public.profiles;
CREATE POLICY profiles_admin_update_company ON public.profiles
FOR UPDATE USING (
  public.is_l5() AND public.same_company_user(id)
)
WITH CHECK (
  public.is_l5() AND public.same_company_user(id)
);

DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
FOR SELECT USING (
  user_id = auth.uid()
  OR (
    public.is_l4_or_l5()
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = user_roles.client_id
        AND c.company_id = public.current_company_id()
    )
  )
);

DROP POLICY IF EXISTS user_roles_l5_insert ON public.user_roles;
CREATE POLICY user_roles_l5_insert ON public.user_roles
FOR INSERT WITH CHECK (
  public.is_l5()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = user_roles.client_id
      AND c.company_id = public.current_company_id()
  )
);

DROP POLICY IF EXISTS user_roles_l5_update ON public.user_roles;
CREATE POLICY user_roles_l5_update ON public.user_roles
FOR UPDATE USING (
  public.is_l5()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = user_roles.client_id
      AND c.company_id = public.current_company_id()
  )
)
WITH CHECK (
  public.is_l5()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = user_roles.client_id
      AND c.company_id = public.current_company_id()
  )
);

DROP POLICY IF EXISTS user_roles_l5_delete ON public.user_roles;
CREATE POLICY user_roles_l5_delete ON public.user_roles
FOR DELETE USING (
  public.is_l5()
  AND EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = user_roles.client_id
      AND c.company_id = public.current_company_id()
  )
);

DROP POLICY IF EXISTS active_sessions_self_select ON public.active_sessions;
CREATE POLICY active_sessions_self_select ON public.active_sessions
FOR SELECT USING (
  user_id = auth.uid()
  OR (public.is_l5() AND public.same_company_user(user_id))
);

DROP POLICY IF EXISTS active_sessions_self_insert ON public.active_sessions;
CREATE POLICY active_sessions_self_insert ON public.active_sessions
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR (public.is_l5() AND public.same_company_user(user_id))
);

DROP POLICY IF EXISTS active_sessions_self_update ON public.active_sessions;
CREATE POLICY active_sessions_self_update ON public.active_sessions
FOR UPDATE USING (
  user_id = auth.uid()
  OR (public.is_l5() AND public.same_company_user(user_id))
)
WITH CHECK (
  user_id = auth.uid()
  OR (public.is_l5() AND public.same_company_user(user_id))
);

DROP POLICY IF EXISTS active_sessions_l5_delete ON public.active_sessions;
CREATE POLICY active_sessions_l5_delete ON public.active_sessions
FOR DELETE USING (
  public.is_l5() AND public.same_company_user(user_id)
);

DROP POLICY IF EXISTS shifts_select_policy ON public.shifts;
CREATE POLICY shifts_select_policy ON public.shifts
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS shifts_manage_policy ON public.shifts;
CREATE POLICY shifts_manage_policy ON public.shifts
FOR ALL USING (
  public.can_manage_client(client_id)
)
WITH CHECK (
  public.can_manage_client(client_id)
);

DROP POLICY IF EXISTS asset_categories_select_policy ON public.asset_categories;
CREATE POLICY asset_categories_select_policy ON public.asset_categories
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS asset_categories_manage_policy ON public.asset_categories;
CREATE POLICY asset_categories_manage_policy ON public.asset_categories
FOR ALL USING (
  public.can_manage_client(client_id)
)
WITH CHECK (
  public.can_manage_client(client_id)
);

DROP POLICY IF EXISTS assets_select_policy ON public.assets;
CREATE POLICY assets_select_policy ON public.assets
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS assets_manage_policy ON public.assets;
CREATE POLICY assets_manage_policy ON public.assets
FOR ALL USING (
  public.can_manage_client(client_id)
)
WITH CHECK (
  public.can_manage_client(client_id)
);

DROP POLICY IF EXISTS checklist_templates_select_policy ON public.checklist_templates;
CREATE POLICY checklist_templates_select_policy ON public.checklist_templates
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS checklist_templates_manage_policy ON public.checklist_templates;
CREATE POLICY checklist_templates_manage_policy ON public.checklist_templates
FOR ALL USING (
  public.can_manage_client(client_id)
)
WITH CHECK (
  public.can_manage_client(client_id)
);

DROP POLICY IF EXISTS checklist_assignments_select_policy ON public.checklist_assignments;
CREATE POLICY checklist_assignments_select_policy ON public.checklist_assignments
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS checklist_assignments_manage_policy ON public.checklist_assignments;
CREATE POLICY checklist_assignments_manage_policy ON public.checklist_assignments
FOR ALL USING (
  public.can_manage_client(client_id)
)
WITH CHECK (
  public.can_manage_client(client_id)
);

DROP POLICY IF EXISTS inspections_select_policy ON public.inspections;
CREATE POLICY inspections_select_policy ON public.inspections
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS inspections_l1_insert_policy ON public.inspections;
CREATE POLICY inspections_l1_insert_policy ON public.inspections
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND public.has_role_for_client(client_id, ARRAY['l1_technician', 'l5_admin']::public.app_role[])
);

DROP POLICY IF EXISTS inspections_l1_update_draft_policy ON public.inspections;
CREATE POLICY inspections_l1_update_draft_policy ON public.inspections
FOR UPDATE USING (
  submitted_by = auth.uid()
  AND status = 'draft'
  AND public.has_role_for_client(client_id, ARRAY['l1_technician']::public.app_role[])
)
WITH CHECK (
  submitted_by = auth.uid()
  AND public.has_role_for_client(client_id, ARRAY['l1_technician']::public.app_role[])
  AND status IN ('draft', 'submitted')
);

DROP POLICY IF EXISTS inspections_supervisor_update_policy ON public.inspections;
CREATE POLICY inspections_supervisor_update_policy ON public.inspections
FOR UPDATE USING (
  public.can_supervise_client(client_id)
)
WITH CHECK (
  public.can_supervise_client(client_id)
);

DROP POLICY IF EXISTS inspections_l5_delete_policy ON public.inspections;
CREATE POLICY inspections_l5_delete_policy ON public.inspections
FOR DELETE USING (
  public.is_l5() AND public.same_company_client(client_id)
);

DROP POLICY IF EXISTS abnormality_tickets_select_policy ON public.abnormality_tickets;
CREATE POLICY abnormality_tickets_select_policy ON public.abnormality_tickets
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS abnormality_tickets_supervisor_update_policy ON public.abnormality_tickets;
CREATE POLICY abnormality_tickets_supervisor_update_policy ON public.abnormality_tickets
FOR UPDATE USING (
  public.can_supervise_client(client_id)
)
WITH CHECK (
  public.can_supervise_client(client_id)
);

DROP POLICY IF EXISTS abnormality_tickets_l5_delete_policy ON public.abnormality_tickets;
CREATE POLICY abnormality_tickets_l5_delete_policy ON public.abnormality_tickets
FOR DELETE USING (
  public.is_l5() AND public.same_company_client(client_id)
);

DROP POLICY IF EXISTS vendor_permits_select_policy ON public.vendor_permits;
CREATE POLICY vendor_permits_select_policy ON public.vendor_permits
FOR SELECT USING (
  public.can_read_client(client_id)
);

DROP POLICY IF EXISTS vendor_permits_manage_policy ON public.vendor_permits;
CREATE POLICY vendor_permits_manage_policy ON public.vendor_permits
FOR ALL USING (
  public.can_manage_client(client_id)
)
WITH CHECK (
  public.can_manage_client(client_id)
);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION public.check_abnormalities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_schema JSONB;
  template_asset_id UUID;
  field_def JSONB;
  field_id TEXT;
  field_label TEXT;
  field_type TEXT;
  raw_value TEXT;
  numeric_value NUMERIC;
  min_value NUMERIC;
  max_value NUMERIC;
  deviation_ratio NUMERIC;
  calculated_severity public.ticket_severity;
BEGIN
  IF NEW.status <> 'submitted' THEN
    RETURN NEW;
  END IF;

  SELECT ct.schema, ct.asset_id
  INTO template_schema, template_asset_id
  FROM public.checklist_templates ct
  WHERE ct.id = NEW.template_id;

  IF template_schema IS NULL THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.abnormality_tickets t
  WHERE t.inspection_id = NEW.id
    AND t.status IN ('open', 'acknowledged', 'escalated');

  FOR field_def IN
    SELECT * FROM jsonb_array_elements(COALESCE(template_schema, '[]'::jsonb))
  LOOP
    field_type := COALESCE(field_def ->> 'type', '');
    IF field_type <> 'number' THEN
      CONTINUE;
    END IF;

    field_id := field_def ->> 'id';
    field_label := COALESCE(field_def ->> 'label', field_id);

    IF field_id IS NULL OR field_id = '' THEN
      CONTINUE;
    END IF;

    raw_value := NEW.data ->> field_id;
    IF raw_value IS NULL OR btrim(raw_value) = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      numeric_value := raw_value::numeric;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    min_value := NULLIF(field_def ->> 'min_value', '')::numeric;
    max_value := NULLIF(field_def ->> 'max_value', '')::numeric;

    IF min_value IS NULL AND max_value IS NULL THEN
      CONTINUE;
    END IF;

    IF (min_value IS NOT NULL AND numeric_value < min_value)
      OR (max_value IS NOT NULL AND numeric_value > max_value) THEN

      IF min_value IS NOT NULL AND numeric_value < min_value THEN
        IF min_value = 0 THEN
          deviation_ratio := 1;
        ELSE
          deviation_ratio := ABS((min_value - numeric_value) / min_value);
        END IF;
      ELSIF max_value IS NOT NULL AND numeric_value > max_value THEN
        IF max_value = 0 THEN
          deviation_ratio := 1;
        ELSE
          deviation_ratio := ABS((numeric_value - max_value) / max_value);
        END IF;
      ELSE
        deviation_ratio := 0;
      END IF;

      calculated_severity := CASE WHEN deviation_ratio > 0.20 THEN 'critical' ELSE 'warning' END;

      INSERT INTO public.abnormality_tickets (
        inspection_id,
        client_id,
        asset_id,
        field_id,
        field_label,
        submitted_value,
        threshold_info,
        severity,
        status
      ) VALUES (
        NEW.id,
        NEW.client_id,
        template_asset_id,
        field_id,
        field_label,
        raw_value,
        jsonb_build_object(
          'min_value', min_value,
          'max_value', max_value,
          'unit', field_def ->> 'unit'
        ),
        calculated_severity,
        'open'
      )
      ON CONFLICT (inspection_id, field_id)
      DO UPDATE SET
        submitted_value = EXCLUDED.submitted_value,
        threshold_info = EXCLUDED.threshold_info,
        severity = EXCLUDED.severity,
        status = CASE
          WHEN public.abnormality_tickets.status = 'resolved' THEN public.abnormality_tickets.status
          ELSE 'open'
        END,
        assigned_to = NULL,
        acknowledged_at = NULL,
        acknowledged_by = NULL,
        escalated_at = NULL,
        resolved_at = CASE
          WHEN public.abnormality_tickets.status = 'resolved' THEN public.abnormality_tickets.resolved_at
          ELSE NULL
        END,
        resolution_notes = CASE
          WHEN public.abnormality_tickets.status = 'resolved' THEN public.abnormality_tickets.resolution_notes
          ELSE NULL
        END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_abnormalities_on_inspections ON public.inspections;
CREATE TRIGGER check_abnormalities_on_inspections
AFTER INSERT OR UPDATE OF data, status ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.check_abnormalities();

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'escalate_open_abnormality_tickets';

    PERFORM cron.schedule(
      'escalate_open_abnormality_tickets',
      '*/5 * * * *',
      $job$
      UPDATE public.abnormality_tickets
      SET
        status = 'escalated',
        escalated_at = timezone('utc', now())
      WHERE status = 'open'
        AND created_at <= timezone('utc', now()) - interval '60 minutes';
      $job$
    );
  END IF;
END;
$cron$;

INSERT INTO public.companies (name)
VALUES ('Acme CMMS Operator')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.clients (company_id, name, logo_url)
SELECT c.id, v.client_name, NULL
FROM public.companies c
CROSS JOIN (
  VALUES
    ('North Plant'),
    ('South Plant')
) AS v(client_name)
WHERE c.name = 'Acme CMMS Operator'
ON CONFLICT (company_id, name) DO NOTHING;

DO $$
DECLARE
  admin_user_id UUID;
  operator_company_id UUID;
  default_client_id UUID;
  target_admin_email TEXT := 'admin@acme-cmms.local';
BEGIN
  SELECT id INTO operator_company_id
  FROM public.companies
  WHERE name = 'Acme CMMS Operator';

  SELECT id INTO default_client_id
  FROM public.clients
  WHERE name = 'North Plant'
    AND company_id = operator_company_id
  LIMIT 1;

  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = target_admin_email
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, company_id, is_active)
    VALUES (admin_user_id, 'Platform Admin', operator_company_id, TRUE)
    ON CONFLICT (id)
    DO UPDATE SET
      company_id = EXCLUDED.company_id,
      is_active = TRUE,
      full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name);

    IF default_client_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, client_id, role, is_active)
      VALUES (admin_user_id, default_client_id, 'l5_admin', TRUE)
      ON CONFLICT (user_id, client_id, role) DO NOTHING;
    END IF;
  ELSE
    RAISE NOTICE 'Seed note: create auth user with email % first, then re-run this migration to bind admin role.', target_admin_email;
  END IF;
END;
$$;
