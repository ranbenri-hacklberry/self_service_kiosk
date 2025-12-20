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
    onRate
}) => {
    const handlePlay = () => {
        onPlay?.(song);
    };

    const handleRate = (rating) => {
        // Like (5) or Dislike (1)
        onRate?.(song.id, rating);
    };

    const myRating = song?.myRating || 0;
    const isLiked = myRating === 5;
    const isDisliked = myRating === 1;

    // Format duration (seconds to MM:SS)
    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };


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


            {/* Like / Dislike */}
            <div className="flex-shrink-0 ml-3 flex items-center gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); handleRate(1); }}
                    className={`p-2 sm:p-3 rounded-full transition-all transform hover:scale-110
                        ${isDisliked ? 'text-red-400 bg-red-500/20 ring-1 ring-red-400/40' : 'text-white/40 hover:text-red-400 hover:bg-white/10'}`}
                    title="לא אהבתי"
                >
                    <ThumbsDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); handleRate(5); }}
                    className={`p-2 sm:p-3 rounded-full transition-all transform hover:scale-110
                        ${isLiked ? 'text-green-400 bg-green-500/20 ring-1 ring-green-400/40' : 'text-white/40 hover:text-green-400 hover:bg-white/10'}`}
                    title="אהבתי"
                >
                    <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

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
