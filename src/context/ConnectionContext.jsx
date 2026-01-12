import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * @typedef {'online' | 'offline' | 'local-only' | 'cloud-only' | 'checking'} ConnectionStatus
 * @typedef {{ status: ConnectionStatus, localAvailable: boolean, cloudAvailable: boolean, lastSync: Date|null, lastLocalAvailable: Date|null }} ConnectionState
 */

const ConnectionContext = createContext(null);

// Local Supabase URL (Docker)
const LOCAL_SUPABASE_URL = import.meta.env.VITE_LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';

export const ConnectionProvider = ({ children }) => {
    const [state, setState] = useState({
        status: 'checking',
        localAvailable: false,
        cloudAvailable: false,
        lastSync: null,
        lastLocalAvailable: null,
        lastCloudAvailable: null
    });
    const [showOfflinePopup, setShowOfflinePopup] = useState(false);
    const [showOnlinePopup, setShowOnlinePopup] = useState(false);
    const offlineTimeoutRef = useRef(null);
    const GRACE_PERIOD_MS = 60000; // 60 seconds grace period (1 minute)

    const checkConnectivity = useCallback(async () => {
        let localOk = false;
        let cloudOk = false;

        // FAST PATH: If browser says offline, don't even try network calls
        if (!navigator.onLine) {
            console.log('📴 [ConnectionContext] Browser reports offline - skipping network checks');
            setState(prev => ({
                ...prev,
                status: 'offline',
                cloudAvailable: false,
                localAvailable: false
            }));
            return;
        }

        // Check Cloud (Remote) - use the main supabase client with strict timeout
        try {
            // Create a short timeout so we fail fast if network hangs
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 3000); // 3s timeout

            const { error } = await supabase
                .from('menu_items')
                .select('id')
                .limit(1)
                .maybeSingle()
                .abortSignal(abortController.signal);

            clearTimeout(timeoutId);
            cloudOk = !error;
        } catch (err) {
            console.log('📡 [ConnectionContext] Cloud check failed:', err.message);
            cloudOk = false;
        }

        localOk = false; // Force Cloud Only

        // Determine status
        let status = 'checking';
        if (localOk && cloudOk) {
            status = 'online';
        } else if (localOk && !cloudOk) {
            status = 'local-only'; // Offline mode
        } else if (!localOk && cloudOk) {
            status = 'cloud-only';
        } else {
            status = 'offline';
        }

        const now = new Date();
        setState(prev => ({
            status,
            localAvailable: localOk,
            cloudAvailable: cloudOk,
            lastSync: (localOk && cloudOk) ? now : prev.lastSync,
            lastLocalAvailable: localOk ? now : prev.lastLocalAvailable,
            lastCloudAvailable: cloudOk ? now : prev.lastCloudAvailable
        }));

        // ✅ AUTO-DISMISS Offline Popup if active check determines online
        if (status === 'online' || status === 'cloud-only') {
            if (showOfflinePopup) setShowOfflinePopup(false);
        }

        // Trigger offline popup if transition to offline (and not already shown)
        if (status === 'offline' && !showOfflinePopup && navigator.onLine) {
            // Ping failed but browser says online - likely a filter or real internet issue
            if (!offlineTimeoutRef.current) {
                offlineTimeoutRef.current = setTimeout(() => {
                    setShowOnlinePopup(false);
                    setShowOfflinePopup(true);
                }, GRACE_PERIOD_MS);
            }
        } else if (status === 'online' || status === 'cloud-only') {
            if (offlineTimeoutRef.current) {
                clearTimeout(offlineTimeoutRef.current);
                offlineTimeoutRef.current = null;
            }
        }

    }, [showOfflinePopup]);

    // Check on mount and periodically - INCREASED FREQUENCY
    useEffect(() => {
        checkConnectivity();
        const interval = setInterval(checkConnectivity, 5000); // Check every 5 seconds (was 30)
        return () => clearInterval(interval);
    }, [checkConnectivity]);

    // Listen for online/offline browser events - WITH POPUP
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Device is now ONLINE');
            if (offlineTimeoutRef.current) {
                clearTimeout(offlineTimeoutRef.current);
                offlineTimeoutRef.current = null;
            }
            setShowOfflinePopup(false); // Close offline popup first
            setShowOnlinePopup(true);
            checkConnectivity();

            // ✅ AUTO-DISMISS Online Popup after 3 seconds
            setTimeout(() => {
                setShowOnlinePopup(false);
            }, 3000);
        };
        const handleOffline = () => {
            console.log('📴 Device is now OFFLINE (starting grace period)');
            setShowOnlinePopup(false);

            // Only trigger popup after grace period
            if (!offlineTimeoutRef.current) {
                offlineTimeoutRef.current = setTimeout(() => {
                    console.log('📴 Grace period ended - showing offline popup');
                    setShowOfflinePopup(true);
                    offlineTimeoutRef.current = null;
                }, GRACE_PERIOD_MS);
            }

            setState(prev => ({ ...prev, status: 'offline', cloudAvailable: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkConnectivity]);

    // 🔄 AUTO-SYNC TRIGGER: When status becomes online, trigger the offline queue sync
    const prevStatusRef = useRef('checking');

    useEffect(() => {
        const currentStatus = state.status;
        const prevStatus = prevStatusRef.current;

        // If we transitioned TO online FROM something else (offline/checking/local-only)
        if (currentStatus === 'online' && prevStatus !== 'online') {
            console.log('🔄 [ConnectionContext] Connection restored! Triggering syncQueue...');

            // Dynamic import to avoid circular deps or heavy load on init
            import('../services/offlineQueue').then(({ syncQueue }) => {
                syncQueue().then(result => {
                    if (result.synced > 0) {
                        console.log(`✅ [ConnectionContext] Auto-sync complete: ${result.synced} items pushed.`);
                    }
                }).catch(err => console.error('❌ [ConnectionContext] Auto-sync failed:', err));
            });
        }

        prevStatusRef.current = currentStatus;
    }, [state.status]);

    return (
        <ConnectionContext.Provider value={{ ...state, refresh: checkConnectivity }}>
            {/* Offline Popup */}
            {showOfflinePopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl shadow-2xl p-8 mx-4 max-w-sm text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-4xl">📴</span>
                        </div>
                        <h2 className="text-2xl font-black mb-3">📴 מצב אופליין</h2>
                        <div className="text-white/90 font-medium text-right space-y-2 mb-4">
                            <p className="text-center">אין חיבור לאינטרנט</p>
                            <div className="bg-white/10 rounded-xl p-3 text-sm space-y-1">
                                <p>⚠️ הזמנות לא יעברו בין מכשירים</p>
                                <p>💳 סליקת אשראי לא תעבוד</p>
                                <p>✅ ההזמנות יישמרו ויסתנכרנו כשהחיבור יחזור</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowOfflinePopup(false)}
                            className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition"
                        >
                            הבנתי ✓
                        </button>
                    </div>
                </div>
            )}

            {/* Online Popup */}
            {showOnlinePopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-3xl shadow-2xl p-8 mx-4 max-w-sm text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="text-4xl">🌐</span>
                        </div>
                        <h2 className="text-2xl font-black mb-2">חזרנו אונליין!</h2>
                        <p className="text-white/90 font-medium mb-4">
                            החיבור חזר לפעול.
                            <br />
                            <span className="text-white/80 text-sm">מסנכרן שינויים...</span>
                        </p>
                        <button
                            onClick={() => setShowOnlinePopup(false)}
                            className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition"
                        >
                            מעולה! ✓
                        </button>
                    </div>
                </div>
            )}

            {children}
        </ConnectionContext.Provider>
    );
};

export const useConnection = () => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within ConnectionProvider');
    }
    return context;
};

export default ConnectionContext;
