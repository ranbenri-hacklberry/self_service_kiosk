-- ==========================================
-- FINAL FIX FOR MUSIC PLAYER PERMISSIONS (RLS)
-- ==========================================

-- This script enables full access (Select, Insert, Update, Delete)
-- to all music-related tables for authenticated users (and anon if needed for dev).
-- Run this in your Supabase SQL Editor.

-- 1. Music Playlists
ALTER TABLE music_playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for music_playlists" ON music_playlists;
CREATE POLICY "Enable all access for music_playlists" ON music_playlists
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Music Playlist Songs (Songs inside playlists)
ALTER TABLE music_playlist_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for music_playlist_songs" ON music_playlist_songs;
CREATE POLICY "Enable all access for music_playlist_songs" ON music_playlist_songs
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Music Ratings (Likes/Dislikes)
ALTER TABLE music_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for music_ratings" ON music_ratings;
CREATE POLICY "Enable all access for music_ratings" ON music_ratings
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Music Artists (Required for Scanning)
ALTER TABLE music_artists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for music_artists" ON music_artists;
CREATE POLICY "Enable all access for music_artists" ON music_artists
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Music Albums (Required for Scanning)
ALTER TABLE music_albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for music_albums" ON music_albums;
CREATE POLICY "Enable all access for music_albums" ON music_albums
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Music Songs (Required for Scanning)
ALTER TABLE music_songs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for music_songs" ON music_songs;
CREATE POLICY "Enable all access for music_songs" ON music_songs
    FOR ALL USING (true) WITH CHECK (true);

-- Debug: Verify policies created
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename LIKE 'music_%';
