import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useRatings = () => {
    const { currentUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Rate a song (1-5 stars)
    const rateSong = useCallback(async (songId, rating) => {
        if (!currentUser || !songId) return false;

        setIsLoading(true);
        try {
            // Check if rating exists
            const { data: existing } = await supabase
                .from('music_ratings')
                .select('*')
                .eq('song_id', songId)
                .eq('employee_id', currentUser.id)
                .single();

            if (existing) {
                // Update existing rating
                const { error } = await supabase
                    .from('music_ratings')
                    .update({
                        rating,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Create new rating
                const { error } = await supabase
                    .from('music_ratings')
                    .insert({
                        song_id: songId,
                        employee_id: currentUser.id,
                        rating,
                        business_id: currentUser.business_id
                    });

                if (error) throw error;
            }

            return true;
        } catch (err) {
            console.error('Error rating song:', err);
            window.alert('Rating Error: ' + err.message); // Debug Alert
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Get my rating for a song
    const getMyRating = useCallback(async (songId) => {
        if (!currentUser || !songId) return null;

        try {
            const { data } = await supabase
                .from('music_ratings')
                .select('rating, skip_count')
                .eq('song_id', songId)
                .eq('employee_id', currentUser.id)
                .single();

            return data;
        } catch {
            return null;
        }
    }, [currentUser]);

    // Get aggregate ratings for a song
    const getSongRatings = useCallback(async (songId) => {
        try {
            const { data, error } = await supabase
                .from('music_ratings')
                .select('rating, skip_count')
                .eq('song_id', songId);

            if (error) throw error;

            const ratings = data?.filter(r => r.rating) || [];
            const avgRating = ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                : 0;
            const totalSkips = data?.reduce((sum, r) => sum + (r.skip_count || 0), 0) || 0;

            return {
                avgRating,
                ratingCount: ratings.length,
                totalSkips
            };
        } catch (err) {
            console.error('Error getting song ratings:', err);
            return { avgRating: 0, ratingCount: 0, totalSkips: 0 };
        }
    }, []);

    // Get top rated songs (for playlist generation)
    const getTopRatedSongs = useCallback(async (options = {}) => {
        const {
            minRating = 3.5,
            artistIds = null,
            limit = 100
        } = options;

        try {
            // Get all songs with ratings
            let query = supabase
                .from('music_songs')
                .select(`
          *,
          album:music_albums(id, name, cover_url),
          artist:music_artists(id, name)
        `);

            if (artistIds && artistIds.length > 0) {
                query = query.in('artist_id', artistIds);
            }

            const { data: songs, error } = await query;
            if (error) throw error;

            // Get all ratings
            const songIds = songs.map(s => s.id);
            const { data: ratings } = await supabase
                .from('music_ratings')
                .select('song_id, rating, skip_count')
                .in('song_id', songIds);

            // Calculate scores and filter
            const scoredSongs = songs.map(song => {
                const songRatings = ratings?.filter(r => r.song_id === song.id) || [];
                const validRatings = songRatings.filter(r => r.rating);
                const avgRating = validRatings.length > 0
                    ? validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length
                    : 0;
                const totalSkips = songRatings.reduce((sum, r) => sum + (r.skip_count || 0), 0);

                // Team score = avg rating minus skip penalty
                const teamScore = avgRating - (totalSkips * 0.1);

                return {
                    ...song,
                    avgRating,
                    teamScore,
                    ratingCount: validRatings.length,
                    totalSkips
                };
            });

            // Filter by minimum rating and sort by team score
            const filtered = scoredSongs
                .filter(s => s.avgRating >= minRating || s.ratingCount === 0) // Include unrated
                .sort((a, b) => b.teamScore - a.teamScore)
                .slice(0, limit);

            return filtered;
        } catch (err) {
            console.error('Error getting top rated songs:', err);
            return [];
        }
    }, []);

    // Generate smart playlist based on team preferences
    const generateSmartPlaylist = useCallback(async (options = {}) => {
        const {
            name = 'צוות פלייליסט',
            artistIds = null,
            minRating = 3.0,
            maxSongs = 100,
            saveToDb = true
        } = options;

        try {
            setIsLoading(true);

            // Get top rated songs
            const songs = await getTopRatedSongs({
                minRating,
                artistIds,
                limit: maxSongs
            });

            if (!songs.length) {
                return { success: false, message: 'אין מספיק שירים עם דירוג מתאים' };
            }

            if (saveToDb && currentUser) {
                // Save playlist
                const { data: playlist, error: playlistError } = await supabase
                    .from('music_playlists')
                    .insert({
                        name,
                        is_auto_generated: true,
                        filter_min_rating: minRating,
                        filter_artists: artistIds,
                        business_id: currentUser.business_id,
                        created_by: currentUser.id
                    })
                    .select()
                    .single();

                if (playlistError) throw playlistError;

                // Add songs to playlist
                const playlistSongs = songs.map((song, index) => ({
                    playlist_id: playlist.id,
                    song_id: song.id,
                    position: index
                }));

                const { error: songsError } = await supabase
                    .from('music_playlist_songs')
                    .insert(playlistSongs);

                if (songsError) throw songsError;

                return {
                    success: true,
                    playlist: { ...playlist, songs },
                    message: `נוצר פלייליסט עם ${songs.length} שירים`
                };
            }

            return { success: true, songs };
        } catch (err) {
            console.error('Error generating playlist:', err);
            return { success: false, message: err.message };
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, getTopRatedSongs]);

    return {
        isLoading,
        rateSong,
        getMyRating,
        getSongRatings,
        getTopRatedSongs,
        generateSmartPlaylist
    };
};

export default useRatings;
