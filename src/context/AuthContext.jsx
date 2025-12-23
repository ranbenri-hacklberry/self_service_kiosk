import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

// API URL for sync endpoint
const API_URL = import.meta.env.VITE_MUSIC_API_URL ||
    import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8080';

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager', 'music'
    const [isLoading, setIsLoading] = useState(true);
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
                            triggerSync(sessionUser?.business_id);
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

    const login = (employee) => {
        setCurrentUser(employee);
        localStorage.setItem('kiosk_user', JSON.stringify(employee));
        localStorage.setItem('kiosk_auth_time', Date.now().toString());

        // Trigger sync immediately after login
        triggerSync(employee?.business_id);
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
