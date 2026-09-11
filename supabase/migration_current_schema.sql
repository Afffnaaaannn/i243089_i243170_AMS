-- Compatibility migration for the existing Supabase schema.
-- This keeps the current USER/LEVEL_* model and creates profiles for new signups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_username TEXT;
BEGIN
    v_username := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, username, full_name, email, level, role)
    VALUES (
        NEW.id,
        v_username,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), v_username),
        NEW.email,
        'LEVEL_0',
        'USER'
    );

    INSERT INTO public.user_permissions (user_id, permission_id)
    SELECT NEW.id, id FROM public.permissions WHERE name = 'asset:list';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for accounts registered before the trigger was installed.
INSERT INTO public.profiles (id, username, full_name, email, level, role)
SELECT
    users.id,
    COALESCE(NULLIF(users.raw_user_meta_data->>'username', ''), split_part(users.email, '@', 1)),
    COALESCE(NULLIF(users.raw_user_meta_data->>'full_name', ''), split_part(users.email, '@', 1)),
    users.email,
    'LEVEL_0',
    'USER'
FROM auth.users AS users
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles AS existing WHERE existing.id = users.id
);

INSERT INTO public.user_permissions (user_id, permission_id)
SELECT profiles.id, permissions.id
FROM public.profiles
JOIN public.permissions ON permissions.name = 'asset:list'
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_permissions AS existing
    WHERE existing.user_id = profiles.id AND existing.permission_id = permissions.id
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
    ON public.profiles FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles AS actor
        WHERE actor.id = auth.uid()
          AND actor.role IN ('IT_ADMIN', 'UNIVERSITY_ADMIN')
    ))
    WITH CHECK (true);

DROP POLICY IF EXISTS permissions_read_authenticated ON public.permissions;
CREATE POLICY permissions_read_authenticated
    ON public.permissions FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS user_permissions_read_own ON public.user_permissions;
CREATE POLICY user_permissions_read_own
    ON public.user_permissions FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_permissions_insert_own ON public.user_permissions;
CREATE POLICY user_permissions_insert_own
    ON public.user_permissions FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_permissions_manage_admin ON public.user_permissions;
CREATE POLICY user_permissions_manage_admin
    ON public.user_permissions FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles AS actor
        WHERE actor.id = auth.uid()
          AND actor.role IN ('IT_ADMIN', 'UNIVERSITY_ADMIN')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles AS actor
        WHERE actor.id = auth.uid()
          AND actor.role IN ('IT_ADMIN', 'UNIVERSITY_ADMIN')
    ));
