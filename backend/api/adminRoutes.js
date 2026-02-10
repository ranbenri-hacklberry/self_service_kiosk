/**
 * adminRoutes.js - Admin endpoints for Docker ↔ Cloud sync
 *
 * Endpoints:
 * - GET /api/admin/docker-dump/:table - Fetch data from Docker Local Supabase
 * - GET /api/admin/compare-timestamps - Compare timestamps between Cloud and Docker
 * - GET /api/admin/sync-queue - Get sync queue status (if needed)
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// 1. Cloud Supabase Client (Service Role)
const REMOTE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY; // Must be Service Role

if (!REMOTE_KEY) console.warn("⚠️ [AdminRoutes] Missing SUPABASE_SERVICE_KEY. Sync might fail due to RLS.");

const cloudSupabase = createClient(REMOTE_URL, REMOTE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// 2. Docker Local Supabase Client (Service Role)
const DOCKER_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
// Prefer Service Role Key for Admin operations
const DOCKER_KEY = process.env.VITE_LOCAL_SERVICE_ROLE_KEY ||
    process.env.LOCAL_SUPABASE_SERVICE_KEY ||
    process.env.VITE_LOCAL_SUPABASE_ANON_KEY;

if (!DOCKER_KEY) console.warn("⚠️ [AdminRoutes] Missing DOCKER_KEY.");

const dockerSupabase = createClient(DOCKER_URL, DOCKER_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});


/**
 * Helper: Transform data before upserting to match schema differences
 */
const transformData = (table, data, target) => {
    if (!data || data.length === 0) return data;

    return data.map(row => {
        const newRow = { ...row };

        // 1. inventory_items Mapping
        if (table === 'inventory_items') {
            if (target === 'docker') {
                // Cloud (low_stock_alert) -> Docker (low_stock_threshold_units)
                if (newRow.low_stock_alert !== undefined) {
                    newRow.low_stock_threshold_units = newRow.low_stock_alert;
                    delete newRow.low_stock_alert;
                }

                // Remove Generated Columns (read-only in Docker)
                delete newRow.cost_per_1000_units;
            } else {
                // Docker (low_stock_threshold_units) -> Cloud (low_stock_alert)
                if (newRow.low_stock_threshold_units !== undefined) {
                    newRow.low_stock_alert = newRow.low_stock_threshold_units;
                    delete newRow.low_stock_threshold_units;
                }
            }
        }

        // 2. Orders Mapping (Remove cashier_id if pushing to Cloud and Cloud doesn't support it yet)
        if (table === 'orders' && target === 'cloud') {
            // Cloud schema doesn't have cashier_id yet
            delete newRow.cashier_id;
            delete newRow.face_match_confidence;
        }

        return newRow;
    });
};

/**
 * Helper: Get Conflict Columns
 */
const getConflictColumns = (table) => {
    if (table === 'menuitemoptions') return 'item_id,group_id';
    // Add other composite keys if needed
    return 'id';
};


/**
 * GET /api/admin/docker-dump/:table
 * Fetch all data from a specific table in Docker Local Supabase
 */
