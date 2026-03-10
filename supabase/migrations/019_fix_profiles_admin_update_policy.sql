-- 019_fix_profiles_admin_update_policy.sql
-- Allow active L5 admins to update profile rows directly in admin workflows.
-- This removes brittle legacy same-company gating based on profiles.company_id.

DROP POLICY IF EXISTS profiles_admin_update_company ON public.profiles;

CREATE POLICY profiles_admin_update_company ON public.profiles
FOR UPDATE USING (
  public.is_l5()
)
WITH CHECK (
  public.is_l5()
);
