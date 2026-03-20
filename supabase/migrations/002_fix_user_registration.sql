-- ============================================================
-- Fix: Allow user registration by adding INSERT policy
-- and auto-sync trigger from auth.users → public.users
-- ============================================================

-- 1. Allow authenticated users to insert their own record
CREATE POLICY IF NOT EXISTS "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Auto-create public.users when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      'user'::public.user_role
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      public.users.role
    );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
