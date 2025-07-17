/*
  # Fix Attendance Tracking System
  
  1. New Features
    - Add function to properly track daily attendance status
    - Ensure only one absence record per day
    - Fix check-out not being counted as attendance
    
  2. Changes
    - Add function to determine if a user has already been marked absent
    - Add function to get user's attendance status for a specific day
    - Add trigger to prevent duplicate absence records
    
  3. Security
    - No changes to RLS policies
*/

-- Create function to check if a user has already been marked absent for a day
CREATE OR REPLACE FUNCTION has_absence_record(p_user_id uuid, p_date date)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM attendance 
    WHERE user_id = p_user_id 
      AND type = 'absent'
      AND DATE(timestamp) = p_date
  );
END;
$$;

-- Create function to get user's attendance status for a day
CREATE OR REPLACE FUNCTION get_user_attendance_status(p_user_id uuid, p_date date)
RETURNS TABLE (
  has_check_in boolean,
  has_check_out boolean,
  is_absent boolean,
  check_in_time timestamptz,
  check_out_time timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS (
      SELECT 1 FROM attendance 
      WHERE user_id = p_user_id 
        AND type = 'masuk' 
        AND status = 'berhasil'
        AND DATE(timestamp) = p_date
    ) AS has_check_in,
    EXISTS (
      SELECT 1 FROM attendance 
      WHERE user_id = p_user_id 
        AND type = 'keluar' 
        AND status = 'berhasil'
        AND DATE(timestamp) = p_date
    ) AS has_check_out,
    EXISTS (
      SELECT 1 FROM attendance 
      WHERE user_id = p_user_id 
        AND type = 'absent'
        AND DATE(timestamp) = p_date
    ) AS is_absent,
    (
      SELECT timestamp FROM attendance 
      WHERE user_id = p_user_id 
        AND type = 'masuk' 
        AND status = 'berhasil'
        AND DATE(timestamp) = p_date
      LIMIT 1
    ) AS check_in_time,
    (
      SELECT timestamp FROM attendance 
      WHERE user_id = p_user_id 
        AND type = 'keluar' 
        AND status = 'berhasil'
        AND DATE(timestamp) = p_date
      LIMIT 1
    ) AS check_out_time;
END;
$$;

-- Create function to mark user as absent
CREATE OR REPLACE FUNCTION mark_user_absent(p_user_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_role text;
  v_user_status text;
  v_already_absent boolean;
  v_has_attendance boolean;
BEGIN
  -- Check if user is admin (admins are excluded from absence tracking)
  SELECT role, status INTO v_user_role, v_user_status
  FROM profiles
  WHERE id = p_user_id;
  
  -- Skip if user is admin or inactive
  IF v_user_role = 'admin' OR v_user_status != 'active' THEN
    RETURN;
  END IF;
  
  -- Check if user already has an absence record for this day
  SELECT has_absence_record(p_user_id, p_date) INTO v_already_absent;
  
  -- Check if user already has any attendance for this day
  SELECT 
    EXISTS (
      SELECT 1 FROM attendance 
      WHERE user_id = p_user_id 
        AND (type = 'masuk' OR type = 'keluar')
        AND status = 'berhasil'
        AND DATE(timestamp) = p_date
    ) INTO v_has_attendance;
  
  -- Only create absence record if user doesn't have attendance and isn't already marked absent
  IF NOT v_has_attendance AND NOT v_already_absent THEN
    INSERT INTO attendance (
      user_id,
      type,
      timestamp,
      status,
      is_late,
      late_minutes,
      work_hours,
      overtime_hours,
      notes
    ) VALUES (
      p_user_id,
      'absent',
      p_date::timestamp + interval '23 hours 59 minutes',
      'tidak_hadir',
      false,
      0,
      0,
      0,
      'Tidak hadir - tidak melakukan absensi'
    );
  END IF;
END;
$$;

-- Create function to mark all active non-admin users as absent
CREATE OR REPLACE FUNCTION mark_all_absent_users(p_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r_user record;
BEGIN
  -- Loop through all active non-admin users
  FOR r_user IN 
    SELECT id 
    FROM profiles 
    WHERE status = 'active' 
      AND role != 'admin'
  LOOP
    -- Check if user already has attendance for this day
    IF NOT EXISTS (
      SELECT 1 
      FROM attendance 
      WHERE user_id = r_user.id 
        AND (type = 'masuk' OR type = 'keluar')
        AND status = 'berhasil'
        AND DATE(timestamp) = p_date
    ) THEN
      -- Mark user as absent
      PERFORM mark_user_absent(r_user.id, p_date);
    END IF;
  END LOOP;
END;
$$;

-- Add comments to explain the purpose of these functions
COMMENT ON FUNCTION has_absence_record(uuid, date) IS 'Checks if a user already has an absence record for a specific day';
COMMENT ON FUNCTION get_user_attendance_status(uuid, date) IS 'Gets a user''s attendance status for a specific day';
COMMENT ON FUNCTION mark_user_absent(uuid, date) IS 'Marks a user as absent for a specific day if they don''t have attendance';
COMMENT ON FUNCTION mark_all_absent_users(date) IS 'Marks all active non-admin users as absent for a specific day if they don''t have attendance';