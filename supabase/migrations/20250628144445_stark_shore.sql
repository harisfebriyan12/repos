/*
  # Fix attendance unique constraint

  1. Changes
    - Adds a DO block to check if the constraint already exists before adding it
    - Prevents the "relation already exists" error
    - Ensures the unique constraint on user_id and timestamp is properly in place
*/

-- Check if the constraint already exists and add it only if it doesn't
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'attendance_user_timestamp_unique' 
        AND table_name = 'attendance'
    ) THEN
        -- Add the unique constraint if it doesn't exist
        ALTER TABLE attendance 
        ADD CONSTRAINT attendance_user_timestamp_unique 
        UNIQUE (user_id, timestamp);
    END IF;
END $$;