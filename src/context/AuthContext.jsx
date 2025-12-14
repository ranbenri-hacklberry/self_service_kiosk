import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager'
    const [isLoading, setIsLoading] = useState(true);

    // Load state from sessionStorage on mount (Refresh resilience only)
    useEffect(() => {
        // We do NOT load from localStorage anymore to ensure "New Opening" = Login Screen
        const storedSession = sessionStorage.getItem('kiosk_user');
        const storedMode = localStorage.getItem('kiosk_mode'); // Keep mode persistent (Device config)

        console.log('🔐 AuthContext Loading:', {
            hasStoredSession: !!storedSession,
            hasStoredMode: !!storedMode
        });

        if (storedSession) {
            try {
                const sessionUser = JSON.parse(storedSession);
                console.log('🔐 Loaded from sessionStorage:', {
                    id: sessionUser.id,
                    name: sessionUser.name
                });
                setCurrentUser(sessionUser);
            } catch (e) {
                console.error('Failed to parse session user', e);
                sessionStorage.removeItem('kiosk_user');
            }
        }

        if (storedMode) {
            setDeviceMode(storedMode);
        }

        setIsLoading(false);
    }, []);

    const login = (employee) => {
        setCurrentUser(employee);
        // Save to Session Storage (Persist on refresh, clear on close)
        sessionStorage.setItem('kiosk_user', JSON.stringify(employee));
        // Clear any old local storage to be sure
        localStorage.removeItem('kiosk_user');
    };

    const logout = () => {
        setCurrentUser(null);
        setDeviceMode(null);
        localStorage.removeItem('kiosk_user');
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
