-- Fix music tables constraints for upsert operations

-- Add unique constraint on music_artists.name
ALTER TABLE music_artists 
ADD CONSTRAINT music_artists_name_key UNIQUE (name);

-- Add unique constraint on music_albums (name, artist_id)
ALTER TABLE music_albums 
ADD CONSTRAINT music_albums_name_artist_id_key UNIQUE (name, artist_id);

-- Add unique constraint on music_songs.file_path
ALTER TABLE music_songs 
ADD CONSTRAINT music_songs_file_path_key UNIQUE (file_path);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_music_artists_name ON music_artists(name);
CREATE INDEX IF NOT EXISTS idx_music_albums_name_artist ON music_albums(name, artist_id);
CREATE INDEX IF NOT EXISTS idx_music_songs_file_path ON music_songs(file_path);

COMMENT ON TABLE music_artists IS 'Music artists with unique names';
COMMENT ON TABLE music_albums IS 'Music albums with unique name per artist';
COMMENT ON TABLE music_songs IS 'Music songs with unique file paths';
