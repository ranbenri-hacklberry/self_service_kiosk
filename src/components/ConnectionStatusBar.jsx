import React from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { useAuth } from '@/context/AuthContext';
import { Wifi, WifiOff, RefreshCw, CloudDownload } from 'lucide-react';

/**
 * Connection status indicator - can be floating or integrated into headers
 * Now includes sync status from AuthContext
 */
const ConnectionStatusBar = ({ isIntegrated = false }) => {
    const { status, refresh } = useConnection();
    const { currentUser, syncStatus } = useAuth();

    // Base styles for the pill
    const baseStyles = isIntegrated
        ? "text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 border transition-all duration-300 h-7"
        : "fixed top-3 left-3 z-[100] text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md border transition-all duration-300";

    const syncIndicator = syncStatus?.inProgress ? (
        <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
            <div className="bg-purple-500/20 text-purple-700 text-[8px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-200/50 animate-pulse">
                <CloudDownload size={9} className="animate-bounce" />
                <span>מסנכרן {syncStatus.progress || 0}%</span>
            </div>
        </div>
    ) : null;

    const content = (() => {
        // Online, Cloud-only, or Local-only = Connected (green)
        if (status === 'online' || status === 'local-only' || status === 'cloud-only') {
            return (
                <div className={`${baseStyles} bg-green-500/15 text-green-700 border-green-200/50 relative`}>
                    <Wifi size={10} strokeWidth={2.5} />
                    <span className="font-bold text-[10px]">מחובר</span>
                    {syncIndicator}
                </div>
            );
        }

        // Checking connection
        if (status === 'checking') {
            return (
                <div className={`${baseStyles} bg-blue-500/15 text-blue-700 border-blue-200/50 relative`}>
                    <RefreshCw size={10} strokeWidth={2.5} className="animate-spin" />
                    <span className="font-bold text-[10px]">בודק...</span>
                </div>
            );
        }

        // Offline = Disconnected (red)
        return (
            <div className={`${baseStyles} bg-red-500/15 text-red-700 border-red-200/50 relative`}>
                <WifiOff size={10} strokeWidth={2.5} />
                <span className="font-bold text-[10px]">מנותק</span>
                <button
                    onClick={refresh}
                    className="p-0.5 hover:bg-red-200/50 rounded-full transition-colors"
                    title="נסה שוב"
                >
                    <RefreshCw size={9} />
                </button>
                {syncIndicator}
            </div>
        );
    })();

    if (!content) return null;

    if (isIntegrated) {
        return (
            <div className="flex items-center justify-center w-full">
                {content}
            </div>
        );
    }

    return content;
};

export default ConnectionStatusBar;

