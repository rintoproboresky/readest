-- Stub functions for usage tracking (self-host: no quota enforcement).
-- These prevent PGRST202 errors when the app calls get_current_usage
-- or increment_daily_usage via supabase.rpc().

CREATE OR REPLACE FUNCTION public.get_current_usage(
    p_user_id uuid,
    p_usage_type text,
    p_period text DEFAULT 'daily'
)
RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_usage(
    p_user_id uuid,
    p_usage_type text,
    p_usage_date text,
    p_increment integer DEFAULT 1,
    p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
    RETURN 0;
END;
$$;

GRANT ALL ON FUNCTION public.get_current_usage TO authenticated;
GRANT ALL ON FUNCTION public.increment_daily_usage TO authenticated;
