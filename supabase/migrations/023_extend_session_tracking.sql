-- Extend active_sessions with optional expiry metadata and index to speed up staleness checks.
ALTER TABLE public.active_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.active_sessions
SET expires_at = timezone('utc', now()) + INTERVAL '24 hours'
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen ON public.active_sessions (last_seen);

-- Helper for optional RPC usage by clients or diagnostics.
CREATE OR REPLACE FUNCTION public.is_session_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.active_sessions
    WHERE user_id = p_user_id
      AND last_seen > timezone('utc', now()) - INTERVAL '24 hours'
  );
END;
$$;