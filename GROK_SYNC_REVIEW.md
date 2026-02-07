# Data Synchronization System - Expert Code Review Request

## 🎯 Context

This is a multi-tenant POS (Point of Sale) and Kitchen Display System (KDS) application serving coffee shops in Israel. The system operates in an **offline-first architecture** with **three data layers**:

1. **Cloud (Supabase)** - Source of truth, hosted on Supabase Cloud
2. **Docker (Local Supabase)** - Local PostgreSQL replica running in Docker, enables offline operation
3. **Dexie (IndexedDB)** - Browser-based cache for instant UI updates

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUD (Supabase)                         │
│   • Production data store with RLS policies                     │
│   • Multi-tenant isolation via business_id                      │
│   • Real-time subscriptions for live updates                    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Sync via Backend API
                              │ (resolve-conflict, docker-dump)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOCKER (Local Supabase)                       │
│   • Full PostgreSQL replica per location                        │
│   • Enables offline operation when internet is down             │
│   • Syncs to Cloud periodically                                 │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Sync via syncService.js
                              │ (initialLoad, syncTable)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DEXIE (Browser Cache)                        │
│   • IndexedDB-based local storage                               │
│   • Provides instant UI responsiveness                          │
│   • Synced with Docker/Cloud layer                              │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Tables Being Synced

| Table | Type | Notes |
|-------|------|-------|
| businesses | Master | Single-tenant filter |
| menu_items | Master | SKU catalog |
| employees | Master | Staff records |
| customers | Master | Customer database |
| optiongroups | Master | Modifier groups (milk type, size) |
| optionvalues | Master | Modifier values (no business_id, linked via group_id) |
| menuitemoptions | Junction | Links menu items to option groups |
| orders | Historical | **3-day rolling window** |
| order_items | Historical | **3-day rolling window, FK to orders** |
| loyalty_cards | Master | Points cards |
| loyalty_transactions | Historical | **3-day rolling window** |
| prepared_items_inventory | Master | Pre-made inventory |
| recurring_tasks | Master | Daily prep tasks |
| task_completions | Historical | Task completion log |

## 🔧 Key Synchronization Features

### 1. Historical Data Windowing

- Orders, order_items, and loyalty_transactions are synced with a **3-day rolling window**
- Before syncing, Dexie clears ALL historical data to prevent accumulation
- This ensures the local cache stays lean and relevant

### 2. Multi-Tenant Isolation

- All queries are filtered by `business_id`
- RLS (Row Level Security) is enforced on Supabase
- Backend validates `business_id` before any sync operation

### 3. Conflict Resolution

- DatabaseExplorer UI compares counts across all three layers
- Users can choose Cloud or Docker as "source of truth" per table
- resolve-conflict API handles full data transfer with paging (handles >1000 rows)

### 4. Schema Compatibility

- Different layers may have slightly different schemas
- prepared_items_inventory uses `item_id` as primary key (not `id`)
- Code strips incompatible fields when syncing between layers

### 5. Foreign Key Handling

- order_items has FK to orders
- Sync uses batch upsert with row-by-row fallback for FK violations
- This prevents cascading failures on large syncs

---

## 📁 FILE 1: syncService.js (Frontend - Supabase → Dexie Sync)

