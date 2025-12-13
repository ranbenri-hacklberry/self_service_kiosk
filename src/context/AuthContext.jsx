import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [deviceMode, setDeviceMode] = useState(null); // 'kiosk', 'kds', 'manager'
    const [isLoading, setIsLoading] = useState(true);

    // Load state from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('kiosk_user');
        const storedSession = sessionStorage.getItem('employee_session');
        const storedMode = localStorage.getItem('kiosk_mode');

        console.log('🔐 AuthContext Loading:', {
            hasStoredUser: !!storedUser,
            hasStoredSession: !!storedSession,
            hasStoredMode: !!storedMode
        });

        // Prefer sessionStorage (employee login) over localStorage (customer)
        if (storedSession) {
            try {
                const sessionUser = JSON.parse(storedSession);
                console.log('🔐 Loaded from sessionStorage:', {
                    id: sessionUser.id,
                    name: sessionUser.name,
                    whatsapp_phone: sessionUser.whatsapp_phone
                });
                setCurrentUser(sessionUser);
            } catch (e) {
                console.error('Failed to parse session user', e);
                sessionStorage.removeItem('employee_session');
            }
        } else if (storedUser) {
            try {
                const localUser = JSON.parse(storedUser);
                console.log('🔐 Loaded from localStorage:', localUser);
                setCurrentUser(localUser);
            } catch (e) {
                console.error('Failed to parse stored user', e);
                localStorage.removeItem('kiosk_user');
            }
        }

        if (storedMode) {
            setDeviceMode(storedMode);
        }

        setIsLoading(false);
    }, []);

    const login = (employee) => {
        setCurrentUser(employee);
        localStorage.setItem('kiosk_user', JSON.stringify(employee));
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
