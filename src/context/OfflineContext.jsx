/**
 * Offline Status Provider
 * Context that manages online/offline state and sync status
 * 
 * @module context/OfflineContext
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialLoad, syncOrders, subscribeToOrders, subscribeToOrderItems, isOnline } from '../services/syncService';
import { useAuth } from './AuthContext';
import { useSyncStatus, useHasLocalData } from '../hooks/useLocalDB';

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

    const syncStatus = useSyncStatus();
    const hasLocalData = useHasLocalData();

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            console.log('🌐 Device is now ONLINE');
            setOnline(true);
            // Trigger sync when coming back online
            if (currentUser?.business_id) {
                performSync(currentUser.business_id);
            }
        };

        const handleOffline = () => {
            console.log('📴 Device is now OFFLINE');
            setOnline(false);
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

        const ordersSubscription = subscribeToOrders(currentUser.business_id, () => {
            // Local DB auto-updated by subscription handler
            setLastSyncTime(new Date());
        });

        const itemsSubscription = subscribeToOrderItems(currentUser.business_id, () => {
            setLastSyncTime(new Date());
        });

        return () => {
            ordersSubscription?.unsubscribe();
            itemsSubscription?.unsubscribe();
        };
    }, [currentUser?.business_id, online]);

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
            {children}
        </OfflineContext.Provider>
    );
};

export default OfflineProvider;