```javascript
/**
 * Supabase → Dexie Sync Service
 * Handles data synchronization between Supabase (cloud) and Dexie (local)
 * 
 * ⚠️ IMPORTANT: RLS (Row Level Security) is ALWAYS enabled on Supabase!
 * This is a multi-tenant application. If data is not syncing:
 * 1. FIRST check RLS policies in Supabase Dashboard
 * 2. Verify the user's business_id matches the data
 * 3. Check if the auth token is being sent correctly
 */

import { db, sync_meta } from '../db/database';
import { supabase } from '../lib/supabase';
import { syncQueue, getPendingActions } from './offlineQueue';

// Sync configuration
const SYNC_CONFIG = {
    tables: [
        { local: 'businesses', remote: 'businesses' },
        { local: 'menu_items', remote: 'menu_items' },
        { local: 'customers', remote: 'customers' },
        { local: 'employees', remote: 'employees' },
        { local: 'discounts', remote: 'discounts' },
        { local: 'orders', remote: 'orders' },
        { local: 'order_items', remote: 'order_items' },
        { local: 'optiongroups', remote: 'optiongroups' },
        { local: 'optionvalues', remote: 'optionvalues' },
        { local: 'menuitemoptions', remote: 'menuitemoptions' },
        { local: 'loyalty_cards', remote: 'loyalty_cards' },
        { local: 'loyalty_transactions', remote: 'loyalty_transactions' },
        { local: 'recurring_tasks', remote: 'recurring_tasks' },
        { local: 'task_completions', remote: 'task_completions' },
        { local: 'prepared_items_inventory', remote: 'prepared_items_inventory' },
        { local: 'suppliers', remote: 'suppliers' },
        { local: 'inventory_items', remote: 'inventory_items' },
    ],
    batchSize: 1000,
};

export const isOnline = () => navigator.onLine;

/**
 * MIGRATION CHECK:
 * Detects fresh environment and performs HARD RESET of Dexie
 */
export const autoDetectMigrationAndReset = async () => {
    const MIGRATION_KEY = 'kds_local_migration_v3';
    const hasMigrated = localStorage.getItem(MIGRATION_KEY);

    if (!hasMigrated) {
        console.warn('🚀 [Migration] New Environment Detected! Performing Hard Reset...');
        try {
            await db.transaction('rw', db.tables, async () => {
                await Promise.all(db.tables.map(table => table.clear()));
            });
            localStorage.setItem(MIGRATION_KEY, 'true');
            return true;
        } catch (e) {
            console.error('❌ [Migration] Failed:', e);
            return false;
        }
    }
    return false;
};

export const syncTable = async (localTable, remoteTable, filter = null, businessId = null) => {
    if (!isOnline()) {
        return { success: false, reason: 'offline' };
    }

    try {
        // 🛡️ Skip menu_items sync if local data exists (user preference)
        if (localTable === 'menu_items') {
            const count = await db[localTable].count();
            if (count > 0) {
                return { success: true, count, skipped: true };
            }
        }

        // 🧹 WIPE BEFORE SYNC - Ensure perfect mirror
        if (businessId) {
            try {
                const historicalTables = ['orders', 'order_items', 'loyalty_transactions'];
                if (historicalTables.includes(localTable)) {
                    console.log(`🧹 [Sync] CLEARING ALL ${localTable} (3-day window sync)`);
                    await db[localTable].clear();
                } else if (['prepared_items_inventory', 'menuitemoptions', 'optionvalues'].includes(localTable)) {
                    console.log(`🧹 [Sync] Aggressively clearing ${localTable}...`);
                    await db[localTable].clear();
                } else if (db[localTable].schema.indexes.some(idx => idx.name === 'business_id')) {
                    await db[localTable].where('business_id').equals(businessId).delete();
                } else if (localTable === 'businesses') {
                    await db.businesses.where('id').equals(businessId).delete();
                }
            } catch (wipeErr) {
                console.warn(`⚠️ Dexie cleanup failed for ${localTable}:`, wipeErr);
            }
        }

        // --- SPECIAL SYNC LOGIC ---

        // Customers & Loyalty Cards via RPC with pagination
        if ((remoteTable === 'customers' || remoteTable === 'loyalty_cards') && businessId) {
            const rpcName = remoteTable === 'customers' ? 'get_customers_for_sync' : 'get_loyalty_cards_for_sync';
            let allRemoteData = [];
            let rpcPage = 0;
            let hasMoreRpc = true;

            while (hasMoreRpc) {
                const { data, error } = await supabase.rpc(rpcName, { p_business_id: businessId })
                    .range(rpcPage * 1000, (rpcPage + 1) * 1000 - 1);

                if (error || !data || data.length === 0) {
                    hasMoreRpc = false;
                } else {
                    allRemoteData.push(...data);
                    if (data.length < 1000) hasMoreRpc = false;
                    rpcPage++;
                }
            }

            // Fallback to direct query
            if (allRemoteData.length === 0) {
                const { data: fallbackData } = await supabase.from(remoteTable).select('*').eq('business_id', businessId).limit(1000);
                if (fallbackData) allRemoteData = fallbackData;
            }

            if (allRemoteData.length > 0) {
                await db[localTable].bulkPut(allRemoteData.map(r => ({ ...r, business_id: r.business_id || businessId })));
                return { success: true, count: allRemoteData.length };
            }
            return { success: true, count: 0 };
        }

        // Loyalty Transactions - 3 Days ONLY
        if (remoteTable === 'loyalty_transactions' && businessId) {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const isoDate = threeDaysAgo.toISOString();

            let page = 0;
            let hasMore = true;
            let syncedCount = 0;

            while (hasMore) {
                const { data, error } = await supabase
                    .from(remoteTable)
                    .select('*')
                    .eq('business_id', businessId)
                    .gte('created_at', isoDate)
                    .range(page * 1000, (page + 1) * 1000 - 1);

                if (error || !data || data.length === 0) {
                    hasMore = false;
                } else {
                    await db[localTable].bulkPut(data);
                    syncedCount += data.length;
                    if (data.length < 1000) hasMore = false;
                    page++;
                }
            }
            return { success: true, count: syncedCount };
        }

        // Order Items - 3 Days ONLY (FK dependency on orders)
        if (remoteTable === 'order_items' && businessId) {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const isoDate = threeDaysAgo.toISOString();

            let ids = [];
            let orderPage = 0;
            let hasMoreOrders = true;

            // Step 1: Get Order IDs from the last 3 days
            while (hasMoreOrders) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('business_id', businessId)
                    .gte('created_at', isoDate)
                    .range(orderPage * 1000, (orderPage + 1) * 1000 - 1);

                if (error || !data || data.length === 0) {
                    hasMoreOrders = false;
                } else {
                    ids.push(...data.map(o => o.id));
                    if (data.length < 1000) hasMoreOrders = false;
                    orderPage++;
                }
            }

            if (ids.length === 0) {
                return { success: true, count: 0 };
            }

            let syncedCount = 0;

            // BATCH SIZE 100 to avoid URL length limits (PostgREST IN clause)
            for (let i = 0; i < ids.length; i += 100) {
                const batchIds = ids.slice(i, i + 100);
                let hasMoreItems = true;
                let itemPage = 0;

                while (hasMoreItems) {
                    const { data, error } = await supabase
                        .from('order_items')
                        .select('*')
                        .in('order_id', batchIds)
                        .range(itemPage * 1000, (itemPage + 1) * 1000 - 1);

                    if (error) {
                        hasMoreItems = false;
                        continue;
                    }

                    if (data && data.length > 0) {
                        await db[localTable].bulkPut(data);
                        syncedCount += data.length;
                        if (data.length < 1000) hasMoreItems = false;
                        itemPage++;
                    } else {
                        hasMoreItems = false;
                    }
                }
            }
            return { success: true, count: syncedCount };
        }

        // Orders - 3 Days ONLY
        if (remoteTable === 'orders' && businessId) {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const isoDate = threeDaysAgo.toISOString();

            let page = 0;
            let hasMore = true;
            let syncedCount = 0;

            while (hasMore) {
                const { data, error } = await supabase
                    .from(remoteTable)
                    .select('*')
                    .eq('business_id', businessId)
                    .gte('created_at', isoDate)
                    .range(page * SYNC_CONFIG.batchSize, (page + 1) * SYNC_CONFIG.batchSize - 1);

                if (error) throw error;

                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    await db[localTable].bulkPut(data);
                    syncedCount += data.length;
                    if (data.length < SYNC_CONFIG.batchSize) hasMore = false;
                    page++;
                }
            }
            return { success: true, count: syncedCount };
        }

        // Generic sync for other tables...
        // (Standard pagination with business_id filter)
    } catch (error) {
        console.error(`❌ Error syncing ${localTable}:`, error);
        return { success: false, error: error.message };
    }
};
```

