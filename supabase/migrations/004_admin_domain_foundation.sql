-- 004_admin_domain_foundation.sql
-- Admin-domain foundation: companies/facilities/access mappings/audit logs.

CREATE SEQUENCE IF NOT EXISTS public.company_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.facility_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_company_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CMP-' || LPAD(nextval('public.company_code_seq')::TEXT, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_facility_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'FAC-' || LPAD(nextval('public.facility_code_seq')::TEXT, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.normalize_clean_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(btrim(COALESCE(value, '')), '\s+', ' ', 'g');
$$;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_code TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

UPDATE public.companies
SET company_name = COALESCE(NULLIF(public.normalize_clean_text(company_name), ''), public.normalize_clean_text(name))
WHERE company_name IS NULL OR public.normalize_clean_text(company_name) = '';

UPDATE public.companies
SET billing_address = COALESCE(NULLIF(public.normalize_clean_text(billing_address), ''), 'Not provided')
WHERE billing_address IS NULL OR public.normalize_clean_text(billing_address) = '';

UPDATE public.companies
SET company_code = public.next_company_code()
WHERE company_code IS NULL OR public.normalize_clean_text(company_code) = '';

ALTER TABLE public.companies
  ALTER COLUMN company_code SET NOT NULL,
  ALTER COLUMN company_name SET NOT NULL,
  ALTER COLUMN billing_address SET NOT NULL;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_company_code_format_chk
    CHECK (company_code = upper(company_code) AND company_code ~ '^[A-Z0-9-]{4,20}$'),
  ADD CONSTRAINT companies_company_name_clean_chk
    CHECK (company_name = public.normalize_clean_text(company_name) AND company_name <> ''),
  ADD CONSTRAINT companies_billing_address_clean_chk
    CHECK (billing_address = public.normalize_clean_text(billing_address) AND billing_address <> '');

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_company_code ON public.companies (company_code);

CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_code TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  facility_name TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_facilities_code ON public.facilities (facility_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_facilities_company_name ON public.facilities (company_id, lower(facility_name));

ALTER TABLE public.facilities
  ADD CONSTRAINT facilities_code_format_chk
    CHECK (facility_code = upper(facility_code) AND facility_code ~ '^[A-Z0-9-]{4,20}$'),
  ADD CONSTRAINT facilities_name_clean_chk
    CHECK (facility_name = public.normalize_clean_text(facility_name) AND facility_name <> ''),
  ADD CONSTRAINT facilities_address_clean_chk
    CHECK (address_line_1 = public.normalize_clean_text(address_line_1) AND address_line_1 <> ''),
  ADD CONSTRAINT facilities_city_clean_chk
    CHECK (city = public.normalize_clean_text(city) AND city <> ''),
  ADD CONSTRAINT facilities_state_clean_chk
    CHECK (state = public.normalize_clean_text(state) AND state <> ''),
  ADD CONSTRAINT facilities_country_clean_chk
    CHECK (country = public.normalize_clean_text(country) AND country <> '');

CREATE OR REPLACE FUNCTION public.set_admin_updated_at()
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

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_admin_updated_at();

DROP TRIGGER IF EXISTS trg_facilities_updated_at ON public.facilities;
CREATE TRIGGER trg_facilities_updated_at
BEFORE UPDATE ON public.facilities
FOR EACH ROW EXECUTE FUNCTION public.set_admin_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_company_and_facility_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    NEW.company_code := upper(public.normalize_clean_text(COALESCE(NEW.company_code, public.next_company_code())));
    NEW.company_name := public.normalize_clean_text(NEW.company_name);
    NEW.billing_address := public.normalize_clean_text(NEW.billing_address);
  ELSIF TG_TABLE_NAME = 'facilities' THEN
    NEW.facility_code := upper(public.normalize_clean_text(COALESCE(NEW.facility_code, public.next_facility_code())));
    NEW.facility_name := public.normalize_clean_text(NEW.facility_name);
    NEW.address_line_1 := public.normalize_clean_text(NEW.address_line_1);
    NEW.city := public.normalize_clean_text(NEW.city);
    NEW.state := public.normalize_clean_text(NEW.state);
    NEW.country := public.normalize_clean_text(NEW.country);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_normalize ON public.companies;
CREATE TRIGGER trg_companies_normalize
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.normalize_company_and_facility_values();

DROP TRIGGER IF EXISTS trg_facilities_normalize ON public.facilities;
CREATE TRIGGER trg_facilities_normalize
BEFORE INSERT OR UPDATE ON public.facilities
FOR EACH ROW EXECUTE FUNCTION public.normalize_company_and_facility_values();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR public.normalize_clean_text(p.email) = '');

