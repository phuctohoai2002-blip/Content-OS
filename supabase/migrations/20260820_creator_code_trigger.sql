-- Make Creator Code system-generated at the database layer.
-- Format: {niche_code}-CREATOR-{sequence}

CREATE OR REPLACE FUNCTION public.generate_creator_code(p_niche_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_niche_code text;
  v_next integer;
BEGIN
  IF p_niche_id IS NULL THEN
    RAISE EXCEPTION 'Niche is required to generate Creator Code';
  END IF;

  -- Serialize code generation per niche for concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtext('creator-code:' || p_niche_id::text));

  SELECT niche_code INTO v_niche_code
  FROM public.niches
  WHERE id = p_niche_id;

  IF v_niche_code IS NULL THEN
    RAISE EXCEPTION 'Invalid niche_id: %', p_niche_id;
  END IF;

  SELECT COALESCE(MAX(split_part(creator_code, '-CREATOR-', 2)::integer), 0) + 1
  INTO v_next
  FROM public.creators
  WHERE niche_id = p_niche_id
    AND creator_code LIKE v_niche_code || '-CREATOR-%'
    AND split_part(creator_code, '-CREATOR-', 2) ~ '^[0-9]+$';

  RETURN v_niche_code || '-CREATOR-' || lpad(v_next::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_creator_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.creator_code := public.generate_creator_code(NEW.niche_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creators_generate_code ON public.creators;
CREATE TRIGGER creators_generate_code
BEFORE INSERT ON public.creators
FOR EACH ROW
EXECUTE FUNCTION public.set_creator_code();

GRANT EXECUTE ON FUNCTION public.generate_creator_code(uuid) TO anon, authenticated;
