/*
  # Fix User Creation and Profile Management

  1. Database Functions
    - Create or replace the handle_new_user function
    - Create or replace sync functions for user metadata
    - Create or replace update_updated_at_column function

  2. Triggers
    - Ensure trigger exists for new user creation
    - Fix any broken triggers on profiles table

  3. Security
    - Update RLS policies to ensure proper access
    - Fix any permission issues

  4. Extensions
    - Ensure required extensions are enabled
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create or replace the function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    full_name, 
    role,
    title,
    bio,
    status,
    join_date,
    contract_start_date,
    contract_type,
    is_face_registered,
    created_at, 
    updated_at
  )
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'karyawan'),
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN 'Administrator'
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'kepala' THEN 'Kepala Bagian'
      ELSE 'Karyawan'
    END,
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN 'Administrator sistem absensi'
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'kepala' THEN 'Kepala Bagian di sistem absensi'
      ELSE 'Karyawan di sistem absensi'
    END,
    'active',
    CURRENT_DATE,
    CURRENT_DATE,
    'permanent',
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN true
      ELSE false
    END,
    now(), 
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the function to sync admin users
CREATE OR REPLACE FUNCTION public.sync_admin_users()
RETURNS trigger AS $$
BEGIN
  -- Delete existing entry if it exists
  DELETE FROM public.temp_admin_users WHERE user_id = NEW.id;
  
  -- Insert new entry if role is admin or kepala
  IF NEW.role IN ('admin', 'kepala') THEN
    INSERT INTO public.temp_admin_users (user_id, role, created_at)
    VALUES (NEW.id, NEW.role, now());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the function to update auth user metadata
CREATE OR REPLACE FUNCTION public.update_auth_user_metadata()
RETURNS trigger AS $$
BEGIN
  -- Update auth.users metadata when profile changes
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.role,
    'name', NEW.name,
    'full_name', NEW.full_name
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the function to sync user metadata
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS trigger AS $$
BEGIN
  -- Update auth.users metadata when profile changes
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.role,
    'name', NEW.name,
    'full_name', NEW.full_name
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS sync_admin_users_trigger ON public.profiles;
DROP TRIGGER IF EXISTS sync_user_metadata ON public.profiles;
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

-- Create the trigger to handle new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create triggers on profiles table
CREATE TRIGGER sync_admin_users_trigger 
  AFTER INSERT OR UPDATE OF role ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION sync_admin_users();

CREATE TRIGGER sync_user_metadata_trigger 
  AFTER INSERT OR UPDATE OF role, name, full_name ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION sync_user_metadata();

CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Kepala can view profiles" ON public.profiles;

-- Create updated RLS policies
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can manage all profiles" 
  ON public.profiles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE temp_admin_users.user_id = auth.uid() 
      AND temp_admin_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE temp_admin_users.user_id = auth.uid() 
      AND temp_admin_users.role = 'admin'
    )
  );

CREATE POLICY "Kepala can view profiles" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE temp_admin_users.user_id = auth.uid() 
      AND temp_admin_users.role IN ('admin', 'kepala')
    )
  );

-- Ensure temp_admin_users table has proper policies
DROP POLICY IF EXISTS "Anyone can read admin users" ON public.temp_admin_users;
DROP POLICY IF EXISTS "System can manage admin users" ON public.temp_admin_users;

CREATE POLICY "Anyone can read admin users" 
  ON public.temp_admin_users FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "System can manage admin users" 
  ON public.temp_admin_users FOR ALL 
  TO authenticated 
  USING (false) 
  WITH CHECK (false);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.temp_admin_users TO anon, authenticated;
GRANT ALL ON public.attendance TO anon, authenticated;
GRANT ALL ON public.employee_salaries TO anon, authenticated;
GRANT ALL ON public.positions TO anon, authenticated;
GRANT ALL ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.notifications TO anon, authenticated;
GRANT ALL ON public.activity_logs TO anon, authenticated;
GRANT ALL ON public.password_changes TO anon, authenticated;
GRANT ALL ON public.attendance_warnings TO anon, authenticated;
GRANT ALL ON public.warning_letters TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_admin_users() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_auth_user_metadata() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_metadata() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon, authenticated;