import React from 'react';
import { House } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MiniMusicPlayer from './music/MiniMusicPlayer';
import ConnectivityStatus from './ConnectivityStatus';
import ConnectionStatusBar from './ConnectionStatusBar';

const UnifiedHeader = ({
    title,
    subtitle,
    onHome,
    children, // For Tabs or specific controls
    className = ''
}) => {
    const navigate = useNavigate();

    const handleHome = () => {
        if (onHome) onHome();
        else navigate('/mode-selection');
    };

    return (
        <header className={`bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-3 flex items-center justify-between z-20 shrink-0 sticky top-0 relative ${className}`}>

            {/* RIGHT SIDE: Navigation & Title */}
            <div className="flex items-center gap-6 z-10">
                {/* Home Button */}
                <button
                    onClick={handleHome}
                    className="w-10 h-10 flex items-center justify-center bg-white text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95 shadow-sm"
                    title="חזרה למסך ראשי"
                >
                    <House size={20} strokeWidth={2} />
                </button>

                {/* Title Block */}
                <div className="flex flex-col">
                    <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                        {title}
                    </h1>
                    {subtitle && (
                        <span className="text-[11px] font-bold text-slate-400 mt-0.5">
                            {subtitle}
                        </span>
                    )}
                </div>

                {/* Divider & Children (Tabs) */}
                {children && (
                    <>
                        <div className="w-px h-8 bg-slate-200 mx-2" />
                        {/* Translate Right significantly to clear the central clock */}
                        <div className="translate-x-12">
                            {children}
                        </div>
                    </>
                )}
            </div>

            {/* CENTER: CLOCK & STATUS (Absolute) */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden xl:flex items-center gap-6">
                {/* Clock */}
                <span className="text-3xl font-black text-slate-800 tracking-tight tabular-nums leading-none">
                    {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>

                {/* Status - Attached to the left of the clock */}
                <div className="mt-1">
                    <ConnectivityStatus mode="inline" />
                </div>
            </div>

            {/* LIGHT LEFT SIDE: Music Only */}
            <div className="flex items-center gap-4 z-10">
                <div className="hidden lg:flex items-center gap-4">
                    <div className="w-px h-8 bg-slate-100" />
                    {/* Music Player */}
                    <MiniMusicPlayer />
                </div>
            </div>
        </header>
    );
};

export default UnifiedHeader;
