import React from 'react';
import { Play, Pause, ThumbsUp, ThumbsDown } from 'lucide-react';

/**
 * Song row component for album view
 */
const SongRow = ({
    song,
    index,
    isPlaying = false,
    isCurrentSong = false,
    onPlay,
    onRate,
    showRating = true
}) => {
    const handlePlay = () => {
        onPlay?.(song);
    };

    const handleRate = (rating) => {
        // Toggle rating: if clicking same rating, remove it (set to 0)
        // Like (5) or Dislike (1)
        const currentRating = song.myRating || 0;

        if (rating === 5) {
            // Clicked Like
            onRate?.(song.id, currentRating === 5 ? 0 : 5);
        } else if (rating === 1) {
            // Clicked Dislike
            onRate?.(song.id, currentRating === 1 ? 0 : 1);
        }
    };

    // Format duration (seconds to MM:SS)
    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isLiked = (song.myRating || 0) >= 4;
    const isDisliked = (song.myRating || 0) > 0 && (song.myRating || 0) <= 2;

    return (
        <div
            className={`music-song-row ${isCurrentSong ? 'playing' : ''} group`}
            onClick={handlePlay}
        >
            {/* Track number / Playing indicator */}
            <div className="w-10 flex-shrink-0 flex justify-center">
                {isCurrentSong && isPlaying ? (
                    <div className="music-playing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                ) : isCurrentSong ? (
                    <Pause className="w-4 h-4 text-purple-400" />
                ) : (
                    <span className="text-white/40 text-sm font-medium track-number">
                        {index + 1}
                    </span>
                )}
            </div>

            {/* Song info */}
            <div className="flex-1 min-w-0 mr-3">
                <h4 className={`font-medium truncate ${isCurrentSong ? 'text-purple-400' : 'text-white'}`}>
                    {song.title}
                </h4>
                {song.artist && (
                    <p className="text-white/50 text-sm truncate">
                        {song.artist.name}
                    </p>
                )}
            </div>

            {/* Like / Dislike - More prominent as requested */}
            {showRating && (
                <div className="flex-shrink-0 ml-4 hidden sm:flex items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRate(1); }}
                        className={`p-3 rounded-full transition-all transform hover:scale-110 ${isDisliked
                            ? 'text-red-400 bg-red-400/20 ring-1 ring-red-400/50'
                            : 'text-white/40 hover:text-red-400 hover:bg-white/10'}`}
                        title="לא אהבתי (הסר מהפלייליסט)"
                    >
                        <ThumbsDown className="w-5 h-5" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleRate(5); }}
                        className={`p-3 rounded-full transition-all transform hover:scale-110 ${isLiked
                            ? 'text-green-400 bg-green-400/20 ring-1 ring-green-400/50'
                            : 'text-white/40 hover:text-green-400 hover:bg-white/10'}`}
                        title="אהבתי"
                    >
                        <ThumbsUp className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Duration */}
            <div className="w-12 flex-shrink-0 text-left text-white/40 text-sm">
                {formatDuration(song.duration_seconds)}
            </div>

            {/* Play button on hover */}
            <button
                onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-purple-500 
                   flex items-center justify-center opacity-0 group-hover:opacity-100
                   transition-all ml-2 flex-shrink-0"
            >
                <Play className="w-4 h-4 text-white fill-white" />
            </button>
        </div>
    );
};

export default SongRow;
