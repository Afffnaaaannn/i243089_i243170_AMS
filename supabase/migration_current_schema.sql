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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('IT_ADMIN', 'UNIVERSITY_ADMIN')
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin
    ON public.profiles FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
    ON public.profiles FOR UPDATE TO authenticated
    USING (public.is_admin())
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

-- Inventory and workflow data. The application uses these tables as its only
-- operational data store; localStorage is not used for business records.
CREATE TABLE IF NOT EXISTS public.universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.faculties (
    id TEXT PRIMARY KEY,
    university_id TEXT NOT NULL REFERENCES public.universities(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY,
    faculty_id TEXT NOT NULL REFERENCES public.faculties(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    default_level INTEGER NOT NULL CHECK (default_level BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    room TEXT NOT NULL,
    department_id TEXT NOT NULL REFERENCES public.departments(id),
    exception_request_id TEXT,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    department_id TEXT NOT NULL REFERENCES public.departments(id),
    faculty_id TEXT NOT NULL REFERENCES public.faculties(id),
    university_id TEXT NOT NULL REFERENCES public.universities(id),
    location_id TEXT NOT NULL REFERENCES public.locations(id),
    condition TEXT NOT NULL,
    status TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requests (
    id TEXT PRIMARY KEY,
    request_number TEXT NOT NULL UNIQUE,
    request_type TEXT NOT NULL,
    form_type TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    asset_id TEXT REFERENCES public.assets(id),
    location_id TEXT REFERENCES public.locations(id),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    purpose TEXT NOT NULL,
    special_justification TEXT,
    status TEXT NOT NULL,
    department_id TEXT REFERENCES public.departments(id),
    faculty_id TEXT REFERENCES public.faculties(id),
    university_id TEXT REFERENCES public.universities(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transfers (
    id TEXT PRIMARY KEY,
    transfer_number TEXT NOT NULL UNIQUE,
    asset_id UUID NOT NULL REFERENCES public.assets(id),
    source_department_id TEXT NOT NULL REFERENCES public.departments(id),
    destination_department_id TEXT NOT NULL REFERENCES public.departments(id),
    destination_faculty_id TEXT NOT NULL REFERENCES public.faculties(id),
    destination_university_id TEXT NOT NULL REFERENCES public.universities(id),
    destination_location_id UUID REFERENCES public.locations(id),
    transfer_type TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.universities (id, name, code) VALUES
    ('univ-1', 'Central State University', 'CSU'),
    ('univ-ext', 'External Partner University', 'EPU')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.faculties (id, university_id, name, code) VALUES
    ('fac-fet', 'univ-1', 'Faculty of Engineering & Technology', 'FET'),
    ('fac-fos', 'univ-1', 'Faculty of Science', 'FOS'),
    ('fac-ext', 'univ-ext', 'External Faculty of Medicine', 'EFM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, faculty_id, name, code) VALUES
    ('dept-cse', 'fac-fet', 'Computer Science & Engineering', 'CSE'),
    ('dept-ee', 'fac-fet', 'Electrical & Electronic Engineering', 'EE'),
    ('dept-phys', 'fac-fos', 'Department of Physics', 'PHYS'),
    ('dept-chem', 'fac-fos', 'Department of Chemistry', 'CHEM'),
    ('dept-ext', 'fac-ext', 'External Medical Research', 'EXT')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, name, description, default_level) VALUES
    ('IT_GROUP_MEMBER', 'IT Group Member', 'Technical specialist for infrastructure and authorized location creation.', 2),
    ('DEPARTMENT_ADMIN', 'Department Administrator (DA)', 'Department-level asset manager and first-tier transfer approver.', 1),
    ('FACULTY_ADMIN', 'Faculty Administrator / Dean', 'Faculty-level manager and cross-department transfer approver.', 2),
    ('UNIVERSITY_ADMIN', 'University Administrator', 'Central campus governance, policy, and cross-faculty approver.', 3),
    ('STANDARD_USER', 'Standard User (Level 0)', 'Student or basic staff member.', 0),
    ('RESEARCH_STAFF', 'Senior Researcher (Level 1)', 'Academic and research personnel.', 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['universities', 'faculties', 'departments', 'roles', 'locations', 'assets', 'requests', 'transfers'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', table_name);
        EXECUTE format('CREATE POLICY authenticated_full_access ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', table_name);
    END LOOP;
END $$;
