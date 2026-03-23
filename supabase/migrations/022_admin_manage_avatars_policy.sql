-- 022_admin_manage_avatars_policy.sql
-- Allow L5 admins to manage avatars for any user (upload/update/delete).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_admin_manage'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY avatars_admin_manage
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'avatars'
        AND public.is_l5()
      )
      WITH CHECK (
        bucket_id = 'avatars'
        AND public.is_l5()
      )
    $policy$;
  END IF;
END;
$$;
