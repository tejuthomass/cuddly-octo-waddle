-- 005_employee_id_login.sql
-- Enables employee ID based login while keeping Supabase email/password auth.

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_employee_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF p_employee_id IS NULL OR public.normalize_clean_text(p_employee_id) = '' THEN
    RETURN NULL;
  END IF;

  SELECT p.email
  INTO v_email
  FROM public.profiles p
  WHERE p.employee_id = upper(public.normalize_clean_text(p_employee_id))
    AND p.is_active = TRUE
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO authenticated;
