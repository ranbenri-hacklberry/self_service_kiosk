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
    const [scanLibrary, setScanLibrary] = useState(null); // { artists, albums, songs } from last scan (fallback when DB/RLS blocks)
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMusicDriveConnected, setIsMusicDriveConnected] = useState(false); // Start as false until we check

    const fetchRatingsMap = useCallback(async (songIds) => {
        if (!currentUser?.id) {
            return new Map();
        }

        try {
            const res = await fetch(`${MUSIC_API_URL}/music/library/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId: currentUser.id, songIds })
            });
            const json = await res.json();
            if (!res.ok || !json?.success) return new Map();
            const m = new Map();
            (json.ratings || []).forEach(r => m.set(r.song_id, r.rating));
            return m;
        } catch {
            return new Map();
        }
    }, [currentUser?.id]);

    const fetchFavoritesSongs = useCallback(async () => {
        if (!currentUser?.id) return [];
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/library/favorites?employeeId=${encodeURIComponent(currentUser.id)}`);
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch favorites');
            return json.songs || [];
        } catch (err) {
            console.error('Error fetching favorites:', err);
            return [];
        }
    }, [currentUser?.id]);

    // Check if music drive is connected
    const checkMusicDriveConnection = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${MUSIC_API_URL}/music/volumes`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Check for saved music path in localStorage, or find external drive
            const savedMusicPath = localStorage.getItem('music_drive_path');

            // Look for: saved path, Ran1 drive, or any external volume (not Macintosh HD)
            const externalDrive = data.volumes?.find(v =>
                (savedMusicPath && v.path === savedMusicPath) ||
                v.name === 'Ran1' ||
                (v.path.startsWith('/Volumes/') && v.name !== 'Macintosh HD')
            );

            const isConnected = !!externalDrive;
            setIsMusicDriveConnected(isConnected);

            // Save the path if found
            if (externalDrive) {
                localStorage.setItem('music_drive_path', externalDrive.path);
            }

            return isConnected;
        } catch (err) {
            console.error('Error checking music drive connection:', err);
            setIsMusicDriveConnected(false);
            return false;
        }
    }, []);

    // Fetch all artists (via backend service to bypass RLS)
    const fetchArtists = useCallback(async () => {
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/library/artists`);
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch artists');
            const list = json.artists || [];
            if (list.length === 0 && scanLibrary?.artists?.length) {
                setArtists(scanLibrary.artists);
            } else {
                setArtists(list);
            }
        } catch (err) {
            console.error('Error fetching artists:', err);
            setError(err.message);
        }
    }, [scanLibrary]);

    // Fetch all albums with artist info (via backend service to bypass RLS)
    const fetchAlbums = useCallback(async () => {
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/library/albums`);
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch albums');
            const list = json.albums || [];
            if (list.length === 0 && scanLibrary?.albums?.length) {
                setAlbums(scanLibrary.albums);
            } else {
                setAlbums(list);
            }
        } catch (err) {
            console.error('Error fetching albums:', err);
            setError(err.message);
        }
    }, [scanLibrary]);

    // Fetch all playlists (via backend service to bypass RLS)
    const fetchPlaylists = useCallback(async () => {
        try {
            const res = await fetch(`${MUSIC_API_URL}/music/library/playlists`);
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch playlists');
            setPlaylists(json.playlists || []);
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

    // Fetch songs for a playlist (via backend service to bypass RLS)
    const fetchPlaylistSongs = useCallback(async (playlistId) => {
        try {
            setIsLoading(true);
            const res = await fetch(`${MUSIC_API_URL}/music/library/playlists/${playlistId}/songs`);
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch playlist songs');
            const songs = json.songs || [];
            const ratingMap = await fetchRatingsMap(songs.map(s => s.id).filter(Boolean));
            return songs.map(s => ({ ...s, myRating: ratingMap.get(s.id) || 0 }));
        } catch (err) {
            console.error('Error fetching playlist songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Fetch songs for an album (via backend service to bypass RLS)
    const fetchAlbumSongs = useCallback(async (albumId) => {
        try {
            setIsLoading(true);
            // If this is a scanned album (we use folder_path as id), resolve from scan cache
            const looksLikeFolderPath = typeof albumId === 'string' && albumId.startsWith('/');
            if (looksLikeFolderPath && scanLibrary?.songs?.length) {
                const albumMeta = scanLibrary?.albums?.find(a => a.id === albumId);
                const coverUrl = albumMeta?.cover_url || null;
                const albumName = albumMeta?.name || null;
                const artistName = albumMeta?.artist?.name || null;

                const matching = scanLibrary.songs
                    .filter(s => s.file_path?.startsWith(albumId))
                    .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                    .map(s => ({
                        ...s,
                        album: { name: albumName, cover_url: coverUrl },
                        artist: { name: artistName || s.artist?.name || null }
                    }));

                return matching;
            }

            const res = await fetch(`${MUSIC_API_URL}/music/library/albums/${albumId}/songs`);
            const json = await res.json();
            if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to fetch album songs');
            const songs = json.songs || [];
            const ratingMap = await fetchRatingsMap(songs.map(s => s.id).filter(Boolean));
            return songs.map(s => ({ ...s, myRating: ratingMap.get(s.id) || 0 }));
        } catch (err) {
            console.error('Error fetching album songs:', err);
            setError(err.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, scanLibrary]);

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

    // Scan directory for music files (backend scans + saves to Supabase using service key)
    const scanMusicDirectory = useCallback(async (directoryPath, forceClean = false, onProgress = null) => {
        try {
            setIsLoading(true);
            setError(null);

            onProgress?.({ phase: 'סורק ושומר למסד נתונים...', current: 0, total: 0 });
            const response = await fetch(`${MUSIC_API_URL}/music/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: directoryPath, saveToDb: true, forceClean })
            });

            const result = await response.json();
            if (!response.ok || !result?.success) {
                throw new Error(result?.message || 'Failed to scan directory');
            }

            // Always populate UI immediately from scan result (even if DB write is blocked by RLS/missing service key)
            const rawArtists = result.data?.artists || [];
            const rawAlbums = result.data?.albums || [];
            const rawSongs = result.data?.songs || [];

            const mappedArtists = rawArtists.map(a => ({
                id: `scan-artist:${a.name}`,
                name: a.name,
                image_url: null,
                folder_path: a.folder_path || null
            }));

            const mappedAlbums = rawAlbums.map(a => ({
                id: a.folder_path, // folder path is unique and lets us resolve songs locally
                name: a.name,
                cover_url: a.cover_path || null,
                folder_path: a.folder_path || null,
                artist: { name: a.artist_name }
            }));

            const albumByFolder = new Map(mappedAlbums.map(a => [a.id, a]));
            const mappedSongs = rawSongs.map(s => {
                // best-effort: match album by folder path prefix
                let albumMatch = null;
                for (const [folderPath, album] of albumByFolder.entries()) {
                    if (folderPath && s.file_path?.startsWith(folderPath)) {
                        albumMatch = album;
                        break;
                    }
                }

                return {
                    id: s.file_path, // stable for playback
                    title: s.title,
                    file_path: s.file_path,
                    file_name: s.file_name,
                    track_number: s.track_number || 0,
                    duration_seconds: null,
                    artist: { name: s.artist_name },
                    album: albumMatch ? { name: albumMatch.name, cover_url: albumMatch.cover_url } : { name: s.album_name, cover_url: null }
                };
            });

            const library = { artists: mappedArtists, albums: mappedAlbums, songs: mappedSongs };
            setScanLibrary(library);
            setArtists(mappedArtists);
            setAlbums(mappedAlbums);
            setSongs(mappedSongs);

            onProgress?.({ phase: 'טוען נתונים...', current: 0, total: 0 });
            await fetchArtists();
            await fetchAlbums();
            await fetchPlaylists();

            onProgress?.({ phase: 'סיים!', current: result?.stats?.songs || 0, total: result?.stats?.songs || 0 });
            return result;
        } catch (err) {
            console.error('Error scanning directory:', err);
            setError(err.message);
            return { success: false, message: err.message };
        } finally {
            setIsLoading(false);
        }
    }, [fetchArtists, fetchAlbums, fetchPlaylists]);

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
        checkMusicDriveConnection();
        fetchArtists();
        fetchAlbums();
        fetchPlaylists();
    }, [checkMusicDriveConnection, fetchArtists, fetchAlbums, fetchPlaylists]);

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
        fetchFavoritesSongs,
        deletePlaylist,
        removePlaylistSong,
        addSongToPlaylist,
        scanMusicDirectory,
        isMusicDriveConnected,
        checkMusicDriveConnection,
        generateSmartPlaylist: useCallback(async (options = {}) => {
            const {
                name = 'פלייליסט חכם',
                artistIds = null,
                maxSongs = 100,
                saveToDb = true
            } = options;

            if (!currentUser?.id) {
                return { success: false, message: 'אין משתמש מחובר' };
            }

            try {
                const res = await fetch(`${MUSIC_API_URL}/music/smart-playlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        artistIds,
                        maxSongs,
                        saveToDb,
                        employeeId: currentUser.id,
                        businessId: currentUser.business_id || null
                    })
                });

                const json = await res.json();
                if (!res.ok || !json?.success) {
                    return { success: false, message: json?.message || 'Failed to create playlist' };
                }

                // Attach myRating for UI highlighting
                const songs = json.playlist?.songs || [];
                const ratingMap = await fetchRatingsMap(songs.map(s => s.id).filter(Boolean));
                const songsWithRatings = songs.map(s => ({ ...s, myRating: ratingMap.get(s.id) || 0 }));

                return {
                    success: true,
                    playlist: { ...(json.playlist || {}), songs: songsWithRatings },
                    message: json.message || `נוצר פלייליסט עם ${songsWithRatings.length} שירים`
                };
            } catch (err) {
                console.error('Error generating playlist:', err);
                return { success: false, message: err.message };
            }
        }, [currentUser?.id, currentUser?.business_id, fetchRatingsMap]),

        refreshAll: async () => {
            await fetchArtists();
            await fetchAlbums();
            await fetchPlaylists();
        }
    };
};

export default useAlbums;
