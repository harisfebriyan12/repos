-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  location TEXT,
  title TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'karyawan' CHECK (role IN ('admin', 'kepala', 'karyawan')),
  position_id UUID,
  employee_id TEXT UNIQUE,
  department TEXT,
  salary DECIMAL(15,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  join_date DATE DEFAULT CURRENT_DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  contract_type TEXT DEFAULT 'permanent' CHECK (contract_type IN ('permanent', 'contract', 'internship')),
  is_face_registered BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_id TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  description_id TEXT,
  description_en TEXT,
  base_salary DECIMAL(15,2) DEFAULT 0,
  min_salary DECIMAL(15,2) DEFAULT 0,
  max_salary DECIMAL(15,2) DEFAULT 0,
  department TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create employee_salaries table
CREATE TABLE IF NOT EXISTS employee_salaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  daily_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  overtime_rate DECIMAL(5,2) DEFAULT 1.5,
  bonus DECIMAL(15,2) DEFAULT 0,
  deduction DECIMAL(15,2) DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('masuk', 'keluar', 'absent')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  status TEXT NOT NULL DEFAULT 'berhasil' CHECK (status IN ('berhasil', 'gagal', 'wajah_tidak_valid', 'lokasi_tidak_valid', 'tidak_hadir')),
  is_late BOOLEAN DEFAULT FALSE,
  late_minutes INTEGER DEFAULT 0,
  work_hours DECIMAL(5,2) DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  daily_salary_earned DECIMAL(15,2) DEFAULT 0,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create attendance_warnings table
CREATE TABLE IF NOT EXISTS attendance_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('late', 'absent', 'early_leave', 'misconduct')),
  warning_level INTEGER NOT NULL CHECK (warning_level BETWEEN 1 AND 3),
  description TEXT NOT NULL,
  sp_number TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by UUID REFERENCES profiles(id),
  is_resolved BOOLEAN DEFAULT FALSE,
  resolution_date DATE,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create warning_letters table
CREATE TABLE IF NOT EXISTS warning_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('SP1', 'SP2', 'SP3', 'termination')),
  letter_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  description TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('late_warning', 'absence_warning', 'salary_info', 'system_alert', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create password_changes table
CREATE TABLE IF NOT EXISTS password_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('self_change', 'admin_reset', 'forced_reset')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for positions (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_profiles_position'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT fk_profiles_position 
    FOREIGN KEY (position_id) REFERENCES positions(id);
  END IF;
END $$;

-- Create basic indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

CREATE INDEX IF NOT EXISTS idx_positions_department ON positions(department);
CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(type);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

CREATE INDEX IF NOT EXISTS idx_employee_salaries_user_id ON employee_salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_active ON employee_salaries(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_effective_date ON employee_salaries(effective_date);

CREATE INDEX IF NOT EXISTS idx_attendance_warnings_user_id ON attendance_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_warnings_resolved ON attendance_warnings(is_resolved);
CREATE INDEX IF NOT EXISTS idx_attendance_warnings_issue_date ON attendance_warnings(issue_date);

CREATE INDEX IF NOT EXISTS idx_warning_letters_user_id ON warning_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_warning_letters_status ON warning_letters(status);
CREATE INDEX IF NOT EXISTS idx_warning_letters_issue_date ON warning_letters(issue_date);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_password_changes_user_id ON password_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_password_changes_created_at ON password_changes(created_at);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_enabled ON system_settings(is_enabled);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Kepala can view non-admin profiles" ON profiles;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can view non-admin profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'kepala'
    ) AND role != 'admin'
  );

-- Drop existing position policies
DROP POLICY IF EXISTS "Authenticated users can view positions" ON positions;
DROP POLICY IF EXISTS "Admin can manage positions" ON positions;

-- Positions policies
CREATE POLICY "Authenticated users can view positions" ON positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage positions" ON positions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing salary policies
DROP POLICY IF EXISTS "Users can view own salary" ON employee_salaries;
DROP POLICY IF EXISTS "Admin can view all salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Admin can manage all salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Kepala can view non-admin salaries" ON employee_salaries;

-- Employee salaries policies
CREATE POLICY "Users can view own salary" ON employee_salaries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can view all salaries" ON employee_salaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can manage all salaries" ON employee_salaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can view non-admin salaries" ON employee_salaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'kepala'
    ) AND user_id IN (
      SELECT id FROM profiles WHERE role != 'admin'
    )
  );