WITH profile_rank AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.profiles
  WHERE employee_id IS NULL OR public.normalize_clean_text(employee_id) = ''
)
UPDATE public.profiles p
SET employee_id = 'EMP-' || LPAD(profile_rank.rn::TEXT, 6, '0')
FROM profile_rank
WHERE p.id = profile_rank.id;

UPDATE public.profiles
SET email = lower(public.normalize_clean_text(email)),
    employee_id = upper(public.normalize_clean_text(employee_id)),
    full_name = public.normalize_clean_text(full_name)
WHERE TRUE;

ALTER TABLE public.profiles
  ALTER COLUMN employee_id SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_employee_id_format_chk
    CHECK (employee_id = upper(employee_id) AND employee_id ~ '^[A-Z0-9-]{3,40}$'),
  ADD CONSTRAINT profiles_email_clean_chk
    CHECK (email = lower(public.normalize_clean_text(email)) AND email <> ''),
  ADD CONSTRAINT profiles_full_name_clean_chk
    CHECK (full_name = public.normalize_clean_text(full_name) AND full_name <> '');

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_employee_id ON public.profiles (employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email ON public.profiles (lower(email));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_code') THEN
    CREATE TYPE public.role_code AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5', 'CLIENT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_code public.role_code NOT NULL,
  role_title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_active_role ON public.user_role_assignments (user_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.user_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, facility_id)
);

DROP TRIGGER IF EXISTS trg_user_role_assignments_updated_at ON public.user_role_assignments;
CREATE TRIGGER trg_user_role_assignments_updated_at
BEFORE UPDATE ON public.user_role_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_admin_updated_at();

DROP TRIGGER IF EXISTS trg_user_companies_updated_at ON public.user_companies;
CREATE TRIGGER trg_user_companies_updated_at
BEFORE UPDATE ON public.user_companies
FOR EACH ROW EXECUTE FUNCTION public.set_admin_updated_at();

DROP TRIGGER IF EXISTS trg_user_facilities_updated_at ON public.user_facilities;
CREATE TRIGGER trg_user_facilities_updated_at
BEFORE UPDATE ON public.user_facilities
FOR EACH ROW EXECUTE FUNCTION public.set_admin_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_last_active_l5_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_l5_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role_code = 'L5' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
      SELECT COUNT(*) INTO active_l5_count
      FROM public.user_role_assignments
      WHERE role_code = 'L5'
        AND is_active = TRUE;

      IF active_l5_count <= 1 THEN
        RAISE EXCEPTION 'At least one active L5 admin must remain.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role_code = 'L5' AND OLD.is_active = TRUE THEN
      SELECT COUNT(*) INTO active_l5_count
      FROM public.user_role_assignments
      WHERE role_code = 'L5'
        AND is_active = TRUE;

      IF active_l5_count <= 1 THEN
        RAISE EXCEPTION 'At least one active L5 admin must remain.';
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_active_l5_removal ON public.user_role_assignments;
CREATE TRIGGER trg_prevent_last_active_l5_removal
BEFORE UPDATE OR DELETE ON public.user_role_assignments
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_active_l5_removal();

CREATE OR REPLACE FUNCTION public.prevent_l4_l5_facility_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = NEW.user_id
      AND ura.is_active = TRUE
      AND ura.role_code IN ('L4', 'L5')
  ) THEN
    RAISE EXCEPTION 'L4/L5 users must not be mapped to facilities.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.facilities f
    WHERE f.id = NEW.facility_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_companies uc
        WHERE uc.user_id = NEW.user_id
          AND uc.company_id = f.company_id
          AND uc.is_active = TRUE
      )
  ) THEN
    RAISE EXCEPTION 'User must be mapped to the facility company before facility assignment.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_l4_l5_facility_mapping ON public.user_facilities;
CREATE TRIGGER trg_prevent_l4_l5_facility_mapping
BEFORE INSERT OR UPDATE ON public.user_facilities
FOR EACH ROW EXECUTE FUNCTION public.prevent_l4_l5_facility_mapping();

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  before_data JSONB,
  after_data JSONB,
  request_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID;
  row_id UUID;
