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

    const [syncDiffs, setSyncDiffs] = React.useState(0);
    const [isChecking, setIsChecking] = React.useState(false);

    // Base styles for the pill
    const baseStyles = isIntegrated
        ? "text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 border transition-all duration-300 h-7"
        : "fixed top-3 left-3 z-[100] text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md border transition-all duration-300";

    const runSyncDoctor = async () => {
        if (!currentUser?.business_id || isChecking) return;
        setIsChecking(true);
        try {
            const { getSyncDiffs, healOrder } = await import('@/services/syncService');
            const result = await getSyncDiffs(currentUser.business_id);

            if (result.success && result.diffs.length > 0) {
                console.log(`🚑 Sync Doctor found ${result.diffs.length} issues. Healing...`);
                setSyncDiffs(result.diffs.length);

                // Auto-heal mismatches
                for (const diff of result.diffs) {
                    await healOrder(diff, currentUser.business_id);
                }

                // Re-check after healing
                const recheck = await getSyncDiffs(currentUser.business_id);
                setSyncDiffs(recheck.success ? recheck.diffs.length : 0);
            } else {
                setSyncDiffs(0);
            }
        } catch (err) {
            console.error('Sync Doctor Error:', err);
        } finally {
            setIsChecking(false);
        }
    };

    // Auto-check periodically
    React.useEffect(() => {
        const interval = setInterval(runSyncDoctor, 60000 * 5); // Every 5 minutes
        runSyncDoctor();
        return () => clearInterval(interval);
    }, [currentUser?.business_id]);

    const syncIndicator = (
        <div className="absolute -bottom-6 right-0 left-0 flex justify-center pointer-events-auto">
            <button
                onClick={runSyncDoctor}
                disabled={isChecking}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black border transition-all ${syncDiffs > 0
                    ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
            >
                {isChecking ? (
                    <RefreshCw size={8} className="animate-spin" />
                ) : (
                    <CloudDownload size={8} />
                )}
                <span>{syncDiffs > 0 ? `תיקון ${syncDiffs}` : 'סנכרון תקין'}</span>
            </button>
        </div>
    );

    const content = (() => {
        if (status === 'online' || status === 'local-only' || status === 'cloud-only') {
            return (
                <div className={`${baseStyles} bg-green-500/15 text-green-700 border-green-200/50 relative mb-4`}>
                    <Wifi size={10} strokeWidth={2.5} />
                    <span className="font-bold">מחובר</span>
                    {syncIndicator}
                </div>
            );
        }

        if (status === 'checking') {
            return (
                <div className={`${baseStyles} bg-blue-500/15 text-blue-700 border-blue-200/50 relative mb-4`}>
                    <RefreshCw size={10} strokeWidth={2.5} className="animate-spin" />
                    <span className="font-bold">בודק...</span>
                </div>
            );
        }

        return (
            <div className={`${baseStyles} bg-red-500/15 text-red-700 border-red-200/50 relative mb-4`}>
                <WifiOff size={10} strokeWidth={2.5} />
                <span className="font-bold">מנותק</span>
                <button
                    onClick={refresh}
                    className="p-0.5 hover:bg-red-200/50 rounded-full transition-colors"
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

