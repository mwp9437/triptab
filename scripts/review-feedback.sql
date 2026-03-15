-- ============================================================
-- Feedback Review Queries
-- Paste these into the Supabase SQL Editor to review feedback
-- ============================================================

-- All new feedback, newest first
SELECT id, user_email, feedback_type, message, page_url, created_at
FROM public.feedback
WHERE status = 'new'
ORDER BY created_at DESC;

-- All feedback grouped by type
SELECT feedback_type, count(*) as total,
  count(*) FILTER (WHERE status = 'new') as new_count,
  count(*) FILTER (WHERE status = 'reviewed') as reviewed_count,
  count(*) FILTER (WHERE status = 'fixed') as fixed_count
FROM public.feedback
GROUP BY feedback_type
ORDER BY total DESC;

-- Mark a specific feedback as reviewed (replace the UUID)
-- UPDATE public.feedback SET status = 'reviewed' WHERE id = 'PASTE-UUID-HERE';

-- Mark a specific feedback as fixed
-- UPDATE public.feedback SET status = 'fixed' WHERE id = 'PASTE-UUID-HERE';

-- Mark a specific feedback as wontfix
-- UPDATE public.feedback SET status = 'wontfix' WHERE id = 'PASTE-UUID-HERE';

-- Export all feedback as JSON (for feeding to Claude Code)
SELECT json_agg(
  json_build_object(
    'id', id,
    'type', feedback_type,
    'message', message,
    'email', user_email,
    'page', page_url,
    'status', status,
    'created', created_at
  ) ORDER BY created_at DESC
) as feedback_json
FROM public.feedback
WHERE status = 'new';
