import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, ThumbsUp, ThumbsDown, Music, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Compact Mini music player for headers
 * Connects to RanTunes via Supabase music_current_playback table
 * Uses business email for playback sync
 * Light/white theme, ~1/3 screen width
 */
const MiniMusicPlayer = ({ className = '' }) => {
    const { currentUser } = useAuth();
    const [playback, setPlayback] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [businessEmail, setBusinessEmail] = useState(null);

    // Fetch business email first
    useEffect(() => {
        const fetchBusinessEmail = async () => {
            if (!currentUser?.business_id) return;

            try {
                const { data } = await supabase
                    .from('businesses')
                    .select('email')
                    .eq('id', currentUser.business_id)
                    .single();

                if (data?.email) {
                    setBusinessEmail(data.email);
                } else {
                    // Fallback to user email if business email not set
                    setBusinessEmail(currentUser.email);
                }
            } catch (err) {
                console.error('Error fetching business email:', err);
                setBusinessEmail(currentUser.email);
            }
        };

        fetchBusinessEmail();
    }, [currentUser?.business_id, currentUser?.email]);

    // Fetch initial playback state from RanTunes
    useEffect(() => {
        const fetchPlayback = async () => {
            if (!businessEmail) return;

            try {
                const { data } = await supabase
                    .from('music_current_playback')
                    .select('*')
                    .eq('user_email', businessEmail)
                    .maybeSingle();

                if (data) setPlayback(data);
            } catch (err) {
                console.error('Error fetching playback:', err);
            }
        };

        fetchPlayback();
    }, [businessEmail]);

    // Subscribe to realtime updates from RanTunes
    useEffect(() => {
        if (!businessEmail) return;

        const channel = supabase
            .channel('mini-playback-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'music_current_playback',
                    filter: `user_email=eq.${businessEmail}`
                },
                (payload) => {
                    if (payload.new) {
                        setPlayback(payload.new);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessEmail]);

    // Send command to RanTunes
    const sendCommand = async (command) => {
        console.log('🎮 [MiniPlayer] sendCommand called:', { command, businessEmail, isLoading });

        if (!businessEmail || isLoading) {
            console.log('🎮 [MiniPlayer] Command blocked:', { noEmail: !businessEmail, isLoading });
            return;
        }

        setIsLoading(true);
        try {
            console.log('🎮 [MiniPlayer] Inserting command to music_commands table...');
            const { data, error } = await supabase
                .from('music_commands')
                .insert({
                    user_email: businessEmail,
                    user_id: currentUser?.id,
                    command: command,
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                console.error('🎮 [MiniPlayer] Insert error:', error);
            } else {
                console.log('🎮 [MiniPlayer] Command inserted successfully:', data);
            }

            // Optimistic UI update
            if (command === 'pause') {
                setPlayback(prev => prev ? { ...prev, is_playing: false } : prev);
            } else if (command === 'play') {
                setPlayback(prev => prev ? { ...prev, is_playing: true } : prev);
            }
        } catch (err) {
            console.error('🎮 [MiniPlayer] Error sending command:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Rate the current song
    // Rating 1 = dislike (song will be skipped in future plays)
    // Rating 5 = like
    // Rating 0 = remove rating
    const rateSong = async (rating) => {
        if (!playback?.song_id || !currentUser?.id) return;

        try {
            console.log('🎵 [MiniPlayer] Rating song:', { song_id: playback.song_id, rating });

            await supabase
                .from('rantunes_ratings')
                .upsert({
                    song_id: playback.song_id,
                    user_id: currentUser.id,
                    rating: rating,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, song_id' });

            // Optimistic update
            setPlayback(prev => ({ ...prev, userRating: rating }));

            // If disliked (rating = 1), skip to next song automatically
            if (rating === 1) {
                console.log('🎵 [MiniPlayer] Song disliked, skipping to next...');
                await sendCommand('next');
            }
        } catch (err) {
            console.error('Error rating song:', err);
        }
    };

    // Open RanTunes in new tab
    const openRanTunes = () => {
        window.open('https://music.hacklberryfinn.com', '_blank');
    };

    // Don't render if no playback data
    if (!currentUser || !playback || !playback.song_title) {
        return null;
    }

    const isLiked = playback.userRating === 5;
    const isDisliked = playback.userRating === 1;

    return (
        <div
            className={`flex items-center gap-3 bg-gray-100 hover:bg-gray-50 rounded-xl px-4 py-2 transition-all max-w-[340px] min-w-[220px] ${className}`}
            dir="rtl"
        >
            {/* Album Art - Right side in RTL */}
            <div
                className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 shrink-0 cursor-pointer shadow-sm"
                onClick={openRanTunes}
            >
                {playback.cover_url ? (
                    <img
                        src={playback.cover_url}
                        alt={playback.album_name || 'Album'}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Music className="w-5 h-5" />
                    </div>
                )}
            </div>

            {/* Song & Artist */}
            <div className="min-w-0 flex-1 cursor-pointer text-right" onClick={openRanTunes}>
                <p className="text-gray-800 text-sm font-semibold truncate leading-tight">
                    {playback.song_title}
                </p>
                <p className="text-gray-500 text-xs truncate leading-tight">
                    {playback.artist_name}
                </p>
            </div>

            {/* Controls - order: Like, Dislike, Play/Pause, Next */}
            <div className="flex items-center gap-1 shrink-0">
                {/* Like */}
                <button
                    onClick={() => rateSong(isLiked ? 0 : 5)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
                        ${isLiked
                            ? 'bg-green-100 text-green-600'
                            : 'text-gray-400 hover:text-green-500 hover:bg-gray-200'
                        }`}
                    title="אהבתי"
                >
                    <ThumbsUp className="w-3.5 h-3.5" />
                </button>

                {/* Dislike */}
                <button
                    onClick={() => rateSong(isDisliked ? 0 : 1)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
                        ${isDisliked
                            ? 'bg-red-100 text-red-600'
                            : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
                        }`}
                    title="לא אהבתי"
                >
                    <ThumbsDown className="w-3.5 h-3.5" />
                </button>

                {/* Play/Pause with left arrow indicator */}
                <button
                    onClick={() => sendCommand(playback.is_playing ? 'pause' : 'play')}
                    disabled={isLoading}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isLoading ? 'bg-gray-200 opacity-50' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                    title={playback.is_playing ? 'השהה' : 'נגן'}
                >
                    {playback.is_playing ? (
                        <Pause className="w-4 h-4 text-gray-700 fill-gray-700" />
                    ) : (
                        <Play className="w-4 h-4 text-gray-700 fill-gray-700" />
                    )}
                </button>

                {/* Next Song - arrow pointing left for RTL */}
                <button
                    onClick={() => sendCommand('next')}
                    disabled={isLoading}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isLoading ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                    title="שיר הבא"
                >
                    <SkipBack className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

export default MiniMusicPlayer;
