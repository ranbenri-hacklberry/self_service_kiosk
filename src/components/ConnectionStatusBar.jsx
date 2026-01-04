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

    return (
        <div className={`flex flex-col items-start gap-0.5 min-w-[70px] ${isIntegrated ? '' : 'fixed top-3 left-3 z-[100] bg-white/80 backdrop-blur-md p-1.5 rounded-xl border shadow-sm'}`} dir="rtl">
            <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full transition-all duration-500 shadow-sm ${isChecking ? 'bg-blue-400 animate-pulse' :
                        isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                            'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                    }`} />
                <span className="text-[10px] font-black text-slate-700 leading-none">
                    {isChecking ? 'בודק...' : isOnline ? 'מחובר' : 'מנותק'}
                </span>
                {!isOnline && !isChecking && (
                    <button onClick={refresh} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <RefreshCw size={8} />
                    </button>
                )}
            </div>
            <div className="text-[8px] font-medium text-slate-400 leading-tight whitespace-nowrap">
                סונכרן: <span className="text-slate-500">{formatSyncTime(lastSyncTime)}</span>
            </div>
        </div>
    );
};

export default ConnectionStatusBar;

