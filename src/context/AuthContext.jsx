import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase'; // 🆕 FIX: Import supabase client

const AuthContext = createContext(null);

// API URL for sync endpoint
const API_URL = import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8080';

export const APP_VERSION = '3.7.2'; // Google Drive Integration & Orders Backup
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager', 'music'
    const [isLoading, setIsLoading] = useState(true);

    // 🚀 Session version tracking is now handled in SplashScreen to prevent double-splash reloads
    useEffect(() => {
        localStorage.setItem('app_version', APP_VERSION);
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
        const checkAuth = async () => {
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
                        let sessionUser = JSON.parse(storedSession);

                        // Fetch business_name if missing from stored session
                        if (!sessionUser.business_name && sessionUser.business_id) {
                            console.log('🏢 Fetching missing business_name for business_id:', sessionUser.business_id);
                            try {
                                const { data: businessData, error } = await supabase
                                    .from('businesses')
                                    .select('name')
                                    .eq('id', sessionUser.business_id)
                                    .single();

                                console.log('🏢 Business fetch result:', { data: businessData, error });

                                if (businessData?.name) {
                                    sessionUser = { ...sessionUser, business_name: businessData.name };
                                    // Update localStorage with enriched data
                                    localStorage.setItem('kiosk_user', JSON.stringify(sessionUser));
                                    console.log('✅ Business name saved:', businessData.name);
                                }
                            } catch (e) {
                                console.warn('❌ Could not fetch business name for session:', e);
                            }
                        } else {
                            console.log('🏢 Business name already present:', sessionUser.business_name);
                        }

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
                const { syncOrders, syncLoyalty, isOnline } = await import('../services/syncService');
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
                    // Just sync orders and loyalty frequently
                    const result = await syncOrders(currentUser.business_id);
                    const loyaltyResult = await syncLoyalty(currentUser.business_id);

                    if (result.success) {
                        console.log(`✅ [Background] Synced ${result.ordersCount} orders`);
                    }
                    if (loyaltyResult.success) {
                        console.log(`✅ [Background] Synced ${loyaltyResult.transactions} transactions`);
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

    const login = async (employee) => {
        // If business_name is missing, fetch it from the database
        let enrichedEmployee = { ...employee };

        if (!employee.business_name && employee.business_id) {
            try {
                const { data: businessData } = await supabase
                    .from('businesses')
                    .select('name')
                    .eq('id', employee.business_id)
                    .single();

                if (businessData?.name) {
                    enrichedEmployee.business_name = businessData.name;
                }
            } catch (e) {
                console.warn('Could not fetch business name:', e);
            }
        }

        setCurrentUser(enrichedEmployee);
        localStorage.setItem('kiosk_user', JSON.stringify(enrichedEmployee));
        localStorage.setItem('kiosk_auth_time', Date.now().toString());

        // Color force full sync on next background run
        localStorage.removeItem('last_full_sync');
        localStorage.setItem('last_sync_time', Date.now().toString());
    };

    const logout = () => {
        const originalAdminStr = localStorage.getItem('original_super_admin');

        if (originalAdminStr) {
            // RESTORE SUPER ADMIN SESSION
            try {
                const originalAdmin = JSON.parse(originalAdminStr);
                console.log('🔙 Restoring Super Admin session:', originalAdmin.name);

                setCurrentUser(originalAdmin);
                localStorage.setItem('kiosk_user', originalAdminStr);
                localStorage.setItem('kiosk_auth_time', Date.now().toString());

                // Cleanup impersonation flags
                localStorage.removeItem('original_super_admin');
                localStorage.removeItem('return_to_super_portal');
                localStorage.removeItem('last_full_sync'); // Clear sync state from the other business

                window.location.href = '/super-admin';
                return;
            } catch (e) {
                console.error('Failed to restore super admin', e);
                // Fallthrough to normal logout
            }
        }

        // Normal Logout
        setCurrentUser(null);
        setDeviceMode(null);
        localStorage.removeItem('kiosk_user');
        localStorage.removeItem('kiosk_auth_time');
        localStorage.removeItem('kiosk_mode');
        localStorage.removeItem('last_sync_time');
        window.location.href = '/';
    };

    const setMode = (mode) => {
        setDeviceMode(mode);
        localStorage.setItem('kiosk_mode', mode);
    };

    const switchBusinessContext = (businessId, businessName) => {
        if (!currentUser?.is_super_admin) {
            console.error('Only super admins can switch business context');
            return;
        }

        // Save original identity
        localStorage.setItem('original_super_admin', JSON.stringify(currentUser));

        const impersonatedUser = {
            ...currentUser,
            business_id: businessId,
            access_level: 'owner', // Elevate to owner for full access
            is_admin: true,
            impersonating_business_name: businessName,
            is_impersonating: true
        };

        console.log('🚀 Switching context to:', businessName);

        setCurrentUser(impersonatedUser);
        localStorage.setItem('kiosk_user', JSON.stringify(impersonatedUser));
        localStorage.setItem('return_to_super_portal', 'true');

        // Force sync for new business
        localStorage.removeItem('last_full_sync');
        localStorage.setItem('last_sync_time', Date.now().toString());

        // Clear mode so they can choose
        setDeviceMode(null);
        localStorage.removeItem('kiosk_mode');
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            isAuthenticated: !!currentUser,
            deviceMode,
            login,
            logout,
            setMode,
            switchBusinessContext,
            isLoading,
            syncStatus,
            triggerSync,
            appVersion: APP_VERSION
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
