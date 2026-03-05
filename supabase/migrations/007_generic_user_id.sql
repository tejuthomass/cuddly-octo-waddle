-- 007_generic_user_id.sql
-- Converts profile login identifier to an opaque generic user ID generated in DB.

CREATE OR REPLACE FUNCTION public.generate_generic_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
BEGIN
  LOOP
    v_id := 'U-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.employee_id = v_id
    );
  END LOOP;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_generic_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL OR public.normalize_clean_text(NEW.employee_id) = '' THEN
    NEW.employee_id := public.generate_generic_user_id();
  ELSE
    NEW.employee_id := upper(public.normalize_clean_text(NEW.employee_id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_generic_user_id ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_generic_user_id
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_generic_user_id();

UPDATE public.profiles
SET employee_id = public.generate_generic_user_id()
WHERE employee_id IS NULL
   OR public.normalize_clean_text(employee_id) = ''
   OR employee_id ~ '^EMP-[0-9]{6}$';

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
