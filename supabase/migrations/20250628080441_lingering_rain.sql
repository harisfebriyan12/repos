-- Fix infinite recursion in RLS policies by simplifying them
-- This migration removes circular dependencies without accessing auth schema

-- First, let's add a role column to auth.users metadata during registration
-- We'll handle this through application logic instead of database functions

-- Drop existing problematic policies on profiles table
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Kepala can view non-admin profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create simplified policies that don't cause recursion
-- Basic user access - users can always access their own data
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (for registration)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- For admin/kepala access, we'll use a simpler approach
-- Create a temporary table to store admin user IDs to avoid recursion
CREATE TABLE IF NOT EXISTS temp_admin_users (
  user_id uuid PRIMARY KEY,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on temp table
ALTER TABLE temp_admin_users ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read from temp_admin_users
CREATE POLICY "Anyone can read admin users"
  ON temp_admin_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow system to insert/update temp_admin_users
CREATE POLICY "System can manage admin users"
  ON temp_admin_users
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Admin policy using the temp table
CREATE POLICY "Admin can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Kepala can view profiles (but not manage admin profiles)
CREATE POLICY "Kepala can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'kepala')
    )
  );

-- Fix similar issues in other tables

-- Drop and recreate policies for employee_salaries
DROP POLICY IF EXISTS "Admin can manage all salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Admin can view all salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Kepala can view non-admin salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Users can view own salary" ON employee_salaries;

CREATE POLICY "Users can view own salary"
  ON employee_salaries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all salaries"
  ON employee_salaries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can view salaries"
  ON employee_salaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'kepala')
    )
  );

-- Fix attendance policies
DROP POLICY IF EXISTS "Admin can manage all attendance" ON attendance;
DROP POLICY IF EXISTS "Kepala can view non-admin attendance" ON attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;

CREATE POLICY "Users can view own attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage all attendance"
  ON attendance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can view attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'kepala')
    )
  );

-- Fix attendance_warnings policies
DROP POLICY IF EXISTS "Admin can manage all warnings" ON attendance_warnings;
DROP POLICY IF EXISTS "Kepala can manage non-admin warnings" ON attendance_warnings;
DROP POLICY IF EXISTS "Users can view own warnings" ON attendance_warnings;

CREATE POLICY "Users can view own warnings"
  ON attendance_warnings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all warnings"
  ON attendance_warnings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can manage warnings"
  ON attendance_warnings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'kepala')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'kepala')
    )
  );

-- Fix warning_letters policies
DROP POLICY IF EXISTS "Admin can manage all warning letters" ON warning_letters;
DROP POLICY IF EXISTS "Users can view own warning letters" ON warning_letters;

CREATE POLICY "Users can view own warning letters"
  ON warning_letters
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all warning letters"
  ON warning_letters
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix notifications policies
DROP POLICY IF EXISTS "Admin can manage all notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage all notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Admin can view all activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;

CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can view all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Fix password_changes policies
DROP POLICY IF EXISTS "Admin can view all password changes" ON password_changes;
DROP POLICY IF EXISTS "Authenticated users can insert password changes" ON password_changes;
DROP POLICY IF EXISTS "Users can view own password changes" ON password_changes;

CREATE POLICY "Users can view own password changes"
  ON password_changes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert password changes"
  ON password_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can view all password changes"
  ON password_changes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix system_settings policies
DROP POLICY IF EXISTS "Admin can manage system settings" ON system_settings;
DROP POLICY IF EXISTS "Authenticated users can view system settings" ON system_settings;

CREATE POLICY "Authenticated users can view system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage system settings"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Fix positions policies
DROP POLICY IF EXISTS "Admin can manage positions" ON positions;
DROP POLICY IF EXISTS "Authenticated users can view positions" ON positions;

CREATE POLICY "Authenticated users can view positions"
  ON positions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage positions"
  ON positions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create a function to sync admin users to temp table
CREATE OR REPLACE FUNCTION sync_admin_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove old entry if exists
  DELETE FROM temp_admin_users WHERE user_id = NEW.id;
  
  -- Add new entry if user is admin or kepala
  IF NEW.role IN ('admin', 'kepala') THEN
    INSERT INTO temp_admin_users (user_id, role)
    VALUES (NEW.id, NEW.role)
    ON CONFLICT (user_id) DO UPDATE SET role = NEW.role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync admin users
DROP TRIGGER IF EXISTS sync_admin_users_trigger ON profiles;
CREATE TRIGGER sync_admin_users_trigger
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_admin_users();

-- Populate temp_admin_users with existing admin/kepala users
INSERT INTO temp_admin_users (user_id, role)
SELECT id, role FROM profiles 
WHERE role IN ('admin', 'kepala')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;