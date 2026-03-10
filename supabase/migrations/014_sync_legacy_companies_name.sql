-- 014_sync_legacy_companies_name.sql
-- Keep legacy companies.name and admin-domain companies.company_name in sync.
-- Prevents NOT NULL failures on legacy name during inserts/updates.

CREATE OR REPLACE FUNCTION public.sync_legacy_company_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.company_name := public.normalize_clean_text(COALESCE(NEW.company_name, NEW.name));
  NEW.name := public.normalize_clean_text(COALESCE(NEW.name, NEW.company_name));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_sync_legacy_name ON public.companies;
CREATE TRIGGER trg_companies_sync_legacy_name
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_company_name();
