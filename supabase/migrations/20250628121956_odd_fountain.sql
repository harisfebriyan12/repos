/*
  # Remove Salary Management and Add Bank Management
  
  1. Changes
    - Add bank_info table to store bank information
    - Add bank_id reference to profiles table
    - Update RLS policies for the new table
  
  2. Security
    - Enable RLS on bank_info table
    - Admin can manage all bank info
    - Users can view bank info
*/

-- Create bank_info table
CREATE TABLE IF NOT EXISTS bank_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  bank_logo TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add bank_id reference to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bank_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bank_id UUID REFERENCES bank_info(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_info_name ON bank_info(bank_name);
CREATE INDEX IF NOT EXISTS idx_bank_info_active ON bank_info(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_bank_id ON profiles(bank_id);

-- Enable RLS on bank_info
ALTER TABLE bank_info ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bank_info
CREATE POLICY "Users can view bank info"
  ON bank_info
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage bank info"
  ON bank_info
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

-- Create trigger for updated_at
CREATE TRIGGER update_bank_info_updated_at
  BEFORE UPDATE ON bank_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default bank data
INSERT INTO bank_info (bank_name, bank_code, description, is_active)
VALUES 
  ('BCA', '014', 'Bank Central Asia', true),
  ('Mandiri', '008', 'Bank Mandiri', true),
  ('BNI', '009', 'Bank Negara Indonesia', true),
  ('BRI', '002', 'Bank Rakyat Indonesia', true),
  ('CIMB Niaga', '022', 'CIMB Niaga', true),
  ('Permata', '013', 'Bank Permata', true),
  ('Danamon', '011', 'Bank Danamon', true),
  ('BTN', '200', 'Bank Tabungan Negara', true),
  ('BTPN', '213', 'Bank BTPN', true),
  ('OCBC NISP', '028', 'Bank OCBC NISP', true)
ON CONFLICT DO NOTHING;