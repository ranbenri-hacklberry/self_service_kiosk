import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

const MusicContext = createContext(null);

// Get base URL for music files from backend
const MUSIC_API_URL = import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8080';

export const MusicProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const audioRef = useRef(new Audio());
    const handleNextRef = useRef(() => { });

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(0.7);

    // Playlist state
    const [playlist, setPlaylist] = useState([]);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState('none'); // none, one, all

    // Loading states
    const [isLoading, setIsLoading] = useState(false);

    // Skip threshold - if song was played less than 30% before skip, count as dislike
    const SKIP_THRESHOLD = 0.3;

    // Audio event listeners
    useEffect(() => {
        const audio = audioRef.current;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration || 0);
        const handleEnded = () => handleNextRef.current();
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, []);

    // Update volume
    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

    // Log skip as dislike if skipped early
    const logSkip = useCallback(async (song, wasEarlySkip) => {
        if (!song || !currentUser) return;

        try {
            // Log to playback history
            await supabase.from('music_playback_history').insert({
                song_id: song.id,
                employee_id: currentUser.id,
                was_skipped: true,
                business_id: currentUser.business_id
            });

            // If early skip, increment skip count in ratings
            if (wasEarlySkip) {
                const { data: existing } = await supabase
                    .from('music_ratings')
                    .select('*')
                    .eq('song_id', song.id)
                    .eq('employee_id', currentUser.id)
                    .single();

                if (existing) {
                    await supabase
                        .from('music_ratings')
                        .update({
                            skip_count: (existing.skip_count || 0) + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                } else {
                    await supabase.from('music_ratings').insert({
                        song_id: song.id,
                        employee_id: currentUser.id,
                        skip_count: 1,
                        business_id: currentUser.business_id
                    });
                }
            }
        } catch (error) {
            console.error('Error logging skip:', error);
        }
    }, [currentUser]);

    // Play a song
    const playSong = useCallback(async (song, playlistSongs = null) => {
        if (!song) return;

        // Never play disliked songs
        if ((song.myRating || 0) === 1) {
            console.log('🎵 playSong: skipping disliked song:', song.title);
            // If we have a playlist, move to next
            if (playlistSongs || playlist.length > 0) {
                // If playlistSongs is provided, we need to update our local state first
                if (playlistSongs) setPlaylist(playlistSongs);
                // Call handleNext (wrapped in timeout to avoid recursion issues)
                setTimeout(() => handleNextRef.current(), 100);
            }
            return;
        }

        setIsLoading(true);

        try {
            // Build audio URL
            const audioUrl = `${MUSIC_API_URL}/music/stream?path=${encodeURIComponent(song.file_path)}`;

            audioRef.current.src = audioUrl;
            audioRef.current.load();

            try {
                await audioRef.current.play();
            } catch (playError) {
                console.error('Audio play failed:', playError);
                throw new Error('Failed to play audio. The file may not be available.');
            }

            setCurrentSong(song);

            // Set playlist if provided
            if (playlistSongs) {
                setPlaylist(playlistSongs);
                const idx = playlistSongs.findIndex(s => s.id === song.id);
                setPlaylistIndex(idx >= 0 ? idx : 0);
            }

            // Log playback
            if (currentUser) {
                await supabase.from('music_playback_history').insert({
                    song_id: song.id,
                    employee_id: currentUser.id,
                    was_skipped: false,
                    business_id: currentUser.business_id
                });
            }
        } catch (error) {
            console.error('Error playing song:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    // Play/Pause toggle
    const togglePlay = useCallback(() => {
        if (audioRef.current.paused) {
            audioRef.current.play();
        } else {
            audioRef.current.pause();
        }
    }, []);

    // Pause
    const pause = useCallback(() => {
        audioRef.current.pause();
    }, []);

    // Resume
    const resume = useCallback(() => {
        audioRef.current.play();
    }, []);

    // Next song
    const handleNext = useCallback(() => {
        if (!playlist.length) return;

        // Check if this was an early skip
        const wasEarlySkip = currentTime < duration * SKIP_THRESHOLD;
        if (currentSong && wasEarlySkip) {
            logSkip(currentSong, true);
        }

        const isDislikedSong = (s) => (s?.myRating || 0) === 1;

        let nextIndex;
        if (shuffle) {
            // try a few times to avoid disliked songs
            let tries = 0;
            do {
                nextIndex = Math.floor(Math.random() * playlist.length);
                tries += 1;
            } while (tries < 10 && isDislikedSong(playlist[nextIndex]));
        } else if (repeat === 'one') {
            nextIndex = playlistIndex;
        } else {
            nextIndex = playlistIndex + 1;
            if (nextIndex >= playlist.length) {
                if (repeat === 'all') {
                    nextIndex = 0;
                } else {
                    // End of playlist
                    setIsPlaying(false);
                    return;
                }
            }
        }

        // Skip disliked songs (linear scan)
        if (!shuffle && repeat !== 'one') {
            let guard = 0;
            while (guard < playlist.length && isDislikedSong(playlist[nextIndex])) {
                nextIndex += 1;
                if (nextIndex >= playlist.length) {
                    if (repeat === 'all') nextIndex = 0;
                    else {
                        setIsPlaying(false);
                        return;
                    }
                }
                guard += 1;
            }
        }

        setPlaylistIndex(nextIndex);
        playSong(playlist[nextIndex]);
    }, [playlist, playlistIndex, shuffle, repeat, currentSong, currentTime, duration, logSkip, playSong]);

    // Keep ref in sync with handleNext
    useEffect(() => {
        handleNextRef.current = handleNext;
    }, [handleNext]);

    // Previous song
    const handlePrevious = useCallback(() => {
        if (!playlist.length) return;

        // If more than 3 seconds in, restart current song
        if (currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }

        const isDislikedSong = (s) => (s?.myRating || 0) === 1;

        let prevIndex = playlistIndex - 1;
        if (prevIndex < 0) {
            prevIndex = repeat === 'all' ? playlist.length - 1 : 0;
        }

        // Skip disliked songs (backwards scan)
        let guard = 0;
        while (guard < playlist.length && isDislikedSong(playlist[prevIndex])) {
            prevIndex -= 1;
            if (prevIndex < 0) {
                if (repeat === 'all') prevIndex = playlist.length - 1;
                else {
                    // Start of playlist reached and it's disliked
                    prevIndex = 0; 
                    // If even the first one is disliked, we stop or find first playable
                    if (isDislikedSong(playlist[0])) {
                        let firstPlayable = playlist.findIndex(s => !isDislikedSong(s));
                        if (firstPlayable === -1) {
                            setIsPlaying(false);
                            return;
                        }
                        prevIndex = firstPlayable;
                    }
                    break;
                }
            }
            guard += 1;
        }

        setPlaylistIndex(prevIndex);
        playSong(playlist[prevIndex]);
    }, [playlist, playlistIndex, repeat, currentTime, playSong]);

    // Seek to position
    const seek = useCallback((time) => {
        audioRef.current.currentTime = time;
    }, []);

    // Rate a song (like/dislike only) - use backend service to bypass RLS
    const rateSong = useCallback(async (songId, rating) => {
        console.log('🎵 rateSong called:', { songId, rating, currentUser: currentUser?.id });
        if (!currentUser || !songId) {
            console.log('🎵 rateSong: missing user or songId');
            return false;
        }

        try {
            const response = await fetch(`${MUSIC_API_URL}/music/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId,
                    employeeId: currentUser.id,
                    businessId: currentUser.business_id || null,
                    rating
                })
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result?.success) {
                throw new Error(result?.message || 'Failed to rate song');
            }

            // Update current playlist and current song with the new rating
            setPlaylist(prev => prev.map(s => s.id === songId ? { ...s, myRating: rating } : s));
            if (currentSong?.id === songId) {
                setCurrentSong(prev => ({ ...prev, myRating: rating }));
                
                // If the current song was just disliked, skip to next
                if (rating === 1) {
                    console.log('🎵 rateSong: current song disliked, skipping...');
                    handleNext();
                }
            }

            return true;
        } catch (error) {
            console.error('Error rating song:', error);
            return false;
        }
    }, [currentUser]);

    // Set volume
    const setVolume = useCallback((vol) => {
        const clampedVol = Math.max(0, Math.min(1, vol));
        setVolumeState(clampedVol);
        audioRef.current.volume = clampedVol;
    }, []);


    // Stop playback
    const stop = useCallback(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setCurrentSong(null);
        setIsPlaying(false);
    }, []);

    const value = {
        // State
        isPlaying,
        currentSong,
        currentTime,
        duration,
        volume,
        playlist,
        playlistIndex,
        shuffle,
        repeat,
        isLoading,

        // Actions
        playSong,
        togglePlay,
        pause,
        resume,
        handleNext,
        handlePrevious,
        seek,
        setVolume,
        rateSong,
        stop,
        setShuffle,
        setRepeat,
        setPlaylist,

        // Refs
        audioRef
    };

    return (
        <MusicContext.Provider value={value}>
            {children}
        </MusicContext.Provider>
    );
};

export const useMusic = () => {
    const context = useContext(MusicContext);
    if (!context) {
        throw new Error('useMusic must be used within a MusicProvider');
    }
    return context;
};

export default MusicContext;