BEGIN
  actor := auth.uid();
  row_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);

  INSERT INTO public.audit_logs (
    actor_user_id,
    action_type,
    entity_type,
    entity_id,
    target_user_id,
    before_data,
    after_data
  ) VALUES (
    actor,
    TG_OP,
    TG_TABLE_NAME,
    row_id,
    CASE
      WHEN TG_TABLE_NAME IN ('profiles', 'user_role_assignments', 'user_companies', 'user_facilities')
      THEN COALESCE((to_jsonb(NEW)->>'user_id')::uuid, (to_jsonb(OLD)->>'user_id')::uuid, row_id)
      ELSE NULL
    END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_companies ON public.companies;
CREATE TRIGGER trg_audit_companies
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS trg_audit_facilities ON public.facilities;
CREATE TRIGGER trg_audit_facilities
AFTER INSERT OR UPDATE OR DELETE ON public.facilities
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS trg_audit_user_role_assignments ON public.user_role_assignments;
CREATE TRIGGER trg_audit_user_role_assignments
AFTER INSERT OR UPDATE OR DELETE ON public.user_role_assignments
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS trg_audit_user_companies ON public.user_companies;
CREATE TRIGGER trg_audit_user_companies
AFTER INSERT OR UPDATE OR DELETE ON public.user_companies
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS trg_audit_user_facilities ON public.user_facilities;
CREATE TRIGGER trg_audit_user_facilities
AFTER INSERT OR UPDATE OR DELETE ON public.user_facilities
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_admin_panel_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = auth.uid()
      AND ura.is_active = TRUE
      AND ura.role_code IN ('L4', 'L5')
  )
  OR public.is_l5();
$$;

DROP POLICY IF EXISTS facilities_admin_select ON public.facilities;
CREATE POLICY facilities_admin_select ON public.facilities
FOR SELECT USING (public.has_admin_panel_access());

DROP POLICY IF EXISTS facilities_l5_mutate ON public.facilities;
CREATE POLICY facilities_l5_mutate ON public.facilities
FOR ALL USING (public.is_l5())
WITH CHECK (public.is_l5());

DROP POLICY IF EXISTS ura_admin_select ON public.user_role_assignments;
CREATE POLICY ura_admin_select ON public.user_role_assignments
FOR SELECT USING (public.has_admin_panel_access());

DROP POLICY IF EXISTS ura_l5_mutate ON public.user_role_assignments;
CREATE POLICY ura_l5_mutate ON public.user_role_assignments
FOR ALL USING (public.is_l5())
WITH CHECK (public.is_l5());

DROP POLICY IF EXISTS user_companies_admin_select ON public.user_companies;
CREATE POLICY user_companies_admin_select ON public.user_companies
FOR SELECT USING (public.has_admin_panel_access());

DROP POLICY IF EXISTS user_companies_l5_mutate ON public.user_companies;
CREATE POLICY user_companies_l5_mutate ON public.user_companies
FOR ALL USING (public.is_l5())
WITH CHECK (public.is_l5());

DROP POLICY IF EXISTS user_facilities_admin_select ON public.user_facilities;
CREATE POLICY user_facilities_admin_select ON public.user_facilities
FOR SELECT USING (public.has_admin_panel_access());

DROP POLICY IF EXISTS user_facilities_l5_mutate ON public.user_facilities;
CREATE POLICY user_facilities_l5_mutate ON public.user_facilities
FOR ALL USING (public.is_l5())
WITH CHECK (public.is_l5());

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
FOR SELECT USING (public.has_admin_panel_access());

DROP POLICY IF EXISTS audit_logs_l5_insert ON public.audit_logs;
CREATE POLICY audit_logs_l5_insert ON public.audit_logs
FOR INSERT WITH CHECK (public.is_l5());

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'purge_audit_logs_30d';

    PERFORM cron.schedule(
      'purge_audit_logs_30d',
      '30 2 * * *',
      $job$
      DELETE FROM public.audit_logs
      WHERE created_at < timezone('utc', now()) - interval '30 days';
      $job$
    );
  END IF;
END;
$cron$;

CREATE INDEX IF NOT EXISTS idx_facilities_company_id ON public.facilities(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON public.user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON public.user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_user_facilities_user_id ON public.user_facilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_facilities_facility_id ON public.user_facilities(facility_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_code ON public.user_role_assignments(role_code);
