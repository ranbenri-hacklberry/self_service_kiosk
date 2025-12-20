import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MUSIC_API_URL = import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8080';

export const useAlbums = () => {
    const { currentUser } = useAuth();
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [songs, setSongs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch all artists
    const fetchArtists = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('music_artists')
                .select('*')
                .order('name');

            if (error) throw error;
            setArtists(data || []);
        } catch (err) {
            console.error('Error fetching artists:', err);
            setError(err.message);
        }
    }, []);

    // Fetch all albums with artist info
    const fetchAlbums = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('music_albums')
                .select(`
          *,
          artist:music_artists(id, name, image_url)
        `)
                .order('name');

            if (error) throw error;
            setAlbums(data || []);
        } catch (err) {
            console.error('Error fetching albums:', err);
            setError(err.message);
        }
    }, []);

    // Fetch all playlists
    const fetchPlaylists = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('music_playlists')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPlaylists(data || []);
        } catch (err) {
            console.error('Error fetching playlists:', err);
            setError(err.message);
        }
    }, []);

    // Delete a playlist
    const deletePlaylist = useCallback(async (playlistId) => {
        try {
            const { error } = await supabase
                .from('music_playlists')
                .delete()
                .eq('id', playlistId);

            if (error) throw error;

            setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            return true;
        } catch (err) {
            console.error('Error deleting playlist:', err);
            window.alert('Delete Error: ' + err.message); // Debug Alert
            setError(err.message);
            return false;
        }
    }, []);

    // Remove song from playlist
    const removePlaylistSong = useCallback(async (entryId) => {
        try {
            const { error } = await supabase
                .from('music_playlist_songs')
                .delete()
                .eq('id', entryId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error removing playlist song:', err);
            return false;
        }
    }, []);

    // Add song to playlist
    const addSongToPlaylist = useCallback(async (playlistId, songId) => {
        try {
            // Get last position
            const { data: maxPos } = await supabase
                .from('music_playlist_songs')
                .select('position')
                .eq('playlist_id', playlistId)
                .order('position', { ascending: false })
                .limit(1)
                .single();

            const nextPos = (maxPos?.position || 0) + 1;

            const { data, error } = await supabase
                .from('music_playlist_songs')
                .insert({
                    playlist_id: playlistId,
                    song_id: songId,
                    position: nextPos
                })
                .select()
                .single();

            if (error) throw error;
            return data; // Return the new entry
        } catch (err) {
            console.error('Error adding playlist song:', err);
            return null;
        }
    }, []);

    // Fetch songs for a playlist
    const fetchPlaylistSongs = useCallback(async (playlistId) => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('music_playlist_songs')
                .select(`
                    *,
                    song:music_songs (
                        *,
                        album:music_albums(id, name, cover_url),
                        artist:music_artists(id, name)
                    )
                `)
                .eq('playlist_id', playlistId)
                .order('position');

            if (error) throw error;

            // Extract songs from join and format
            const songs = data.map(item => ({
                ...item.song,
                playlist_entry_id: item.id
            })).filter(s => s.id); // Filter out nulls if any

            // Fetch ratings for these songs
            if (songs.length > 0) {
                const songIds = songs.map(s => s.id);
                const { data: ratings } = await supabase
                    .from('music_ratings')
                    .select('*')
                    .in('song_id', songIds);

                return songs.map(song => {
                    const songRatings = ratings?.filter(r => r.song_id === song.id) || [];
                    const avgRating = songRatings.length > 0
                        ? songRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / songRatings.filter(r => r.rating).length
                        : 0;
                    const myRating = songRatings.find(r => r.employee_id === currentUser?.id)?.rating || 0;
                    const totalSkips = songRatings.reduce((sum, r) => sum + (r.skip_count || 0), 0);

                    return {
                        ...song,
                        avgRating: isNaN(avgRating) ? 0 : avgRating,
                        myRating,
                        totalSkips,
                        ratingCount: songRatings.filter(r => r.rating).length
                    };
                });
            }

            return songs;
        } catch (err) {
            console.error('Error fetching playlist songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Fetch songs for an album with ratings
    const fetchAlbumSongs = useCallback(async (albumId) => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('music_songs')
                .select(`
          *,
          album:music_albums(id, name, cover_url),
          artist:music_artists(id, name)
        `)
                .eq('album_id', albumId)
                .order('track_number');

            if (error) throw error;

            // Fetch ratings for these songs
            const songIds = data.map(s => s.id);
            const { data: ratings } = await supabase
                .from('music_ratings')
                .select('*')
                .in('song_id', songIds);

            // Calculate average ratings
            const songsWithRatings = data.map(song => {
                const songRatings = ratings?.filter(r => r.song_id === song.id) || [];
                const avgRating = songRatings.length > 0
                    ? songRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / songRatings.filter(r => r.rating).length
                    : 0;
                const myRating = songRatings.find(r => r.employee_id === currentUser?.id)?.rating || 0;
                const totalSkips = songRatings.reduce((sum, r) => sum + (r.skip_count || 0), 0);

                return {
                    ...song,
                    avgRating: isNaN(avgRating) ? 0 : avgRating,
                    myRating,
                    totalSkips,
                    ratingCount: songRatings.filter(r => r.rating).length
                };
            });

            return songsWithRatings;
        } catch (err) {
            console.error('Error fetching album songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Fetch all songs
    const fetchAllSongs = useCallback(async () => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('music_songs')
                .select(`
          *,
          album:music_albums(id, name, cover_url),
          artist:music_artists(id, name)
        `)
                .order('title');

            if (error) throw error;
            setSongs(data || []);
            return data || [];
        } catch (err) {
            console.error('Error fetching songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Scan directory for music files (calls backend, then saves to Supabase)
    const scanMusicDirectory = useCallback(async (directoryPath, forceClean = false, onProgress = null) => {
        try {
            setIsLoading(true);
            setError(null);

            // If forceClean, delete all existing data first
            if (forceClean) {
                onProgress?.({ phase: 'מוחק נתונים ישנים...', current: 0, total: 0 });
                console.log('🗑️ Deleting all existing songs for clean rescan...');
                await supabase.from('music_songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('music_albums').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('music_artists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                console.log('✅ Cleaned database');
            }

            // 1. Call backend to scan files
            onProgress?.({ phase: 'סורק תיקיות...', current: 0, total: 0 });
            const response = await fetch(`${MUSIC_API_URL}/music/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: directoryPath })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to scan directory');
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Scan failed');
            }

            const artists = result.data?.artists || [];
            const albums = result.data?.albums || [];
            const songs = result.data?.songs || [];
            const totalItems = artists.length + albums.length + songs.length;
            let processedItems = 0;

            console.log(`📂 Found ${artists.length} artists, ${albums.length} albums, ${songs.length} songs`);

            // 2. Batch insert artists
            onProgress?.({ phase: 'שומר אמנים...', current: processedItems, total: totalItems });
            const artistMap = {};

            if (artists.length > 0) {
                // Insert all artists at once
                const { data: insertedArtists, error: artistError } = await supabase
                    .from('music_artists')
                    .upsert(
                        artists.map(a => ({ name: a.name, folder_path: a.folder_path })),
                        { onConflict: 'name', ignoreDuplicates: false }
                    )
                    .select();

                if (artistError) console.error('Artist insert error:', artistError);

                // Fetch all artists to build map
                const { data: allArtists } = await supabase.from('music_artists').select('id, name');
                allArtists?.forEach(a => { artistMap[a.name] = a.id; });
                processedItems += artists.length;
            }

            // 3. Batch insert albums
            onProgress?.({ phase: 'שומר אלבומים...', current: processedItems, total: totalItems });
            const albumMap = {};

            if (albums.length > 0) {
                const albumsToInsert = albums
                    .filter(a => artistMap[a.artist_name])
                    .map(a => ({
                        name: a.name,
                        artist_id: artistMap[a.artist_name],
                        folder_path: a.folder_path,
                        cover_url: a.cover_path
                    }));

                if (albumsToInsert.length > 0) {
                    const { error: albumError } = await supabase
                        .from('music_albums')
                        .upsert(albumsToInsert, { onConflict: 'name,artist_id', ignoreDuplicates: false });

                    if (albumError) console.error('Album insert error:', albumError);
                }

                // Fetch all albums to build map
                const { data: allAlbums } = await supabase
                    .from('music_albums')
                    .select('id, name, artist_id');
                allAlbums?.forEach(a => {
                    const artistName = Object.keys(artistMap).find(k => artistMap[k] === a.artist_id);
                    if (artistName) albumMap[`${artistName}/${a.name}`] = a.id;
                });
                processedItems += albums.length;
            }

            // 4. Batch insert songs in chunks of 50
            const CHUNK_SIZE = 50;
            let savedCount = 0;

            for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
                const chunk = songs.slice(i, i + CHUNK_SIZE);
                onProgress?.({
                    phase: `שומר שירים... (${Math.min(i + CHUNK_SIZE, songs.length)}/${songs.length})`,
                    current: processedItems + i,
                    total: totalItems
                });

                const songsToInsert = chunk
                    .filter(s => artistMap[s.artist_name])
                    .map(s => ({
                        title: s.title,
                        file_path: s.file_path,
                        file_name: s.file_name,
                        track_number: s.track_number,
                        artist_id: artistMap[s.artist_name],
                        album_id: albumMap[`${s.artist_name}/${s.album_name}`] || null
                    }));

                if (songsToInsert.length > 0) {
                    const { error: songError } = await supabase
                        .from('music_songs')
                        .upsert(songsToInsert, { onConflict: 'file_path', ignoreDuplicates: false });

                    if (songError) console.error('Song insert error:', songError);
                    else savedCount += songsToInsert.length;
                }
            }
            processedItems = totalItems;

            console.log(`✅ Saved ${savedCount} songs`);
            onProgress?.({ phase: 'סיים!', current: totalItems, total: totalItems });

            // Refresh data after save
            await fetchArtists();
            await fetchAlbums();

            return result;
        } catch (err) {
            console.error('Error scanning directory:', err);
            setError(err.message);
            return { success: false, message: err.message };
        } finally {
            setIsLoading(false);
        }
    }, [fetchArtists, fetchAlbums]);

    // Get songs by artist
    const fetchArtistSongs = useCallback(async (artistId) => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase
                .from('music_songs')
                .select(`
          *,
          album:music_albums(id, name, cover_url),
          artist:music_artists(id, name)
        `)
                .eq('artist_id', artistId)
                .order('album_id', { ascending: true })
                .order('track_number', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error fetching artist songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchArtists();
        fetchAlbums();
        fetchPlaylists();
    }, [fetchArtists, fetchAlbums, fetchPlaylists]);

    return {
        artists,
        albums,
        playlists,
        songs,
        isLoading,
        error,
        fetchArtists,
        fetchAlbums,
        fetchAlbumSongs,
        fetchAllSongs,
        fetchArtistSongs,
        fetchPlaylists,
        fetchPlaylistSongs,
        deletePlaylist,
        removePlaylistSong,
        addSongToPlaylist,
        scanMusicDirectory,
        refreshAll: async () => {
            await fetchArtists();
            await fetchAlbums();
            await fetchPlaylists();
        }
    };
};

export default useAlbums;
