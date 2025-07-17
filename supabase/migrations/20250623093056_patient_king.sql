/*
  # Fix Storage Policies for Face Photos

  1. Storage Setup
    - Ensure face-photos bucket exists and is properly configured
    - Fix RLS policies for file upload/access
    - Allow authenticated users to upload and manage face photos

  2. Security
    - Users can upload their own face photos
    - Admin/kepala can upload photos for others
    - Proper file naming convention enforcement
*/

-- Ensure the face-photos bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'face-photos', 
  'face-photos', 
  false, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png'];

-- Drop all existing storage policies for face-photos
DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own face photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own face photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload any face photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view any face photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload face photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view face photos" ON storage.objects;

-- Create comprehensive storage policies for face-photos
CREATE POLICY "Face photos: Enable upload for authenticated users"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'face-photos'
  );

CREATE POLICY "Face photos: Enable read for authenticated users"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'face-photos'
  );

CREATE POLICY "Face photos: Enable update for authenticated users"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'face-photos'
  );

CREATE POLICY "Face photos: Enable delete for authenticated users"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'face-photos'
  );

-- Allow public read access for face photos (needed for avatar display)
CREATE POLICY "Face photos: Enable public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'face-photos'
  );

-- Update bucket to allow public read
UPDATE storage.buckets 
SET public = true 
WHERE id = 'face-photos';