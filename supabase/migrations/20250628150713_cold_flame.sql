/*
  # Exclude Admin Users from Absence Tracking

  1. New Functions
    - `should_track_absence(user_role text)`: Determines if a user should be tracked for absence based on role
    - `get_absent_employees(p_date date)`: Returns a list of absent employees, excluding admins

  2. Changes
    - Adds logic to exclude admin users from absence tracking
    - Improves absence tracking for dashboard statistics
*/

-- Create a function to check if a user should be tracked for absence
CREATE OR REPLACE FUNCTION should_track_absence(user_role text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Exclude admin users from absence tracking
  RETURN user_role != 'admin';
END;
$$;

-- Create a function to handle absence tracking for the dashboard
CREATE OR REPLACE FUNCTION get_absent_employees(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    p.department
  FROM 
    profiles p
  WHERE 
    p.status = 'active'
    AND p.role != 'admin'  -- Exclude admin users
    AND NOT EXISTS (
      SELECT 1 
      FROM attendance a 
      WHERE a.user_id = p.id 
        AND a.type = 'masuk'
        AND a.status = 'berhasil'
        AND DATE(a.timestamp) = p_date
    );
END;
$$;

-- Add comments to explain the purpose of these functions
COMMENT ON FUNCTION should_track_absence(text) IS 'Determines if a user should be tracked for absence based on their role. Admin users are excluded.';
COMMENT ON FUNCTION get_absent_employees(date) IS 'Returns a list of employees who are absent on a given date, excluding admin users.';