import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, ThumbsUp, ThumbsDown, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Compact Mini Music Bar for iCaffe Headers
 * Design: Light/white theme, max 1/3 screen width
 * Embedded in individual screen headers (left side)
 */
const MiniMusicBar = ({ className = '' }) => {
    const { currentUser } = useAuth();
    const [playback, setPlayback] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch initial playback state
    useEffect(() => {
        const fetchPlayback = async () => {
            if (!currentUser?.email) return;

            try {
                const { data } = await supabase
                    .from('music_current_playback')
                    .select('*')
                    .eq('user_email', currentUser.email)
                    .maybeSingle();

                if (data) setPlayback(data);
            } catch (err) {
                console.error('Error fetching playback:', err);
            }
        };

        fetchPlayback();
    }, [currentUser?.id]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!currentUser?.email) return;

        const channel = supabase
            .channel('playback-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'music_current_playback',
                    filter: `user_email=eq.${currentUser.email}`
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
    }, [currentUser?.email]);

    // Send command to RanTunes via Supabase
    const sendCommand = async (command) => {
        if (!currentUser?.email || isLoading) return;

        setIsLoading(true);
        try {
            await supabase
                .from('music_commands')
                .insert({
                    user_email: currentUser.email,
                    user_id: currentUser.id,
                    command: command,
                    created_at: new Date().toISOString()
                });
        } catch (err) {
            console.error('Error sending command:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Rate the current song
    const rateSong = async (rating) => {
        if (!playback?.song_id || !currentUser?.id) return;

        try {
            await supabase
                .from('rantunes_ratings')
                .upsert({
                    song_id: playback.song_id,
                    user_id: currentUser.id,
                    rating: rating,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, song_id' });

            setPlayback(prev => ({ ...prev, userRating: rating }));
        } catch (err) {
            console.error('Error rating song:', err);
        }
    };

    // Open RanTunes in new tab
    const openRanTunes = () => {
        window.open('https://music.hacklberryfinn.com', '_blank');
    };

    // Don't render if user not logged in or no playback
    if (!currentUser || !currentUser.email || !playback || !playback.song_title) {
        return null;
    }

    const isLiked = playback.userRating === 5;
    const isDisliked = playback.userRating === 1;

    return (
        <div
            className={`flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-1.5 transition-all max-w-[33%] min-w-[200px] ${className}`}
            dir="ltr"
        >
            {/* Album Art */}
            <div
                className="w-8 h-8 rounded-lg overflow-hidden bg-gray-200 shrink-0 cursor-pointer"
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
                        <Music className="w-4 h-4" />
                    </div>
                )}
            </div>

            {/* Song & Artist */}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={openRanTunes}>
                <p className="text-gray-800 text-xs font-medium truncate leading-tight">
                    {playback.song_title}
                </p>
                <p className="text-gray-500 text-[10px] truncate leading-tight">
                    {playback.artist_name}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
                {/* Play/Pause */}
                <button
                    onClick={() => sendCommand(playback.is_playing ? 'pause' : 'play')}
                    disabled={isLoading}
                    className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all"
                    title={playback.is_playing ? 'השהה' : 'נגן'}
                >
                    {playback.is_playing ? (
                        <Pause className="w-3 h-3 text-gray-700 fill-gray-700" />
                    ) : (
                        <Play className="w-3 h-3 text-gray-700 fill-gray-700" />
                    )}
                </button>

                {/* Like */}
                <button
                    onClick={() => rateSong(isLiked ? 0 : 5)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                        ${isLiked
                            ? 'bg-green-100 text-green-600'
                            : 'text-gray-400 hover:text-green-500 hover:bg-gray-200'
                        }`}
                    title="אהבתי"
                >
                    <ThumbsUp className="w-3 h-3" />
                </button>

                {/* Dislike */}
                <button
                    onClick={() => rateSong(isDisliked ? 0 : 1)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                        ${isDisliked
                            ? 'bg-red-100 text-red-600'
                            : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
                        }`}
                    title="לא אהבתי"
                >
                    <ThumbsDown className="w-3 h-3" />
                </button>

                {/* Next */}
                <button
                    onClick={() => sendCommand('next')}
                    disabled={isLoading}
                    className="w-6 h-6 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition-all"
                    title="שיר הבא"
                >
                    <SkipForward className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
};

export default MiniMusicBar;
