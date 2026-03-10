-- 015_enforce_facility_assignment_role_scope.sql
-- Enforce that facility-level mappings are only for L1/L2/L3 users.
-- Also deactivates any existing active facility mappings for CLIENT users.

UPDATE public.user_facilities uf
SET is_active = FALSE
WHERE uf.is_active = TRUE
  AND EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = uf.user_id
      AND ura.is_active = TRUE
      AND ura.role_code = 'CLIENT'
  );

CREATE OR REPLACE FUNCTION public.enforce_facility_assignment_role_scope()
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
      AND ura.role_code IN ('L1', 'L2', 'L3')
  ) THEN
    RAISE EXCEPTION 'Only L1, L2, or L3 users can be assigned to a facility.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_facilities_enforce_role_scope ON public.user_facilities;
CREATE TRIGGER trg_user_facilities_enforce_role_scope
BEFORE INSERT OR UPDATE ON public.user_facilities
FOR EACH ROW EXECUTE FUNCTION public.enforce_facility_assignment_role_scope();
