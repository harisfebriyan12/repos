/*
  # Fix attendance unique constraint

  This migration checks if the unique constraint already exists before trying to add it.
  This prevents errors when the constraint has already been created.
*/

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