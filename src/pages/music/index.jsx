import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Music, Disc, ListMusic, Search, Upload, RefreshCw,
    ArrowRight, Sparkles, User, Play, FolderOpen, Heart,
    Pause, SkipForward, SkipBack, Trash2, X, HardDrive, AlertCircle, Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMusic } from '@/context/MusicContext';
import { useAlbums } from '@/hooks/useAlbums';
import { useAuth } from '@/context/AuthContext';
import AlbumCard from '@/components/music/AlbumCard';
import VinylTurntable from '@/components/music/VinylTurntable';
import SongRow from '@/components/music/SongRow';
import MiniMusicPlayer from '../../components/music/MiniMusicPlayer';
import ConnectionStatusBar from '../../components/ConnectionStatusBar';
import AlbumView from './components/AlbumView';
import PlaylistBuilder from './components/PlaylistBuilder';
import DirectoryScanner from './components/DirectoryScanner';
import SpotifyAlbumSearch from './components/SpotifyAlbumSearch';
import SpotifyService from '@/lib/spotifyService';
import '@/styles/music.css';

// Tabs for navigation
const TABS = [
    { id: 'albums', label: 'אלבומים', icon: Disc },
    { id: 'artists', label: 'אמנים', icon: User },
    { id: 'playlists', label: 'פלייליסטים', icon: ListMusic },
    { id: 'favorites', label: 'מועדפים', icon: Heart },
];

