-- One-time administrator bootstrap.
-- Replace the email below with the account that should manage the system.
-- Run only after that account has been registered.

BEGIN;

UPDATE public.profiles
SET role = 'IT_ADMIN',
    level = 'LEVEL_3',
    updated_at = now()
WHERE lower(email) = lower('i243170@isb.nu.edu.pk');

INSERT INTO public.user_permissions (user_id, permission_id)
SELECT profiles.id, permissions.id
FROM public.profiles
CROSS JOIN public.permissions
WHERE lower(profiles.email) = lower('i243170@isb.nu.edu.pk')
  AND permissions.name IN (
    'request:create', 'request:list', 'request:show', 'request:edit', 'request:approval',
    'asset:create', 'asset:list', 'asset:show', 'asset:edit',
    'location:create', 'location:list', 'location:show', 'location:edit', 'location:delete',
    'universityPart:create', 'universityPart:list', 'universityPart:show',
    'universityPart:edit', 'universityPart:delete',
    'search:simple', 'search:advanced',
    'report:list', 'report:show',
    'user:list', 'user:show', 'user:edit',
    'audit:list', 'audit:show'
  )
ON CONFLICT (user_id, permission_id) DO NOTHING;

COMMIT;

SELECT email, role, level
FROM public.profiles
WHERE lower(email) = lower('i243170@isb.nu.edu.pk');
