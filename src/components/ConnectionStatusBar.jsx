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
    const isChecking = status === 'checking';

    // Get business name from user or impersonation
    const businessName = currentUser?.impersonating_business_name || currentUser?.business_name || null;

    return (
        <div className={`flex flex-col items-center gap-0.5 ${isIntegrated ? '' : 'fixed top-3 left-3 z-[100] bg-white/80 backdrop-blur-md p-1.5 rounded-xl border shadow-sm'}`} dir="rtl">
            {/* Business Name Badge */}
            {isOnline ? (
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                        <span className="text-xs font-bold text-green-700 leading-none">
                            {businessName || 'מחובר'}
                        </span>
                    </div>
                    {lastSyncTime && (
                        <span className="text-[10px] font-black text-slate-400 mt-0.5">
                            סונכרן: {formatSyncTime(lastSyncTime)}
                        </span>
                    )}
                </div>
            ) : isChecking ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-xs font-bold text-blue-600 leading-none">מתחבר...</span>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                    <span className="text-xs font-bold text-red-600 leading-none">לא מחובר</span>
                    <button onClick={refresh} className="text-red-400 hover:text-red-600 transition-colors ml-1">
                        <RefreshCw size={10} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ConnectionStatusBar;

