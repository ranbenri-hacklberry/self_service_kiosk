import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialLoad, syncOrders, subscribeToAllChanges, isOnline } from '../services/syncService';
import { useAuth } from './AuthContext';

const OfflineContext = createContext();

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within OfflineProvider');
    }
    return context;
};

export const OfflineProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [online, setOnline] = useState(navigator.onLine);
    const [syncing, setSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [showOfflinePopup, setShowOfflinePopup] = useState(false);
    const [showOnlinePopup, setShowOnlinePopup] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [hasLocalData, setHasLocalData] = useState(false);

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Device is now ONLINE');
            setOnline(true);
            setShowOnlinePopup(true);
            setTimeout(() => setShowOnlinePopup(false), 3000); // Hide after 3 seconds
            // Trigger sync when coming back online
            if (currentUser?.business_id) {
                performSync(currentUser.business_id);
            }
        };

        const handleOffline = () => {
            console.log('📴 Device is now OFFLINE');
            setOnline(false);
            setShowOfflinePopup(true);
            setTimeout(() => setShowOfflinePopup(false), 4000); // Hide after 4 seconds
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [currentUser]);

    // Initial sync on mount
    useEffect(() => {
        if (currentUser?.business_id && online && !hasLocalData) {
            console.log('🚀 Running initial data load...');
            performInitialLoad(currentUser.business_id);
        }
    }, [currentUser?.business_id, online, hasLocalData]);

    // Subscribe to real-time changes
    useEffect(() => {
        if (!currentUser?.business_id || !online) return;

        console.log('🔌 initializing Realtime subscriptions...');
        // Subscribe to ALL tables (orders, menu, customers, modifiers, etc.)
        const subscriptions = subscribeToAllChanges(currentUser.business_id);

        return () => {
            console.log('🔌 cleaning up Realtime subscriptions...');
            subscriptions.forEach(sub => sub.unsubscribe());
        };
    }, [currentUser?.business_id, online]);

    // Auto-sync queue when coming back online
    useEffect(() => {
        if (online && currentUser?.business_id) {
            console.log('🌐 Back online - syncing pending changes...');
            const syncPending = async () => {
                try {
                    const { syncQueue } = await import('../services/offlineQueue');
                    const result = await syncQueue();
                    if (result.synced > 0) {
                        console.log(`✅ Synced ${result.synced} pending actions to Supabase`);
                    }
                } catch (err) {
                    console.error('Failed to sync queue:', err);
                }
            };
            syncPending();
        }
    }, [online, currentUser?.business_id]);

    // Perform initial load
    const performInitialLoad = useCallback(async (businessId) => {
        if (!isOnline()) {
            console.log('⏸️ Cannot perform initial load - offline');
            return;
        }

        setSyncing(true);
        setSyncError(null);

        try {
            const result = await initialLoad(businessId);
            if (result.success) {
                setLastSyncTime(new Date());
                console.log('✅ Initial load complete');
            } else {
                setSyncError(result.reason || 'Unknown error');
            }
        } catch (error) {
            console.error('❌ Initial load failed:', error);
            setSyncError(error.message);
        } finally {
            setSyncing(false);
        }
    }, []);

    // Perform orders sync
    const performSync = useCallback(async (businessId) => {
        if (!isOnline()) {
            return { success: false, reason: 'offline' };
        }

        setSyncing(true);
        setSyncError(null);

        try {
            const result = await syncOrders(businessId);
            if (result.success) {
                setLastSyncTime(new Date());
            }
            return result;
        } catch (error) {
            console.error('❌ Sync failed:', error);
            setSyncError(error.message);
            return { success: false, error };
        } finally {
            setSyncing(false);
        }
    }, []);

    // Manual refresh trigger
    const refresh = useCallback(() => {
        if (currentUser?.business_id) {
            return performSync(currentUser.business_id);
        }
        return Promise.resolve({ success: false, reason: 'no_business' });
    }, [currentUser?.business_id, performSync]);

    const value = {
        // Connection status
        online,
        offline: !online,

        // Sync status
        syncing,
        lastSyncTime,
        syncError,
        syncStatus,
        hasLocalData,

        // Actions
        refresh,
        performInitialLoad,

        // Utilities
        isOnline
    };

    return (
        <OfflineContext.Provider value={value}>
            {/* Offline Popup */}
            {showOfflinePopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-3xl shadow-2xl p-8 mx-4 max-w-sm text-center transform animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m2.121 9.9a6.002 6.002 0 008.486 0m-8.486-7.072a6 6 0 018.486 0" />
                                <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2.5} />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black mb-2">📴 מצב אופליין</h2>
                        <p className="text-white/90 font-medium">
                            אין חיבור לאינטרנט.
                            <br />
                            <span className="text-white/80 text-sm">המערכת תמשיך לעבוד ותסתנכרן כשתחזור</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Online Popup */}
            {showOnlinePopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-3xl shadow-2xl p-8 mx-4 max-w-sm text-center transform animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a11 11 0 0114.16 0M1.394 9.393a16 16 0 0121.212 0" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black mb-2">🌐 חזרנו אונליין!</h2>
                        <p className="text-white/90 font-medium">
                            החיבור חזר לפעול.
                            <br />
                            <span className="text-white/80 text-sm">מסנכרן שינויים...</span>
                        </p>
                    </div>
                </div>
            )}

            {children}
        </OfflineContext.Provider>
    );
};

export default OfflineProvider;
