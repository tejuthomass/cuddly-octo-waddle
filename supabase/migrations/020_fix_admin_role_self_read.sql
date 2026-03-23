-- 020_fix_admin_role_self_read.sql
-- Fix circular RLS dependency: allow users to read their own role assignment
-- even if they're not yet authenticated to the admin panel.

DROP POLICY IF EXISTS ura_user_select_self ON public.user_role_assignments;
CREATE POLICY ura_user_select_self ON public.user_role_assignments
FOR SELECT USING (user_id = auth.uid());
