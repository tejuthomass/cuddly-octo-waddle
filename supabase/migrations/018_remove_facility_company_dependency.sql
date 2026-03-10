-- 018_remove_facility_company_dependency.sql
-- Removes legacy dependency that required user_companies mapping before user_facilities assignment.
-- Current model: L1/L2/L3 are site-scoped directly.

DROP TRIGGER IF EXISTS trg_prevent_l4_l5_facility_mapping ON public.user_facilities;

CREATE OR REPLACE FUNCTION public.prevent_l4_l5_facility_mapping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = FALSE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = NEW.user_id
      AND ura.is_active = TRUE
      AND ura.role_code IN ('L4', 'L5', 'CLIENT')
  ) THEN
    RAISE EXCEPTION 'Only L1, L2, or L3 users can be assigned to a facility.';
  END IF;

  RETURN NEW;
END;
$$;
