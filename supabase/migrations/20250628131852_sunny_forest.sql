/*
  # Create departments table

  1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `description` (text, optional)
      - `head_name` (text, optional)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `departments` table
    - Add policy for admin users to manage all departments
    - Add policy for authenticated users to view departments

  3. Indexes
    - Index on name for faster searches
    - Index on is_active for filtering
*/

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  head_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments (name);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments (is_active);

-- RLS Policies
CREATE POLICY "Admin can manage all departments"
  ON departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM temp_admin_users
      WHERE temp_admin_users.user_id = auth.uid()
      AND temp_admin_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM temp_admin_users
      WHERE temp_admin_users.user_id = auth.uid()
      AND temp_admin_users.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can view departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some default departments
INSERT INTO departments (name, description, is_active) VALUES
  ('IT', 'Information Technology Department', true),
  ('HR', 'Human Resources Department', true),
  ('Finance', 'Finance and Accounting Department', true),
  ('Operations', 'Operations Department', true),
  ('Marketing', 'Marketing Department', true)
ON CONFLICT (name) DO NOTHING;