-- Fix pillar performance aggregation.
-- Videos can carry pillar_id directly, so aggregate from videos.pillar_id
-- instead of requiring videos.content_id -> content_items.pillar_id.

CREATE OR REPLACE VIEW public.pillar_performance AS
SELECT
    p.id AS pillar_id,
    p.pillar_code,
    p.name AS pillar_name,
    p.niche_id,
    COUNT(DISTINCT v.id) AS video_count,
    COALESCE(SUM(v.views), 0) AS total_views,
    COALESCE(SUM(v.likes), 0) AS total_likes,
    COALESCE(SUM(v.comments), 0) AS total_comments,
    COALESCE(SUM(v.shares), 0) AS total_shares,
    COALESCE(SUM(v.saves), 0) AS total_saves,
    COALESCE(SUM(v.followers_gained), 0) AS total_followers,
    CASE
        WHEN COALESCE(SUM(v.views), 0) > 0
        THEN ROUND(SUM(v.followers_gained) / SUM(v.views) * 100, 2)
        ELSE 0
    END AS follow_conversion
FROM public.pillars p
LEFT JOIN public.videos v
    ON v.pillar_id = p.id
    AND LOWER(v.status) = 'published'
GROUP BY p.id, p.pillar_code, p.name, p.niche_id;
