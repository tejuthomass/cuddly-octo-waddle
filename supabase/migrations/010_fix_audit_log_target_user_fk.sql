-- 010_fix_audit_log_target_user_fk.sql
-- Prevent audit insert FK errors when deleting profiles and cascaded user-linked rows.

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID;
  row_id UUID;
  candidate_target_user_id UUID;
BEGIN
  actor := auth.uid();
  row_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);

  candidate_target_user_id := CASE
    WHEN TG_TABLE_NAME IN ('profiles', 'user_role_assignments', 'user_companies', 'user_facilities')
    THEN COALESCE((to_jsonb(NEW)->>'user_id')::uuid, (to_jsonb(OLD)->>'user_id')::uuid, row_id)
    ELSE NULL
  END;

  IF candidate_target_user_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = candidate_target_user_id
     ) THEN
    candidate_target_user_id := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    actor_user_id,
    action_type,
    entity_type,
    entity_id,
    target_user_id,
    before_data,
    after_data
  ) VALUES (
    actor,
    TG_OP,
    TG_TABLE_NAME,
    row_id,
    candidate_target_user_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
