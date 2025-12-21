-- Fix RLS policies for music_playlists and music_ratings
-- Allow public access for development/demo purposes

-- 1. Policies for music_playlists
DROP POLICY IF EXISTS "Enable delete for users" ON music_playlists;
DROP POLICY IF EXISTS "Enable insert for users" ON music_playlists;
DROP POLICY IF EXISTS "Enable update for users" ON music_playlists;
DROP POLICY IF EXISTS "Enable read for users" ON music_playlists;

CREATE POLICY "Enable delete for users" ON music_playlists FOR DELETE USING (true);
CREATE POLICY "Enable insert for users" ON music_playlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for users" ON music_playlists FOR UPDATE USING (true);
CREATE POLICY "Enable read for users" ON music_playlists FOR SELECT USING (true);

-- 2. Policies for music_ratings (fixing "not captured" issue if any)
DROP POLICY IF EXISTS "Enable all for music_ratings" ON music_ratings;
CREATE POLICY "Enable all for music_ratings" ON music_ratings FOR ALL USING (true) WITH CHECK (true);

-- 3. Policies for music_playlist_songs (needed for managing songs in playlists)
DROP POLICY IF EXISTS "Enable all for music_playlist_songs" ON music_playlist_songs;
CREATE POLICY "Enable all for music_playlist_songs" ON music_playlist_songs FOR ALL USING (true) WITH CHECK (true);
