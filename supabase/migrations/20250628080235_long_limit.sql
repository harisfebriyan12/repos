-- Fix auth metadata synchronization and role handling

-- Create or replace function to sync user metadata
CREATE OR REPLACE FUNCTION sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users metadata when profile is created or role changes
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.role,
    'name', NEW.name,
    'full_name', NEW.full_name
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON profiles;

-- Create trigger to sync metadata on profile changes
CREATE TRIGGER sync_user_metadata_trigger
  AFTER INSERT OR UPDATE OF role, name, full_name ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metadata();

-- Update existing users' metadata to ensure consistency
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role', p.role,
  'name', p.name,
  'full_name', p.full_name
)
FROM profiles p 
WHERE auth.users.id = p.id;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract role from user metadata
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
  ON CONFLICT (id) DO UPDATE SET
    role = COALESCE(NEW.raw_user_meta_data->>'role', 'karyawan'),
    name = COALESCE(NEW.raw_user_meta_data->>'name', profiles.name),
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', profiles.full_name),
    updated_at = NOW();
  
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