---

## 📁 FILE 2: backend_server.js (Node.js Backend - Cloud ↔ Docker Sync)

### /api/admin/resolve-conflict Endpoint

```javascript
// RESOLVE CONFLICT API: Copy data from one source to another
app.post("/api/admin/resolve-conflict", async (req, res) => {
    const { table, source, businessId } = req.body;

    if (!table || !source || !businessId) {
        return res.status(400).json({ error: "Missing table, source, or businessId" });
    }

    console.log(`🔧 [ResolveConflict] ${table}: Using ${source} as source of truth`);

    try {
        const sourceClient = source === 'docker' ? localSupabase : remoteSupabase;
        const targetClient = source === 'docker' ? remoteSupabase : localSupabase;

        if (!sourceClient || !targetClient) {
            return res.status(503).json({ error: "Database clients not available" });
        }

        // Multi-tenant tables that have business_id
        const multiTenantTables = [
            'menu_items', 'orders', 'order_items', 'customers', 'employees',
            'loyalty_cards', 'loyalty_transactions', 'optiongroups', 'discounts',
            'suppliers', 'recurring_tasks', 'task_completions', 'inventory_items'
        ];

        // Step 1: Fetch ALL data from source using paging
        let allSourceData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            let query = sourceClient.from(table).select('*');

            if (table === 'businesses') {
                query = query.eq('id', businessId);
            } else if (multiTenantTables.includes(table)) {
                query = query.eq('business_id', businessId);
            } else if (table === 'optionvalues' || table === 'menuitemoptions') {
                const { data: groups } = await sourceClient.from('optiongroups').select('id').eq('business_id', businessId);
                const groupIds = (groups || []).map(g => g.id);
                if (groupIds.length > 0) {
                    query = query.in('group_id', groupIds);
                } else {
                    hasMore = false;
                    continue;
                }
            } else if (table === 'prepared_items_inventory') {
                const { data: items } = await sourceClient.from('menu_items').select('id').eq('business_id', businessId);
                const itemIds = (items || []).map(i => i.id);
                if (itemIds.length > 0) {
                    query = query.in('item_id', itemIds);
                } else {
                    hasMore = false;
                    continue;
                }
            }

            query = query.range(page * 1000, (page + 1) * 1000 - 1);
            const { data, error: fetchError } = await query;

            if (fetchError) {
                return res.status(500).json({ error: fetchError.message });
            }

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allSourceData = allSourceData.concat(data);
                if (data.length < 1000) hasMore = false;
                else page++;
            }
        }

        const sourceData = allSourceData;

        if (!sourceData || sourceData.length === 0) {
            return res.json({ success: true, synced: 0, message: "No data in source" });
        }

        console.log(`📦 [ResolveConflict] Fetched ${sourceData.length} TOTAL rows from ${source}`);

        // Step 2: Delete existing data in target
        if (table !== 'prepared_items_inventory') {
            let deleteQuery = targetClient.from(table).delete();

            if (table === 'businesses') {
                deleteQuery = deleteQuery.eq('id', businessId);
            } else if (multiTenantTables.includes(table)) {
                deleteQuery = deleteQuery.eq('business_id', businessId);
            } else if (table === 'optionvalues' || table === 'menuitemoptions') {
                const { data: targetGroups } = await targetClient.from('optiongroups').select('id').eq('business_id', businessId);
                const targetGroupIds = (targetGroups || []).map(g => g.id);
                if (targetGroupIds.length > 0) {
                    deleteQuery = deleteQuery.in('group_id', targetGroupIds);
                }
            }

            const { error: deleteError } = await deleteQuery;
            if (deleteError) {
                console.warn(`⚠️ [ResolveConflict] Delete warning for ${table}:`, deleteError.message);
            }
        }

        // Step 3: Upsert source data to target
        let onConflict = 'id';
        if (table === 'prepared_items_inventory') onConflict = 'item_id';
        if (table === 'menuitemoptions') onConflict = 'item_id,group_id';

        // SPECIAL HANDLING FOR order_items: Upsert in batches, ignore FK errors
        if (table === 'order_items') {
            let successful = 0;
            let failed = 0;

            for (let i = 0; i < sourceData.length; i += 50) {
                const batch = sourceData.slice(i, i + 50);
                const { error: batchErr } = await targetClient.from(table).upsert(batch, { onConflict: 'id' });

                if (batchErr) {
                    // Row-by-row fallback for FK violations
                    for (const row of batch) {
                        const { error: rowErr } = await targetClient.from(table).upsert(row, { onConflict: 'id' });
                        if (!rowErr) successful++;
                        else failed++;
                    }
                } else {
                    successful += batch.length;
                }
            }

            return res.json({ success: true, synced: successful, skipped: failed });
        }

        // SPECIAL HANDLING FOR prepared_items_inventory: Uses item_id as PK
        if (table === 'prepared_items_inventory') {
            let successful = 0;
            let failed = 0;
            const targetIsCloud = source === 'docker';

            for (const row of sourceData) {
                // Strip incompatible fields for cloud target
                const payload = {
                    item_id: row.item_id,
                    initial_stock: row.initial_stock,
                    current_stock: row.current_stock,
                    unit: row.unit,
                    last_updated: row.last_updated
                };

                // Only include business_id/id if target is Docker
                if (!targetIsCloud) {
                    if (row.business_id) payload.business_id = row.business_id;
                    if (row.id) payload.id = row.id;
                }

                const { error } = await targetClient.from(table).upsert(payload, {
                    onConflict: 'item_id',
                    ignoreDuplicates: false
                });

                if (!error) successful++;
                else failed++;
            }

            return res.json({ success: true, synced: successful, failed });
        }

        // STANDARD UPSERT for other tables
        const { error: upsertError } = await targetClient.from(table).upsert(sourceData, {
            onConflict: onConflict,
            ignoreDuplicates: false
        });

        if (upsertError) {
            if (upsertError.code === '23503') {
                return res.status(409).json({ error: "Foreign key violation - sync parent records first" });
            }
            return res.status(500).json({ error: upsertError.message });
        }

        res.json({ success: true, synced: sourceData.length });

    } catch (err) {
        console.error(`❌ [ResolveConflict] Exception:`, err);
        res.status(500).json({ error: err.message });
    }
});
```

