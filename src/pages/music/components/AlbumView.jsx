import React, { useState, useEffect } from 'react';
import { ArrowRight, Play, Clock, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMusic } from '@/context/MusicContext';
import { useAlbums } from '@/hooks/useAlbums';
import SongRow from '@/components/music/SongRow';
import '@/styles/music.css';

const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const MUSIC_API_URL = isLocalServer ? '' : (
    import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://127.0.0.1:8082'
);

// Helper to convert local path to backend URL
const getCoverUrl = (localPath) => {
    if (!localPath) return null;
    if (localPath.startsWith('http')) return localPath;
    return `${MUSIC_API_URL}/music/cover?path=${encodeURIComponent(localPath)}`;
};

/**
 * Album view component - shows album details and song list
 */
const AlbumView = ({ album, onBack }) => {
    const { playSong, currentSong, isPlaying, rateSong } = useMusic();
    const { fetchAlbumSongs } = useAlbums();

    const [songs, setSongs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch album songs on mount
    useEffect(() => {
        const loadSongs = async () => {
            setIsLoading(true);
            const albumSongs = await fetchAlbumSongs(album.id);
            setSongs(albumSongs);
            setIsLoading(false);
        };

        if (album?.id) {
            loadSongs();
        }
    }, [album?.id, fetchAlbumSongs]);

    // Handle play all
    const handlePlayAll = () => {
        if (songs.length > 0) {
            playSong(songs[0], songs);
        }
    };

    // Handle song play
    const handleSongPlay = (song) => {
        playSong(song, songs);
    };

    // Handle rating
    const handleRate = async (songId, rating) => {
        await rateSong(songId, rating);
    };


    // Calculate total duration
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const formatTotalDuration = () => {
        const hours = Math.floor(totalDuration / 3600);
        const mins = Math.floor((totalDuration % 3600) / 60);
        if (hours > 0) {
            return `${hours} שעות ${mins} דקות`;
        }
        return `${mins} דקות`;
    };

    // Generate gradient based on album name
    const getGradient = () => {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        ];
        const index = (album.name?.charCodeAt(0) || 0) % gradients.length;
        return gradients[index];
    };

    return (
        <div className="min-h-full">
            {/* Header with album info */}
            <div
                className="relative p-6 pb-32"
                style={{ background: getGradient() }}
            >
                {/* Back button */}
                <button
                    onClick={onBack}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full music-glass 
                    flex items-center justify-center z-10"
                >
                    <ArrowRight className="w-5 h-5 text-white" />
                </button>

                {/* Album info */}
                <div className="flex items-end gap-6 mt-8">
                    {/* Cover */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-48 h-48 rounded-2xl shadow-2xl overflow-hidden flex-shrink-0"
                    >
                        {album.cover_url ? (
                            <img
                                src={getCoverUrl(album.cover_url)}
                                alt={album.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="w-full h-full music-glass flex items-center justify-center">
                                <Music className="w-20 h-20 text-white/30" />
                            </div>
                        )}
                    </motion.div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-white/70 text-sm font-medium mb-1">אלבום</p>
                        <h1 className="text-white text-4xl font-black mb-2 truncate">
                            {album.name}
                        </h1>
                        <p className="text-white/80 text-lg mb-4">
                            {album.artist?.name || 'אמן לא ידוע'}
                        </p>
                        <div className="flex items-center gap-4 text-white/60 text-sm">
                            {album.release_year && (
                                <span>{album.release_year}</span>
                            )}
                            <span>•</span>
                            <span>{songs.length} שירים</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatTotalDuration()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Play button */}
                <button
                    onClick={handlePlayAll}
                    disabled={songs.length === 0}
                    className="absolute left-6 bottom-6 w-14 h-14 rounded-full bg-white 
                    flex items-center justify-center shadow-xl
                    hover:scale-105 transition-transform disabled:opacity-50"
                >
                    <Play className="w-7 h-7 text-purple-600 fill-purple-600 mr-[-3px]" />
                </button>

                {/* Gradient fade */}
                <div className="absolute bottom-0 left-0 right-0 h-32 
                       bg-gradient-to-t from-[#1a1a2e] to-transparent" />
            </div>

            {/* Song list */}
            <div className="bg-[#1a1a2e] px-4 pb-32 -mt-20">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : songs.length === 0 ? (
                    <div className="text-center py-12">
                        <Music className="w-12 h-12 text-white/20 mx-auto mb-4" />
                        <p className="text-white/40">אין שירים באלבום זה</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {songs.map((song, index) => (
                            <SongRow
                                key={song.id}
                                song={song}
                                index={index}
                                isPlaying={isPlaying}
                                isCurrentSong={currentSong?.id === song.id}
                                onPlay={handleSongPlay}
                                onRate={handleRate}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlbumView;
