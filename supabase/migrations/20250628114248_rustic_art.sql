/*
  # Add Bank Account and Salary Payment Features
  
  1. New Features
    - Add bank account fields to profiles table
    - Add payment status tracking to employee_salaries
    - Create new salary_payments table for payment history
    
  2. Changes
    - Add bank_name, bank_account_number, bank_account_name to profiles
    - Add payment_status, last_payment_date, payment_notes to employee_salaries
    - Create salary_payments table with complete payment tracking
    
  3. Security
    - Enable RLS on salary_payments table
    - Add policies for users to view their own payments
    - Add policies for admins to manage all payments
*/

-- Add bank account information to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

-- Add payment status to employee_salaries table
ALTER TABLE employee_salaries 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed')),
ADD COLUMN IF NOT EXISTS last_payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

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

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own salary payments" ON salary_payments;
DROP POLICY IF EXISTS "Admin can manage all salary payments" ON salary_payments;

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

-- Create trigger to update updated_at column (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_salary_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_salary_payments_updated_at
      BEFORE UPDATE ON salary_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create function to process salary payment and send notification
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
  bank_info TEXT;
  payment_details JSONB;
BEGIN
  -- Get the active salary record
  SELECT id INTO salary_id FROM employee_salaries 
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Get user name and bank info
  SELECT 
    name, 
    COALESCE(bank_name || ' - ' || bank_account_number, 'No bank account') 
  INTO user_name, bank_info 
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Create payment details
  payment_details := jsonb_build_object(
    'amount', p_amount,
    'payment_method', p_payment_method,
    'reference', p_payment_reference,
    'bank_info', bank_info,
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