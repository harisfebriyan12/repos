/*
  # Fix ambiguous letter_number reference in generate_warning_letter function

  This migration fixes the "column reference letter_number is ambiguous" error
  by properly qualifying all column references with table aliases.

  1. Changes
     - Added table alias 'wl' for warning_letters table
     - Qualified all column references with the table alias
     - Renamed local variable to v_letter_number to avoid ambiguity
     - Fixed RETURN QUERY to use qualified column names
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS generate_warning_letter(uuid, text, text, text, uuid);

-- Recreate the function with proper column qualification
CREATE OR REPLACE FUNCTION generate_warning_letter(
  p_user_id uuid,
  p_warning_type text,
  p_reason text,
  p_description text DEFAULT NULL,
  p_issued_by uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  letter_number text,
  warning_type text,
  reason text,
  description text,
  issue_date date,
  issued_by uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_letter_number text;
  v_year text;
  v_month text;
  v_sequence_number integer;
  v_warning_letter_id uuid;
BEGIN
  -- Get current year and month
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  v_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::text, 2, '0');
  
  -- Get the next sequence number for this month and year
  SELECT COALESCE(MAX(
    CASE 
      WHEN wl.letter_number ~ ('^SP[0-9]+-[0-9]+-' || v_month || '-' || v_year || '$')
      THEN CAST(SPLIT_PART(SPLIT_PART(wl.letter_number, '-', 2), '-', 1) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO v_sequence_number
  FROM warning_letters wl
  WHERE EXTRACT(YEAR FROM wl.issue_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM wl.issue_date) = EXTRACT(MONTH FROM CURRENT_DATE);
  
  -- Generate the letter number: SP{type}-{sequence}-{month}-{year}
  v_letter_number := p_warning_type || '-' || 
                     LPAD(v_sequence_number::text, 3, '0') || '-' || 
                     v_month || '-' || v_year;
  
  -- Insert the new warning letter
  INSERT INTO warning_letters (
    user_id,
    warning_type,
    letter_number,
    reason,
    description,
    issue_date,
    issued_by,
    status
  )
  VALUES (
    p_user_id,
    p_warning_type,
    v_letter_number,
    p_reason,
    p_description,
    CURRENT_DATE,
    p_issued_by,
    'active'
  )
  RETURNING warning_letters.id INTO v_warning_letter_id;
  
  -- Return the created warning letter
  RETURN QUERY
  SELECT 
    wl.id,
    wl.letter_number,
    wl.warning_type,
    wl.reason,
    wl.description,
    wl.issue_date,
    wl.issued_by,
    wl.status
  FROM warning_letters wl
  WHERE wl.id = v_warning_letter_id;
END;
$$;