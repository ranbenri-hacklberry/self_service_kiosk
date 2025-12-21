import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Music, Plus, Check, Loader2, Minus } from 'lucide-react';
import { search as spotifySearch } from '@/lib/spotifyService';

// Popular genres for Spotify
const GENRES = [
    { id: 'all', label: 'הכל', query: '' },
    { id: 'rock', label: 'רוק', query: 'genre:rock' },
    { id: 'pop', label: 'פופ', query: 'genre:pop' },
    { id: 'hip-hop', label: 'היפ-הופ', query: 'genre:hip-hop' },
    { id: 'electronic', label: 'אלקטרוני', query: 'genre:electronic' },
    { id: 'jazz', label: 'ג\'אז', query: 'genre:jazz' },
    { id: 'classical', label: 'קלאסי', query: 'genre:classical' },
    { id: 'r-n-b', label: 'R&B', query: 'genre:r-n-b' },
    { id: 'indie', label: 'אינדי', query: 'genre:indie' },
    { id: 'metal', label: 'מטאל', query: 'genre:metal' },
];

// Debounce hook for live search
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Spotify Album Search Modal
 * Allows searching and adding/removing Spotify albums to user's library
 */
export default function SpotifyAlbumSearch({ onClose, onAddAlbum, onRemoveAlbum, userAlbumIds = [] }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('all');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);

    // Debounced search query for live search
    const debouncedQuery = useDebounce(searchQuery, 400);

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('spotify_recent_searches');
        if (saved) {
            setRecentSearches(JSON.parse(saved));
        }
    }, []);

    // Live search - trigger when debounced query or genre changes
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim() && selectedGenre === 'all') {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const genreQuery = GENRES.find(g => g.id === selectedGenre)?.query || '';
                const fullQuery = [debouncedQuery.trim(), genreQuery].filter(Boolean).join(' ');

                const response = await spotifySearch(fullQuery || 'year:2024', ['album'], 50);
                setResults(response.albums?.items || []);

                // Save to recent searches
                if (debouncedQuery.trim() && debouncedQuery.length > 2) {
                    const updated = [debouncedQuery, ...recentSearches.filter(s => s !== debouncedQuery)].slice(0, 5);
                    setRecentSearches(updated);
                    localStorage.setItem('spotify_recent_searches', JSON.stringify(updated));
                }
            } catch (error) {
                console.error('Spotify search error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, selectedGenre]);

    // Handle genre change
    const handleGenreChange = (genreId) => {
        setSelectedGenre(genreId);
    };

    // Toggle album selection
    const handleAlbumClick = (album) => {
        const isAdded = userAlbumIds.includes(album.id);
        if (isAdded) {
            onRemoveAlbum?.(album.id);
        } else {
            onAddAlbum?.(album);
        }
    };

    // Check if album is already added
    const isAlbumAdded = (albumId) => userAlbumIds.includes(albumId);

    // Count of added albums
    const addedCount = userAlbumIds.length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-5xl max-h-[90vh] bg-gradient-to-b from-gray-900 to-black rounded-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                            הוסף אלבום מ-Spotify
                        </h2>

                        <div className="flex items-center gap-4">
                            {/* Albums count badge */}
                            {addedCount > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-full">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span className="text-green-400 font-medium">{addedCount} אלבומים בספרייה</span>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar - Live search, no button */}
                    <div className="relative mb-4">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="התחל להקליד לחיפוש..."
                            className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pr-12 pl-12
                                     text-white placeholder-white/40 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        {isLoading && (
                            <Loader2 className="absolute left-12 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 animate-spin" />
                        )}
                    </div>

                    {/* Genre Filter */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
                        {GENRES.map(genre => (
                            <button
                                key={genre.id}
                                onClick={() => handleGenreChange(genre.id)}
                                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all
                                    ${selectedGenre === genre.id
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                    }`}
                            >
                                {genre.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading && results.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-12">
                            <Music className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <p className="text-white/50 text-lg">
                                {searchQuery ? 'לא נמצאו תוצאות' : 'התחל להקליד כדי לחפש אלבומים'}
                            </p>
                            {recentSearches.length > 0 && !searchQuery && (
                                <div className="mt-6">
                                    <p className="text-white/30 text-sm mb-3">חיפושים אחרונים:</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {recentSearches.map((term, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSearchQuery(term)}
                                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white/70 text-sm transition-colors"
                                            >
                                                {term}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                            {results.map(album => {
                                const added = isAlbumAdded(album.id);
                                return (
                                    <motion.div
                                        key={album.id}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`relative group cursor-pointer rounded-xl overflow-hidden
                                            ${added ? 'ring-2 ring-green-500' : ''}`}
                                        onClick={() => handleAlbumClick(album)}
                                    >
                                        {/* Album Art */}
                                        <div className="aspect-square bg-gray-800">
                                            {album.images?.[0]?.url ? (
                                                <img
                                                    src={album.images[0].url}
                                                    alt={album.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Music className="w-12 h-12 text-white/20" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Overlay - different for added vs not added */}
                                        <div className={`absolute inset-0 flex items-center justify-center transition-opacity
                                            ${added
                                                ? 'bg-green-600/80'
                                                : 'bg-black/60 opacity-0 group-hover:opacity-100'}`}
                                        >
                                            {added ? (
                                                <div className="flex flex-col items-center">
                                                    <Check className="w-8 h-8 text-white mb-1" />
                                                    <span className="text-white/80 text-xs">לחץ להסרה</span>
                                                </div>
                                            ) : (
                                                <Plus className="w-10 h-10 text-white" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                                            <h3 className="text-white font-bold text-xs truncate">{album.name}</h3>
                                            <p className="text-white/60 text-xs truncate">
                                                {album.artists?.map(a => a.name).join(', ')}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
