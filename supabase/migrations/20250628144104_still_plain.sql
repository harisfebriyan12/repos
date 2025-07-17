/*
  # Add unique constraint to attendance table

  1. Changes
    - Add unique constraint on (user_id, timestamp) to attendance table
    - This allows ON CONFLICT operations to work properly

  2. Security
    - No changes to RLS policies needed
*/

-- Add unique constraint on user_id and timestamp
-- This prevents duplicate attendance records for the same user at the exact same time
ALTER TABLE attendance 
ADD CONSTRAINT attendance_user_timestamp_unique 
UNIQUE (user_id, timestamp);