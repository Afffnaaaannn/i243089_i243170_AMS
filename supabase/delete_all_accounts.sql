-- WARNING: This permanently deletes every user account in this Supabase project.
-- Related profiles, permissions, requests, and approvals are removed by foreign keys.

BEGIN;

DELETE FROM auth.users;

COMMIT;
