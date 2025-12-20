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

        // Check Local (Docker) - simple health check
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
                method: 'GET', // HEAD sometimes causes issues with some proxies
                headers: {
                    'apikey': import.meta.env.VITE_LOCAL_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
                },
                signal: controller.signal,
                mode: 'cors'
            }).catch(() => ({ ok: false }));
            
            clearTimeout(id);
            localOk = response && (response.ok || response.status === 400);
        } catch {
            localOk = false;
        }

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
