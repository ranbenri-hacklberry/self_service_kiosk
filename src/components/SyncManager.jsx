import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Cloud, Database } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const SyncManager = () => {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState({
        inProgress: false,
        lastSync: null,
        progress: 0,
        currentTable: null,
        error: null,
        localAvailable: false,
        remoteAvailable: false
    });
    const [isExpanded, setIsExpanded] = useState(false);

    const businessId = currentUser?.business_id;

    const fetchStatus = async () => {
        try {
            const resp = await fetch('/api/sync/status');
            const data = await resp.json();
            setStatus(prev => ({ ...prev, ...data }));
        } catch (err) {
            console.error('Failed to fetch sync status:', err);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const triggerSync = async () => {
        if (status.inProgress || !businessId) return;

        try {
            const resp = await fetch('/api/sync-cloud-to-local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId })
            });

            if (resp.ok) {
                console.log('Sync triggered successfully');
                fetchStatus();
            }
        } catch (err) {
            console.error('Failed to trigger sync:', err);
        }
    };

    if (!status.localAvailable) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999]" dir="rtl">
            <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${isExpanded ? 'w-80' : 'w-14 h-14'}`}>
                {/* Header / Toggle Button */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full h-14 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                    {status.inProgress ? (
                        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                    ) : status.error ? (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                    ) : (
                        <div className="relative">
                            <Database className="w-6 h-6 text-slate-600" />
                            <Cloud className="w-3 h-3 text-blue-400 absolute -top-1 -right-1" />
                        </div>
                    )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="p-4 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span>ניהול סנכרון מקומי (Docker)</span>
                            {status.remoteAvailable && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Cloud Link OK</span>}
                        </h3>

                        <div className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div className="bg-slate-50 p-2 rounded-lg">
                                    <span className="text-slate-400 block uppercase">מצב</span>
                                    <span className="font-bold text-slate-700">
                                        {status.inProgress ? 'מסנכרן...' : 'ממתין'}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg">
                                    <span className="text-slate-400 block uppercase">סנכרון אחרון</span>
                                    <span className="font-bold text-slate-700">
                                        {status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'לעולם לא'}
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            {status.inProgress && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500 font-medium">סנכרון טבלה: {status.currentTable}</span>
                                        <span className="text-blue-600 font-bold">{status.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-blue-500 h-full transition-all duration-500"
                                            style={{ width: `${status.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); triggerSync(); }}
                                disabled={status.inProgress}
                                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${status.inProgress
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-[0.98]'
                                    }`}
                            >
                                <RefreshCw className={`w-4 h-4 ${status.inProgress ? 'animate-spin' : ''}`} />
                                {status.inProgress ? 'מבצע סנכרון...' : 'סנכרן מהענן עכשיו'}
                            </button>

                            {status.error && (
                                <div className="p-2 bg-red-50 rounded-lg text-red-600 text-[10px] flex items-start gap-2">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                    <span>{status.error}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncManager;
