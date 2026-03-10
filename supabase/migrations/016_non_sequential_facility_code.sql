-- 016_non_sequential_facility_code.sql
-- Makes facility codes non-sequential and non-guessable.

CREATE OR REPLACE FUNCTION public.next_facility_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := 'F-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.facilities f
      WHERE f.facility_code = v_code
    );
  END LOOP;

  RETURN v_code;
END;
$$;

UPDATE public.facilities
SET facility_code = public.next_facility_code()
WHERE facility_code ~ '^FAC-[0-9]{4,}$';
