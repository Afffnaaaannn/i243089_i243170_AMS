-- Promote an existing registered account to Inventory Admin.
-- Replace the email below, then run this script in Supabase SQL Editor.

BEGIN;

UPDATE public.profiles
SET role = 'INVENTORY_ADMIN',
    level = 'LEVEL_2',
    updated_at = now()
WHERE lower(email) = lower('aroojabrar2@gmail.com');

INSERT INTO public.user_permissions (user_id, permission_id)
SELECT profiles.id, permissions.id
FROM public.profiles
CROSS JOIN public.permissions
WHERE lower(profiles.email) = lower('aroojabrar2@gmail.com')
  AND permissions.name IN (
    'asset:create',
    'asset:list',
    'asset:show',
    'asset:edit',
    'location:list',
    'location:show',
    'request:list',
    'request:show',
    'report:list',
    'report:show'
  )
ON CONFLICT (user_id, permission_id) DO NOTHING;

COMMIT;

SELECT email, role, level
FROM public.profiles
WHERE lower(email) = lower('aroojabrar2@gmail.com');