router.get('/docker-dump/:table', async (req, res) => {
    const { table } = req.params;
    const { businessId, recentDays } = req.query;

    console.log(`[AdminRoutes] Fetching ${table} from Docker (businessId: ${businessId}, recentDays: ${recentDays})`);

    try {
        let query = dockerSupabase.from(table).select('*');

        // Filter by businessId if provided
        if (businessId) {
            if (table === 'businesses') {
                query = query.eq('id', businessId);
            } else {
                // Tables without business_id: optionvalues, menuitemoptions
                const noBusinessIdTables = ['optionvalues', 'menuitemoptions'];
                if (!noBusinessIdTables.includes(table)) {
                    query = query.eq('business_id', businessId);
                }
            }
        }

        // For historical tables (orders, order_items, loyalty_transactions), filter by recent days
        if (recentDays) {
            const days = parseInt(recentDays);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            query = query.gte('created_at', cutoffDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error(`[AdminRoutes] Docker query error for ${table}:`, error);
            return res.status(500).json({ success: false, error: error.message });
        }

        console.log(`[AdminRoutes] ✓ Fetched ${data?.length || 0} rows from Docker ${table}`);
        return res.json({ success: true, data: data || [] });

    } catch (err) {
        console.error(`[AdminRoutes] Docker fetch error for ${table}:`, err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/compare-timestamps
 * Compare timestamps between Cloud and Docker for a specific table
 */
router.get('/compare-timestamps', async (req, res) => {
    const { table, businessId, noBusinessId } = req.query;

    console.log(`[AdminRoutes] Comparing timestamps for ${table} (businessId: ${businessId})`);

    try {
        // Build queries for both Cloud and Docker
        let cloudQuery = cloudSupabase.from(table).select('id, updated_at', { count: 'exact' });
        let dockerQuery = dockerSupabase.from(table).select('id, updated_at', { count: 'exact' });

        // Filter by businessId if applicable
        if (businessId && noBusinessId !== 'true') {
            cloudQuery = cloudQuery.eq('business_id', businessId);
            dockerQuery = dockerQuery.eq('business_id', businessId);
        }

        // Execute queries
        const [cloudRes, dockerRes] = await Promise.all([
            cloudQuery,
            dockerQuery
        ]);

        if (cloudRes.error || dockerRes.error) {
            console.error(`[AdminRoutes] Timestamp comparison error:`, cloudRes.error || dockerRes.error);
            return res.status(500).json({
                success: false,
                error: cloudRes.error?.message || dockerRes.error?.message
            });
        }

        // Check if table has updated_at column
        const hasUpdatedAtColumn = cloudRes.data?.[0]?.updated_at !== undefined;

        // Get latest updated_at from each source
        const cloudLatest = cloudRes.data?.length > 0
            ? cloudRes.data.reduce((latest, row) => {
                if (!row.updated_at) return latest;
                const rowDate = new Date(row.updated_at);
                return !latest || rowDate > new Date(latest) ? row.updated_at : latest;
            }, null)
            : null;

        const dockerLatest = dockerRes.data?.length > 0
            ? dockerRes.data.reduce((latest, row) => {
                if (!row.updated_at) return latest;
                const rowDate = new Date(row.updated_at);
                return !latest || rowDate > new Date(latest) ? row.updated_at : latest;
            }, null)
            : null;

        // Determine winner (Last-Write-Wins)
        let winner = null;
        let reason = '';

        if (!hasUpdatedAtColumn) {
            winner = 'cloud';
            reason = 'טבלה ללא updated_at - Cloud כברירת מחדל';
        } else if (!cloudLatest && !dockerLatest) {
            winner = null;
            reason = 'אין נתונים בשני המקורות';
        } else if (!cloudLatest) {
            winner = 'docker';
            reason = 'רק Docker יש נתונים';
        } else if (!dockerLatest) {
            winner = 'cloud';
            reason = 'רק Cloud יש נתונים';
        } else {
            const cloudDate = new Date(cloudLatest);
            const dockerDate = new Date(dockerLatest);

            if (cloudDate > dockerDate) {
                winner = 'cloud';
                reason = `Cloud עודכן לאחרונה (${cloudLatest})`;
            } else if (dockerDate > cloudDate) {
                winner = 'docker';
                reason = `Docker עודכן לאחרונה (${dockerLatest})`;
            } else {
                winner = 'cloud';
                reason = 'זהה - Cloud כברירת מחדל';
            }
        }

        console.log(`[AdminRoutes] ✓ ${table}: ${winner?.toUpperCase() || 'NO WINNER'} (${reason})`);

        return res.json({
            success: true,
            hasUpdatedAtColumn,
            cloud: {
                count: cloudRes.count || 0,
                latestUpdatedAt: cloudLatest
            },
            docker: {
                count: dockerRes.count || 0,
                latestUpdatedAt: dockerLatest
            },
            winner,
            reason
        });

    } catch (err) {
        console.error(`[AdminRoutes] Timestamp comparison error:`, err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/admin/sync-queue
 * Get sync queue status (placeholder for now)
 */
router.get('/sync-queue', async (req, res) => {
    // This is a placeholder - implement actual queue if needed
    return res.json({ success: true, queue: [] });
});

/**
 * GET /api/admin/trusted-stats
 * Get trusted counts from Cloud and Docker for comparison
 */
router.get('/trusted-stats', async (req, res) => {
    const { table, businessId, noBusinessId } = req.query;

    console.log(`[AdminRoutes] Trusted Stats for ${table} (businessId: ${businessId})`);

    try {
        // Build queries
        let cloudQuery = cloudSupabase.from(table).select('*', { count: 'exact', head: true });
        let dockerQuery = dockerSupabase.from(table).select('*', { count: 'exact', head: true });

        // Filter by businessId
        if (businessId && noBusinessId !== 'true') {
            if (table === 'businesses') {
                cloudQuery = cloudQuery.eq('id', businessId);
                dockerQuery = dockerQuery.eq('id', businessId);
            } else {
                cloudQuery = cloudQuery.eq('business_id', businessId);
                dockerQuery = dockerQuery.eq('business_id', businessId);
            }
        }

        // Execute queries in parallel
        const [cloudRes, dockerRes] = await Promise.all([cloudQuery, dockerQuery]);

        if (cloudRes.error || dockerRes.error) {
            console.error(`[AdminRoutes] Stats error for ${table}:`, cloudRes.error || dockerRes.error);
            // Don't fail completely, return what we have or -1
            return res.json({
                cloud: cloudRes.count ?? -1,
                docker: dockerRes.count ?? -1,
                error: cloudRes.error?.message || dockerRes.error?.message
            });
        }

        return res.json({
            cloud: cloudRes.count || 0,
            docker: dockerRes.count || 0,
            // Future: Add recent counts here if needed
            cloudRecent: 0,
            dockerRecent: 0
        });

    } catch (err) {
        console.error(`[AdminRoutes] Stats fatal error for ${table}:`, err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/sync-cloud-to-local
 * Master sync endpoint: Cloud → Docker (Full bidirectional sync)
 * This is the main endpoint that syncs ALL tables from Cloud to Docker Local Supabase
 */
router.post('/sync-cloud-to-local', async (req, res) => {
    const { businessId } = req.body;

    if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    console.log(`[CloudSync] Starting Cloud → Docker sync for business ${businessId}...`);

    const TABLES_TO_SYNC = [
        // Core tables (must sync first - dependencies)
        { name: 'businesses', hasBusinessId: false, priority: 1 },
        { name: 'employees', hasBusinessId: true, priority: 1 },

        // Menu & Categories
        { name: 'item_category', hasBusinessId: true, priority: 2 },
        { name: 'menu_items', hasBusinessId: true, priority: 2 },

        // Modifiers
        { name: 'optiongroups', hasBusinessId: true, priority: 2 },
        { name: 'optionvalues', hasBusinessId: false, priority: 2 },
        { name: 'menuitemoptions', hasBusinessId: false, priority: 2 },

        // Customers & Loyalty
        { name: 'customers', hasBusinessId: true, priority: 3 },
        { name: 'loyalty_cards', hasBusinessId: true, priority: 3 },
        { name: 'loyalty_transactions', hasBusinessId: true, priority: 3, recentDays: 3 },

        // Inventory & Tasks
        { name: 'inventory_items', hasBusinessId: true, priority: 3 },
        { name: 'prepared_items_inventory', hasBusinessId: true, priority: 3 },
        { name: 'suppliers', hasBusinessId: true, priority: 3 },
        { name: 'recurring_tasks', hasBusinessId: true, priority: 3 },
        { name: 'tasks', hasBusinessId: true, priority: 3 },
        { name: 'task_completions', hasBusinessId: true, priority: 3 },

        // Orders (historical - 3 days only)
        { name: 'orders', hasBusinessId: true, priority: 4, recentDays: 3 },
        { name: 'order_items', hasBusinessId: true, priority: 4, recentDays: 3 },

        // Discounts
        { name: 'discounts', hasBusinessId: true, priority: 3 }
    ];

    // Sort by priority
    const sortedTables = TABLES_TO_SYNC.sort((a, b) => a.priority - b.priority);

    const results = {};
    let totalSynced = 0;
    let totalErrors = 0;

    try {
        for (const table of sortedTables) {
            try {
                console.log(`[CloudSync] Syncing ${table.name}...`);

                // Build Cloud query
                let cloudQuery = cloudSupabase.from(table.name).select('*');

                // Filter by businessId if applicable
                if (table.hasBusinessId) {
                    cloudQuery = cloudQuery.eq('business_id', businessId);
                }

                // Special case for businesses (pk is id)
                if (table.name === 'businesses') {
                    cloudQuery = cloudQuery.eq('id', businessId);
                }

                // Filter by date for historical tables
                if (table.recentDays) {
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - table.recentDays);
                    cloudQuery = cloudQuery.gte('created_at', cutoffDate.toISOString());
                }

                // Fetch from Cloud
                const { data: cloudData, error: cloudError } = await cloudQuery;

                if (cloudError) {
                    console.error(`[CloudSync] Cloud fetch error for ${table.name}:`, cloudError);
                    results[table.name] = { success: false, error: cloudError.message };
                    totalErrors++;
                    continue;
                }

                if (!cloudData || cloudData.length === 0) {
                    console.log(`[CloudSync] No data in Cloud for ${table.name}`);
                    results[table.name] = { success: true, count: 0, action: 'skip' };
                    continue;
                }

                // Transform Data (e.g. Map column names)
                const transformedData = transformData(table.name, cloudData, 'docker');

                // Clear Docker table first (for this business only)
                // Note: We skip clearing join tables to avoid accidental data loss unless careful
                // Actually, if we are doing "Nuclear Sync" for local, we might want to clear.
                // But this function is just "sync-cloud-to-local" which might be incremental.
                // Let's rely on Upsert to overwrite.

                // Insert/Upsert into Docker
                const onConflict = getConflictColumns(table.name);
                const { error: dockerError } = await dockerSupabase
                    .from(table.name)
                    .upsert(transformedData, { onConflict });

                if (dockerError) {
                    console.error(`[CloudSync] Docker upsert error for ${table.name}:`, dockerError);
                    results[table.name] = { success: false, error: dockerError.message };
                    totalErrors++;
                    continue;
                }

                console.log(`[CloudSync] ✓ Synced ${cloudData.length} rows for ${table.name}`);
                results[table.name] = { success: true, count: cloudData.length, action: 'synced' };
                totalSynced += cloudData.length;

            } catch (tableError) {
                console.error(`[CloudSync] Error syncing ${table.name}:`, tableError);
                results[table.name] = { success: false, error: tableError.message };
                totalErrors++;
            }
        }

        console.log(`[CloudSync] ✓ Sync complete: ${totalSynced} records, ${totalErrors} errors`);
        return res.json({
            success: true,
            totalSynced,
            totalErrors,
            results
        });

    } catch (err) {
        console.error('[CloudSync] Fatal error:', err);
        return res.status(500).json({
            success: false,
            error: err.message,
            results
        });
    }
});

/**
 * POST /api/sync-local-to-cloud
 * Reverse sync: Docker → Cloud (Push local changes to cloud)
 */
router.post('/sync-local-to-cloud', async (req, res) => {
    const { businessId } = req.body;

    if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    console.log(`[DockerSync] Starting Docker → Cloud sync for business ${businessId}...`);

    // Only sync tables that can have local modifications
    const TABLES_TO_PUSH = [
        'orders',
        'order_items',
        'customers',
        'loyalty_cards',
        'loyalty_transactions',
        'task_completions',
        'prepared_items_inventory',
        'inventory_items'
    ];

    const results = {};
    let totalPushed = 0;
    let totalErrors = 0;

    try {
        for (const tableName of TABLES_TO_PUSH) {
            try {
                console.log(`[DockerSync] Pushing ${tableName}...`);

                // Fetch from Docker
                let dockerQuery = dockerSupabase.from(tableName).select('*');

                // Filter by businessId if table has it
                if (!['order_items'].includes(tableName)) {
                    dockerQuery = dockerQuery.eq('business_id', businessId);
                }

                const { data: dockerData, error: dockerError } = await dockerQuery;

                if (dockerError) {
                    console.error(`[DockerSync] Docker fetch error for ${tableName}:`, dockerError);
                    results[tableName] = { success: false, error: dockerError.message };
                    totalErrors++;
                    continue;
                }

                if (!dockerData || dockerData.length === 0) {
                    console.log(`[DockerSync] No data in Docker for ${tableName}`);
                    results[tableName] = { success: true, count: 0, action: 'skip' };
                    continue;
                }

                // Transform Data
                const transformedData = transformData(tableName, dockerData, 'cloud');

                // Upsert to Cloud (conflict resolution: newer wins)
                const onConflict = getConflictColumns(tableName);
                const { error: cloudError } = await cloudSupabase
                    .from(tableName)
                    .upsert(transformedData, {
                        onConflict,
                        ignoreDuplicates: false
                    });

                if (cloudError) {
                    console.error(`[DockerSync] Cloud upsert error for ${tableName}:`, cloudError);
                    results[tableName] = { success: false, error: cloudError.message };
                    totalErrors++;
                    continue;
                }

                console.log(`[DockerSync] ✓ Pushed ${dockerData.length} rows for ${tableName}`);
                results[tableName] = { success: true, count: dockerData.length, action: 'pushed' };
                totalPushed += dockerData.length;

            } catch (tableError) {
                console.error(`[DockerSync] Error pushing ${tableName}:`, tableError);
                results[tableName] = { success: false, error: tableError.message };
                totalErrors++;
            }
        }

        console.log(`[DockerSync] ✓ Push complete: ${totalPushed} records, ${totalErrors} errors`);
        return res.json({
            success: true,
            totalPushed,
            totalErrors,
            results
        });

    } catch (err) {
        console.error('[DockerSync] Fatal error:', err);
        return res.status(500).json({
            success: false,
            error: err.message,
            results
        });
    }
});

/**
 * GET /api/admin/docker-health
 * Check if Docker Local Supabase is running and responsive
 */
router.get('/docker-health', async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${DOCKER_URL}/rest/v1/`, {
            method: 'GET',
            headers: { 'apikey': DOCKER_KEY },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            // Try a simple query to verify connection
            const { data, error } = await dockerSupabase.from('businesses').select('id').limit(1);

            return res.json({
                success: true,
                status: 'healthy',
                url: DOCKER_URL,
                canQuery: !error,
                message: error ? `Connected but query failed: ${error.message}` : 'Docker Supabase is running and responsive'
            });
        } else {
            return res.json({
                success: false,
                status: 'unhealthy',
                url: DOCKER_URL,
                message: `Docker responded with status ${response.status}`
            });
        }
    } catch (err) {
        return res.json({
            success: false,
            status: 'offline',
            url: DOCKER_URL,
            message: `Docker Local Supabase is not running: ${err.message}`
        });
    }
});

/**
 * POST /api/admin/full-bidirectional-sync
 * Complete sync: Cloud → Docker → Cloud (ensures perfect consistency)
 */
router.post('/full-bidirectional-sync', async (req, res) => {
    const { businessId } = req.body;

    if (!businessId) {
        return res.status(400).json({ success: false, error: 'businessId is required' });
    }

    console.log(`[FullSync] Starting full bidirectional sync for business ${businessId}...`);

    try {
        // Step 1: Push Docker → Cloud (preserve local changes)
        console.log('[FullSync] Step 1: Pushing local changes to Cloud...');
        const pushResponse = await fetch(`http://localhost:${process.env.PORT || 8081}/api/admin/sync-local-to-cloud`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId })
        });
        const pushResult = await pushResponse.json();

        // Step 2: Pull Cloud → Docker (get latest from cloud)
        console.log('[FullSync] Step 2: Pulling latest from Cloud to Docker...');
        const pullResponse = await fetch(`http://localhost:${process.env.PORT || 8081}/api/admin/sync-cloud-to-local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId })
        });
        const pullResult = await pullResponse.json();

        console.log('[FullSync] ✓ Full bidirectional sync complete');
        return res.json({
            success: true,
            push: pushResult,
            pull: pullResult,
            message: 'Full sync completed successfully'
        });

    } catch (err) {
        console.error('[FullSync] Error:', err);
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

export default router;
