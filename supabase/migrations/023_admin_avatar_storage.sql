-- 023_admin_avatar_storage.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_admin_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY avatars_admin_insert
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_role_assignments ura
          WHERE ura.user_id = auth.uid() AND ura.role_code IN ('L4', 'L5') AND ura.is_active = true
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_admin_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY avatars_admin_update
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'avatars'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_role_assignments ura
          WHERE ura.user_id = auth.uid() AND ura.role_code IN ('L4', 'L5') AND ura.is_active = true
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_admin_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY avatars_admin_delete
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'avatars'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_role_assignments ura
          WHERE ura.user_id = auth.uid() AND ura.role_code IN ('L4', 'L5') AND ura.is_active = true
        )
      )
    $policy$;
  END IF;
END;
$$;