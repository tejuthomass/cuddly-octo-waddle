-- 003_super_admin_guards.sql
-- Enforce a single active Super Admin and protect that role from deactivation/removal.

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_super_admin_role
  ON public.user_roles (role)
  WHERE role = 'l5_admin' AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.prevent_super_admin_role_disable_or_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'l5_admin' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
      RAISE EXCEPTION 'Super Admin role cannot be disabled.';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'l5_admin' AND OLD.is_active = TRUE THEN
      RAISE EXCEPTION 'Super Admin role cannot be deleted.';
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_role_disable_or_delete ON public.user_roles;
CREATE TRIGGER trg_prevent_super_admin_role_disable_or_delete
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_role_disable_or_delete();

CREATE OR REPLACE FUNCTION public.prevent_super_admin_profile_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.id
      AND ur.role = 'l5_admin'
      AND ur.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Super Admin user cannot be deactivated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_profile_deactivation ON public.profiles;
CREATE TRIGGER trg_prevent_super_admin_profile_deactivation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_profile_deactivation();
