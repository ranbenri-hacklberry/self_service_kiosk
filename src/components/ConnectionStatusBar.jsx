import React from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { Wifi, WifiOff, Cloud, CloudOff, Server, ServerOff, RefreshCw } from 'lucide-react';

/**
 * Subtle connection status indicator - positioned in top-left corner
 * Shows connection mode (online/offline/local-only/cloud-only) and last sync time
 */
const ConnectionStatusBar = () => {
    const { status, localAvailable, cloudAvailable, lastSync, lastLocalAvailable, lastCloudAvailable, refresh } = useConnection();

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

    // Base styles for the floating pill
    const baseStyles = "fixed top-3 left-3 z-[100] text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all duration-300";

    // Fully online - minimal green indicator
    if (status === 'online') {
        return (
            <div className={`${baseStyles} bg-green-500/15 text-green-700 border border-green-200/50`}>
                <Wifi size={11} strokeWidth={2.5} />
                <span className="font-medium">מחובר</span>
            </div>
        );
    }

    // Local only (Offline mode)
    if (status === 'local-only') {
        return (
            <div className={`${baseStyles} bg-amber-500/15 text-amber-800 border border-amber-200/50`}>
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
            <div className={`${baseStyles} bg-blue-500/15 text-blue-800 border border-blue-200/50`}>
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
            <div className={`${baseStyles} bg-red-500/15 text-red-800 border border-red-200/50`}>
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
};

export default ConnectionStatusBar;
