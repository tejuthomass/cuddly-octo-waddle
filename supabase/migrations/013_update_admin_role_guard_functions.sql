-- 013_update_admin_role_guard_functions.sql
-- Align legacy role guard helpers with the admin-domain role model.
-- Keeps backward compatibility with legacy public.user_roles while
-- supporting public.user_role_assignments as the source of truth.

CREATE OR REPLACE FUNCTION public.is_l4_or_l5()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = TRUE
        AND ur.role IN ('l4_management', 'l5_admin')
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.is_active = TRUE
        AND ura.role_code IN ('L4', 'L5')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_l5()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = TRUE
        AND ur.role = 'l5_admin'
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.is_active = TRUE
        AND ura.role_code = 'L5'
    )
  );
$$;
