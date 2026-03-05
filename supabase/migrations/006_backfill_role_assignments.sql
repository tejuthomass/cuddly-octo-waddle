-- 006_backfill_role_assignments.sql
-- Backfill user_role_assignments from legacy user_roles to preserve existing users/admins.

WITH ranked_legacy_roles AS (
  SELECT
    ur.user_id,
    CASE ur.role
      WHEN 'l1_technician' THEN 'L1'::public.role_code
      WHEN 'l2_supervisor' THEN 'L2'::public.role_code
      WHEN 'l3_manager' THEN 'L3'::public.role_code
      WHEN 'l4_management' THEN 'L4'::public.role_code
      WHEN 'l5_admin' THEN 'L5'::public.role_code
      WHEN 'client_viewer' THEN 'CLIENT'::public.role_code
    END AS role_code,
    CASE ur.role
      WHEN 'l1_technician' THEN 'Technician'
      WHEN 'l2_supervisor' THEN 'Supervisor'
      WHEN 'l3_manager' THEN 'Manager'
      WHEN 'l4_management' THEN 'Management'
      WHEN 'l5_admin' THEN 'L5 Admin'
      WHEN 'client_viewer' THEN 'Client Viewer'
    END AS role_title,
    ur.is_active,
    ur.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY ur.user_id
      ORDER BY
        ur.is_active DESC,
        CASE ur.role
          WHEN 'l5_admin' THEN 1
          WHEN 'l4_management' THEN 2
          WHEN 'l3_manager' THEN 3
          WHEN 'l2_supervisor' THEN 4
          WHEN 'l1_technician' THEN 5
          WHEN 'client_viewer' THEN 6
          ELSE 99
        END,
        ur.created_at DESC
    ) AS rn
  FROM public.user_roles ur
)
INSERT INTO public.user_role_assignments (
  user_id,
  role_code,
  role_title,
  is_active,
  granted_by,
  created_at,
  updated_at
)
SELECT
  r.user_id,
  r.role_code,
  r.role_title,
  r.is_active,
  NULL,
  r.created_at,
  timezone('utc', now())
FROM ranked_legacy_roles r
WHERE r.rn = 1
  AND r.role_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = r.user_id
  );
