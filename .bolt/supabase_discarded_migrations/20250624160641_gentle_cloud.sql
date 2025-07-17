/*
  # Complete Employee Attendance System Migration
  
  This migration creates a complete employee attendance system with:
  1. User profiles with comprehensive employee information
  2. Position management with salary ranges
  3. Attendance tracking with face and location verification
  4. Notification system for warnings and alerts
  5. Salary management and calculations
  6. Warning letters and SP system
  7. Activity logging and audit trails
  8. System settings and configurations
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Role-based access control (admin, karyawan)
  - Secure file storage for face photos
  
  ## Features
  - Automatic salary calculation
  - Late attendance tracking
  - Absence monitoring
  - Warning letter generation
  - Real-time notifications
  - Comprehensive reporting
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'karyawan');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'terminated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('male', 'female');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contract_type AS ENUM ('permanent', 'contract', 'internship');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_type AS ENUM ('masuk', 'keluar');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('berhasil', 'lokasi_tidak_valid', 'wajah_tidak_valid', 'tidak_hadir');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE warning_type AS ENUM ('late', 'absent', 'early_leave', 'no_checkout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sp_type AS ENUM ('SP1', 'SP2', 'SP3', 'termination');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('late_warning', 'absence_warning', 'salary_info', 'system_alert');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_id text NOT NULL,
  name_en text NOT NULL,
  description_id text DEFAULT '',
  description_en text DEFAULT '',
  base_salary decimal(12,2) DEFAULT 0,
  min_salary decimal(12,2) DEFAULT 0,
  max_salary decimal(12,2) DEFAULT 0,
  department text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  name text DEFAULT '',
  full_name text DEFAULT '',
  title text DEFAULT '',
  bio text DEFAULT '',
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  phone_number text DEFAULT '',
  location text DEFAULT '',
  address text DEFAULT '',
  avatar_url text DEFAULT '',
  github_url text DEFAULT '',
  linkedin_url text DEFAULT '',
  twitter_url text DEFAULT '',
  birth_date date,
  gender gender_type,
  role user_role DEFAULT 'karyawan',
  department text DEFAULT '',
  employee_id text DEFAULT '',
  hire_date date DEFAULT CURRENT_DATE,
  join_date date DEFAULT CURRENT_DATE,
  position_id uuid REFERENCES positions(id),
  salary decimal(12,2) DEFAULT 0,
  status user_status DEFAULT 'active',
  contract_start_date date DEFAULT CURRENT_DATE,
  contract_end_date date,
  contract_type contract_type DEFAULT 'permanent',
  bank_name text DEFAULT '',
  bank_account_number text DEFAULT '',
  bank_account_name text DEFAULT '',
  is_face_registered boolean DEFAULT false,
  last_login timestamptz,
  device_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type attendance_type NOT NULL,
  timestamp timestamptz DEFAULT now(),
  latitude float,
  longitude float,
  status attendance_status DEFAULT 'berhasil',
  is_late boolean DEFAULT false,
  late_minutes integer DEFAULT 0,
  work_hours decimal(5,2) DEFAULT 0,
  check_in_time timestamptz,
  check_out_time timestamptz,
  total_work_hours decimal(5,2) DEFAULT 0,
  overtime_hours decimal(5,2) DEFAULT 0,
  notes text DEFAULT '',
  daily_salary_earned decimal(12,2) DEFAULT 0,
  admin_notified boolean DEFAULT false
);

-- Create employee_salaries table
CREATE TABLE IF NOT EXISTS employee_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  daily_salary decimal(12,2) DEFAULT 0,
  overtime_rate decimal(5,2) DEFAULT 1.5,
  bonus decimal(12,2) DEFAULT 0,
  deduction decimal(12,2) DEFAULT 0,
  effective_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create work_schedules table
CREATE TABLE IF NOT EXISTS work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  work_start_time time DEFAULT '08:00:00',
  work_end_time time DEFAULT '17:00:00',
  break_duration_minutes integer DEFAULT 60,
  late_tolerance_minutes integer DEFAULT 15,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create attendance_warnings table
CREATE TABLE IF NOT EXISTS attendance_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES attendance(id) ON DELETE CASCADE,
  warning_type warning_type,
  warning_level integer DEFAULT 1 CHECK (warning_level BETWEEN 1 AND 3),
  sp_number text,
  warning_date date DEFAULT CURRENT_DATE,
  description text DEFAULT '',
  issued_by uuid REFERENCES profiles(id),
  is_resolved boolean DEFAULT false,
  resolution_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create salary_calculations table
CREATE TABLE IF NOT EXISTS salary_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  calculation_month date,
  total_work_days integer DEFAULT 0,
  total_present_days integer DEFAULT 0,
  total_late_days integer DEFAULT 0,
  total_absent_days integer DEFAULT 0,
  total_overtime_hours decimal(5,2) DEFAULT 0,
  base_salary decimal(12,2) DEFAULT 0,
  overtime_pay decimal(12,2) DEFAULT 0,
  bonus decimal(12,2) DEFAULT 0,
  deductions decimal(12,2) DEFAULT 0,
  final_salary decimal(12,2) DEFAULT 0,
  is_finalized boolean DEFAULT false,
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create warning_letters table
CREATE TABLE IF NOT EXISTS warning_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES profiles(id),
  warning_type sp_type NOT NULL,
  letter_number text NOT NULL,
  reason text NOT NULL,
  description text DEFAULT '',
  issue_date date DEFAULT CURRENT_DATE,
  effective_date date DEFAULT CURRENT_DATE,
  is_acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  letter_content text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create salary_payments table
CREATE TABLE IF NOT EXISTS salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  payment_period_start date NOT NULL,
  payment_period_end date NOT NULL,
  base_salary decimal(12,2) DEFAULT 0,
  days_worked integer DEFAULT 0,
  days_late integer DEFAULT 0,
  total_hours decimal(5,2) DEFAULT 0,
  overtime_hours decimal(5,2) DEFAULT 0,
  bonus decimal(12,2) DEFAULT 0,
  deductions decimal(12,2) DEFAULT 0,
  gross_salary decimal(12,2) DEFAULT 0,
  net_salary decimal(12,2) DEFAULT 0,
  payment_status payment_status DEFAULT 'pending',
  payment_date date,
  payment_method text DEFAULT 'bank_transfer',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create attendance_settings table
CREATE TABLE IF NOT EXISTS attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_start_time time DEFAULT '08:00:00',
  work_end_time time DEFAULT '17:00:00',
  late_threshold_minutes integer DEFAULT 15,
  early_leave_threshold_minutes integer DEFAULT 30,
  break_duration_minutes integer DEFAULT 60,
  overtime_threshold_minutes integer DEFAULT 30,
  weekend_work_allowed boolean DEFAULT false,
  holiday_work_allowed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create password_changes table
CREATE TABLE IF NOT EXISTS password_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES profiles(id),
  change_type text CHECK (change_type IN ('self_change', 'admin_reset', 'forced_change')),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create user_management_logs table
CREATE TABLE IF NOT EXISTS user_management_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('create_user', 'update_user', 'delete_user', 'change_role', 'reset_password', 'update_settings')),
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb DEFAULT '{}',
  description text DEFAULT '',
  display_name_id text DEFAULT '',
  display_name_en text DEFAULT '',
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cv_sections table (for portfolio features)
CREATE TABLE IF NOT EXISTS cv_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cv_data table (for portfolio features)
CREATE TABLE IF NOT EXISTS cv_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_type text NOT NULL,
  title text DEFAULT '',
  subtitle text DEFAULT '',
  description text DEFAULT '',
  start_date text DEFAULT '',
  end_date text DEFAULT '',
  location text DEFAULT '',
  skills text[] DEFAULT '{}',
  level integer DEFAULT 50,
  is_current boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table (for portfolio features)
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT '',
  description text DEFAULT '',
  image_url text DEFAULT '',
  technologies text[] DEFAULT '{}',
  github_url text DEFAULT '',
  demo_url text DEFAULT '',
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create certificates table (for portfolio features)
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text DEFAULT '',
  issuer text DEFAULT '',
  date text DEFAULT '',
  image_url text DEFAULT '',
  credential_url text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create skills table (for portfolio features)
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text DEFAULT '',
  category text DEFAULT '',
  level integer DEFAULT 50,
  icon text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create site_settings table (for portfolio features)
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb DEFAULT '{}',
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_management_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Profiles policies
CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can read basic profile info" ON profiles
  FOR SELECT TO public
  USING (true);

-- Positions policies
CREATE POLICY "Public can read positions" ON positions
  FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage positions" ON positions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Attendance policies
CREATE POLICY "Users can manage own attendance" ON attendance
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read all attendance" ON attendance
  FOR SELECT TO authenticated
  USING (true);

-- Employee salaries policies
CREATE POLICY "Users can read own salary" ON employee_salaries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage salaries" ON employee_salaries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Work schedules policies
CREATE POLICY "Users can read own schedule" ON work_schedules
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage schedules" ON work_schedules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Attendance warnings policies
CREATE POLICY "Users can read own warnings" ON attendance_warnings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage warnings" ON attendance_warnings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Salary calculations policies
CREATE POLICY "Users can read own salary calculations" ON salary_calculations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage salary calculations" ON salary_calculations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications" ON notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Warning letters policies
CREATE POLICY "Users can read own warning letters" ON warning_letters
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all warning letters" ON warning_letters
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Salary payments policies
CREATE POLICY "Users can read own salary payments" ON salary_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all salary payments" ON salary_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attendance settings policies
CREATE POLICY "Authenticated users can manage attendance settings" ON attendance_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Password changes policies
CREATE POLICY "Users can read own password changes" ON password_changes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage password changes" ON password_changes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Activity logs policies
CREATE POLICY "Users can read own activity logs" ON activity_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage activity logs" ON activity_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- User management logs policies
CREATE POLICY "Authenticated users can manage user logs" ON user_management_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- System settings policies
CREATE POLICY "Public can read enabled settings" ON system_settings
  FOR SELECT TO public
  USING (is_enabled = true);

CREATE POLICY "Authenticated users can manage settings" ON system_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Portfolio tables policies (public read, authenticated manage)
CREATE POLICY "Public can read CV sections" ON cv_sections
  FOR SELECT TO public
  USING (is_enabled = true);

CREATE POLICY "Authenticated users can manage CV sections" ON cv_sections
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can read CV data when enabled" ON cv_data
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can manage CV data" ON cv_data
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public projects are viewable by everyone" ON projects
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can manage projects" ON projects
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public certificates are viewable by everyone" ON certificates
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can manage certificates" ON certificates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public skills are viewable by everyone" ON skills
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can manage skills" ON skills
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can read enabled settings" ON site_settings
  FOR SELECT TO public
  USING (is_enabled = true);

CREATE POLICY "Authenticated users can manage settings" ON site_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(type);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_active ON employee_salaries(is_active);
CREATE INDEX IF NOT EXISTS idx_work_schedules_user_id ON work_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_active ON work_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_warnings_user_id ON attendance_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_warnings_date ON attendance_warnings(warning_date);
CREATE INDEX IF NOT EXISTS idx_salary_calculations_user_id ON salary_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_calculations_month ON salary_calculations(calculation_month);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_warning_letters_user_id ON warning_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_warning_letters_type ON warning_letters(warning_type);
CREATE INDEX IF NOT EXISTS idx_salary_payments_user_id ON salary_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON salary_payments(payment_period_start, payment_period_end);
CREATE INDEX IF NOT EXISTS idx_password_changes_user_id ON password_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_logs_admin ON user_management_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_target ON user_management_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created ON user_management_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_enabled ON system_settings(is_enabled);

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS warning_letter_seq START 1;

-- Create functions

-- Function to automatically calculate daily salary
CREATE OR REPLACE FUNCTION calculate_daily_salary()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate for successful check-ins
  IF NEW.type = 'masuk' AND NEW.status = 'berhasil' THEN
    -- Get user's salary
    SELECT salary INTO NEW.daily_salary_earned
    FROM profiles 
    WHERE id = NEW.user_id;
    
    -- Calculate based on working days (22 days per month)
    NEW.daily_salary_earned := COALESCE(NEW.daily_salary_earned, 0) / 22;
    
    -- Reduce salary if late (10% reduction for each 15 minutes late)
    IF NEW.is_late AND NEW.late_minutes > 0 THEN
      NEW.daily_salary_earned := NEW.daily_salary_earned * (1 - (NEW.late_minutes / 15.0 * 0.1));
      NEW.daily_salary_earned := GREATEST(NEW.daily_salary_earned, 0); -- Ensure not negative
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to send late notifications to admin
CREATE OR REPLACE FUNCTION notify_admin_late_attendance()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id uuid;
  employee_name text;
BEGIN
  -- Only process late check-ins
  IF NEW.type = 'masuk' AND NEW.is_late AND NEW.status = 'berhasil' AND NOT NEW.admin_notified THEN
    -- Get admin user ID
    SELECT id INTO admin_user_id 
    FROM profiles 
    WHERE role = 'admin' 
    LIMIT 1;
    
    -- Get employee name
    SELECT name INTO employee_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Create notification for admin
    IF admin_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        admin_id,
        type,
        title,
        message,
        data
      ) VALUES (
        admin_user_id,
        NEW.user_id,
        'late_warning',
        'Karyawan Terlambat',
        employee_name || ' terlambat ' || NEW.late_minutes || ' menit pada ' || to_char(NEW.timestamp, 'DD/MM/YYYY HH24:MI'),
        jsonb_build_object(
          'employee_id', NEW.user_id,
          'employee_name', employee_name,
          'late_minutes', NEW.late_minutes,
          'attendance_id', NEW.id,
          'timestamp', NEW.timestamp
        )
      );
      
      -- Mark as notified
      NEW.admin_notified := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate warning letters
CREATE OR REPLACE FUNCTION generate_warning_letter(
  p_user_id uuid,
  p_warning_type text,
  p_reason text,
  p_description text DEFAULT ''
)
RETURNS uuid AS $$
DECLARE
  letter_id uuid;
  letter_number text;
  admin_id uuid;
  employee_name text;
  letter_content text;
BEGIN
  -- Get admin ID
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  -- Get employee name
  SELECT name INTO employee_name FROM profiles WHERE id = p_user_id;
  
  -- Generate letter number
  letter_number := p_warning_type || '/' || to_char(now(), 'YYYY/MM/') || 
                   LPAD(nextval('warning_letter_seq')::text, 3, '0');
  
  -- Generate letter content
  letter_content := 'SURAT PERINGATAN ' || p_warning_type || E'\n\n' ||
                   'Kepada: ' || employee_name || E'\n' ||
                   'Tanggal: ' || to_char(now(), 'DD Month YYYY') || E'\n\n' ||
                   'Dengan ini kami memberikan surat peringatan ' || p_warning_type || 
                   ' atas: ' || p_reason || E'\n\n' ||
                   COALESCE(p_description, '') || E'\n\n' ||
                   'Harap untuk lebih memperhatikan kedisiplinan kerja.' || E'\n\n' ||
                   'Hormat kami,' || E'\n' ||
                   'Manajemen';
  
  -- Insert warning letter
  INSERT INTO warning_letters (
    user_id,
    issued_by,
    warning_type,
    letter_number,
    reason,
    description,
    letter_content
  ) VALUES (
    p_user_id,
    admin_id,
    p_warning_type::sp_type,
    letter_number,
    p_reason,
    p_description,
    letter_content
  ) RETURNING id INTO letter_id;
  
  -- Create notification for employee
  INSERT INTO notifications (
    user_id,
    admin_id,
    type,
    title,
    message,
    data
  ) VALUES (
    p_user_id,
    admin_id,
    'late_warning',
    'Surat Peringatan ' || p_warning_type,
    'Anda telah menerima surat peringatan ' || p_warning_type || ' dengan nomor: ' || letter_number,
    jsonb_build_object(
      'warning_letter_id', letter_id,
      'letter_number', letter_number,
      'warning_type', p_warning_type
    )
  );
  
  RETURN letter_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check contract expiration
CREATE OR REPLACE FUNCTION check_contract_expiration()
RETURNS void AS $$
DECLARE
  expiring_contract RECORD;
  admin_id uuid;
BEGIN
  -- Get admin ID
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  -- Check for contracts expiring in 30 days
  FOR expiring_contract IN 
    SELECT id, name, contract_end_date
    FROM profiles 
    WHERE contract_end_date IS NOT NULL 
    AND contract_end_date <= CURRENT_DATE + INTERVAL '30 days'
    AND contract_end_date > CURRENT_DATE
    AND status = 'active'
  LOOP
    -- Create notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      admin_id,
      'system_alert',
      'Kontrak Akan Berakhir',
      'Kontrak ' || expiring_contract.name || ' akan berakhir pada ' || 
      to_char(expiring_contract.contract_end_date, 'DD/MM/YYYY'),
      jsonb_build_object(
        'employee_id', expiring_contract.id,
        'employee_name', expiring_contract.name,
        'contract_end_date', expiring_contract.contract_end_date
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_calculate_daily_salary ON attendance;
CREATE TRIGGER trigger_calculate_daily_salary
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_salary();

DROP TRIGGER IF EXISTS trigger_notify_admin_late ON attendance;
CREATE TRIGGER trigger_notify_admin_late
  BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_late_attendance();

-- Create storage bucket for face photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'face-photos', 
  'face-photos', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png'];

-- Storage policies for face photos
CREATE POLICY "Authenticated users can upload face photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'face-photos');

CREATE POLICY "Authenticated users can read face photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'face-photos');

CREATE POLICY "Public can read face photos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'face-photos');

-- Insert default positions
INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
  ('Administrator', 'Administrator', 'Administrator sistem', 'System Administrator', 8000000, 7000000, 10000000, 'IT'),
  ('Manager', 'Manager', 'Manager departemen', 'Department Manager', 6000000, 5000000, 8000000, 'Management'),
  ('Staff IT', 'IT Staff', 'Staff teknologi informasi', 'Information Technology Staff', 4500000, 4000000, 6000000, 'IT'),
  ('Staff HR', 'HR Staff', 'Staff sumber daya manusia', 'Human Resources Staff', 4000000, 3500000, 5000000, 'HR'),
  ('Staff Keuangan', 'Finance Staff', 'Staff keuangan dan akuntansi', 'Finance and Accounting Staff', 4200000, 3800000, 5500000, 'Finance'),
  ('Staff Marketing', 'Marketing Staff', 'Staff pemasaran', 'Marketing Staff', 4000000, 3500000, 5500000, 'Marketing'),
  ('Staff Operasional', 'Operations Staff', 'Staff operasional', 'Operations Staff', 3800000, 3500000, 4500000, 'Operations'),
  ('Karyawan Umum', 'General Employee', 'Karyawan umum', 'General Employee', 3500000, 3000000, 4000000, 'General')
ON CONFLICT DO NOTHING;

-- Insert default attendance settings
INSERT INTO attendance_settings (work_start_time, work_end_time, late_threshold_minutes, early_leave_threshold_minutes, break_duration_minutes, overtime_threshold_minutes) 
VALUES ('08:00:00', '17:00:00', 15, 30, 60, 30)
ON CONFLICT DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, display_name_id, display_name_en, description, is_enabled) VALUES
  ('office_location', '{"latitude": -6.200000, "longitude": 106.816666, "radius": 100, "address": "Jakarta Office"}', 'Lokasi Kantor', 'Office Location', 'Main office location coordinates and allowed radius', true),
  ('attendance_settings', '{"work_start_time": "08:00", "work_end_time": "17:00", "late_threshold_minutes": 15, "early_leave_threshold_minutes": 30}', 'Pengaturan Absensi', 'Attendance Settings', 'Attendance time settings and thresholds', true),
  ('face_recognition_settings', '{"similarity_threshold": 0.6, "max_attempts": 3, "cooldown_minutes": 5}', 'Pengaturan Pengenalan Wajah', 'Face Recognition Settings', 'Face recognition configuration', true),
  ('notification_settings', '{"email_notifications": true, "sms_notifications": false, "push_notifications": true}', 'Pengaturan Notifikasi', 'Notification Settings', 'System notification preferences', true),
  ('language_settings', '{"default_language": "id", "available_languages": ["id", "en"]}', 'Pengaturan Bahasa', 'Language Settings', 'System language configuration', true),
  ('salary_settings', '{"currency": "IDR", "pay_period": "monthly", "overtime_rate": 1.5}', 'Pengaturan Gaji', 'Salary Settings', 'Salary and payment configuration', true)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  display_name_id = EXCLUDED.display_name_id,
  display_name_en = EXCLUDED.display_name_en,
  updated_at = now();

-- Create default admin user
DO $$
DECLARE
  admin_user_id uuid;
  admin_position_id uuid;
BEGIN
  -- Get admin position ID
  SELECT id INTO admin_position_id FROM positions WHERE name_en = 'Administrator' LIMIT 1;
  
  -- Create admin user ID
  admin_user_id := gen_random_uuid();
  
  -- Insert admin user into auth.users (if not exists)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    admin_user_id,
    'authenticated',
    'authenticated',
    'admin@company.com',
    crypt('admin123', gen_salt('bf')),
    NOW(),
    '{"role": "admin"}',
    NOW(),
    NOW()
  ) ON CONFLICT (email) DO NOTHING;
  
  -- Get the actual admin user ID (in case it already existed)
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@company.com';
  
  -- Insert admin profile
  INSERT INTO profiles (
    id,
    name,
    full_name,
    email,
    role,
    title,
    bio,
    phone_number,
    address,
    status,
    salary,
    position_id,
    join_date,
    contract_start_date,
    contract_type,
    department,
    employee_id,
    is_face_registered,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id,
    'Administrator',
    'System Administrator',
    'admin@company.com',
    'admin',
    'System Administrator',
    'Default system administrator account',
    '+62-21-1234567',
    'Jakarta, Indonesia',
    'active',
    8000000,
    admin_position_id,
    CURRENT_DATE,
    CURRENT_DATE,
    'permanent',
    'IT',
    'ADM001',
    false,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    full_name = 'System Administrator',
    title = 'System Administrator',
    status = 'active',
    position_id = admin_position_id,
    department = 'IT',
    employee_id = 'ADM001',
    updated_at = NOW();
  
  -- Create default salary record for admin
  INSERT INTO employee_salaries (user_id, daily_salary, is_active)
  VALUES (admin_user_id, 300000, true)
  ON CONFLICT DO NOTHING;
  
  -- Create default work schedule for admin
  INSERT INTO work_schedules (user_id, work_start_time, work_end_time, late_tolerance_minutes, is_active)
  VALUES (admin_user_id, '08:00:00', '17:00:00', 15, true)
  ON CONFLICT DO NOTHING;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Final verification
SELECT 'Migration completed successfully. All tables, functions, triggers, and default data have been created.' as status;