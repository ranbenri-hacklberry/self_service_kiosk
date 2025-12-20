import React from 'react';
import { Music, Play, Pause } from 'lucide-react';

const MUSIC_API_URL = import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8080';

// Helper to convert local path to backend URL
const getCoverUrl = (localPath) => {
    if (!localPath) return null;
    if (localPath.startsWith('http')) return localPath;
    return `${MUSIC_API_URL}/music/cover?path=${encodeURIComponent(localPath)}`;
};

/**
 * Simplified Vinyl Turntable Component
 * Shows a spinning vinyl record with album art in center
 */
const VinylTurntable = ({ song, isPlaying, albumArt, onTogglePlay }) => {
    const coverUrl = getCoverUrl(albumArt);

    return (
        <div className="vinyl-container" dir="ltr">
            {/* Turntable base - wood texture */}
            <div className="vinyl-base">
                {/* Platter */}
                <div className="vinyl-platter-ring">
                    {/* Vinyl record */}
                    <div className={`vinyl-disc ${isPlaying ? 'vinyl-spinning' : ''}`}>
                        {/* Grooves */}
                        <div className="vinyl-groove" style={{ width: '90%', height: '90%' }}></div>
                        <div className="vinyl-groove" style={{ width: '75%', height: '75%' }}></div>
                        <div className="vinyl-groove" style={{ width: '60%', height: '60%' }}></div>
                        <div className="vinyl-groove" style={{ width: '50%', height: '50%' }}></div>

                        {/* Center label */}
                        <div className="vinyl-center-label">
                            {coverUrl ? (
                                <img src={coverUrl} alt="Album" className="vinyl-album-art" />
                            ) : (
                                <div className="vinyl-no-art">
                                    <Music className="w-6 h-6 text-white/50" />
                                </div>
                            )}
                            <div className="vinyl-spindle-hole"></div>
                        </div>

                        {/* Shine effect */}
                        <div className="vinyl-reflection"></div>
                    </div>
                </div>

                {/* Tonearm */}
                <div className={`vinyl-arm ${isPlaying ? 'vinyl-arm-playing' : ''}`}>
                    <div className="vinyl-arm-pivot"></div>
                    <div className="vinyl-arm-stick">
                        <div className="vinyl-arm-head"></div>
                    </div>
                </div>

                {/* Armrest - where tonearm rests when not playing */}
                <div className="vinyl-armrest"></div>

                {/* LED indicator */}
                <div className={`vinyl-led ${isPlaying ? 'vinyl-led-on' : ''}`}></div>
            </div>

            {/* Song info */}
            {song && (
                <div className="vinyl-info">
                    <p className="vinyl-title">{song.title}</p>
                    <p className="vinyl-artist">{song.artist?.name || song.album?.name || ''}</p>
                </div>
            )}
        </div>
    );
};

export default VinylTurntable;
