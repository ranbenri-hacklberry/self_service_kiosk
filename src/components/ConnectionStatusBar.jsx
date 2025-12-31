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
        // Fully online - green "מחובר"
        if (status === 'online') {
            return (
                <div className={`${baseStyles} bg-green-500/15 text-green-700 border-green-200/50 relative`}>
                    <Wifi size={10} strokeWidth={2.5} />
                    <span className="font-bold text-[10px]">מחובר</span>
                    {syncIndicator}
                </div>
            );
        }

        // Any offline state - red "מנותק"
        // (local-only, cloud-only, or offline)
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

