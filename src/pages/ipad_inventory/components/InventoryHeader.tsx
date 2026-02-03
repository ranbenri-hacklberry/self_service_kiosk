import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, House, ClipboardList, Truck } from 'lucide-react';

const MotionDiv = motion.div as any;
const MotionButton = motion.button as any; // Added MotionButton alias
import MiniMusicPlayer from '@/components/music/MiniMusicPlayer';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';

interface InventoryHeaderProps {
    activeTab: 'counts' | 'shipping';
    setActiveTab: (tab: 'counts' | 'shipping') => void;
    onExit: () => void;
}

const InventoryHeader: React.FC<InventoryHeaderProps> = ({ activeTab, setActiveTab, onExit }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
            {/* Right: Exit / Home Button */}
            <div className="flex items-center gap-4 w-1/4">
                <button
                    onClick={onExit}
                    className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                >
                    <House size={24} />
                </button>
                <div className="flex flex-col">
                    <span className="text-slate-900 font-bold text-lg leading-tight">ניהול מלאי</span>
                    <span className="text-slate-500 text-xs font-medium">מעקב, ספירה וקבלת סחורה</span>
                </div>
            </div>

            {/* Center: Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full max-w-md shadow-inner">
                <button
                    onClick={() => setActiveTab('counts')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'counts'
                        ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <ClipboardList size={18} />
                    <span>ספירה ודיווח</span>
                </button>
                <button
                    onClick={() => setActiveTab('shipping')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'shipping'
                        ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Truck size={18} />
                    <span>משלוחים בדרך</span>
                </button>
            </div>

            {/* Left: Clock, Status, Music */}
            <div className="flex items-center gap-6 w-1/4 justify-end">
                <div className="hidden xl:block">
                    <MiniMusicPlayer />
                </div>

                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Clock size={16} className="text-indigo-500" />
                        <span className="font-bold text-lg tabular-nums">
                            {time.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <ConnectionStatusBar />
                </div>
            </div>
        </div>
    );
};

export default InventoryHeader;
