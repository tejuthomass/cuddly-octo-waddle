-- 011_company_id_and_logo_storage.sql
-- Makes company IDs non-guessable and adds client logo support.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE OR REPLACE FUNCTION public.next_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := 'C-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.company_code = v_code
    );
  END LOOP;

  RETURN v_code;
END;
$$;

UPDATE public.companies
SET company_code = public.next_company_code()
WHERE company_code ~ '^CMP-[0-9]{4,}$';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'company-logos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'company-logos',
      'company-logos',
      true,
      5242880,
      ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml']
    );
  END IF;
END;
$$;

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml']
WHERE id = 'company-logos';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_logos_public_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY company_logos_public_read
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'company-logos')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_logos_authenticated_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY company_logos_authenticated_insert
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'company-logos'
        AND auth.uid() IS NOT NULL
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_logos_authenticated_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY company_logos_authenticated_update
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'company-logos'
        AND auth.uid() IS NOT NULL
      )
      WITH CHECK (
        bucket_id = 'company-logos'
        AND auth.uid() IS NOT NULL
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_logos_authenticated_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY company_logos_authenticated_delete
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'company-logos'
        AND auth.uid() IS NOT NULL
      )
    $policy$;
  END IF;
END;
$$;
