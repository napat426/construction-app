DO $$
BEGIN
  -- Disable RLS for weekly_reports
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'weekly_reports') THEN
    ALTER TABLE public.weekly_reports DISABLE ROW LEVEL SECURITY;
  END IF;

  -- Disable RLS for inspections
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inspections') THEN
    ALTER TABLE public.inspections DISABLE ROW LEVEL SECURITY;
  END IF;

  -- Disable RLS for concrete_pours
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'concrete_pours') THEN
    ALTER TABLE public.concrete_pours DISABLE ROW LEVEL SECURITY;
  END IF;

  -- Disable RLS for materials
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'materials') THEN
    ALTER TABLE public.materials DISABLE ROW LEVEL SECURITY;
  END IF;

  -- Disable RLS for user_profiles
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
    ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
