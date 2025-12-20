import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Music, Disc, ListMusic, Search, Upload, RefreshCw,
    ArrowRight, Sparkles, User, Play, FolderOpen, Heart,
    Pause, SkipForward, SkipBack, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicProvider, useMusic } from '@/context/MusicContext';
import { useAlbums } from '@/hooks/useAlbums';
import { useAuth } from '@/context/AuthContext';
import AlbumCard from '@/components/music/AlbumCard';
import VinylTurntable from '@/components/music/VinylTurntable';
import SongRow from '@/components/music/SongRow';
import AlbumView from './components/AlbumView';
import PlaylistBuilder from './components/PlaylistBuilder';
import DirectoryScanner from './components/DirectoryScanner';
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
    const {
        albums,
        artists,
        playlists,
        isLoading,
        error,
        isMusicDriveConnected,
        checkMusicDriveConnection,
        refreshAll,
        scanMusicDirectory,
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
        playlist
    } = useMusic();

    const [activeTab, setActiveTab] = useState('albums');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [showPlaylistBuilder, setShowPlaylistBuilder] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [currentAlbumSongs, setCurrentAlbumSongs] = useState([]);
    const [favoriteSongs, setFavoriteSongs] = useState([]);

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
        const ok = await rateSong(songId, rating);
        if (!ok) return;

        // Optimistic UI update
        setCurrentAlbumSongs(prev => prev.map(s => s.id === songId ? { ...s, myRating: rating } : s));
        setFavoriteSongs(prev => {
            const exists = prev.some(s => s.id === songId);
            if (rating === 5) {
                if (exists) return prev.map(s => s.id === songId ? { ...s, myRating: 5 } : s);
                const src = currentAlbumSongs.find(s => s.id === songId);
                return src ? [{ ...src, myRating: 5 }, ...prev] : prev;
            }
            if (rating === 1) {
                // remove from favorites if disliked
                return prev.filter(s => s.id !== songId);
            }
            return prev;
        });
    };

    // Load favorites when opening the favorites tab
    useEffect(() => {
        if (activeTab !== 'favorites') return;
        (async () => {
            const songs = await fetchFavoritesSongs();
            setFavoriteSongs(songs || []);
        })();
    }, [activeTab, fetchFavoritesSongs]);

    // Get songs to display (current album or playlist)
    const displaySongs = currentAlbumSongs.length > 0 ? currentAlbumSongs : playlist;

    return (
        <div className="min-h-screen music-gradient-dark" dir="rtl">
            <div className="music-split-layout">
                {/* Right side - Vinyl Turntable */}
                <div className="music-split-right">
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
                            <div className="text-center mt-8">
                                <p className="text-white/50 text-lg">בחר אלבום להתחיל לנגן</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Left side - Song list / Albums */}
                <div className="music-split-left flex flex-col">
                    {/* Header */}
                    <header className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleExit}
                                className="w-10 h-10 rounded-full music-glass flex items-center justify-center"
                            >
                                <ArrowRight className="w-5 h-5 text-white" />
                            </button>

                            <div className="flex items-center gap-2">
                                <Music className="w-6 h-6 text-purple-400" />
                                <h1 className="text-white text-xl font-bold">מוזיקה</h1>
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
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        {isLoading && albums.length === 0 ? (
                                            <div className="col-span-full flex items-center justify-center py-12">
                                                <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                            </div>
                                        ) : !isMusicDriveConnected ? (
                                            <div className="col-span-full text-center py-12">
                                                <div className="w-16 h-16 rounded-full bg-red-500/20 mb-4 flex items-center justify-center mx-auto">
                                                    <Disc className="w-8 h-8 text-red-400" />
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
                                        ) : filteredAlbums.length === 0 ? (
                                            <div className="col-span-full text-center py-12">
                                                <Disc className="w-16 h-16 text-white/20 mx-auto mb-4" />
                                                <p className="text-white/40 text-lg mb-4">אין אלבומים</p>
                                                <button
                                                    onClick={() => setShowScanner(true)}
                                                    className="px-6 py-3 music-gradient-purple rounded-xl text-white font-medium"
                                                >
                                                    <Upload className="w-5 h-5 inline-block ml-2" />
                                                    סרוק ספרייה
                                                </button>
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
        </div>
    );
};

// Wrap with MusicProvider
const MusicPage = () => {
    return (
        <MusicProvider>
            <MusicPageContent />
        </MusicProvider>
    );
};

export default MusicPage;
