import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

// API URL for sync endpoint
const API_URL = import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8080';

const APP_VERSION = '2.0.5'; // Increment this to force all iPads to reload and clear cache

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager', 'music'
    const [isLoading, setIsLoading] = useState(true);

    // 🔥 AUTO-UPDATE & CACHE REFRESH MECHANISM
    useEffect(() => {
        const checkVersion = () => {
            const lastVersion = localStorage.getItem('app_version');
            if (lastVersion && lastVersion !== APP_VERSION) {
                console.log(`🚀 New version detected (${APP_VERSION}). Clearing cache and reloading...`);
                // Clear local data that might be corrupted or outdated
                localStorage.removeItem('db_version'); // Force DB migrations if any
                localStorage.removeItem('last_full_sync');

                // Do NOT use localStorage.clear() as it might remove device settings
                // Just force a hard reload
                window.location.reload(true);
            }
            localStorage.setItem('app_version', APP_VERSION);
        };

        checkVersion();
        const interval = setInterval(checkVersion, 300000); // Check every 5 minutes
        return () => clearInterval(interval);
    }, []);

    const [syncStatus, setSyncStatus] = useState({
        inProgress: false,
        lastSync: null,
        progress: 0,
        error: null
    });

    // Trigger cloud-to-local sync
    const triggerSync = async (businessId = null) => {
        try {
            console.log('🔄 Starting cloud-to-local sync...');
            setSyncStatus(prev => ({ ...prev, inProgress: true, error: null }));

            const response = await fetch(`${API_URL}/api/sync-cloud-to-local`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Sync failed');
            }

            console.log('✅ Sync initiated:', data);

            // Poll for sync status
            const pollStatus = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${API_URL}/api/sync/status`);
                    const status = await statusRes.json();
                    setSyncStatus(status);

                    if (!status.inProgress) {
                        clearInterval(pollStatus);
                        if (status.error) {
                            console.error('❌ Sync error:', status.error);
                        } else {
                            console.log('🎉 Sync complete!', status);
                        }
                    }
                } catch (pollErr) {
                    console.warn('Sync status poll failed:', pollErr.message);
                }
            }, 2000);

            // Stop polling after 2 minutes max
            setTimeout(() => clearInterval(pollStatus), 120000);

        } catch (err) {
            console.error('❌ Sync trigger failed:', err.message);
            setSyncStatus(prev => ({ ...prev, inProgress: false, error: err.message }));
        }
    };

    // Load state from localStorage on mount with expiration check
    useEffect(() => {
        const checkAuth = () => {
            console.log('🔐 AuthContext: Checking stored session...');
            const storedSession = localStorage.getItem('kiosk_user');
            const storedTime = localStorage.getItem('kiosk_auth_time');
            const storedMode = localStorage.getItem('kiosk_mode');

            if (storedSession && storedTime) {
                const now = Date.now();
                // 18 hours expiration (Daily login requirement)
                const hoursPassed = (now - parseInt(storedTime)) / (1000 * 60 * 60);

                if (hoursPassed < 18) {
                    try {
                        const sessionUser = JSON.parse(storedSession);
                        setCurrentUser(sessionUser);

                        // DEEP FIX: If accessing through icaffe domain, ensure we don't get stuck in old kiosk mode
                        const isIffeDomain = window.location.hostname === 'icaffe.hacklberryfinn.com';
                        if (isIffeDomain && storedMode === 'kiosk') {
                            console.log('🧹 Clearing old kiosk mode for production domain');
                            localStorage.removeItem('kiosk_mode');
                            setDeviceMode(null);
                        } else if (storedMode) {
                            setDeviceMode(storedMode);
                        }

                        // Trigger sync on page load if user exists (background refresh)
                        const lastSyncTime = localStorage.getItem('last_sync_time');
                        const syncAge = lastSyncTime ? (now - parseInt(lastSyncTime)) / (1000 * 60) : Infinity;
                        if (syncAge > 30) { // Sync if older than 30 minutes
                            // triggerSync(sessionUser?.business_id); // DISABLED for Cloud-Only Mode
                        }
                    } catch (e) {
                        console.error('Failed to parse session user', e);
                        localStorage.removeItem('kiosk_user');
                        localStorage.removeItem('kiosk_auth_time');
                        localStorage.removeItem('kiosk_mode');
                    }
                } else {
                    localStorage.removeItem('kiosk_user');
                    localStorage.removeItem('kiosk_auth_time');
                    localStorage.removeItem('kiosk_mode');
                }
            } else {
                localStorage.removeItem('kiosk_mode');
            }

            setIsLoading(false);
        };

        checkAuth();
    }, []);

    // Auto-sync queue when coming back online
    useEffect(() => {
        const handleOnline = async () => {
            if (currentUser?.business_id) {
                console.log('🌐 [AuthContext] Back online - syncing pending changes...');
                try {
                    const { syncQueue } = await import('../services/offlineQueue');
                    const result = await syncQueue();
                    if (result.synced > 0) {
                        console.log(`✅ [AuthContext] Synced ${result.synced} pending actions`);
                    }
                } catch (err) {
                    console.error('Failed to sync queue:', err);
                }
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [currentUser?.business_id]);

    // Background sync every 5 minutes (when user is logged in)
    useEffect(() => {
        if (!currentUser?.business_id) return;

        const runBackgroundSync = async () => {
            try {
                console.log('🔄 [Background] Starting periodic sync...');
                const { syncOrders, isOnline } = await import('../services/syncService');
                const { syncQueue } = await import('../services/offlineQueue');

                if (!isOnline()) {
                    console.log('📴 [Background] Offline, skipping sync');
                    return;
                }

                // First, sync local changes TO cloud
                await syncQueue();

                // Check if we need a FULL sync (Initial Load)
                // We do this once per session or if explicit refresh needed
                // But for now, let's do a lightweight check or just rely on syncOrders for frequent updates
                // However, user specifically asked for auto-sync on entry.
                // syncing ALL tables is safer for modifiers/menu consistency.

                const { initialLoad } = await import('../services/syncService');
                const lastFullSync = localStorage.getItem('last_full_sync');
                const timeSinceFullSync = lastFullSync ? (Date.now() - parseInt(lastFullSync)) : Infinity;

                // Run full sync if it's been more than 1 hour or never ran
                if (timeSinceFullSync > 60 * 60 * 1000) {
                    console.log('🔄 [Background] Running FULL initial load (periodic/login)...');
                    await initialLoad(currentUser.business_id);
                    localStorage.setItem('last_full_sync', Date.now().toString());
                } else {
                    // Just sync orders frequently
                    const result = await syncOrders(currentUser.business_id);
                    if (result.success) {
                        console.log(`✅ [Background] Synced ${result.ordersCount} orders`);
                    }
                }

                localStorage.setItem('last_sync_time', Date.now().toString());
            } catch (err) {
                console.warn('⚠️ [Background] Sync failed:', err.message);
            }
        };

        // Run immediately on login
        runBackgroundSync();

        // Then run every 5 minutes
        const interval = setInterval(runBackgroundSync, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [currentUser?.business_id]);

    // 🕛 MIDNIGHT AUTO-LOGOUT: Force logout at midnight every day
    useEffect(() => {
        const checkMidnightLogout = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            // Check if it's between 00:00 and 00:05 (5-minute window)
            if (hours === 0 && minutes < 5) {
                const lastMidnightLogout = localStorage.getItem('last_midnight_logout');
                const today = now.toDateString();

                // Only logout once per day
                if (lastMidnightLogout !== today) {
                    console.log('🕛 MIDNIGHT AUTO-LOGOUT: Clearing all sessions...');

                    // Mark that we did midnight logout today
                    localStorage.setItem('last_midnight_logout', today);

                    // Clear ALL session data
                    localStorage.removeItem('kiosk_user');
                    localStorage.removeItem('kiosk_auth_time');
                    localStorage.removeItem('kiosk_mode');
                    localStorage.removeItem('manager_auth_key');
                    localStorage.removeItem('manager_auth_time');
                    localStorage.removeItem('manager_employee_id');
                    localStorage.removeItem('currentCustomer');
                    sessionStorage.removeItem('employee_session');

                    // Force reload to login screen
                    window.location.href = '/mode-selection';
                }
            }
        };

        // Check immediately
        checkMidnightLogout();

        // Then check every minute
        const midnightInterval = setInterval(checkMidnightLogout, 60 * 1000);

        return () => clearInterval(midnightInterval);
    }, []);

    const login = (employee) => {
        setCurrentUser(employee);
        localStorage.setItem('kiosk_user', JSON.stringify(employee));
        localStorage.setItem('kiosk_auth_time', Date.now().toString());

        // Color force full sync on next background run
        localStorage.removeItem('last_full_sync');
        localStorage.setItem('last_sync_time', Date.now().toString());
    };

    const logout = () => {
        setCurrentUser(null);
        setDeviceMode(null);
        localStorage.removeItem('kiosk_user');
        localStorage.removeItem('kiosk_auth_time');
        localStorage.removeItem('kiosk_mode');
        localStorage.removeItem('last_sync_time');
    };

    const setMode = (mode) => {
        setDeviceMode(mode);
        localStorage.setItem('kiosk_mode', mode);
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            deviceMode,
            login,
            logout,
            setMode,
            isLoading,
            syncStatus,
            triggerSync
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
