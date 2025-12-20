import React from 'react';
import { Play, Pause, SkipBack, ThumbsUp, ThumbsDown, Music } from 'lucide-react';
import { useMusic } from '@/context/MusicContext';

/**
 * Mini music player for headers (KDS, Music, etc.)
 */
const MiniMusicPlayer = () => {
    const {
        currentSong,
        isPlaying,
        togglePlay,
        handleNext,
        rateSong
    } = useMusic();

    if (!currentSong) return null;

    const myRating = currentSong.myRating || 0;
    const isLiked = myRating === 5;
    const isDisliked = myRating === 1;

    const handleRate = async (rating) => {
        const finalRating = myRating === rating ? 0 : rating;
        await rateSong(currentSong.id, finalRating);
    };

    return (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-50 rounded-2xl border border-slate-200 ml-4 max-w-[400px]">
            {/* Song Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-purple-200/50">
                    {currentSong.album?.cover_url ? (
                        <img 
                            src={currentSong.album.cover_url} 
                            alt={currentSong.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Music size={16} className="text-purple-600" />
                    )}
                </div>
                <div className="min-w-0" dir="rtl">
                    <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                        {currentSong.title}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 truncate leading-tight">
                        {currentSong.artist?.name || 'אמן לא ידוע'}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 border-r border-slate-200 pr-3 mr-1">
                {/* Dislike */}
                <button
                    onClick={() => handleRate(1)}
                    className={`p-2 rounded-lg transition-all ${
                        isDisliked 
                        ? 'bg-red-100 text-red-600 shadow-sm' 
                        : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                    }`}
                    title="לא אהבתי"
                >
                    <ThumbsDown size={16} fill={isDisliked ? 'currentColor' : 'none'} />
                </button>

                {/* Like */}
                <button
                    onClick={() => handleRate(5)}
                    className={`p-2 rounded-lg transition-all ${
                        isLiked 
                        ? 'bg-green-100 text-green-600 shadow-sm' 
                        : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                    }`}
                    title="אהבתי"
                >
                    <ThumbsUp size={16} fill={isLiked ? 'currentColor' : 'none'} />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    className="p-2 w-9 h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center justify-center shadow-sm mx-1"
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>

                {/* Next (Pointing Left for RTL) */}
                <button
                    onClick={handleNext}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all"
                    title="הבא"
                >
                    <SkipBack size={16} />
                </button>
            </div>
        </div>
    );
};

export default MiniMusicPlayer;
