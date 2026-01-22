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
    const { currentUser } = useAuth();
    const [lastSyncTime, setLastSyncTime] = React.useState(localStorage.getItem('last_sync_time'));

    // Update last sync time from storage
    React.useEffect(() => {
        const updateTime = () => setLastSyncTime(localStorage.getItem('last_sync_time'));
        const interval = setInterval(updateTime, 10000); // Check every 10s
        window.addEventListener('storage', updateTime);
        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', updateTime);
        };
    }, []);

    const formatSyncTime = (timestamp) => {
        if (!timestamp) return 'לא סונכרן';
        const syncDate = new Date(parseInt(timestamp));
        if (isNaN(syncDate)) return 'לא סונכרן';

        const now = new Date();
        const isToday = syncDate.toDateString() === now.toDateString();

        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = syncDate.toDateString() === yesterday.toDateString();

        const dayBefore = new Date();
        dayBefore.setDate(now.getDate() - 2);
        const isDayBefore = syncDate.toDateString() === dayBefore.toDateString();

        const timeStr = syncDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        if (isToday) return `היום ${timeStr}`;
        if (isYesterday) return `אתמול ${timeStr}`;
        if (isDayBefore) return `שלשום ${timeStr}`;
        return syncDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    };

    const isOnline = status === 'online' || status === 'local-only' || status === 'cloud-only';
    const isLocalOnly = status === 'local-only';
    const isCloudOnly = status === 'cloud-only';
    const isBoth = status === 'online';
    const isChecking = status === 'checking';

    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async (e) => {
        e.stopPropagation();
        if (isSyncing || !currentUser?.business_id) return;

        setIsSyncing(true);
        try {
            const resp = await fetch('/api/sync-cloud-to-local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId: currentUser.business_id })
            });
            if (resp.ok) {
                // Background sync started
                console.log('Sync triggered from status bar');
            }
        } catch (err) {
            console.error('Sync failed:', err);
        } finally {
            // We'll keep the icon spinning for 2 seconds to give feedback
            setTimeout(() => setIsSyncing(false), 2000);
        }
    };

    // Icons
    const HomeIcon = ({ size = 12, className = "" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );

    const CloudIcon = ({ size = 12, className = "" }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M17.5 19c.5 0 1-.2 1.4-.5.4-.3.6-.7.6-1.1 0-.6-.5-1-1.1-1.3-.3-.1-.7-.1-1.1 0-1.2.3-2.4-.2-3.1-1.2-.7-1-1.1-2.1-1-3.3.1-1.2.7-2.3 1.7-3s2.1-.8 3.3-.4c.4.1.7.3 1 .5.4.3.9.4 1.3.4.4 0 .9-.1 1.2-.4.4-.3.6-.7.6-1.1 0-.6-.4-1.1-1-1.3-.4-.1-.8-.1-1.2 0-1.8.4-3.6 0-5.1-1.2-1.5-1.2-2.3-2.9-2.2-4.8.1-1.9 1.1-3.6 2.7-4.6" /><path d="M12 21H6a4 4 0 0 1 0-8h.5a5.5 5.5 0 0 1 10.5-2.5 3.5 3.5 0 0 1 3 6.5" />
        </svg>
    );

    // Get business name from user or impersonation
    const businessName = currentUser?.impersonating_business_name || currentUser?.business_name || null;

    return (
        <div className={`flex flex-col items-start gap-1 ${isIntegrated ? '' : 'fixed top-3 left-3 z-[100] bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-slate-200/50 shadow-lg shadow-slate-200/20'}`} dir="rtl">
            {isOnline ? (
                <div className="flex flex-col items-start">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 border border-emerald-100/50 rounded-lg">
                        <div className="flex items-center gap-1">
                            {/* Local Indicator (House) */}
                            {(isBoth || isLocalOnly) && (
                                <div className="flex items-center justify-center p-0.5 bg-emerald-500 rounded text-white shadow-sm shadow-emerald-200">
                                    <HomeIcon size={11} />
                                </div>
                            )}
                            {/* Cloud Indicator (Cloud) */}
                            {(isBoth || isCloudOnly) && (
                                <div className="flex items-center justify-center p-0.5 bg-blue-500 rounded text-white shadow-sm shadow-blue-200">
                                    <CloudIcon size={11} />
                                </div>
                            )}
                        </div>

                        <span className="text-[11px] font-black text-emerald-800 leading-none">
                            {businessName || 'מחובר'}
                        </span>
                    </div>

                    {/* Sync Info Row */}
                    <div className="flex items-center gap-2 mt-1 px-1 group">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 leading-tight">
                                סונכרן: {formatSyncTime(lastSyncTime)}
                            </span>
                        </div>

                        {/* Compact Sync Button */}
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`p-1 rounded-md transition-all ${isSyncing ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-500'}`}
                            title="סנכרן עכשיו"
                        >
                            <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            ) : isChecking ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="text-xs font-bold text-blue-700">מתחבר...</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl relative group">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="text-xs font-bold text-red-700">לא מחובר</span>
                    <button
                        onClick={refresh}
                        className="p-1 hover:bg-red-100 rounded-md text-red-400 transition-colors"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ConnectionStatusBar;

