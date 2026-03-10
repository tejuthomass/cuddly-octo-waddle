-- 017_enforce_company_assignment_role_scope.sql
-- Enforce that account-level mappings are only for CLIENT users.
-- Also deactivates existing active account mappings for non-CLIENT users.

UPDATE public.user_companies uc
SET is_active = FALSE
WHERE uc.is_active = TRUE
  AND EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = uc.user_id
      AND ura.is_active = TRUE
      AND ura.role_code <> 'CLIENT'
  );

CREATE OR REPLACE FUNCTION public.enforce_company_assignment_role_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = FALSE THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = NEW.user_id
      AND ura.is_active = TRUE
      AND ura.role_code = 'CLIENT'
  ) THEN
    RAISE EXCEPTION 'Only CLIENT users can be assigned to an account.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_companies_enforce_role_scope ON public.user_companies;
CREATE TRIGGER trg_user_companies_enforce_role_scope
BEFORE INSERT OR UPDATE ON public.user_companies
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_assignment_role_scope();
