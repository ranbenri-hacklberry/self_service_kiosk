import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager', 'music'
    const [isLoading, setIsLoading] = useState(true);

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
    };

    const logout = () => {
        setCurrentUser(null);
        setDeviceMode(null);
        localStorage.removeItem('kiosk_user');
        localStorage.removeItem('kiosk_auth_time');
        localStorage.removeItem('kiosk_mode');
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
            isLoading
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