const MusicPageContent = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // Permission check: Only Managers and Admins
    const isManager = currentUser?.access_level === 'Admin' ||
        currentUser?.access_level === 'Manager' ||
        currentUser?.is_admin;

    if (!isManager) {
        return (
            <div className="min-h-screen music-gradient-dark flex flex-col items-center justify-center p-6 text-center" dir="rtl">
                <div className="music-glass p-8 rounded-3xl max-w-md border border-red-500/30">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <X className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-white text-2xl font-black mb-4">גישה נדחתה</h2>
                    <p className="text-white/60 mb-8">אין לך הרשאות מתאימות לגישה למערכת המוזיקה. דף זה מיועד למנהלים בלבד.</p>
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="w-full py-4 music-gradient-purple text-white font-bold rounded-2xl hover:scale-[1.02] transition-transform shadow-lg"
                    >
                        חזרה לתפריט ראשי
                    </button>
                </div>
            </div>
        );
    }

    const {
        albums,
        artists,
        playlists,
        isLoading,
        error,
        isMusicDriveConnected,
        checkMusicDriveConnection,
        refreshAll,
        addSongToPlaylist,
        77: addSpotifyAlbum,
        78: removeSpotifyAlbum,
        79: scanMusicDirectory,
        fetchAlbumSongs,
        fetchPlaylists,
        fetchPlaylistSongs,
        fetchFavoritesSongs,
        deletePlaylist,
        generateSmartPlaylist
    } = useAlbums();
    const {
        currentSong,
        playSong,
        isPlaying,
        togglePlay,
        handleNext,
        handlePrevious,
        playlist,
        rateSong
    } = useMusic();

    const [activeTab, setActiveTab] = useState('albums');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [showPlaylistBuilder, setShowPlaylistBuilder] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [currentAlbumSongs, setCurrentAlbumSongs] = useState([]);
    const [favoriteSongs, setFavoriteSongs] = useState([]);

    // NEW: Spotify & Music Source State
    const [showSpotifySearch, setShowSpotifySearch] = useState(false);
    const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
    const [showDiskPopup, setShowDiskPopup] = useState(false);
    const [musicSource, setMusicSource] = useState(() => {
        // Load saved preference from localStorage
        return localStorage.getItem('music_source') || null;
    });

    // Check Spotify connection on mount
    useEffect(() => {
        setIsSpotifyConnected(SpotifyService.isSpotifyLoggedIn());
    }, []);

    // Handle Spotify login
    const handleSpotifyLogin = () => {
        SpotifyService.loginWithSpotify();
    };

    // Handle music source selection
    const handleSelectMusicSource = (source) => {
        setMusicSource(source);
        localStorage.setItem('music_source', source);

        if (source === 'local') {
            // Check if drive is connected
            checkMusicDriveConnection().then(connected => {
                if (!connected) {
                    setShowDiskPopup(true);
                }
            });
        } else if (source === 'spotify') {
            if (!SpotifyService.isSpotifyLoggedIn()) {
                handleSpotifyLogin();
            }
        }
    };

    // Retry disk connection
    const handleRetryDisk = async () => {
        const connected = await checkMusicDriveConnection();
        if (connected) {
            setShowDiskPopup(false);
            refreshAll();
        }
    };

    // Handle delete playlist
    const handleDeletePlaylist = async (e, playlistId) => {
        e.stopPropagation();
        if (window.confirm('האם אתה בטוח שברצונך למחוק את הפלייליסט הזה?')) {
            await deletePlaylist(playlistId);
        }
    };

    // Filter albums/artists/playlists by search
    const filteredAlbums = albums.filter(album =>
        album.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        album.artist?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredArtists = artists.filter(artist =>
        artist.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredPlaylists = playlists.filter(playlist =>
        playlist.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Load songs when album/playlist is selected
    useEffect(() => {
        const loadSongs = async () => {
            if (selectedAlbum?.id) {
                if (selectedAlbum.isPlaylist) {
                    const songs = await fetchPlaylistSongs(selectedAlbum.id);
                    setCurrentAlbumSongs(songs);
                } else {
                    const songs = await fetchAlbumSongs(selectedAlbum.id);
                    setCurrentAlbumSongs(songs);
                }
            }
        };
        loadSongs();
    }, [selectedAlbum, fetchAlbumSongs, fetchPlaylistSongs]);

    // Handle album click - just view songs, don't play
    const handleAlbumClick = async (album) => {
        setSelectedAlbum({ ...album, isPlaylist: false });
        // Songs will be loaded by effect
    };

    // Handle playlist click
    const handlePlaylistClick = async (playlist) => {
        setSelectedAlbum({ ...playlist, isPlaylist: true, artist: { name: 'פלייליסט חכם' } });
        // Songs will be loaded by effect
    };

    // Handle album play - play all songs
    const handleAlbumPlay = async (album) => {
        setSelectedAlbum({ ...album, isPlaylist: false });
        const songs = await fetchAlbumSongs(album.id);
        setCurrentAlbumSongs(songs);
        const playable = (songs || []).filter(s => (s?.myRating || 0) !== 1);
        if (playable.length > 0) {
            playSong(playable[0], playable);
        }
    };

    // Handle playlist play
    const handlePlaylistPlay = async (playlist) => {
        setSelectedAlbum({ ...playlist, isPlaylist: true, artist: { name: 'פלייליסט חכם' } });
        const songs = await fetchPlaylistSongs(playlist.id);
        setCurrentAlbumSongs(songs);
        const playable = (songs || []).filter(s => (s?.myRating || 0) !== 1);
        if (playable.length > 0) {
            playSong(playable[0], playable);
        }
    };

    // Handle back from album view
    const handleBack = () => {
        setSelectedAlbum(null);
        setCurrentAlbumSongs([]);
    };

    // Handle exit
    const handleExit = () => {
        navigate('/mode-selection');
    };

    // Handle song play
    const handleSongPlay = (song) => {
        // Never play disliked songs
        if ((song?.myRating || 0) === 1) {
            return;
        }
        playSong(song, currentAlbumSongs);
    };

    // Handle rating
    const handleRate = async (songId, rating) => {
        // Find the song to get current rating
        const songToUpdate = currentAlbumSongs.find(s => s.id === songId) ||
            favoriteSongs.find(s => s.id === songId);

        const currentRating = songToUpdate?.myRating || 0;

        // Toggle logic: if same rating, set to 0 (remove)
        const finalRating = currentRating === rating ? 0 : rating;

        console.log('🎵 handleRate toggle:', { songId, current: currentRating, requested: rating, final: finalRating });

        const ok = await rateSong(songId, finalRating);
        if (!ok) return;

        // Optimistic UI update
        setCurrentAlbumSongs(prev => prev.map(s => s.id === songId ? { ...s, myRating: finalRating } : s));
        setFavoriteSongs(prev => {
            const exists = prev.some(s => s.id === songId);
            if (finalRating === 5) {
                if (exists) return prev.map(s => s.id === songId ? { ...s, myRating: 5 } : s);
                const src = currentAlbumSongs.find(s => s.id === songId);
                return src ? [{ ...src, myRating: 5 }, ...prev] : prev;
            }
            if (finalRating === 1 || finalRating === 0) {
                // remove from favorites if disliked or removed
                return prev.filter(s => s.id !== songId);
            }
            return prev;
        });

        // Refresh from server after a short delay
        setTimeout(async () => {
            try {
                if (selectedAlbum) {
                    if (selectedAlbum.isPlaylist) {
                        const songs = await fetchPlaylistSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(songs);
                    } else {
                        const songs = await fetchAlbumSongs(selectedAlbum.id);
                        setCurrentAlbumSongs(songs);
                    }
                }
                // Refresh favorites if we're on that tab
                if (activeTab === 'favorites') {
                    await loadFavorites();
                }
            } catch (err) {
                console.error('Error refreshing after rating:', err);
            }
        }, 500);
    };

    // Handle adding Spotify album (metadata + tracks)
    const handleAddSpotifyAlbum = async (spotifyAlbum) => {
        try {
            // 1. Save album metadata
            const albumRecord = await addSpotifyAlbum(spotifyAlbum);
            if (!albumRecord) return;

            // 2. Fetch tracks from Spotify
            const tracksData = await SpotifyService.getAlbumTracks(spotifyAlbum.id);
            const tracks = tracksData.items || [];

            // 3. Save tracks to DB
            const businessId = currentUser?.business_id || null;
            const songInserts = tracks.map(t => ({
                title: t.name,
                album_id: albumRecord.id,
                artist_id: albumRecord.artist_id,
                track_number: t.track_number,
                duration_seconds: Math.round(t.duration_ms / 1000),
                file_path: t.uri, // This is the spotify:track:ID
                file_name: `${t.name}.spotify`,
                business_id: businessId
            }));

            if (songInserts.length > 0) {
                const { error } = await supabase.from('music_songs').upsert(songInserts, { onConflict: 'file_path, business_id' });
                if (error) console.error('Error saving Spotify tracks:', error);
            }

            refreshAll();
        } catch (err) {
            console.error('Error in handleAddSpotifyAlbum:', err);
        }
    };

    // Load favorites
    const loadFavorites = useCallback(async () => {
        const songs = await fetchFavoritesSongs();
        setFavoriteSongs(songs || []);
    }, [fetchFavoritesSongs]);

    // Load favorites when opening the favorites tab
    useEffect(() => {
        if (activeTab !== 'favorites') return;
        loadFavorites();
    }, [activeTab, loadFavorites]);

    // Get songs to display (current album or playlist)
    const displaySongs = currentAlbumSongs.length > 0 ? currentAlbumSongs : playlist;

    return (
        <div className="min-h-screen music-gradient-dark flex flex-col" dir="rtl">
            {/* Full Width Header */}
            <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="w-10 h-10 rounded-full music-glass flex items-center justify-center hover:bg-white/10 transition-colors"
                        title="חזרה לבית"
                    >
                        <Home className="w-5 h-5 text-white" />
                    </button>

                    <div className="flex items-center gap-2">
                        <Music className="w-6 h-6 text-purple-400" />
                        <h1 className="text-white text-xl font-bold">מוזיקה</h1>
                    </div>

                    {/* Mini Player & Connection Group */}
                    <div className="hidden lg:flex items-center gap-3 bg-white/5 p-1 px-2 rounded-2xl border border-white/10">
                        <MiniMusicPlayer />
                        <ConnectionStatusBar isIntegrated={true} />
                    </div>
                </div>

                {/* Search */}
                <div className="flex-1 max-w-md mx-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="חפש אלבומים, אמנים..."
                            className="w-full bg-white/10 border border-white/10 rounded-xl py-2 pr-10 pl-4
                                   text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Music Source Indicator - shows when source is selected */}
                    {musicSource && (
                        <div className="relative group">
                            <button
                                className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all text-sm font-medium
                                    ${musicSource === 'spotify'
                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}
                            >
                                {musicSource === 'spotify' ? (
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                    </svg>
                                ) : (
                                    <HardDrive className="w-4 h-4" />
                                )}
                                <span className="hidden sm:inline">
                                    {musicSource === 'spotify' ? 'Spotify' : 'מקומי'}
                                </span>
                            </button>

                            {/* Dropdown on hover */}
                            <div className="absolute left-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <div className="music-glass rounded-xl p-2 border border-white/20 shadow-xl min-w-[160px]">
                                    <button
                                        onClick={() => {
                                            if (musicSource === 'spotify') {
                                                SpotifyService.logout();
                                                setIsSpotifyConnected(false);
                                            }
                                            setMusicSource(null);
                                            localStorage.removeItem('music_source');
                                            localStorage.removeItem('music_drive_path');
                                        }}
                                        className="w-full text-right px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm"
                                    >
                                        🔄 החלף מקור
                                    </button>
                                    {musicSource === 'spotify' && (
                                        <button
                                            onClick={() => {
                                                SpotifyService.logout();
                                                setIsSpotifyConnected(false);
                                                setMusicSource(null);
                                                localStorage.removeItem('music_source');
                                            }}
                                            className="w-full text-right px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm"
                                        >
                                            ❌ נתק Spotify
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Spotify Search Button - only when spotify is source and connected */}
                    {musicSource === 'spotify' && isSpotifyConnected && (
                        <button
                            onClick={() => setShowSpotifySearch(true)}
                            className="w-10 h-10 rounded-full bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center transition-all"
                            title="חפש אלבומים בספוטיפיי"
                        >
                            <Search className="w-5 h-5 text-green-400" />
                        </button>
                    )}

                    <button
                        onClick={() => setShowScanner(true)}
                        className="w-10 h-10 rounded-full music-glass flex items-center justify-center"
                        title="סרוק ספרייה"
                    >
                        <FolderOpen className="w-5 h-5 text-white" />
                    </button>

                    <button
                        onClick={refreshAll}
                        className={`w-10 h-10 rounded-full music-glass flex items-center justify-center
                               ${isLoading ? 'animate-spin' : ''}`}
                        title="רענן"
                    >
                        <RefreshCw className="w-5 h-5 text-white" />
                    </button>
                </div>
            </header>

            <div className="music-split-layout flex-1 flex">
                {/* Right side - Vinyl Turntable */}
                <div className="music-split-right order-last">
                    <div className="flex flex-col items-center justify-center h-full">
                        <VinylTurntable
                            song={currentSong}
                            isPlaying={isPlaying}
                            albumArt={currentSong?.album?.cover_url}
                        />

                        {/* Player controls */}
                        {currentSong && (
                            <div className="flex items-center gap-4 mt-6" dir="ltr">
                                <button
                                    onClick={handlePrevious}
                                    className="w-12 h-12 rounded-full music-glass flex items-center justify-center hover:scale-110 transition-transform"
                                >
                                    <SkipBack className="w-5 h-5 text-white" />
                                </button>

                                <button
                                    onClick={togglePlay}
                                    className="w-16 h-16 rounded-full music-gradient-purple flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-7 h-7 text-white" />
                                    ) : (
                                        <Play className="w-7 h-7 text-white fill-white mr-[-3px]" />
                                    )}
                                </button>

                                <button
                                    onClick={handleNext}
                                    className="w-12 h-12 rounded-full music-glass flex items-center justify-center hover:scale-110 transition-transform"
                                >
                                    <SkipForward className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        )}

                        {/* No song message */}
                        {!currentSong && (
                            <div className="text-center mt-8 bg-black/20 p-6 rounded-3xl backdrop-blur-sm border border-white/5 max-w-[280px]">
                                <Music className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <p className="text-white/60 font-medium">בחר שיר כדי להתחיל לנגן</p>
                                <p className="text-white/30 text-sm mt-1">האלבומים שלך מופיעים מצד ימין</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Left side - Song list / Albums */}
                <div className="music-split-left flex flex-col">
                    {/* Content area */}
                    <div className="flex-1 overflow-y-auto music-scrollbar">
                        {/* Backend/Supabase misconfiguration banner */}
                        {error && String(error).includes('Missing Supabase Credentials') && (
                            <div className="p-4">
                                <div className="music-glass rounded-2xl p-4 border border-red-500/30">
                                    <p className="text-white font-bold mb-1">שרת המוזיקה לא מוגדר</p>
                                    <p className="text-white/60 text-sm">
                                        חסרים משתני סביבה בשרת: <span className="font-mono">SUPABASE_URL</span> ו-<span className="font-mono">SUPABASE_SERVICE_KEY</span>.
                                        בלי זה לא ניתן לשמור/לקרוא את ספריית המוזיקה.
                                    </p>
                                </div>
                            </div>
                        )}
                        {selectedAlbum ? (
                            /* Selected album - show song list */
                            <div className="p-4">
                                {/* Album header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <button
                                        onClick={handleBack}
                                        className="w-10 h-10 rounded-full music-glass flex items-center justify-center"
                                    >
                                        <ArrowRight className="w-5 h-5 text-white" />
                                    </button>
                                    <div>
                                        <h2 className="text-white text-2xl font-bold">{selectedAlbum.name}</h2>
                                        <p className="text-white/60">{selectedAlbum.artist?.name} • {currentAlbumSongs.length} שירים</p>
                                    </div>
                                </div>

                                {/* Song list */}
                                <div className="space-y-1">
                                    {currentAlbumSongs.map((song, index) => (
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
                            </div>
                        ) : (
                            /* Album grid */
                            <div className="p-4">
                                {/* Tabs */}
                                <nav className="flex items-center gap-2 mb-4">
                                    {TABS.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all
                                           ${activeTab === tab.id
                                                    ? 'music-gradient-purple text-white'
                                                    : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            <span className="font-medium">{tab.label}</span>
                                        </button>
                                    ))}
                                </nav>

                                {/* Albums grid */}
                                {activeTab === 'albums' && (
                                    <>
                                        {/* PROMINENT ADD BUTTON FOR SPOTIFY */}
                                        {musicSource === 'spotify' && isSpotifyConnected && (
                                            <div className="mb-6">
                                                <button
                                                    onClick={() => setShowSpotifySearch(true)}
                                                    className="w-full py-8 music-glass border-2 border-dashed border-green-500/30 rounded-3xl flex flex-col items-center justify-center gap-3 text-green-400 hover:bg-green-500/10 transition-all group shadow-xl"
                                                >
                                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <Search className="w-8 h-8" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="text-xl font-bold">חפש והוסף אלבומים מ-Spotify</h3>
                                                        <p className="text-white/50 text-sm">הוסף מוזיקה חדשה לספרייה של בית הקפה</p>
                                                    </div>
                                                </button>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            {/* Special "Add Album" Card - Always first */}
                                            <motion.div
                                                whileHover={{ scale: 1.02 }}
                                                onClick={() => musicSource === 'spotify' ? setShowSpotifySearch(true) : setShowScanner(true)}
                                                className="music-album-card group bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-center p-4 hover:border-purple-500/50 transition-all cursor-pointer min-h-[200px] rounded-2xl"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                    <Upload className="w-6 h-6 text-white/50" />
                                                </div>
                                                <h3 className="text-white font-bold">הוסף אלבום</h3>
                                                <p className="text-white/40 text-xs">סרוק תיקייה או חפש</p>
                                            </motion.div>

                                            {isLoading && albums.length === 0 ? (
                                                <div className="col-span-full flex items-center justify-center py-12">
                                                    <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                                </div>
                                            ) : filteredAlbums.length === 0 && (musicSource || isMusicDriveConnected) ? (
                                                /* If no albums found but source is ready, we just show the Add card alone (above) or a message */
                                                null
                                            ) : !musicSource && !isMusicDriveConnected ? (
                                                /* Source selection - now integrated into grid area or handled separately */
                                                <div className="col-span-full py-8">
                                                    <div className="text-center mb-8">
                                                        <Music className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                                                        <h2 className="text-white text-2xl font-bold mb-2">בחר מקור מוזיקה</h2>
                                                        <p className="text-white/50">איך תרצה להאזין למוזיקה?</p>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                                                        <button
                                                            onClick={() => handleSelectMusicSource('local')}
                                                            className="flex-1 music-glass p-6 rounded-2xl border border-white/10 hover:border-purple-500/50 hover:bg-white/5 transition-all group"
                                                        >
                                                            <HardDrive className="w-12 h-12 text-blue-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                                                            <h3 className="text-white font-bold text-lg mb-2">כונן מקומי</h3>
                                                            <p className="text-white/50 text-sm">נגן מוזיקה מכונן USB או תיקייה מקומית</p>
                                                        </button>

                                                        <button
                                                            onClick={() => handleSelectMusicSource('spotify')}
                                                            className="flex-1 music-glass p-6 rounded-2xl border border-white/10 hover:border-green-500/50 hover:bg-white/5 transition-all group"
                                                        >
                                                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                                                <svg viewBox="0 0 24 24" className="w-7 h-7 text-black fill-current">
                                                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                                                </svg>
                                                            </div>
                                                            <h3 className="text-white font-bold text-lg mb-2">Spotify</h3>
                                                            <p className="text-white/50 text-sm">התחבר לחשבון Spotify שלך</p>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : musicSource === 'local' && !isMusicDriveConnected ? (
                                                <div className="col-span-full text-center py-12">
                                                    <HardDrive className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                                                    <p className="text-white/60 text-lg mb-2">כונן המוזיקה לא מחובר</p>
                                                    <p className="text-white/40 text-sm mb-4">חבר את הכונן ונסה שוב</p>
                                                    <button onClick={handleRetryDisk} className="px-6 py-3 music-gradient-purple rounded-xl text-white font-medium">בדוק שוב</button>
                                                </div>
                                            ) : (
                                                filteredAlbums.map(album => (
                                                    <AlbumCard
                                                        key={album.id}
                                                        album={album}
                                                        onClick={handleAlbumClick}
                                                        onPlay={handleAlbumPlay}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Favorites */}
                                {activeTab === 'favorites' && (
                                    <div className="space-y-1">
                                        {favoriteSongs.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
                                                <p className="text-white/40 text-lg mb-1">אין מועדפים עדיין</p>
                                                <p className="text-white/30 text-sm">לחץ על 👍 ליד שיר כדי להוסיף למועדפים</p>
                                            </div>
                                        ) : (
                                            favoriteSongs.map((song, index) => (
                                                <SongRow
                                                    key={song.id}
                                                    song={song}
                                                    index={index}
                                                    isPlaying={isPlaying}
                                                    isCurrentSong={currentSong?.id === song.id}
                                                    onPlay={(s) => playSong(s, favoriteSongs.filter(x => (x?.myRating || 0) !== 1))}
                                                    onRate={handleRate}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Artists grid */}
                                {activeTab === 'artists' && (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        {!isMusicDriveConnected ? (
                                            <div className="col-span-full text-center py-12">
                                                <div className="w-16 h-16 rounded-full bg-red-500/20 mb-4 flex items-center justify-center mx-auto">
                                                    <User className="w-8 h-8 text-red-400" />
                                                </div>
                                                <p className="text-white/60 text-lg mb-2">כונן המוזיקה לא מחובר</p>
                                                <p className="text-white/40 text-sm mb-4">חבר את דיסק Ran1 למחשב כדי לגשת למוזיקה</p>
                                                <button
                                                    onClick={checkMusicDriveConnection}
                                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors"
                                                >
                                                    <RefreshCw className="w-5 h-5 inline-block ml-2" />
                                                    בדוק שוב
                                                </button>
                                            </div>
                                        ) : filteredArtists.map(artist => (
                                            <motion.div
                                                key={artist.id}
                                                whileHover={{ scale: 1.05 }}
                                                className="music-glass rounded-2xl p-4 text-center cursor-pointer"
                                            >
                                                <div className="w-20 h-20 mx-auto rounded-full music-gradient-pink mb-3 flex items-center justify-center">
                                                    <User className="w-8 h-8 text-white/50" />
                                                </div>
                                                <h3 className="text-white font-medium truncate">{artist.name}</h3>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}

                                {/* Playlists */}
                                {activeTab === 'playlists' && (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        {!isMusicDriveConnected && filteredPlaylists.length === 0 ? (
                                            <div className="col-span-full text-center py-12">
                                                <div className="w-16 h-16 rounded-full bg-red-500/20 mb-4 flex items-center justify-center mx-auto">
                                                    <ListMusic className="w-8 h-8 text-red-400" />
                                                </div>
                                                <p className="text-white/60 text-lg mb-2">כונן המוזיקה לא מחובר</p>
                                                <p className="text-white/40 text-sm mb-4">חבר את דיסק Ran1 למחשב כדי לגשת למוזיקה ולפלייליסטים</p>
                                                <button
                                                    onClick={checkMusicDriveConnection}
                                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors"
                                                >
                                                    <RefreshCw className="w-5 h-5 inline-block ml-2" />
                                                    בדוק שוב
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Create New Playlist Card */}
                                                <motion.div
                                                    whileHover={{ scale: 1.02 }}
                                                    onClick={() => setShowPlaylistBuilder(true)}
                                                    className="music-playlist-card p-6 cursor-pointer border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-center min-h-[200px]"
                                                >
                                                    <div className="w-16 h-16 rounded-full bg-white/10 mb-4 flex items-center justify-center">
                                                        <Sparkles className="w-8 h-8 text-purple-400" />
                                                    </div>
                                                    <h3 className="text-white font-bold text-xl mb-1">פלייליסט חכם</h3>
                                                    <p className="text-white/50 text-sm">צור פלייליסט חדש</p>
                                                </motion.div>

                                                {/* Existing Playlists */}
                                                {filteredPlaylists.map(playlist => (
                                                    <motion.div
                                                        key={playlist.id}
                                                        whileHover={{ scale: 1.02 }}
                                                        className="music-glass rounded-2xl overflow-hidden group relative"
                                                    >
                                                        {/* Playlist Art / Icon */}
                                                        <div
                                                            className="aspect-square bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center relative cursor-pointer"
                                                            onClick={() => handlePlaylistClick(playlist)}
                                                        >
                                                            <ListMusic className="w-16 h-16 text-white/30" />

                                                            {/* Play Overlay */}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePlaylistPlay(playlist);
                                                                    }}
                                                                    className="w-14 h-14 rounded-full music-gradient-purple flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                                                >
                                                                    <Play className="w-6 h-6 text-white fill-white mr-[-3px]" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Info */}
                                                        <div className="p-4" onClick={() => handlePlaylistClick(playlist)}>
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h3 className="text-white font-bold truncate flex-1">{playlist.name}</h3>
                                                                <button
                                                                    onClick={(e) => handleDeletePlaylist(e, playlist.id)}
                                                                    className="text-white/30 hover:text-red-400 p-1 rounded-full hover:bg-white/10 transition-colors mr-1"
                                                                    title="מחק פלייליסט"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs text-white/50">
                                                                <span>פלייליסט חכם</span>
                                                                {playlist.created_at && (
                                                                    <span>{new Date(playlist.created_at).toLocaleDateString('he-IL')}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Playlist builder modal */}
            {showPlaylistBuilder && (
                <PlaylistBuilder
                    onClose={() => setShowPlaylistBuilder(false)}
                    onSuccess={() => {
                        setShowPlaylistBuilder(false);
                        fetchPlaylists();
                    }}
                />
            )}

            {/* Directory scanner modal */}
            {showScanner && (
                <DirectoryScanner
                    onClose={() => setShowScanner(false)}
                    onScan={scanMusicDirectory}
                />
            )}

            {/* Spotify Album Search Modal */}
            {showSpotifySearch && (
                <SpotifyAlbumSearch
                    onClose={() => setShowSpotifySearch(false)}
                    userAlbumIds={albums.filter(a => a.folder_path?.startsWith('spotify:album:')).map(a => a.folder_path.replace('spotify:album:', ''))}
                    onAddAlbum={handleAddSpotifyAlbum}
                    onRemoveAlbum={(albumId) => {
                        removeSpotifyAlbum(albumId);
                    }}
                />
            )}

            {/* Disk Not Connected Popup */}
            <AnimatePresence>
                {showDiskPopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowDiskPopup(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="music-glass rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-amber-500/20 mb-6 flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-10 h-10 text-amber-400" />
                                </div>
                                <h3 className="text-white text-2xl font-bold mb-3">כונן לא מחובר</h3>
                                <p className="text-white/60 mb-8">
                                    לא הצלחנו לזהות את כונן המוזיקה.
                                    <br />
                                    וודא שהכונן מחובר כראוי ונסה שוב.
                                </p>

                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={handleRetryDisk}
                                        className="px-8 py-3 music-gradient-purple hover:opacity-90 rounded-xl text-white font-bold transition-all flex items-center gap-2"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        נסה שוב
                                    </button>
                                    <button
                                        onClick={() => setShowDiskPopup(false)}
                                        className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Export without wrapper (wrapper moved to Routes.jsx)
const MusicPage = () => {
    return <MusicPageContent />;
};

export default MusicPage;
"I'm getting Cloudflare Error 1013 on initial load. It's caused by high cookie volume from Spotify and Supabase overlapping on the same domain. Please refactor the authentication logic to store the Access Tokens in localStorage instead of Cookies. This will keep the request headers small and prevent Cloudflare from blocking the connection."