-- 012_fix_companies_rls_for_admin.sql
-- Fix companies RLS for admin-domain workflows.
-- Root issue: missing INSERT policy on public.companies caused create-client failures.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Remove legacy policies that scope to current_company_id and block admin-domain behavior.
DROP POLICY IF EXISTS companies_select_own_company ON public.companies;
DROP POLICY IF EXISTS companies_admin_update ON public.companies;

-- Ensure idempotency if this migration is re-run.
DROP POLICY IF EXISTS companies_admin_select ON public.companies;
DROP POLICY IF EXISTS companies_l5_insert ON public.companies;
DROP POLICY IF EXISTS companies_l5_update ON public.companies;
DROP POLICY IF EXISTS companies_l5_delete ON public.companies;

-- Admin panel users (L4/L5) can read companies.
CREATE POLICY companies_admin_select ON public.companies
FOR SELECT USING (public.has_admin_panel_access());

-- Only L5 can mutate companies.
CREATE POLICY companies_l5_insert ON public.companies
FOR INSERT WITH CHECK (public.is_l5());

CREATE POLICY companies_l5_update ON public.companies
FOR UPDATE USING (public.is_l5())
WITH CHECK (public.is_l5());

CREATE POLICY companies_l5_delete ON public.companies
FOR DELETE USING (public.is_l5());
