/**
 * Offline-Aware Supabase Client Wrapper
 * Automatically falls back to local Dexie data when offline
 * 
 * @module lib/offlineSupabase
 */

import { supabase } from './supabase';
import { db } from '../db/database';

/**
 * Check if device is online
 */
export const isOnline = () => navigator.onLine;

/**
 * Table name mapping from Supabase to Dexie
 */
const TABLE_MAPPING = {
    'menu_items': 'menu_items',
    'orders': 'orders',
    'order_items': 'order_items',
    'customers': 'customers',
    'employees': 'employees',
    'discounts': 'discounts',
    'businesses': 'businesses',
    'ingredients': 'ingredients',
};

/**
 * Offline-aware select query
 * If online: fetches from Supabase and caches to Dexie
 * If offline: returns data from Dexie cache
 */
export const offlineSelect = async (tableName, query = {}) => {
    const localTable = TABLE_MAPPING[tableName];

    // If offline, return from local cache
    if (!isOnline()) {
        console.log(`📴 Offline: Reading ${tableName} from local cache`);

        if (!localTable || !db[localTable]) {
            console.warn(`⚠️ No local table for ${tableName}`);
            return { data: [], error: null, fromCache: true };
        }

        try {
            let collection = db[localTable];

            // Apply simple filters if provided
            if (query.eq) {
                for (const [key, value] of Object.entries(query.eq)) {
                    collection = collection.where(key).equals(value);
                }
            }

            const data = await collection.toArray();
            return { data, error: null, fromCache: true };
        } catch (err) {
            console.error(`❌ Local read failed for ${tableName}:`, err);
            return { data: [], error: err, fromCache: true };
        }
    }

    // Online: fetch from Supabase
    try {
        let supabaseQuery = supabase.from(tableName).select(query.select || '*');

        // Apply filters
        if (query.eq) {
            for (const [key, value] of Object.entries(query.eq)) {
                supabaseQuery = supabaseQuery.eq(key, value);
            }
        }
        if (query.in) {
            for (const [key, values] of Object.entries(query.in)) {
                supabaseQuery = supabaseQuery.in(key, values);
            }
        }
        if (query.gte) {
            for (const [key, value] of Object.entries(query.gte)) {
                supabaseQuery = supabaseQuery.gte(key, value);
            }
        }
        if (query.order) {
            supabaseQuery = supabaseQuery.order(query.order.column, { ascending: query.order.ascending });
        }
        if (query.limit) {
            supabaseQuery = supabaseQuery.limit(query.limit);
        }

        const { data, error } = await supabaseQuery;

        // Cache to local on success
        if (!error && data && localTable && db[localTable]) {
            try {
                await db[localTable].bulkPut(data);
            } catch (cacheErr) {
                console.warn(`⚠️ Failed to cache ${tableName}:`, cacheErr);
            }
        }

        return { data, error, fromCache: false };
    } catch (err) {
        // Network error - try local cache
        console.log(`📴 Network error for ${tableName}, falling back to cache`);

        if (localTable && db[localTable]) {
            const data = await db[localTable].toArray();
            return { data, error: null, fromCache: true, networkError: err };
        }

        return { data: [], error: err, fromCache: false };
    }
};

/**
 * Offline-aware RPC call
 * For write operations - queues them if offline
 */
export const offlineRPC = async (functionName, params) => {
    if (!isOnline()) {
        console.log(`📴 Offline: Cannot call RPC ${functionName}`);
        return {
            data: null,
            error: { message: 'Device is offline. Please try again when connected.' },
            offline: true
        };
    }

    try {
        return await supabase.rpc(functionName, params);
    } catch (err) {
        if (!isOnline() || err.message?.includes('offline') || err.message?.includes('Load failed')) {
            return {
                data: null,
                error: { message: 'Lost connection. Please try again when connected.' },
                offline: true
            };
        }
        throw err;
    }
};

/**
 * Get menu items with offline support
 */
export const getMenuItems = async (businessId) => {
    return offlineSelect('menu_items', {
        eq: businessId ? { business_id: businessId } : {},
        select: '*'
    });
};

/**
 * Get orders with offline support
 */
export const getOrders = async (businessId, dateFrom) => {
    const query = {
        eq: { business_id: businessId },
        select: '*'
    };

    if (dateFrom) {
        query.gte = { created_at: dateFrom };
    }

    return offlineSelect('orders', query);
};

/**
 * Get customers with offline support
 */
export const getCustomers = async (businessId) => {
    return offlineSelect('customers', {
        eq: businessId ? { business_id: businessId } : {}
    });
};

/**
 * Get customer by phone with offline support
 */
export const getCustomerByPhone = async (phone) => {
    if (!isOnline()) {
        const customer = await db.customers.where('phone_number').equals(phone).first();
        return { data: customer || null, error: null, fromCache: true };
    }

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

    if (!error && data) {
        try {
            await db.customers.put(data);
        } catch (e) { /* ignore */ }
    }

    return { data, error, fromCache: false };
};

/**
 * Submit order with offline handling
 */
export const submitOrder = async (orderPayload) => {
    if (!isOnline()) {
        // TODO: Queue for later sync
        return {
            data: null,
            error: { message: 'אין חיבור לאינטרנט. לא ניתן לשלוח הזמנה.' },
            offline: true
        };
    }

    return supabase.rpc('submit_order_v2', orderPayload);
};

/**
 * Wrapper to make any Supabase call offline-aware
 */
export const withOfflineFallback = async (supabaseCall, fallbackFn) => {
    if (!isOnline()) {
        console.log('📴 Offline: Using fallback');
        return fallbackFn ? await fallbackFn() : { data: null, error: { message: 'Offline' } };
    }

    try {
        const result = await supabaseCall();
        return result;
    } catch (err) {
        if (!isOnline() || err.message?.includes('Load failed')) {
            console.log('📴 Network error: Using fallback');
            return fallbackFn ? await fallbackFn() : { data: null, error: err };
        }
        throw err;
    }
};

export default {
    isOnline,
    offlineSelect,
    offlineRPC,
    getMenuItems,
    getOrders,
    getCustomers,
    getCustomerByPhone,
    submitOrder,
    withOfflineFallback
};
