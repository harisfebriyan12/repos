/*
  # Add Camera Verification Settings

  1. New Settings
    - Add camera_verification setting to system_settings table
    - Contains enabled flag and admin requirement flag
  
  2. Changes
    - Ensures the camera_verification setting exists with default values
    - Provides configuration for face verification requirements
*/

-- Insert camera_verification setting if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'camera_verification') THEN
    INSERT INTO system_settings (setting_key, setting_value, description, is_enabled)
    VALUES (
      'camera_verification',
      '{"enabled": true, "required_for_admin": false, "updated_by": null, "updated_at": null}',
      'Controls whether face verification is required for attendance',
      true
    );
  END IF;
END $$;