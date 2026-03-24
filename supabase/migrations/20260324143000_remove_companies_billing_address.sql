-- Remove deprecated billing_address from companies and keep normalization trigger compatible.

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_billing_address_clean_chk;

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS billing_address;

CREATE OR REPLACE FUNCTION public.normalize_company_and_facility_values()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    NEW.company_code := upper(public.normalize_clean_text(COALESCE(NEW.company_code, public.next_company_code())));
    NEW.company_name := public.normalize_clean_text(NEW.company_name);
  ELSIF TG_TABLE_NAME = 'facilities' THEN
    NEW.facility_code := upper(public.normalize_clean_text(COALESCE(NEW.facility_code, public.next_facility_code())));
    NEW.facility_name := public.normalize_clean_text(NEW.facility_name);
    NEW.address_line_1 := public.normalize_clean_text(NEW.address_line_1);
    NEW.city := public.normalize_clean_text(NEW.city);
    NEW.state := public.normalize_clean_text(NEW.state);
    NEW.country := public.normalize_clean_text(NEW.country);
  END IF;

  RETURN NEW;
END;
$$;
