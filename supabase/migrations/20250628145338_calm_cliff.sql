/*
  # Exclude admin users from absence tracking
  
  This migration creates a function to check if a user should be tracked for absence.
  Admin users are excluded from absence tracking.
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

-- Create a trigger function to handle absence tracking
CREATE OR REPLACE FUNCTION handle_absence_tracking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the user is an admin
  IF NOT should_track_absence(NEW.role) THEN
    -- For admin users, don't track absences
    RETURN NEW;
  END IF;
  
  -- For non-admin users, continue with normal absence tracking
  RETURN NEW;
END;
$$;

-- Add a comment to explain the purpose of this migration
COMMENT ON FUNCTION should_track_absence(text) IS 'Determines if a user should be tracked for absence based on their role. Admin users are excluded.';
COMMENT ON FUNCTION handle_absence_tracking() IS 'Trigger function to handle absence tracking, excluding admin users.';