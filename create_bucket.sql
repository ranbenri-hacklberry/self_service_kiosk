-- Create a public storage bucket for menu images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'menu-images' );

-- Allow public access to upload images (For MVP/easier testing, refine later for auth)
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'menu-images' );

-- Allow public access to update images
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'menu-images' );
