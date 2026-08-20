-- Creator Code generation
-- Format: {NICHE_CODE}-CREATOR-{SEQUENCE}
-- Sequence is scoped per niche.

CREATE OR REPLACE FUNCTION public.generate_creator_code(p_niche_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_niche_code text;
  v_next integer;
BEGIN
  SELECT niche_code
    INTO v_niche_code
  FROM public.niches
  WHERE id = p_niche_id;

  IF v_niche_code IS NULL THEN
    RAISE EXCEPTION 'Invalid niche_id: %', p_niche_id;
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN creator_code ~ ('^' || regexp_replace(v_niche_code, '([\\.\\+\\*\\?\\[\\]\\(\\)\\{\\}\\|\\^\\$])', '\\\\1', 'g') || '-CREATOR-[0-9]+$')
      THEN split_part(creator_code, '-CREATOR-', 2)::integer
      ELSE 0
    END
  ), 0) + 1
  INTO v_next
  FROM public.creators
  WHERE niche_id = p_niche_id;

  RETURN v_niche_code || '-CREATOR-' || lpad(v_next::text, 3, '0');
END;
$$;

-- RPC used by the frontend. The function locks the niche row while calculating
-- the next sequence to avoid duplicate creator codes during concurrent inserts.
CREATE OR REPLACE FUNCTION public.create_creator(
  p_creator_name text,
  p_handle text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_niche_id uuid DEFAULT NULL,
  p_profile_url text DEFAULT NULL,
  p_creator_type text DEFAULT NULL,
  p_content_style text DEFAULT NULL,
  p_download_path text DEFAULT NULL,
  p_status text DEFAULT 'active'
)
RETURNS public.creators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator public.creators;
  v_code text;
BEGIN
  IF p_niche_id IS NULL THEN
    RAISE EXCEPTION 'Niche is required';
  END IF;

  PERFORM 1 FROM public.niches WHERE id = p_niche_id FOR UPDATE;
  v_code := public.generate_creator_code(p_niche_id);

  INSERT INTO public.creators (
    creator_code, creator_name, handle, platform, niche_id,
    profile_url, creator_type, content_style, download_path, status
  ) VALUES (
    v_code, trim(p_creator_name), NULLIF(trim(p_handle), ''),
    NULLIF(trim(p_platform), ''), p_niche_id,
    NULLIF(trim(p_profile_url), ''), NULLIF(trim(p_creator_type), ''),
    NULLIF(trim(p_content_style), ''), NULLIF(trim(p_download_path), ''),
    COALESCE(NULLIF(trim(p_status), ''), 'active')
  )
  RETURNING * INTO v_creator;

  RETURN v_creator;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_creator_code(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_creator(text,text,text,uuid,text,text,text,text,text) TO anon, authenticated;
