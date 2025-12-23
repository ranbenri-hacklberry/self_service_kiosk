import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

    const checkConnectivity = useCallback(async () => {
        let localOk = false;
        let cloudOk = false;

        // Check Cloud (Remote) - use the main supabase client
        try {
            const { error } = await supabase.from('menu_items').select('id').limit(1).maybeSingle();
            cloudOk = !error;
        } catch {
            cloudOk = false;
        }

        // Check Local (Docker) - DISABLED per user request (Cloud Only Mode)
        // try {
        //     const controller = new AbortController();
        //     const id = setTimeout(() => controller.abort(), 2000);
        //
        //     // Use the backend's sync status endpoint which tells us if local is available
        //     const API_URL = import.meta.env.VITE_MUSIC_API_URL ||
        //         import.meta.env.VITE_MANAGER_API_URL?.replace(/\/$/, '') ||
        //         'http://localhost:8080';
        //
        //     const response = await fetch(`${API_URL}/api/sync/status`, {
        //         method: 'GET',
        //         signal: controller.signal
        //     }).catch(() => ({ ok: false }));
        //
        //     clearTimeout(id);
        //
        //     if (response.ok) {
        //         const data = await response.json();
        //         // Backend tells us if local Supabase is available
        //         localOk = data.localAvailable === true;
        //     }
        // } catch {
        //     localOk = false;
        // }
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

    }, []);

    // Check on mount and periodically
    useEffect(() => {
        checkConnectivity();
        const interval = setInterval(checkConnectivity, 30000); // Every 30 seconds
        return () => clearInterval(interval);
    }, [checkConnectivity]);

    // Listen for online/offline browser events
    useEffect(() => {
        const handleOnline = () => checkConnectivity();
        const handleOffline = () => setState(prev => ({ ...prev, status: 'offline', cloudAvailable: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkConnectivity]);

    return (
        <ConnectionContext.Provider value={{ ...state, refresh: checkConnectivity }}>
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
