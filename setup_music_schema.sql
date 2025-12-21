-- =====================================================
-- MUSIC APPLICATION - Database Schema
-- =====================================================
-- Run this in Supabase SQL Editor

-- 1. ARTISTS TABLE
CREATE TABLE IF NOT EXISTS music_artists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  folder_path TEXT, -- Path on disk for this artist
  business_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ALBUMS TABLE
CREATE TABLE IF NOT EXISTS music_albums (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  artist_id UUID REFERENCES music_artists(id) ON DELETE CASCADE,
  cover_url TEXT,
  folder_path TEXT, -- Path on disk for this album
  release_year INTEGER,
  business_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SONGS TABLE
CREATE TABLE IF NOT EXISTS music_songs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  album_id UUID REFERENCES music_albums(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES music_artists(id) ON DELETE SET NULL,
  track_number INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  file_path TEXT NOT NULL, -- Path on disk
  file_name TEXT,
  business_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RATINGS TABLE - One rating per employee per song
CREATE TABLE IF NOT EXISTS music_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  song_id UUID REFERENCES music_songs(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  skip_count INTEGER DEFAULT 0,
  business_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, employee_id)
);

-- 5. PLAYLISTS TABLE
CREATE TABLE IF NOT EXISTS music_playlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  filter_min_rating NUMERIC(2,1) DEFAULT 3.0, -- Minimum avg rating for auto-generated
  filter_artists UUID[], -- Array of artist IDs to include
  business_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PLAYLIST SONGS TABLE
CREATE TABLE IF NOT EXISTS music_playlist_songs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  playlist_id UUID REFERENCES music_playlists(id) ON DELETE CASCADE NOT NULL,
  song_id UUID REFERENCES music_songs(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- 7. PLAYBACK HISTORY - Track what was played and skipped
CREATE TABLE IF NOT EXISTS music_playback_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  song_id UUID REFERENCES music_songs(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID,
  was_skipped BOOLEAN DEFAULT FALSE,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  business_id UUID
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_music_songs_album ON music_songs(album_id);
CREATE INDEX IF NOT EXISTS idx_music_songs_artist ON music_songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_music_ratings_song ON music_ratings(song_id);
CREATE INDEX IF NOT EXISTS idx_music_ratings_employee ON music_ratings(employee_id);
CREATE INDEX IF NOT EXISTS idx_music_playlist_songs_playlist ON music_playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_music_playback_history_song ON music_playback_history(song_id);

-- =====================================================
-- RLS POLICIES (Disable for now, can add later)
-- =====================================================
ALTER TABLE music_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_playback_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (same pattern as other tables)
CREATE POLICY "Allow all music_artists" ON music_artists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all music_albums" ON music_albums FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all music_songs" ON music_songs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all music_ratings" ON music_ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all music_playlists" ON music_playlists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all music_playlist_songs" ON music_playlist_songs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all music_playback_history" ON music_playback_history FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- HELPER FUNCTION: Get average rating for a song
-- =====================================================
CREATE OR REPLACE FUNCTION get_song_avg_rating(p_song_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(AVG(rating)::NUMERIC(2,1), 0)
  FROM music_ratings
  WHERE song_id = p_song_id AND rating IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- HELPER FUNCTION: Get team rating (considering skips as negative)
-- =====================================================
CREATE OR REPLACE FUNCTION get_song_team_score(p_song_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    AVG(
      CASE 
        WHEN rating IS NOT NULL THEN rating - (skip_count * 0.5)
        ELSE 0
      END
    )::NUMERIC(2,1), 
    0
  )
  FROM music_ratings
  WHERE song_id = p_song_id;
$$ LANGUAGE SQL STABLE;

COMMENT ON TABLE music_artists IS 'Music artists/bands';
COMMENT ON TABLE music_albums IS 'Music albums';
COMMENT ON TABLE music_songs IS 'Individual songs/tracks';
COMMENT ON TABLE music_ratings IS 'Employee ratings for songs (1-5 stars)';
COMMENT ON TABLE music_playlists IS 'User-created or auto-generated playlists';
COMMENT ON TABLE music_playlist_songs IS 'Junction table for playlist songs';
COMMENT ON TABLE music_playback_history IS 'Track playback and skip history';
