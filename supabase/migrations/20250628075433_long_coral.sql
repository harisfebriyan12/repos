/*
  # Fix RLS Infinite Recursion Issue

  1. Problem
    - Current RLS policies on profiles table are causing infinite recursion
    - Policies are likely referencing profiles table within their conditions
    - This creates circular dependencies when executing queries

  2. Solution
    - Drop existing problematic policies
    - Create new simplified policies that avoid recursion
    - Use direct auth.uid() comparisons instead of subqueries to profiles table

  3. Security
    - Maintain proper access control
    - Users can only access their own data
    - Admins can access all data
    - Kepala can access non-admin data
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Kepala can view non-admin profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create new non-recursive policies for profiles table

-- 1. Users can view their own profile (simple, no recursion)
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO public
  USING (auth.uid() = id);

-- 2. Users can update their own profile (simple, no recursion)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Admin can view all profiles (using auth metadata instead of profiles table lookup)
CREATE POLICY "Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  TO public
  USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  );

-- 4. Admin can manage all profiles (using auth metadata)
CREATE POLICY "Admin can manage all profiles"
  ON public.profiles
  FOR ALL
  TO public
  USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  );

-- 5. Kepala can view non-admin profiles (simplified)
CREATE POLICY "Kepala can view non-admin profiles"
  ON public.profiles
  FOR SELECT
  TO public
  USING (
    (auth.jwt() ->> 'role' = 'kepala' OR
     auth.uid() IN (
       SELECT id FROM auth.users 
       WHERE raw_user_meta_data ->> 'role' = 'kepala'
     )) 
    AND role != 'admin'
  );

-- Also fix any recursive policies on related tables that might reference profiles

-- Fix attendance policies to avoid recursion
DROP POLICY IF EXISTS "Admin can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Kepala can view non-admin attendance" ON public.attendance;

CREATE POLICY "Admin can view all attendance"
  ON public.attendance
  FOR SELECT
  TO public
  USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  );

CREATE POLICY "Kepala can view non-admin attendance"
  ON public.attendance
  FOR SELECT
  TO public
  USING (
    (auth.jwt() ->> 'role' = 'kepala' OR
     auth.uid() IN (
       SELECT id FROM auth.users 
       WHERE raw_user_meta_data ->> 'role' = 'kepala'
     )) 
    AND user_id IN (
      SELECT id FROM public.profiles WHERE role != 'admin'
    )
  );

-- Fix notifications policies
DROP POLICY IF EXISTS "Admin can manage all notifications" ON public.notifications;

CREATE POLICY "Admin can manage all notifications"
  ON public.notifications
  FOR ALL
  TO public
  USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  );

-- Fix attendance_warnings policies
DROP POLICY IF EXISTS "Admin can manage all warnings" ON public.attendance_warnings;
DROP POLICY IF EXISTS "Kepala can manage non-admin warnings" ON public.attendance_warnings;

CREATE POLICY "Admin can manage all warnings"
  ON public.attendance_warnings
  FOR ALL
  TO public
  USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  );

CREATE POLICY "Kepala can manage non-admin warnings"
  ON public.attendance_warnings
  FOR ALL
  TO public
  USING (
    (auth.jwt() ->> 'role' = 'kepala' OR
     auth.uid() IN (
       SELECT id FROM auth.users 
       WHERE raw_user_meta_data ->> 'role' = 'kepala'
     )) 
    AND user_id IN (
      SELECT id FROM public.profiles WHERE role != 'admin'
    )
  );

-- Fix employee_salaries policies
DROP POLICY IF EXISTS "Admin can view all salaries" ON public.employee_salaries;
DROP POLICY IF EXISTS "Kepala can view non-admin salaries" ON public.employee_salaries;

CREATE POLICY "Admin can view all salaries"
  ON public.employee_salaries
  FOR SELECT
  TO public
  USING (
    auth.jwt() ->> 'role' = 'admin' OR
    (auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    ))
  );

CREATE POLICY "Kepala can view non-admin salaries"
  ON public.employee_salaries
  FOR SELECT
  TO public
  USING (
    (auth.jwt() ->> 'role' = 'kepala' OR
     auth.uid() IN (
       SELECT id FROM auth.users 
       WHERE raw_user_meta_data ->> 'role' = 'kepala'
     )) 
    AND user_id IN (
      SELECT id FROM public.profiles WHERE role != 'admin'
    )
  );

-- Create a function to update user metadata when profile role changes
CREATE OR REPLACE FUNCTION update_auth_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auth.users metadata when profile role changes
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to keep auth metadata in sync
DROP TRIGGER IF EXISTS sync_user_metadata ON public.profiles;
CREATE TRIGGER sync_user_metadata
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_user_metadata();

-- Update existing users' metadata
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles p 
WHERE auth.users.id = p.id;