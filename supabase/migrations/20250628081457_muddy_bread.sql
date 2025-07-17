-- Fix registration flow and role synchronization

-- Create function to handle new user registration properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't exist
  INSERT INTO public.profiles (
    id,
    name,
    full_name,
    email,
    role,
    title,
    bio,
    status,
    is_face_registered,
    join_date,
    contract_start_date,
    contract_type,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan'),
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN 'Administrator'
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan') = 'kepala' THEN 'Kepala Bagian'
      ELSE 'Karyawan'
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN 'Administrator sistem absensi'
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan') = 'kepala' THEN 'Kepala Bagian di sistem absensi'
      ELSE 'Karyawan sistem absensi'
    END,
    'active',
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan') = 'admin' THEN true
      ELSE false
    END,
    CURRENT_DATE,
    CURRENT_DATE,
    'permanent',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite existing profiles
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Ensure temp_admin_users is properly synced
CREATE OR REPLACE FUNCTION sync_admin_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove old entry if exists
  DELETE FROM temp_admin_users WHERE user_id = NEW.id;
  
  -- Add new entry if user is admin or kepala
  IF NEW.role IN ('admin', 'kepala') THEN
    INSERT INTO temp_admin_users (user_id, role)
    VALUES (NEW.id, NEW.role)
    ON CONFLICT (user_id) DO UPDATE SET 
      role = NEW.role,
      created_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger to sync admin users
DROP TRIGGER IF EXISTS sync_admin_users_trigger ON profiles;
CREATE TRIGGER sync_admin_users_trigger
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_admin_users();

-- Ensure all existing admin/kepala users are in temp_admin_users
INSERT INTO temp_admin_users (user_id, role)
SELECT id, role FROM profiles 
WHERE role IN ('admin', 'kepala')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  created_at = NOW();

-- Add policy to allow users to insert their own profile during registration
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Check if constraint exists before adding it
DO $$
BEGIN
  -- Only add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_role_check' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'kepala', 'karyawan'));
  END IF;
END $$;

-- Add indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_temp_admin_users_role ON temp_admin_users(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Update any existing profiles that might have invalid roles
UPDATE profiles 
SET role = 'karyawan' 
WHERE role NOT IN ('admin', 'kepala', 'karyawan');

-- Ensure all profiles have proper default values
UPDATE profiles 
SET 
  status = COALESCE(status, 'active'),
  is_face_registered = COALESCE(is_face_registered, false),
  join_date = COALESCE(join_date, CURRENT_DATE),
  contract_start_date = COALESCE(contract_start_date, CURRENT_DATE),
  contract_type = COALESCE(contract_type, 'permanent'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE 
  status IS NULL OR 
  is_face_registered IS NULL OR 
  join_date IS NULL OR 
  contract_start_date IS NULL OR 
  contract_type IS NULL OR 
  created_at IS NULL OR 
  updated_at IS NULL;