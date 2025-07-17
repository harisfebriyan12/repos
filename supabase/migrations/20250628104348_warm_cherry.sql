/*
  # Add Bank Account Information and Salary Payment Status

  1. New Fields
    - Add bank account information to profiles table
    - Add salary payment status tracking to employee_salaries table
    - Add payment history table for tracking salary payments

  2. Security
    - Update RLS policies for new tables
    - Ensure proper access control
*/

-- Add bank account information to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bank_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bank_account_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bank_account_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bank_account_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bank_account_name TEXT;
  END IF;
END $$;

-- Add payment status to employee_salaries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_salaries' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE employee_salaries ADD COLUMN payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_salaries' AND column_name = 'last_payment_date'
  ) THEN
    ALTER TABLE employee_salaries ADD COLUMN last_payment_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_salaries' AND column_name = 'payment_notes'
  ) THEN
    ALTER TABLE employee_salaries ADD COLUMN payment_notes TEXT;
  END IF;
END $$;

-- Create salary_payments table for tracking payment history
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salary_id UUID REFERENCES employee_salaries(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'other')),
  payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed')),
  payment_reference TEXT,
  payment_period_start DATE,
  payment_period_end DATE,
  payment_details JSONB,
  created_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_salary_payments_user_id ON salary_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_payment_date ON salary_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_payment_status ON salary_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_payment_status ON employee_salaries(payment_status);

-- Enable RLS on salary_payments table
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for salary_payments
CREATE POLICY "Users can view own salary payments"
  ON salary_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all salary payments"
  ON salary_payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create function to update updated_at column
CREATE TRIGGER update_salary_payments_updated_at
  BEFORE UPDATE ON salary_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to mark salary as paid and send notification
CREATE OR REPLACE FUNCTION process_salary_payment(
  p_user_id UUID,
  p_amount DECIMAL(15,2),
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_payment_reference TEXT DEFAULT NULL,
  p_payment_period_start DATE DEFAULT NULL,
  p_payment_period_end DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  payment_id UUID;
  salary_id UUID;
  user_name TEXT;
  payment_details JSONB;
BEGIN
  -- Get the active salary record
  SELECT id INTO salary_id FROM employee_salaries 
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Get user name
  SELECT name INTO user_name FROM profiles WHERE id = p_user_id;
  
  -- Create payment details
  payment_details := jsonb_build_object(
    'amount', p_amount,
    'payment_method', p_payment_method,
    'reference', p_payment_reference,
    'processed_by', auth.uid(),
    'processed_at', NOW()
  );
  
  -- Insert payment record
  INSERT INTO salary_payments (
    user_id,
    salary_id,
    payment_amount,
    payment_method,
    payment_status,
    payment_reference,
    payment_period_start,
    payment_period_end,
    payment_details,
    created_by,
    notes
  ) VALUES (
    p_user_id,
    salary_id,
    p_amount,
    p_payment_method,
    'completed',
    p_payment_reference,
    p_payment_period_start,
    p_payment_period_end,
    payment_details,
    auth.uid(),
    p_notes
  ) RETURNING id INTO payment_id;
  
  -- Update salary record
  UPDATE employee_salaries
  SET 
    payment_status = 'paid',
    last_payment_date = CURRENT_DATE,
    payment_notes = p_notes,
    updated_at = NOW()
  WHERE id = salary_id;
  
  -- Create notification for the employee
  INSERT INTO notifications (
    user_id,
    admin_id,
    type,
    title,
    message,
    data,
    is_read
  ) VALUES (
    p_user_id,
    auth.uid(),
    'salary_info',
    'Pembayaran Gaji',
    'Gaji Anda sebesar ' || p_amount || ' telah dibayarkan via ' || p_payment_method || '.',
    jsonb_build_object(
      'payment_id', payment_id,
      'amount', p_amount,
      'payment_method', p_payment_method,
      'payment_date', CURRENT_DATE,
      'reference', p_payment_reference
    ),
    false
  );
  
  RETURN payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON salary_payments TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_salary_payment TO anon, authenticated;