/*
  # Add Work Hours Settings

  1. New Settings
    - Add work_hours setting to system_settings table if it doesn't exist
    - Contains start time, end time, late threshold, early leave threshold, and break duration
  
  2. Changes
    - Ensures the work_hours setting exists with default values
    - Provides configuration for attendance validation
*/

-- Insert work_hours setting if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'work_hours') THEN
    INSERT INTO system_settings (setting_key, setting_value, description, is_enabled)
    VALUES (
      'work_hours',
      '{
        "startTime": "08:00",
        "endTime": "17:00",
        "lateThreshold": 15,
        "earlyLeaveThreshold": 15,
        "breakDuration": 60
      }',
      'Standard working hours configuration',
      true
    );
  END IF;
END $$;

-- Create function to check if employee is late based on work hours settings
CREATE OR REPLACE FUNCTION is_employee_late(check_in_time timestamptz)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  work_hours_settings jsonb;
  start_time text;
  late_threshold integer;
  check_in_time_only time;
  start_time_only time;
  late_threshold_interval interval;
BEGIN
  -- Get work hours settings
  SELECT setting_value INTO work_hours_settings
  FROM system_settings
  WHERE setting_key = 'work_hours'
  LIMIT 1;
  
  -- If no settings found, use defaults
  IF work_hours_settings IS NULL THEN
    start_time := '08:00';
    late_threshold := 15;
  ELSE
    start_time := work_hours_settings->>'startTime';
    late_threshold := (work_hours_settings->>'lateThreshold')::integer;
  END IF;
  
  -- Convert to time types
  check_in_time_only := check_in_time::time;
  start_time_only := start_time::time;
  late_threshold_interval := (late_threshold || ' minutes')::interval;
  
  -- Check if employee is late (after start time + threshold)
  RETURN check_in_time_only > (start_time_only + late_threshold_interval);
END;
$$;

-- Create function to calculate late minutes
CREATE OR REPLACE FUNCTION calculate_late_minutes(check_in_time timestamptz)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  work_hours_settings jsonb;
  start_time text;
  check_in_time_only time;
  start_time_only time;
  diff_minutes integer;
BEGIN
  -- Get work hours settings
  SELECT setting_value INTO work_hours_settings
  FROM system_settings
  WHERE setting_key = 'work_hours'
  LIMIT 1;
  
  -- If no settings found, use defaults
  IF work_hours_settings IS NULL THEN
    start_time := '08:00';
  ELSE
    start_time := work_hours_settings->>'startTime';
  END IF;
  
  -- Convert to time types
  check_in_time_only := check_in_time::time;
  start_time_only := start_time::time;
  
  -- Calculate difference in minutes
  diff_minutes := EXTRACT(EPOCH FROM (check_in_time_only - start_time_only))/60;
  
  -- Return late minutes (0 if not late)
  RETURN GREATEST(diff_minutes, 0);
END;
$$;

-- Add comments to explain the purpose of these functions
COMMENT ON FUNCTION is_employee_late(timestamptz) IS 'Determines if an employee is late based on work hours settings.';
COMMENT ON FUNCTION calculate_late_minutes(timestamptz) IS 'Calculates how many minutes an employee is late based on work hours settings.';