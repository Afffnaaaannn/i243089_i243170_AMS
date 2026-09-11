-- Promote an existing registered account to Level 1 Research Staff.
-- Replace the email below, then run this script in Supabase SQL Editor.

BEGIN;

UPDATE public.profiles
SET role = 'USER',
    level = 'LEVEL_1',
    updated_at = now()
WHERE lower(email) = lower('researcher1@ams.edu');

-- Level 1 users retain basic inventory access and receive Advanced request access.
INSERT INTO public.user_permissions (user_id, permission_id)
SELECT profiles.id, permissions.id
FROM public.profiles
CROSS JOIN public.permissions
WHERE lower(profiles.email) = lower('researcher1@ams.edu')
  AND permissions.name IN ('asset:list', 'request:create')
ON CONFLICT (user_id, permission_id) DO NOTHING;

COMMIT;

SELECT email, role, level
FROM public.profiles
WHERE lower(email) = lower('researcher1@ams.edu');
