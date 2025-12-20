import React from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { useAuth } from '@/context/AuthContext';
import { Wifi, WifiOff, Cloud, CloudOff, Server, ServerOff, RefreshCw } from 'lucide-react';

/**
 * Connection status indicator - can be floating or integrated into headers
 */
const ConnectionStatusBar = ({ isIntegrated = false }) => {
    const { status, lastSync, lastLocalAvailable, lastCloudAvailable, refresh } = useConnection();
    const { currentUser } = useAuth();

    // Format relative time
    const formatTime = (date) => {
        if (!date) return 'לא ידוע';
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'עכשיו';
        if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
        if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
        return date.toLocaleDateString('he-IL');
    };

    // Don't show anything while checking
    if (status === 'checking') {
        return null;
    }

    // Base styles for the pill
    const baseStyles = isIntegrated 
        ? "text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 border transition-all duration-300 h-7"
        : "fixed top-3 left-3 z-[100] text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md border transition-all duration-300";

    const content = (() => {
        // Fully online - minimal green indicator
        if (status === 'online') {
            return (
                <div className={`${baseStyles} bg-green-500/15 text-green-700 border-green-200/50`}>
                    <Wifi size={11} strokeWidth={2.5} />
                    <span className="font-medium">מחובר</span>
                </div>
            );
        }

        // Local only (Offline mode)
        if (status === 'local-only') {
            return (
                <div className={`${baseStyles} bg-amber-500/15 text-amber-800 border-amber-200/50`}>
                    <WifiOff size={11} strokeWidth={2.5} />
                    <span className="font-medium">אופליין</span>
                    <span className="text-amber-600 text-[9px]">• {formatTime(lastSync)}</span>
                    <button
                        onClick={refresh}
                        className="p-0.5 hover:bg-amber-200/50 rounded-full transition-colors"
                        title="בדוק חיבור"
                    >
                        <RefreshCw size={9} />
                    </button>
                </div>
            );
        }

        // Cloud only (Local server down)
        if (status === 'cloud-only') {
            return (
                <div className={`${baseStyles} bg-blue-500/15 text-blue-800 border-blue-200/50`}>
                    <ServerOff size={11} strokeWidth={2.5} />
                    <span className="font-medium">ענן בלבד</span>
                    <span className="text-blue-600 text-[9px]">• {formatTime(lastLocalAvailable)}</span>
                    <button
                        onClick={refresh}
                        className="p-0.5 hover:bg-blue-200/50 rounded-full transition-colors"
                        title="בדוק חיבור"
                    >
                        <RefreshCw size={9} />
                    </button>
                </div>
            );
        }

        // Completely offline
        if (status === 'offline') {
            return (
                <div className={`${baseStyles} bg-red-500/15 text-red-800 border-red-200/50`}>
                    <WifiOff size={11} strokeWidth={2.5} />
                    <span className="font-medium">אין חיבור</span>
                    <span className="text-red-600 text-[9px]">• {formatTime(lastSync)}</span>
                    <button
                        onClick={refresh}
                        className="p-0.5 hover:bg-red-200/50 rounded-full transition-colors"
                        title="נסה שוב"
                    >
                        <RefreshCw size={9} />
                    </button>
                </div>
            );
        }
        return null;
    })();

    if (!content) return null;

    if (isIntegrated) {
        return (
            <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-slate-400 mb-0.5 uppercase tracking-wider">
                    {currentUser?.business_name || 'מערכת iCaffe'}
                </span>
                {content}
            </div>
        );
    }

    return content;
};

export default ConnectionStatusBar;
