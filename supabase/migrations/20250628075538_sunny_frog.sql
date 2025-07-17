/*
  # Fix RLS policies for notifications, attendance, and attendance_warnings tables

  1. Policy Updates
    - Fix policies that incorrectly reference 'users' table instead of 'profiles'
    - Update admin and kepala role checks to use profiles table
    - Ensure proper user access controls

  2. Tables Updated
    - notifications: Fix admin policies to use profiles table
    - attendance: Fix admin and kepala policies to use profiles table  
    - attendance_warnings: Fix admin and kepala policies to use profiles table

  3. Security
    - Maintain existing access patterns
    - Users can only access their own data
    - Admins can access all data
    - Kepala can access non-admin data
*/

-- Fix notifications table policies
DROP POLICY IF EXISTS "Admin can manage all notifications" ON notifications;
DROP POLICY IF EXISTS "Admin can view all notifications" ON notifications;

CREATE POLICY "Admin can manage all notifications"
  ON notifications
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Fix attendance table policies  
DROP POLICY IF EXISTS "Admin can manage all attendance" ON attendance;
DROP POLICY IF EXISTS "Admin can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Kepala can view non-admin attendance" ON attendance;

CREATE POLICY "Admin can manage all attendance"
  ON attendance
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Kepala can view non-admin attendance"
  ON attendance
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'kepala'
    )
    AND user_id IN (
      SELECT profiles.id FROM profiles 
      WHERE profiles.role <> 'admin'
    )
  );

-- Fix attendance_warnings table policies
DROP POLICY IF EXISTS "Admin can manage all warnings" ON attendance_warnings;
DROP POLICY IF EXISTS "Kepala can manage non-admin warnings" ON attendance_warnings;

CREATE POLICY "Admin can manage all warnings"
  ON attendance_warnings
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Kepala can manage non-admin warnings"
  ON attendance_warnings
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'kepala'
    )
    AND user_id IN (
      SELECT profiles.id FROM profiles 
      WHERE profiles.role <> 'admin'
    )
  );

-- Fix employee_salaries table policies
DROP POLICY IF EXISTS "Admin can view all salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Kepala can view non-admin salaries" ON employee_salaries;

CREATE POLICY "Admin can view all salaries"
  ON employee_salaries
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Kepala can view non-admin salaries"
  ON employee_salaries
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'kepala'
    )
    AND user_id IN (
      SELECT profiles.id FROM profiles 
      WHERE profiles.role <> 'admin'
    )
  );

-- Fix profiles table policies
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Kepala can view non-admin profiles" ON profiles;

CREATE POLICY "Admin can manage all profiles"
  ON profiles
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can view all profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Kepala can view non-admin profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'kepala'
    )
    AND role <> 'admin'
  );