-- Drop existing attendance policies
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;
DROP POLICY IF EXISTS "Admin can view all attendance" ON attendance;
DROP POLICY IF EXISTS "Admin can manage all attendance" ON attendance;
DROP POLICY IF EXISTS "Kepala can view non-admin attendance" ON attendance;

-- Attendance policies
CREATE POLICY "Users can view own attendance" ON attendance
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own attendance" ON attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can view all attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can manage all attendance" ON attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can view non-admin attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'kepala'
    ) AND user_id IN (
      SELECT id FROM profiles WHERE role != 'admin'
    )
  );

-- Drop existing warning policies
DROP POLICY IF EXISTS "Users can view own warnings" ON attendance_warnings;
DROP POLICY IF EXISTS "Admin can manage all warnings" ON attendance_warnings;
DROP POLICY IF EXISTS "Kepala can manage non-admin warnings" ON attendance_warnings;

-- Attendance warnings policies
CREATE POLICY "Users can view own warnings" ON attendance_warnings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all warnings" ON attendance_warnings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Kepala can manage non-admin warnings" ON attendance_warnings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'kepala'
    ) AND user_id IN (
      SELECT id FROM profiles WHERE role != 'admin'
    )
  );

-- Drop existing warning letter policies
DROP POLICY IF EXISTS "Users can view own warning letters" ON warning_letters;
DROP POLICY IF EXISTS "Admin can manage all warning letters" ON warning_letters;

-- Warning letters policies
CREATE POLICY "Users can view own warning letters" ON warning_letters
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all warning letters" ON warning_letters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing notification policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Admin can manage all notifications" ON notifications;

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all notifications" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing activity log policies
DROP POLICY IF EXISTS "Admin can view all activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON activity_logs;

-- Activity logs policies
CREATE POLICY "Admin can view all activity logs" ON activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can insert activity logs" ON activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Drop existing password change policies
DROP POLICY IF EXISTS "Users can view own password changes" ON password_changes;
DROP POLICY IF EXISTS "Admin can view all password changes" ON password_changes;
DROP POLICY IF EXISTS "Authenticated users can insert password changes" ON password_changes;

-- Password changes policies
CREATE POLICY "Users can view own password changes" ON password_changes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can view all password changes" ON password_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can insert password changes" ON password_changes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Drop existing system settings policies
DROP POLICY IF EXISTS "Authenticated users can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Admin can manage system settings" ON system_settings;

-- System settings policies
CREATE POLICY "Authenticated users can view system settings" ON system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage system settings" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default system settings (using DO block to avoid conflicts)
DO $$
BEGIN
  -- Insert office_location if not exists
  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'office_location') THEN
    INSERT INTO system_settings (setting_key, setting_value, description) VALUES
      ('office_location', '{"latitude": -6.200000, "longitude": 106.816666, "radius": 100, "address": "Jakarta Office"}', 'Main office location and attendance radius');
  END IF;
  
  -- Insert work_hours if not exists
  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'work_hours') THEN
    INSERT INTO system_settings (setting_key, setting_value, description) VALUES
      ('work_hours', '{"start": "08:00", "end": "17:00", "break_duration": 60}', 'Standard working hours configuration');
  END IF;
  
  -- Insert attendance_rules if not exists
  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'attendance_rules') THEN
    INSERT INTO system_settings (setting_key, setting_value, description) VALUES
      ('attendance_rules', '{"late_threshold": 15, "early_leave_threshold": 15, "max_daily_hours": 12}', 'Attendance validation rules');
  END IF;
END $$;