---

## 📁 FILE 3: DatabaseExplorer.jsx (React Admin UI)

Key features:

- Displays counts for all three layers (Cloud, Docker, Dexie)
- Color-coded status: Green (synced), Yellow (awaiting update), Red (conflict)
- "Conflict Resolution Modal" allows selecting source of truth per table
- "Full Vertical Sync" button wipes all layers and re-syncs from chosen source
- Terminal-style log viewer for sync progress

---

## ❓ Review Questions for Grok

1. **Data Integrity**: Are there any edge cases where data could be lost or duplicated during sync?

2. **Concurrency**: What happens if a user makes changes while a sync is in progress?

3. **Error Recovery**: Is the error handling sufficient? Are there any silent failures?

4. **Performance**: Are there any bottlenecks in the paging/batching logic?

5. **Security**: Is the multi-tenant isolation robust? Any RLS bypass concerns?

6. **Best Practices**: What improvements would you suggest for production readiness?

7. **Schema Divergence**: How would you handle schema differences between Cloud and Docker more elegantly?

---

## 🎯 Expected Output

Please provide:

1. **Overall Score (1-10)** with justification
2. **Critical Issues** that must be fixed
3. **Recommended Improvements** prioritized by impact
4. **Code Quality Assessment** (maintainability, readability, patterns)
5. **Architecture Assessment** (is this the right approach for offline-first?)

Thank you!