-- Insert default positions (using DO block to avoid conflicts)
DO $$
BEGIN
  -- Insert Manager IT if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Manager IT') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Manager IT', 'IT Manager', 'Mengelola tim IT dan infrastruktur teknologi', 'Manage IT team and technology infrastructure', 8000000, 7000000, 10000000, 'IT');
  END IF;
  
  -- Insert Staff IT if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Staff IT') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Staff IT', 'IT Staff', 'Mendukung operasional IT dan maintenance sistem', 'Support IT operations and system maintenance', 5000000, 4000000, 6000000, 'IT');
  END IF;
  
  -- Insert Manager HR if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Manager HR') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Manager HR', 'HR Manager', 'Mengelola sumber daya manusia dan rekrutmen', 'Manage human resources and recruitment', 7500000, 6500000, 9000000, 'HR');
  END IF;
  
  -- Insert Staff HR if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Staff HR') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Staff HR', 'HR Staff', 'Mendukung operasional HR dan administrasi', 'Support HR operations and administration', 4500000, 3500000, 5500000, 'HR');
  END IF;
  
  -- Insert Manager Finance if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Manager Finance') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Manager Finance', 'Finance Manager', 'Mengelola keuangan dan akuntansi perusahaan', 'Manage company finance and accounting', 8500000, 7500000, 10500000, 'Finance');
  END IF;
  
  -- Insert Staff Finance if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Staff Finance') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Staff Finance', 'Finance Staff', 'Mendukung operasional keuangan dan pembukuan', 'Support finance operations and bookkeeping', 4800000, 3800000, 5800000, 'Finance');
  END IF;
  
  -- Insert Supervisor if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Supervisor') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Supervisor', 'Supervisor', 'Mengawasi operasional harian dan tim kerja', 'Supervise daily operations and work teams', 6000000, 5000000, 7000000, 'Operations');
  END IF;
  
  -- Insert Staff Operasional if not exists
  IF NOT EXISTS (SELECT 1 FROM positions WHERE name_id = 'Staff Operasional') THEN
    INSERT INTO positions (name_id, name_en, description_id, description_en, base_salary, min_salary, max_salary, department) VALUES
      ('Staff Operasional', 'Operations Staff', 'Melaksanakan tugas operasional harian', 'Execute daily operational tasks', 3500000, 3000000, 4500000, 'Operations');
  END IF;
END $$;

-- Create function to generate warning letter number
CREATE OR REPLACE FUNCTION generate_warning_letter_number(warning_type TEXT)
RETURNS TEXT AS $$
DECLARE
  year_month TEXT;
  sequence_num INTEGER;
  letter_number TEXT;
BEGIN
  year_month := TO_CHAR(CURRENT_DATE, 'YYYY/MM');
  
  SELECT COALESCE(MAX(CAST(SPLIT_PART(SPLIT_PART(letter_number, '/', 4), '-', 1) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM warning_letters
  WHERE letter_number LIKE warning_type || '/' || year_month || '%';
  
  letter_number := warning_type || '/' || year_month || '/' || LPAD(sequence_num::TEXT, 3, '0');
  
  RETURN letter_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate warning letter
CREATE OR REPLACE FUNCTION generate_warning_letter(
  p_user_id UUID,
  p_warning_type TEXT,
  p_reason TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  letter_id UUID;
  letter_number TEXT;
BEGIN
  letter_number := generate_warning_letter_number(p_warning_type);
  
  INSERT INTO warning_letters (
    user_id,
    warning_type,
    letter_number,
    reason,
    description,
    issued_by
  ) VALUES (
    p_user_id,
    p_warning_type,
    letter_number,
    p_reason,
    p_description,
    auth.uid()
  ) RETURNING id INTO letter_id;
  
  -- Create notification for the employee
  INSERT INTO notifications (
    user_id,
    admin_id,
    type,
    title,
    message,
    data
  ) VALUES (
    p_user_id,
    auth.uid(),
    'system_alert',
    'Surat Peringatan ' || p_warning_type,
    'Anda telah menerima surat peringatan ' || p_warning_type || ' dengan nomor ' || letter_number || '. Alasan: ' || p_reason,
    jsonb_build_object(
      'warning_type', p_warning_type,
      'letter_number', letter_number,
      'letter_id', letter_id
    )
  );
  
  RETURN letter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
DROP TRIGGER IF EXISTS update_employee_salaries_updated_at ON employee_salaries;
DROP TRIGGER IF EXISTS update_attendance_warnings_updated_at ON attendance_warnings;
DROP TRIGGER IF EXISTS update_warning_letters_updated_at ON warning_letters;
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_salaries_updated_at BEFORE UPDATE ON employee_salaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_warnings_updated_at BEFORE UPDATE ON attendance_warnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warning_letters_updated_at BEFORE UPDATE ON warning_letters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();