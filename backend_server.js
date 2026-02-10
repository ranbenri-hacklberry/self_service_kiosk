import 'dotenv/config';
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { SerialPort } from 'serialport';
import { uploadBackupToDrive, getLastBackupTime } from './src/services/dbBackupService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`📡 [${req.method}] ${req.path}`);
    next();
});

// Configure multer for file uploads (memory storage)
// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });


// === WHATSAPP & SMS MANAGER (LOCAL) ===
import whatsAppManager from './src/services/whatsappManager.js';

// === MAYA API ROUTES ===
import mayaRoutes from './backend/api/mayaRoutes.js';
import marketingRoutes from './backend/api/marketingRoutes.js';
import adminRoutes from './backend/api/adminRoutes.js';
import { startDockerWatchdog } from './backend/services/dockerWatchdog.js';

app.use('/api/maya', mayaRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/admin', adminRoutes);

// Start Docker Monitoring (Checks every 60s)
startDockerWatchdog(60000);

// 1. WhatsApp Status Check
app.get('/api/whatsapp/status', (req, res) => {
    const instanceName = req.query.instanceName || 'default';
    const status = whatsAppManager.getStatus(instanceName);
    res.json(status);
});

// 2. WhatsApp Connect/QR
app.post('/api/whatsapp/connect', async (req, res) => {
    const { instanceName } = req.body;
    try {
        await whatsAppManager.connectToWhatsApp(instanceName || 'default');
        res.json({ success: true, message: 'Initiating connection...' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. WhatsApp Send Message
app.post('/api/whatsapp/send', async (req, res) => {
    const { to, text, instanceName } = req.body;
    try {
        await whatsAppManager.sendText(instanceName || 'default', to, text);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.5 WhatsApp Logout/Disconnect
app.delete('/api/whatsapp/instance/logout/:instanceName', async (req, res) => {
    const { instanceName } = req.params;
    try {
        const success = await whatsAppManager.disconnect(instanceName || 'default');
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Global SMS Send (using DB Key)
app.post('/api/sms/send', async (req, res) => {
    const { to, text, businessId } = req.body;

    try {
        // Fetch API Key from DB
        const { data: business } = await supabase
            .from('businesses')
            .select('global_sms_api_key, sms_sender_id')
            .eq('id', businessId)
            .single();

        if (!business || !business.global_sms_api_key) {
            return res.status(400).json({ error: 'Missing Global SMS API Key for business' });
        }

        // Send via Global SMS API
        const GLOBAL_SMS_URL = 'https://sapi.itnewsletter.co.il/api/restApiSms/sendSmsToRecipients';

        console.log(`📨 [GlobalSMS] Sending to ${to}...`);

        const response = await fetch(GLOBAL_SMS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ApiKey: business.global_sms_api_key,
                txtOriginator: business.sms_sender_id || '0548317887',
                destinations: to.replace(/\D/g, ''),
                txtSMSmessage: text,
                dteToDeliver: '',
                txtAddInf: ''
            })
        });

        const result = await response.json();

        if (result.success) {
            res.json({ success: true, messageId: result.result || 'ok' });
        } else {
            console.error('❌ Global SMS Provider Error:', result);
            res.status(500).json({ error: result.errDesc || 'Provider error' });
        }

    } catch (err) {
        console.error('❌ SMS Failed:', err);
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});


// === HYBRID SUPABASE SETUP ===
// Standardized Names: LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_KEY
const REMOTE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const LOCAL_URL = process.env.LOCAL_SUPABASE_URL;
const LOCAL_KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY;

let remoteSupabase = null;
let localSupabase = null;
let supabase = null;

// 1. Initialize Remote Client (Always needed for Auth verification)
if (REMOTE_URL && REMOTE_KEY) {
    try {
        remoteSupabase = createClient(REMOTE_URL, REMOTE_KEY);
        console.log(`☁️ Remote Supabase Initialized.`);
    } catch (err) {
        console.error("❌ Failed to initialize Remote Supabase:", err.message);
    }
}

// 2. Initialize Local Client with ACTIVE CHECK
async function initLocalSupabase() {
    if (LOCAL_URL && LOCAL_KEY) {
        try {
            console.log(`🔍 Checking Local Supabase at ${LOCAL_URL}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${LOCAL_URL}/rest/v1/`, {
                method: 'GET',
                headers: { 'apikey': LOCAL_KEY },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                localSupabase = createClient(LOCAL_URL, LOCAL_KEY);
                supabase = localSupabase;
                console.log(`✅ Local Supabase Detected - Running in LOCAL mode.`);
            } else {
                throw new Error(`Response status: ${response.status}`);
            }
        } catch (err) {
            console.log(`ℹ️ Using Remote Supabase Fallback (Local check failed: ${err.message})`);
            supabase = remoteSupabase;
        }
    } else {
        supabase = remoteSupabase;
        console.log("ℹ️ Using Remote Supabase as primary (Local variables missing)");
    }

    if (!supabase) {
        console.error("⚠️ WARNING: No Supabase client available! Server in limited mode.");
    } else {
        console.log("✅ Supabase client ready for operations");
    }
}

// Start initialization
await initLocalSupabase();

// === HYBRID AUTH MIDDLEWARE ===
const hybridAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Step 1: Try to verify with Remote (Cloud) first
        if (remoteSupabase) {
            const { data: { user }, error: authError } = await remoteSupabase.auth.getUser(token);

            if (user && !authError) {
                // User verified on cloud! Sync profile to local if needed
                if (localSupabase) {
                    try {
                        const { data: profile } = await remoteSupabase
                            .from('business_profiles')
                            .select('*')
                            .eq('id', user.id)
                            .single();

                        if (profile) {
                            await localSupabase.from('business_profiles').upsert(profile, { onConflict: 'id' });
                            console.log(`🔄 Synced user profile for ${user.email} to local DB`);
                        }
                    } catch (syncErr) {
                        console.warn('⚠️ Could not sync user profile to local:', syncErr.message);
                    }
                }

                req.user = user;
                req.authSource = 'remote';
                return next();
            }
        }

        // Step 2: Fallback - Check local DB for cached user (offline mode)
        if (localSupabase) {
            // Extract user ID from JWT payload (basic decode, not verify)
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                const userId = payload.sub;

                const { data: localProfile } = await localSupabase
                    .from('business_profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (localProfile) {
                    console.log(`🏠 User ${userId} authenticated from local cache (offline mode)`);
                    req.user = { id: userId, ...localProfile };
                    req.authSource = 'local';
                    return next();
                }
            } catch (decodeErr) {
                // Invalid token format
            }
        }

        return res.status(401).json({ error: 'Authentication failed' });

    } catch (err) {
        console.error('Auth error:', err.message);
        return res.status(500).json({ error: 'Internal auth error' });
    }
};

// Legacy middleware for backward compatibility
const ensureSupabase = (req, res, next) => {
    if (!supabase) {
        return res.status(500).json({ error: "Server Misconfiguration: Missing Supabase Credentials." });
    }
    next();
};

// Global list of tables that MUST be filtered by business_id for security
const MULTI_TENANT_TABLES = [
    'employees', 'menu_items', 'catalog_items', 'inventory_items', 'item_category',
    'customers', 'discounts', 'orders', 'order_items', 'optiongroups',
    'suppliers', 'supplier_orders', 'supplier_order_items', 'loyalty_cards',
    'loyalty_transactions', 'tasks', 'recurring_tasks', 'task_completions',
    'prepared_items_inventory', 'recipes', 'recipe_ingredients', 'business_ai_settings',
    'prep_logs', 'prepared_items_logs', 'inventory_logs'
];

/**
 * SECURITY MIDDLEWARE: Enforce business_id for sensitive sync operations
 * Prevents "leakage" where one business could accidentally (or maliciously) 
 * fetch data from another by omitting the businessId.
 */
const enforceBusinessId = (req, res, next) => {
    const businessId = req.query.businessId || req.body.businessId || req.headers['x-business-id'];
    const table = req.params.table || req.body.table || req.query.table;

    // If it's a multi-tenant table, businessId MUST be provided
    if (table && MULTI_TENANT_TABLES.includes(table) && !businessId) {
        console.error(`🛡️ [Security] Blocked request for ${table} - Missing businessId!`);
        return res.status(400).json({ error: `businessId is required for table ${table}` });
    }

    req.businessId = businessId; // Stick it on the request
    req.table = table;           // Also pass the table name along
    next();
};

/**
 * SHARED HELPER: Build a filtered query for synchronization based on table type
 */
const getSyncQuery = async (client, tableName, businessId, options = { countOnly: false }) => {
    let q = client.from(tableName).select('*', options.countOnly ? { count: 'exact', head: true } : {});

    if (tableName === 'businesses') return q.eq('id', businessId);

    // 1. Tables that might lack business_id and need relationship join
    if (tableName === 'order_items') {
        const { count: hasDirect } = await client.from(tableName).select('*', { count: 'exact', head: true }).eq('business_id', businessId).limit(1);
        if (hasDirect) return q.eq('business_id', businessId);

        // Fallback: Join with orders
        const { data: orders } = await client.from('orders').select('id').eq('business_id', businessId);
        const ids = (orders || []).map(o => o.id);
        return ids.length > 0 ? q.in('order_id', ids) : null;
    }

    if (tableName === 'optionvalues' || tableName === 'menuitemoptions') {
        const { data: groups } = await client.from('optiongroups').select('id').eq('business_id', businessId);
        const groupIds = (groups || []).map(g => g.id);
        return groupIds.length > 0 ? q.in('group_id', groupIds) : null;
    }

    if (tableName === 'prepared_items_inventory') {
        const { data: items } = await client.from('menu_items').select('id').eq('business_id', businessId);
        const itemIds = (items || []).map(i => i.id);
        return itemIds.length > 0 ? q.in('item_id', itemIds) : null;
    }

    // 2. Standard multi-tenant tables
    if (MULTI_TENANT_TABLES.includes(tableName)) {
        return q.eq('business_id', businessId);
    }

    // 3. Global tables
    return q;
};

// ------------------------------------------------------------------
// === SYNC ENGINE: Cloud to Local ===
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// === LOCAL IDENTITY API ===
// ------------------------------------------------------------------
/**
 * Returns the business(es) associated with this local server.
 * Used for auto-discovery and zero-config login in Kiosk mode.
 */
app.get("/api/admin/identity", async (req, res) => {
    try {
        // Business IDs can be provided via .env as a comma-separated list
        const idsString = process.env.LOCAL_BUSINESS_IDS || process.env.VITE_BUSINESS_ID || '';
        const ids = idsString.split(',').map(id => id.trim()).filter(id => id.length > 0);

        if (ids.length === 0) {
            return res.json({ businesses: [], count: 0 });
        }

        // Fetch basic business info for these IDs
        const { data: businesses, error } = await supabase
            .from('businesses')
            .select('id, name, logo_url')
            .in('id', ids);

        if (error) throw error;

        res.json({
            businesses: businesses || [],
            count: businesses?.length || 0,
            machineId: process.env.MACHINE_ID || 'local-server'
        });
    } catch (err) {
        console.error("❌ Identity check failed:", err.message);
        res.status(500).json({ error: err.message });
    }
});

const SYNC_TABLES = [
    { name: 'businesses', key: 'id' },
    { name: 'business_ai_settings', key: 'id' },
    { name: 'employees', key: 'id' },
    { name: 'menu_items', key: 'id' },
    { name: 'catalog_items', key: 'id' },
    { name: 'inventory_items', key: 'id' },
    { name: 'item_category', key: 'id' },
    { name: 'customers', key: 'id' },
    { name: 'discounts', key: 'id' },
    { name: 'orders', key: 'id', limit: 5000 },
    { name: 'order_items', key: 'id', limit: 30000 },
    { name: 'optiongroups', key: 'id' },
    { name: 'optionvalues', key: 'id' },
    { name: 'menuitemoptions', key: ['item_id', 'group_id'] },
    { name: 'suppliers', key: 'id' },
    { name: 'supplier_orders', key: 'id' },
    { name: 'supplier_order_items', key: 'id' },
    { name: 'loyalty_cards', key: 'id' },
    { name: 'loyalty_transactions', key: 'id' },
    { name: 'tasks', key: 'id' },
    { name: 'recurring_tasks', key: 'id' },
    { name: 'task_completions', key: 'id' },
    { name: 'prepared_items_inventory', key: 'item_id' },
    { name: 'recipes', key: 'id' },
    { name: 'recipe_ingredients', key: 'id' },
    { name: 'music_artists', key: 'id' },
    { name: 'music_albums', key: 'id' },
    { name: 'music_songs', key: 'id' },
    { name: 'music_playlists', key: 'id' },
];

// Sync status tracking
let syncStatus = {
    inProgress: false,
    lastSync: null,
    progress: 0,
    currentTable: null,
    error: null
};

app.get("/api/sync/status", (req, res) => {
    res.json({
        ...syncStatus,
        localAvailable: !!localSupabase,
        remoteAvailable: !!remoteSupabase
    });
});

app.get("/api/sync/wellness", async (req, res) => {
    const businessId = req.query.businessId || req.headers['x-business-id'];
    if (!localSupabase) {
        return res.json({ healthy: false, reason: 'local_supabase_not_available', counts: {} });
    }

    try {
        const { count: menuCount } = await localSupabase.from('menu_items').select('*', { count: 'exact', head: true });

        const { data: latestOrder } = await localSupabase
            .from('orders')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // NEW: Count stale active orders (older than 12 hours but still in active state)
        // Note: In Docker/Postgres we use interval syntax or Date comparison
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { count: staleActiveCount } = await localSupabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('order_status', ['new', 'in_progress', 'ready', 'held'])
            .lt('created_at', twelveHoursAgo);

        // NEW: Get oldest active order time
        const { data: oldestOrder } = await localSupabase
            .from('orders')
            .select('created_at')
            .in('order_status', ['new', 'in_progress', 'ready', 'held'])
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        const hasData = (menuCount > 0);
        const isHealthy = hasData && (staleActiveCount || 0) <= 20;

        res.json({
            healthy: isHealthy,
            counts: {
                menu_items: menuCount || 0,
                orders: (await localSupabase.from('orders').select('*', { count: 'exact', head: true })).count || 0,
                stale_active_orders: staleActiveCount || 0
            },
            lastSync: syncStatus.lastSync,
            currentTable: syncStatus.currentTable
        });
    } catch (err) {
        console.error('❌ Cache wellness check failed:', err);
        res.status(500).json({
            healthy: false,
            error: err.message,
            context: 'wellness_check'
        });
    }
});

// ADMIN SECURITY: Simple shared secret for management routes
const ADMIN_SECRET = 'kadense_admin_2026';

// 📡 NOTIFICATION ENDPOINT (Mock for SMS/WhatsApp)
app.post("/api/admin/notify-online", async (req, res) => {
    console.log("📲 [NOTIFICATION] ---------------------------------------------------");
    console.log("📲 [NOTIFICATION] New Local Client Connected & Reset Successfully!");
    console.log("📲 [NOTIFICATION] Timestamp:", new Date().toISOString());
    console.log("📲 [NOTIFICATION] This would be sent via SMS/WhatsApp to Admin.");
    console.log("📲 [NOTIFICATION] ---------------------------------------------------");
    res.json({ success: true, message: "Notification sent" });
});

// 🔄 PURE DOCKER SYNC: Fetch ALL data for a table directly from Docker (bypasses cloud entirely)
app.get("/api/admin/docker-dump/:table", enforceBusinessId, async (req, res) => {
    const { table } = req.params;
    const { recentDays } = req.query;
    const businessId = req.businessId; // Provided by middleware

    if (!localSupabase) return res.status(503).json({ error: "Docker DB not available" });
    if (!table) return res.status(400).json({ error: "Table name required" });

    console.log(`📦 [DockerDump] Fetching ${table} for business ${businessId}...`);

    try {
        let allData = [];
        let page = 0;
        let hasMore = true;

        // Use global list
        const multiTenantTables = MULTI_TENANT_TABLES;

        // Historical tables that should be limited by date
        const historicalTables = ['orders', 'order_items', 'loyalty_transactions'];
        const shouldLimitByDate = historicalTables.includes(table) && recentDays;

        // Calculate date filter if needed
        let fromDate = null;
        if (shouldLimitByDate) {
            fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - parseInt(recentDays));
            console.log(`📅 [DockerDump] Limiting ${table} to after ${fromDate.toISOString()}`);
        }

        while (hasMore) {
            let query = localSupabase.from(table).select('*');

            // --- STRICT BUSINESS FILTERING ---
            if (businessId) {
                if (table === 'businesses') {
                    query = query.eq('id', businessId);
                } else if (table === 'order_items') {
                    // Try direct business_id first, fallback to order join
                    const { count: hasDirect } = await localSupabase.from('order_items').select('*', { count: 'exact', head: true }).eq('business_id', businessId).limit(1);
                    if (hasDirect) {
                        query = query.eq('business_id', businessId);
                    } else {
                        const { data: recentOrders } = await localSupabase.from('orders').select('id').eq('business_id', businessId);
                        const orderIds = (recentOrders || []).map(o => o.id);
                        if (orderIds.length > 0) {
                            query = query.in('order_id', orderIds);
                        } else {
                            return res.json({ success: true, data: [], count: 0 });
                        }
                    }
                } else if (table === 'optionvalues' || table === 'menuitemoptions') {
                    const { data: groups } = await localSupabase.from('optiongroups').select('id').eq('business_id', businessId);
                    const groupIds = (groups || []).map(g => g.id);
                    if (groupIds.length > 0) {
                        query = query.in('group_id', groupIds);
                    } else {
                        return res.json({ success: true, data: [], count: 0 });
                    }
                } else if (multiTenantTables.includes(table)) {
                    query = query.eq('business_id', businessId);
                } else if (table === 'prepared_items_inventory') {
                    const { data: items } = await localSupabase.from('menu_items').select('id').eq('business_id', businessId);
                    const itemIds = (items || []).map(i => i.id);
                    if (itemIds.length > 0) {
                        query = query.in('item_id', itemIds);
                    } else {
                        return res.json({ success: true, data: [], count: 0 });
                    }
                }
            }

            // --- STRICT DATE FILTERING ---
            if (fromDate) {
                if (table === 'orders') {
                    query = query.gte('created_at', fromDate.toISOString());
                } else if (table === 'loyalty_transactions') {
                    query = query.gte('created_at', fromDate.toISOString());
                }
            }

            // --- PAGING ---
            const searchableIdTables = ['orders', 'loyalty_transactions', 'customers', 'employees', 'menu_items', 'order_items', 'loyalty_cards'];
            const hasCreatedAt = ['orders', 'loyalty_transactions', 'order_items', 'task_completions', 'loyalty_cards'].includes(table);

            if (table === 'orders' || table === 'loyalty_transactions' || table === 'order_items') {
                query = query.order('created_at', { ascending: false });
            } else if (table === 'menuitemoptions') {
                query = query.order('item_id', { ascending: true });
            } else if (table === 'optionvalues') {
                query = query.order('group_id', { ascending: true });
            } else if (table === 'prepared_items_inventory') {
                query = query.order('item_id', { ascending: true });
            } else if (searchableIdTables.includes(table)) {
                query = query.order('id', { ascending: false });
            }

            query = query.range(page * 1000, (page + 1) * 1000 - 1);

            const { data, error } = await query;

            if (error) {
                console.error(`❌ [DockerDump] Error:`, error.message);
                return res.status(500).json({ error: error.message });
            }

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                // Final safety: filter by business_id in memory just in case RLS or query failed to apply
                let filtered = data;
                if (businessId && multiTenantTables.includes(table)) {
                    filtered = data.filter(d => d.business_id === businessId);
                }

                allData = allData.concat(filtered);
                if (data.length < 1000) hasMore = false;
                page++;
            }
        }

        // Special handling for order_items: filter by order_ids from recent orders
        if (table === 'order_items' && fromDate && businessId) {
            // Fetch recent order IDs first
            const { data: recentOrders } = await localSupabase
                .from('orders')
                .select('id')
                .eq('business_id', businessId)
                .gte('created_at', fromDate.toISOString());

            const recentOrderIds = new Set((recentOrders || []).map(o => o.id));
            allData = allData.filter(item => recentOrderIds.has(item.order_id));
            console.log(`📅 [DockerDump] Filtered order_items to ${allData.length} (from ${recentOrderIds.size} recent orders)`);
        }

        // Generate IDs for tables that don't have them (Dexie requires 'id' as primary key)
        const tablesNeedingId = ['menuitemoptions', 'optionvalues', 'prepared_items_inventory'];
        if (tablesNeedingId.includes(table)) {
            allData = allData.map((row, idx) => {
                if (!row.id) {
                    // Create a composite ID to ensure uniqueness
                    if (table === 'menuitemoptions') {
                        row.id = `${row.item_id}_${row.group_id}`;
                    } else if (table === 'optionvalues') {
                        row.id = `${row.group_id}_${row.value || idx}`;
                    } else if (table === 'prepared_items_inventory') {
                        row.id = `prep_${row.item_id || idx}`;
                    } else {
                        row.id = `auto_${table}_${idx}`;
                    }
                }
                return row;
            });
            console.log(`🔑 [DockerDump] Generated IDs for ${table}`);
        }

        console.log(`✅ [DockerDump] Returning ${allData.length} rows for ${table}`);
        res.json({ success: true, data: allData, count: allData.length });
    } catch (err) {
        console.error(`❌ [DockerDump] Exception:`, err);
        res.status(500).json({ error: err.message });
    }
});

// RESOLVE CONFLICT API: Copy data from one source to another
app.post("/api/admin/resolve-conflict", enforceBusinessId, async (req, res) => {
    const { table, source } = req.body; // source should stay in body
    const businessId = req.businessId;
    const finalTable = table || req.table;

    if (!finalTable || !source || !businessId) {
        return res.status(400).json({ error: "Missing required parameters (table, source, businessId)" });
    }

    console.log(`🔧 [ResolveConflict] ${finalTable}: Syncing from ${source} for ${businessId}`);

    try {
        const sourceClient = source === 'docker' ? localSupabase : remoteSupabase;
        const targetClient = source === 'docker' ? remoteSupabase : localSupabase;
        const targetName = source === 'docker' ? 'cloud' : 'docker';

        if (!sourceClient || !targetClient) {
            return res.status(503).json({ error: "DB clients not ready" });
        }

        // 1. Fetch filtered data from source
        let allData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const query = await getSyncQuery(sourceClient, finalTable, businessId);
            if (!query) { hasMore = false; continue; }

            const { data, error } = await query.range(page * 1000, (page + 1) * 1000 - 1);
            if (error) throw error;

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allData.push(...data);
                if (data.length < 1000) hasMore = false;
                else page++;
            }
        }

        if (allData.length === 0) {
            console.log(`⚠️ [ResolveConflict] ${finalTable}: No source data found.`);
            return res.json({ success: true, synced: 0, target: targetName, message: "No data found" });
        }

        console.log(`📦 [ResolveConflict] ${finalTable}: Found ${allData.length} source rows.`);

        // 2. Delete target records (filtered)
        const deleteQuery = await getSyncQuery(targetClient, finalTable, businessId);
        if (deleteQuery && finalTable !== 'prepared_items_inventory') {
            const { error: delErr } = await deleteQuery.delete();
            if (delErr) console.warn(`⚠️ [ResolveConflict] ${finalTable}: Delete warning:`, delErr.message);
        }

        // 3. Upsert to target
        let onConflict = 'id';
        if (finalTable === 'prepared_items_inventory') onConflict = 'item_id';
        if (finalTable === 'menuitemoptions') onConflict = 'item_id,group_id';

        const { error: upErr } = await targetClient.from(finalTable).upsert(allData, { onConflict });
        if (upErr) {
            console.warn(`⚠️ [ResolveConflict] ${finalTable}: Bulk upsert failed, retrying granularly:`, upErr.message);
            let successCount = 0;
            let failCount = 0;
            for (const row of allData) {
                const { error: rowErr } = await targetClient.from(finalTable).upsert(row, { onConflict });
                if (!rowErr) successCount++; else failCount++;
            }
            return res.json({ success: true, synced: successCount, failed: failCount, target: targetName, method: 'granular' });
        }

        console.log(`✅ [ResolveConflict] ${finalTable}: Synced ${allData.length} rows.`);
        res.json({ success: true, synced: allData.length, target: targetName });

    } catch (err) {
        console.error(`❌ [ResolveConflict] ${finalTable} Failed:`, err);
        res.status(500).json({ error: err.message });
    }
});

// SYNC QUEUE INSPECTION API
app.get("/api/admin/sync-queue", async (req, res) => {
    try {
        if (!localSupabase) return res.status(503).json({ error: "Local DB unavailable" });

        const { data, error } = await localSupabase
            .from('sync_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("❌ Failed to fetch sync queue:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/admin/sync-queue/retry", async (req, res) => {
    try {
        if (!localSupabase) return res.status(503).json({ error: "Local DB unavailable" });
        const { ids } = req.body;

        if (!ids || !ids.length) return res.status(400).json({ error: "No IDs provided" });

        console.log(`🔄 [SyncQueue] Retrying ${ids.length} items...`);
        const { error } = await localSupabase
            .from('sync_queue')
            .update({ status: 'PENDING', error_message: null })
            .in('id', ids);

        if (error) throw error;

        // Proactively trigger a run
        processSyncQueue().catch(e => console.error("Immediate sync failed:", e));

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 BACKGROUND SYNC WORKER
const processSyncQueue = async () => {
    if (!localSupabase || !remoteSupabase) return;

    // Mutex to avoid parallel runs
    if (global.isProcessingSyncQueue) return;
    global.isProcessingSyncQueue = true;

    try {
        // Fetch up to 100 pending or failed items
        const { data: items, error: fetchError } = await localSupabase
            .from('sync_queue')
            .select('*')
            .or('status.eq.PENDING,status.eq.FAILED')
            .order('created_at', { ascending: true })
            .limit(100);

        if (fetchError) throw fetchError;
        if (!items || items.length === 0) {
            global.isProcessingSyncQueue = false;
            return;
        }

        console.log(`🔄 [SyncWorker] Processing ${items.length} items...`);
        let successCount = 0;
        let failCount = 0;

        for (const item of items) {
            try {
                const action = (item.action || 'UPSERT').toUpperCase();
                let result;

                if (action === 'DELETE') {
                    if (!item.record_id) throw new Error("Missing record_id for DELETE");
                    result = await remoteSupabase.from(item.table_name).delete().eq('id', item.record_id);
                } else {
                    // UPSERT handles both INSERT and UPDATE (PostgRest behavior)
                    if (!item.payload) throw new Error("Missing payload for UPSERT");
                    result = await remoteSupabase.from(item.table_name).upsert(item.payload);
                }

                if (result.error) throw result.error;

                // Success
                await localSupabase.from('sync_queue').update({
                    status: 'DONE', // 'DONE' instead of 'SUCCESS' for consistency with UI
                    sent_at: new Date().toISOString(),
                    error_message: null
                }).eq('id', item.id);
                successCount++;

            } catch (err) {
                console.error(`❌ [SyncWorker] Item ${item.id} (${item.table_name}) failed:`, err.message);
                await localSupabase.from('sync_queue').update({
                    status: 'FAILED',
                    error_message: err.message
                }).eq('id', item.id);
                failCount++;
            }
        }

        console.log(`✅ [SyncWorker] Batch complete. Success: ${successCount}, Failed: ${failCount}`);

        // If we hit the limit, there might be more. Trigger another run shortly.
        if (items.length === 100) {
            setTimeout(processSyncQueue, 1000);
        }

    } catch (e) {
        console.error("❌ [SyncWorker] Fatal worker error:", e.message);
    } finally {
        global.isProcessingSyncQueue = false;
    }
};

// Polling interval: every 30 seconds for higher responsiveness
setInterval(processSyncQueue, 30 * 1000);

// TRUSTED STATS API: Bypass RLS to show true counts in DatabaseExplorer
app.post("/api/admin/purge-docker-table", async (req, res) => {
    const { table } = req.body;
    if (!table) return res.status(400).json({ error: "Table name required" });
    if (!localSupabase) return res.status(503).json({ error: "Local DB not ready" });

    try {
        console.log(`💣 [Nuclear Wipe] Wiping table ${table} in Docker...`);

        // Strategy: Use a filter that is likely to exist and work for mass delete
        // PostgREST requires a filter for DELETE unless configured otherwise.
        let result;

        // Try deleting by 'id' is not null (generic)
        result = await localSupabase.from(table).delete().not('id', 'is', null);

        if (result.error && (result.error.message.includes('id') || result.error.code === '42703')) {
            console.log(`⚠️ [Nuclear Wipe] 'id' column missing for ${table}, trying 'item_id'...`);
            result = await localSupabase.from(table).delete().not('item_id', 'is', null);
        }

        if (result.error && result.error.code === '42703') {
            console.log(`⚠️ [Nuclear Wipe] No standard ID column found, trying 'created_at'...`);
            result = await localSupabase.from(table).delete().not('created_at', 'is', null);
        }

        if (result.error) throw result.error;

        res.json({ success: true, message: `Table ${table} cleared completely` });
    } catch (e) {
        console.error(`❌ [Nuclear Wipe] Failed for ${table}:`, e.message || e);
        res.status(500).json({ error: e.message || "Internal Delete Error" });
    }
});

// TRUSTED STATS API: Bypass RLS to show true counts in DatabaseExplorer
app.all("/api/admin/trusted-stats", enforceBusinessId, async (req, res) => {
    const businessId = req.businessId;
    const table = req.table;

    if (!table || !businessId) return res.status(400).json({ error: "Table and businessId required" });

    const results = { cloud: 0, docker: 0 };

    try {
        // 1. Cloud Count
        if (remoteSupabase) {
            const q = await getSyncQuery(remoteSupabase, table, businessId, { countOnly: true });
            if (q) {
                const { count, error } = await q;
                if (!error) results.cloud = count || 0;
            }
        }

        // 2. Docker Count
        if (localSupabase) {
            const q = await getSyncQuery(localSupabase, table, businessId, { countOnly: true });
            if (q) {
                const { count, error } = await q;
                if (!error) results.docker = count || 0;
                else {
                    // Fallback for Docker
                    const { count: total } = await localSupabase.from(table).select('*', { count: 'exact', head: true });
                    results.docker = total || 0;
                }
            }
        }

        res.json(results);
    } catch (err) {
        console.error(`❌ Stats error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// TIMESTAMP COMPARISON API: Get latest updated_at from both sources for LWW comparison
app.get("/api/admin/compare-timestamps", async (req, res) => {
    const { table, businessId } = req.query;
    if (!table || !businessId) return res.status(400).json({ error: "Table and businessId required" });

    const results = {
        cloud: { latestUpdatedAt: null, count: 0, hasUpdatedAt: false },
        docker: { latestUpdatedAt: null, count: 0, hasUpdatedAt: false }
    };

    const TABLES_WITHOUT_UPDATED_AT = ['menuitemoptions', 'optionvalues', 'task_completions'];
    const hasUpdatedAtColumn = !TABLES_WITHOUT_UPDATED_AT.includes(table);

    console.log(`🕐 [Timestamps] Comparing ${table} for ${businessId}...`);

    try {
        // --- 1. CLOUD ---
        if (remoteSupabase) {
            try {
                const query = await getSyncQuery(remoteSupabase, table, businessId, { countOnly: true });
                if (query) {
                    let finalQuery = query;
                    if (hasUpdatedAtColumn) {
                        finalQuery = finalQuery.order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
                    } else {
                        finalQuery = finalQuery.limit(1);
                    }

                    const { data, count, error } = await finalQuery;
                    if (!error) {
                        results.cloud.count = count || 0;
                        results.cloud.hasUpdatedAt = hasUpdatedAtColumn;
                        if (data && data.length > 0 && data[0].updated_at) results.cloud.latestUpdatedAt = data[0].updated_at;
                    }
                }
            } catch (e) {
                console.warn(`⚠️ Cloud check failed for ${table}:`, e.message);
            }
        }

        // --- 2. DOCKER ---
        if (localSupabase) {
            try {
                const query = await getSyncQuery(localSupabase, table, businessId, { countOnly: true });
                if (query) {
                    let finalQuery = query;
                    if (hasUpdatedAtColumn) {
                        finalQuery = finalQuery.order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
                    } else {
                        finalQuery = finalQuery.limit(1);
                    }

                    const { data, count, error } = await finalQuery;
                    if (!error) {
                        results.docker.count = count || 0;
                        results.docker.hasUpdatedAt = hasUpdatedAtColumn;
                        if (data && data.length > 0 && data[0].updated_at) results.docker.latestUpdatedAt = data[0].updated_at;
                    } else {
                        const { count: total } = await localSupabase.from(table).select('*', { count: 'exact', head: true });
                        results.docker.count = total || 0;
                    }
                }
            } catch (e) {
                console.warn(`⚠️ Docker check failed for ${table}:`, e.message);
            }
        }

        let winner = 'cloud';
        let reason = 'Authoritative default';
        if (results.cloud.count === 0 && results.docker.count > 0) {
            winner = 'docker';
            reason = 'Docker has data, Cloud is empty';
        } else if (hasUpdatedAtColumn && results.cloud.latestUpdatedAt && results.docker.latestUpdatedAt) {
            if (new Date(results.docker.latestUpdatedAt) > new Date(results.cloud.latestUpdatedAt)) {
                winner = 'docker';
                reason = `Docker newer (${results.docker.latestUpdatedAt})`;
            } else {
                reason = `Cloud newer/same (${results.cloud.latestUpdatedAt})`;
            }
        }

        res.json({ ...results, winner, reason });

    } catch (err) {
        console.error(`❌ [Timestamps] Global error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// TABLE METADATA API: Get columns, types, and policies for debugging
app.get("/api/admin/table-metadata", async (req, res) => {
    const { table, target = 'cloud' } = req.query;
    if (!table) return res.status(400).json({ error: "Table name required" });

    const client = target === 'docker' ? localSupabase : remoteSupabase;
    if (!client) return res.status(400).json({ error: `Target ${target} not available` });

    try {
        console.log(`🔍 [Metadata] Fetching ${target} schema for ${table}...`);

        const clientStatus = {
            hasClient: !!client,
            tableRequested: table,
            target
        };

        // 1. Columns and Types
        let columns = [];
        let colError = null;
        try {
            const { data: infoCols, error: err } = await client
                .from('information_schema.columns')
                .select('column_name, data_type, is_nullable, column_default')
                .eq('table_name', table)
                .eq('table_schema', 'public');

            if (err) colError = err.message;
            if (infoCols && infoCols.length > 0) {
                columns = infoCols;
            }
        } catch (e) {
            colError = e.message;
        }

        // Fallback or Enrichment via Sample Row
        let sampleRow = null;
        let sampleError = null;
        try {
            const { data: sample, error: sErr } = await client.from(table).select('*').limit(1);
            if (sErr) sampleError = sErr.message;
            if (sample && sample[0]) {
                sampleRow = sample[0];
                if (columns.length === 0) {
                    columns = Object.keys(sample[0]).map(key => ({
                        column_name: key,
                        data_type: typeof sample[0][key],
                        is_nullable: '?',
                        column_default: '?'
                    }));
                }
            }
        } catch (e) {
            sampleError = e.message;
        }

        // 2. Policies
        let policies = [];
        try {
            const { data: polData } = await client
                .from('pg_policies')
                .select('policyname, cmd, qual')
                .eq('tablename', table);
            policies = polData || [];
        } catch (e) {
            console.warn('Could not fetch policies:', e.message);
        }

        // 3. Foreign Keys
        let relationships = [];
        try {
            const { data: relData } = await client
                .from('information_schema.key_column_usage')
                .select('column_name, constraint_name')
                .eq('table_name', table);
            relationships = relData || [];
        } catch (e) {
            console.warn('Could not fetch relationships:', e.message);
        }

        let totalCount = 0;
        try {
            const { count, error: cErr } = await client.from(table).select('*', { count: 'exact', head: true });
            if (!cErr) totalCount = count || 0;
        } catch (e) {
            console.warn(`Could not get exact count for ${table}:`, e.message);
        }

        res.json({
            table,
            target,
            totalRows: totalCount,
            metadata_source: columns.length > 0 ? (colError ? 'Sample Row Fallback' : 'Database Catalog') : 'Unknown',
            columns,
            policies,
            relationships,
            diagnostics: {
                catalogError: colError,
                sampleError: sampleError,
                hasSample: !!sampleRow,
                clientStatus
            }
        });
    } catch (e) {
        console.error(`❌ [Metadata] Critical Error for ${table}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// === SMS PROXY (No Auth Required for Balance Check to display on Login Screen) ===
app.get("/api/sms/balance", async (req, res) => {
    try {
        const SMS_API_KEY = '5v$YW#4k2Dn@w96306$H#S7cMp@8t$6R';
        const ENDPOINT = 'https://sapi.itnewsletter.co.il/api/restApiSms/getBalance';

        console.log('📨 Checking SMS balance via Proxy...');
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ApiKey: SMS_API_KEY })
        });

        const resultText = await response.text();
        let providerJson;
        try {
            providerJson = JSON.parse(resultText);
        } catch (e) {
            console.warn('Could not parse SMS provider response:', resultText);
            throw new Error('Invalid response from SMS provider');
        }

        if (providerJson.success === false) {
            throw new Error(providerJson.errDesc || 'SMS Provider Error');
        }

        // Return simplified result
        res.json({
            success: true,
            balance: providerJson.result,
            raw: providerJson
        });

    } catch (err) {
        console.error('❌ SMS Balance check failed:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/hardware-snapshot", (req, res) => {
    const scriptPath = path.join(__dirname, 'scripts', 'hardware_telemetry.py');
    exec(`python3 "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Telemetry Error: ${error.message}`);
            // Fallback for demo/basic environments
            return res.json({
                server: "N150_Edge_Node_Simulated",
                local_ip: "192.168.1.150",
                ram: { total_gb: 12.0, available_gb: 8.5, usage_percent: 30 },
                cpu: { usage_percent: 15, cores: 4 }
            });
        }
        try {
            res.json(JSON.parse(stdout));
        } catch (e) {
            res.status(500).json({ error: "Failed to parse telemetry data" });
        }
    });
});

app.post("/api/admin/force-reset-sync", (req, res) => {
    syncStatus.inProgress = false;
    syncStatus.error = null;
    res.json({ message: "Sync status forced to idle" });
});

// Keep old endpoint for backward compatibility during transition
app.post("/api/sync-cloud-to-local", async (req, res) => {
    try {
        console.log("🔍 [Sync Request] Received sync request");

        if (!remoteSupabase) return res.status(400).json({ error: "Remote Supabase not configured" });
        if (!localSupabase) return res.status(400).json({ error: "Local Supabase not running" });

        // PROTECTOR: If sync has been running for more than 5 minutes, assume it's stuck and reset it
        const SYNC_TIMEOUT = 5 * 60 * 1000;
        if (syncStatus.inProgress && syncStatus.startTime && (Date.now() - syncStatus.startTime > SYNC_TIMEOUT)) {
            console.warn("⚠️ [Sync] Previous sync was stuck for > 5 mins. Resetting.");
            syncStatus.inProgress = false;
        }

        if (syncStatus.inProgress) {
            return res.status(409).json({ error: "Sync in progress", progress: syncStatus.progress });
        }

        const { businessId, clearLocal } = req.body;

        if (clearLocal) {
            try {
                await localSupabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await localSupabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            } catch (e) { console.warn('Cleanup failed:', e.message); }
        }

        // Return success immediately
        res.json({ message: "Sync started", estimatedTime: "60s" });

        // Background Process
        (async () => {
            if (syncStatus.inProgress) return;
            syncStatus = {
                inProgress: true,
                lastSync: null,
                progress: 0,
                currentTable: null,
                error: null,
                startTime: Date.now()
            };
            let totalRows = 0;

            // ENSURE CRITICAL ORDER: Items needed as foreign keys must come first
            const sortedTables = [...SYNC_TABLES].sort((a, b) => {
                const priority = {
                    'businesses': 1,
                    'recurring_tasks': 2,
                    'loyalty_cards': 3,
                    'loyalty_transactions': 4,
                    'orders': 5,
                    'order_items': 6,
                    'task_completions': 7
                };
                return (priority[a.name] || 99) - (priority[b.name] || 99);
            });

            try {
                for (let i = 0; i < sortedTables.length; i++) {
                    const tableConfig = sortedTables[i];
                    const tableName = tableConfig.name;
                    // 🛡️ SAFE CLEANUP: Only wipe if explicitly requested (clearLocal) OR only wipe synced data
                    if (businessId && clearLocal) {
                        try {
                            console.log(`🧹 [Sync] SAFE CLEANUP: ${tableName}`);
                            if (tableName === 'businesses') {
                                await localSupabase.from('businesses').delete().eq('id', businessId);
                            } else {
                                // IMPORTANT: Do NOT delete pending_sync records to avoid losing local-only data
                                await localSupabase.from(tableName).delete().eq('business_id', businessId).neq('pending_sync', true);
                            }
                        } catch (wipeErr) {
                            console.warn(`⚠️ [Sync] Cleanup skipped for ${tableName}:`, wipeErr.message);
                        }
                    } else {
                        console.log(`🛡️ [Sync] Incremental Merge for ${tableName} (No Wipe)`);
                    }

                    // 📥 Fetch Logic
                    let allData = [];
                    let hasMore = true;
                    let page = 0;

                    console.log(`📡 [Sync] Fetching ${tableName} for business ${businessId}...`);

                    // SPECIAL: Check if we should use RPC
                    const rpcName = tableName === 'customers' ? 'get_customers_for_sync' :
                        tableName === 'loyalty_cards' ? 'get_loyalty_cards_for_sync' :
                            tableName === 'loyalty_transactions' ? 'get_loyalty_transactions_for_sync' : null;

                    if (rpcName) {
                        console.log(`   - Using Paginated RPC: ${rpcName}`);
                        let rpcPage = 0;
                        let hasMoreRpc = true;
                        while (hasMoreRpc) {
                            const { data, error } = await remoteSupabase.rpc(rpcName, { p_business_id: businessId })
                                .range(rpcPage * 1000, (rpcPage + 1) * 1000 - 1);

                            if (!error && data && data.length > 0) {
                                allData.push(...data);
                                if (data.length < 1000) hasMoreRpc = false;
                                else rpcPage++;
                            } else {
                                hasMoreRpc = false;
                            }
                        }
                        hasMore = false;
                    }

                    // SPECIAL: For order_items, pull MUST paginate through all orders (prevents 1000 row limit)
                    if (tableName === 'order_items' && businessId && hasMore) {
                        try {
                            console.log(`🔍 [Sync] Deep-fetching order_items via ALL cloud orders...`);
                            let cloudOrderIds = [];
                            let orderPage = 0;
                            let hasMoreOrders = true;

                            while (hasMoreOrders) {
                                const { data: orders, error: oErr } = await remoteSupabase.from('orders')
                                    .select('id')
                                    .eq('business_id', businessId)
                                    .range(orderPage * 1000, (orderPage + 1) * 1000 - 1);

                                if (oErr) throw oErr;

                                if (orders && orders.length > 0) {
                                    cloudOrderIds.push(...orders.map(o => o.id));
                                    if (orders.length < 1000) hasMoreOrders = false;
                                    else orderPage++;
                                } else {
                                    hasMoreOrders = false;
                                }
                            }

                            if (cloudOrderIds.length > 0) {
                                console.log(`   - Fetching items for ${cloudOrderIds.length} orders...`);
                                for (let i = 0; i < cloudOrderIds.length; i += 100) {
                                    const batchIds = cloudOrderIds.slice(i, i + 100);
                                    const { data: items, error: iErr } = await remoteSupabase.from('order_items').select('*').in('order_id', batchIds);
                                    if (iErr) {
                                        console.warn(`⚠️ [Sync] Batch fetch for order_items failed at index ${i}:`, iErr.message);
                                        continue;
                                    }
                                    if (items) allData.push(...items);
                                }
                                console.log(`   ✓ [Sync] Successfully fetched ${allData.length} order_items using order_id mapping.`);
                                hasMore = false;
                            } else {
                                console.warn(`⚠️ [Sync] No orders found in cloud for business ${businessId}. Skipping deep-fetch for items.`);
                                // Fallback: try direct fetch if business_id exists on items
                                hasMore = true;
                            }
                        } catch (deepFetchErr) {
                            console.error(`❌ [Sync] Deep-fetch for order_items failed:`, deepFetchErr.message);
                            addLog && addLog(`⚠ Deep-fetch items failed: ${deepFetchErr.message}`, 'warning');
                            // Let it fallback to standard fetch
                            hasMore = true;
                        }
                    }
                    // SPECIAL: For optionvalues / menuitemoptions
                    if ((tableName === 'optionvalues' || tableName === 'menuitemoptions') && businessId && hasMore) {
                        console.log(`🔍 [Sync] Deep-fetching ${tableName} via Option Groups...`);
                        const { data: groups } = await remoteSupabase.from('optiongroups').select('id').eq('business_id', businessId);

                        if (groups && groups.length > 0) {
                            const groupIds = groups.map(g => g.id);
                            for (let i = 0; i < groupIds.length; i += 100) {
                                const batchIds = groupIds.slice(i, i + 100);
                                const { data: items, error } = await remoteSupabase.from(tableName).select('*').in('group_id', batchIds);
                                if (items) allData.push(...items);
                            }
                        }
                        hasMore = false;
                    }

                    while (hasMore) {
                        let query = remoteSupabase.from(tableName).select('*');

                        const multiTenantTables = [
                            'employees', 'menu_items', 'customers', 'orders', 'order_items',
                            'optiongroups', 'suppliers', 'supplier_orders',
                            'supplier_order_items', 'loyalty_cards', 'loyalty_transactions',
                            'tasks', 'recurring_tasks', 'task_completions',
                            'recipes', 'inventory_items', 'business_ai_settings',
                            'discounts', 'item_category'
                        ];

                        if (businessId) {
                            if (tableName === 'businesses') {
                                query = query.eq('id', businessId);
                            } else if (multiTenantTables.includes(tableName)) {
                                query = query.eq('business_id', businessId);
                            }
                        }

                        // Pagination for standard tables
                        query = query.range(page * 1000, (page + 1) * 1000 - 1);

                        const { data, error } = await query;
                        if (error || !data || data.length === 0) {
                            hasMore = false;
                        } else {
                            allData = allData.concat(data);
                            if (data.length < 1000) hasMore = false;
                            page++;
                        }
                    }

                    // Upsert Logic with Last-Write-Wins
                    if (allData.length > 0) {
                        console.log(`📥 [Sync] Processing ${allData.length} rows for local ${tableName}...`);

                        let batch = allData;

                        // 🛠️ DATA ENRICHMENT: Ensure every row has the business_id for local filtering
                        if (businessId && tableName !== 'businesses') {
                            batch = batch.map(row => ({
                                ...row,
                                business_id: row.business_id || businessId
                            }));
                        }

                        // Strip problematic columns
                        if (tableName === 'catalog_items' || tableName === 'inventory_items') {
                            batch = batch.map(item => {
                                const cleaned = { ...item };
                                delete cleaned.default_cost_per_1000_units;
                                delete cleaned.cost_per_1000_units;
                                return cleaned;
                            });
                        }

                        // 🛡️ Fast Bulk Upsert in Batches of 500
                        const onConflict = Array.isArray(tableConfig.key) ? tableConfig.key.join(',') : tableConfig.key;

                        for (let i = 0; i < batch.length; i += 500) {
                            const chunk = batch.slice(i, i + 500);
                            const { error: upsertErr } = await localSupabase.from(tableName).upsert(chunk, { onConflict });

                            if (upsertErr) {
                                console.warn(`⚠️ [Sync] Batch upsert failed for ${tableName} (${upsertErr.message}). Retrying row-by-row...`);
                                // Fallback: Insert rows individually to bypass the one bad row causing FK violation
                                for (const row of chunk) {
                                    const { error: singleErr } = await localSupabase.from(tableName).upsert(row, { onConflict });
                                    if (!singleErr) totalRows++;
                                }
                            } else {
                                totalRows += chunk.length;
                            }
                        }
                    }

                    // 🛠️ SEQUENCE ALIGNMENT: If we just synced orders, update the local sequence to match cloud max
                    if (tableName === 'orders' && allData.length > 0) {
                        try {
                            const maxOrderNum = Math.max(...allData.map(o => o.order_number || 0));
                            if (maxOrderNum > 0) {
                                console.log(`🔄 [Sync] Aligning local order sequence to start after: ${maxOrderNum}`);
                                await localSupabase.rpc('set_order_number_sequence', { next_val: maxOrderNum + 1 });
                            }
                        } catch (seqErr) {
                            console.warn(`⚠️ [Sync] Sequence alignment skipped: ${seqErr.message}`);
                        }
                    }

                    // 🗑️ SMART CLEANUP: Remove local records that shouldn't exist (Junk Data)
                    const CLEANUP_TABLES = ['menuitemoptions', 'optionvalues', 'order_items', 'menu_items', 'optiongroups'];

                    if (CLEANUP_TABLES.includes(tableName) && allData.length > 0) {
                        const primaryKeyOrKeys = tableConfig.key;
                        const isComposite = Array.isArray(primaryKeyOrKeys);

                        // Select the ID columns
                        const selectCols = isComposite ? primaryKeyOrKeys.join(',') : primaryKeyOrKeys;

                        // 1. Get all Local IDs
                        const { data: localRecords } = await localSupabase
                            .from(tableName)
                            .select(selectCols)
                            .eq('business_id', businessId)
                            .neq('pending_sync', true);

                        if (localRecords && localRecords.length > 0) {
                            // Helper to generate unique key string
                            const getRowKey = (row) => {
                                if (isComposite) return primaryKeyOrKeys.map(k => row[k]).join('|');
                                return row[primaryKeyOrKeys];
                            };

                            const cloudKeySet = new Set(allData.map(r => getRowKey(r)));

                            // Find local records NOT in cloud set
                            const toDelete = localRecords.filter(r => !cloudKeySet.has(getRowKey(r)));

                            if (toDelete.length > 0) {
                                console.log(`❌ [Sync] Found ${toDelete.length} junk records in ${tableName}. Deleting...`);

                                // Batch delete
                                // Handle Composite Delete strictly (PostgREST doesn't support .in() for composite tuples easily)
                                if (isComposite) {
                                    // For composite, we have to delete one by one or complex construction.
                                    // To accept a slightly slower cleanup: delete one by one.
                                    console.log('   - Deleting composite key records sequentially (safest)...');
                                    for (const item of toDelete) {
                                        let match = localSupabase.from(tableName).delete();
                                        primaryKeyOrKeys.forEach(k => {
                                            match = match.eq(k, item[k]);
                                        });
                                        await match;
                                    }
                                } else {
                                    // Standard Single Key Delete
                                    const deleteIds = toDelete.map(r => r[primaryKeyOrKeys]);
                                    for (let i = 0; i < deleteIds.length; i += 100) {
                                        const batch = deleteIds.slice(i, i + 100);
                                        await localSupabase.from(tableName).delete().in(primaryKeyOrKeys, batch);
                                    }
                                }
                                console.log(`🧹 [Sync] Junk cleanup complete for ${tableName}`);
                            }
                        }
                    }
                } // End of table loop

                syncStatus.inProgress = false;
                syncStatus.progress = 100;
                syncStatus.lastSync = new Date().toISOString();
                console.log("✅ Sync Finished Successfully. Total rows:", totalRows);

            } catch (bgError) {
                console.error("🔥 Background sync CRASHED:", bgError);
                syncStatus.inProgress = false;
                syncStatus.error = bgError.message;
            }
        })();

    } catch (routeErr) {
        console.error("Sync Route Error:", routeErr);
        if (!res.headersSent) res.status(500).json({ error: routeErr.message });
    }
});

// ------------------------------------------------------------------
// === REAL-TIME SYNC BRIDGE: Cloud -> Docker ===
// ------------------------------------------------------------------
/**
 * This bridge listens for REAL-TIME changes on the Cloud Supabase
 * and immediately reflects them in the Local Docker database.
 * This ensures KDS sees kiosk orders in seconds, not minutes.
 */
const setupRealtimeBridge = () => {
    if (!remoteSupabase || !localSupabase) return;

    console.log("📡 [Bridge] Setting up real-time bidirectional listeners...");

    // 1. CLOUD -> LOCAL (Mainly for Kiosk/Remote orders reaching KDS)
    remoteSupabase
        .channel('cloud-to-local-bridge')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
            console.log("🚀 [Bridge] NEW CLOUD ORDER detected! Syncing to Local...", payload.new.id);
            try {
                const { data: order } = await remoteSupabase.from('orders').select('*, order_items(*)').eq('id', payload.new.id).single();
                if (order) {
                    const { order_items, ...orderData } = order;
                    await localSupabase.from('orders').upsert(orderData);
                    if (order_items && order_items.length > 0) {
                        await localSupabase.from('order_items').upsert(order_items);
                    }
                    console.log(`✅ [Bridge] Cloud Order ${payload.new.order_number} synced to Local.`);
                }
            } catch (err) {
                console.error("❌ [Bridge] Cloud -> Local sync failed:", err.message);
            }
        })
        .subscribe();

    // 2. LOCAL -> CLOUD (Mainly for Tablet/Local orders reaching Management/Cloud backup)
    localSupabase
        .channel('local-to-cloud-bridge')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
            console.log("🚀 [Bridge] NEW LOCAL ORDER detected! Syncing to Cloud...", payload.new.id);
            try {
                const { data: order } = await localSupabase.from('orders').select('*, order_items(*)').eq('id', payload.new.id).single();
                if (order) {
                    const { order_items, ...orderData } = order;
                    await remoteSupabase.from('orders').upsert(orderData);
                    if (order_items && order_items.length > 0) {
                        await remoteSupabase.from('order_items').upsert(order_items);
                    }
                    console.log(`✅ [Bridge] Local Order ${payload.new.order_number} pushed to Cloud.`);
                }
            } catch (err) {
                console.error("❌ [Bridge] Local -> Cloud push failed:", err.message);
            }
        })
        .subscribe();
};

// Start the bridge after a short delay to ensure DBs are connected
setTimeout(setupRealtimeBridge, 5000);

// RAPID POLL: Sync recent orders every 1 minute as a safety net
setInterval(async () => {
    if (!localSupabase || !remoteSupabase) return;

    // We only poll if there's no major sync running
    if (syncStatus.inProgress) return;

    try {
        // Just trigger a light-weight order sync logic here or call the broad endpoint
        // For simplicity, we just log that we are alive. 
        // Real-time handles the speed, polling handles the missed events.
    } catch (e) { }
}, 60 * 1000);

// NEW: Endpoint to archive/complete stale orders
app.post('/api/orders/archive-stale', async (req, res) => {
    const { businessId, olderThanHours = 24, fromStatuses = ['new', 'in_progress', 'ready', 'held', 'pending'] } = req.body;

    if (!localSupabase) return res.status(500).json({ error: 'Local database not available' });

    try {
        const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000)).toISOString();
        console.log(`🧹 Archiving stale orders (older than ${cutoffTime}) for business ${businessId}...`);

        // Step 1: Find them
        const { data: staleOrders, error: findError } = await localSupabase
            .from('orders')
            .select('id')
            .eq('business_id', businessId)
            .in('order_status', fromStatuses)
            .lt('created_at', cutoffTime);

        if (findError) throw findError;

        if (!staleOrders || staleOrders.length === 0) {
            return res.json({ archivedCount: 0, message: 'No stale orders found' });
        }

        const ids = staleOrders.map(o => o.id);

        // Step 2: Archive orders
        const { error: archiveError } = await localSupabase
            .from('orders')
            .update({
                order_status: 'completed',
                updated_at: new Date().toISOString()
            })
            .in('id', ids);

        if (archiveError) throw archiveError;

        // Step 3: Archive items
        await localSupabase
            .from('order_items')
            .update({
                item_status: 'completed',
                updated_at: new Date().toISOString()
            })
            .in('order_id', ids);

        res.json({ success: true, archivedCount: ids.length });
    } catch (err) {
        console.error('❌ Archive stale failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// NEW: Reset sync metadata
app.post('/api/sync/reset-metadata', (req, res) => {
    syncStatus.lastSync = null;
    syncStatus.error = null;
    res.json({ success: true, message: 'Sync metadata reset' });
});

// ------------------------------------------------------------------
// === BACKUP SYSTEM & SCHEDULER ===
// ------------------------------------------------------------------

// 1. Get Backup Status
app.get('/api/admin/backup/status', async (req, res) => {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'Business ID required' });

    try {
        const lastBackup = await getLastBackupTime(businessId);
        res.json({
            success: true,
            lastBackup,
            status: lastBackup ? 'active' : 'never_backed_up'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Trigger Manual/Auto Backup
const performDatabaseBackup = async (businessId) => {
    console.log(`💾 [Backup] Starting backup for ${businessId}...`);

    // Fetch critical data
    const tables = ['orders', 'order_items', 'customers', 'loyalty_cards', 'loyalty_transactions', 'inventory_items'];
    const backupData = {};

    for (const table of tables) {
        const { data } = await localSupabase.from(table).select('*').eq('business_id', businessId);
        if (data) backupData[table] = data;
    }

    // Save to temp file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${businessId}_${timestamp}.json`;
    const tempPath = path.join(__dirname, 'temp_backups');

    if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);
    const filePath = path.join(tempPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    // Upload
    const result = await uploadBackupToDrive(filePath, fileName, businessId);

    // Cleanup
    fs.unlinkSync(filePath);

    return result;
};

app.post('/api/admin/backup/trigger', async (req, res) => {
    const { businessId } = req.body;
    try {
        const result = await performDatabaseBackup(businessId);
        res.json(result);
    } catch (e) {
        console.error('Backup failed:', e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Simple Scheduler (Check every hour)
setInterval(async () => {
    // Only run if localSupabase is active
    if (!localSupabase) return;

    // Hardcoded check for known businesses (in future, fetch from DB)
    // For now, assuming current context business or from env
    // This is a simplified auto-runner placeholder
}, 60 * 60 * 1000);


// 4. Download Local Backup (For Monthly)
app.get('/api/admin/backup/download', async (req, res) => {
    const { businessId } = req.query;
    if (!localSupabase) return res.status(500).json({ error: 'DB not ready' });

    try {
        const tables = ['orders', 'order_items', 'customers', 'loyalty_cards', 'loyalty_transactions', 'supplier_orders'];
        const backupData = {};

        for (const table of tables) {
            const { data } = await localSupabase.from(table).select('*').eq('business_id', businessId);
            if (data) backupData[table] = data;
        }

        const fileName = `monthly_backup_${new Date().toISOString().slice(0, 10)}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(JSON.stringify(backupData, null, 2));

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ------------------------------------------------------------------
// === 1. MENU & CHAT ROUTES ===
// ------------------------------------------------------------------

app.post("/", ensureSupabase, async (req, res) => {
    try {
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'Missing "command" field.' });

        let category = null;
        let item_name = null;
        const lowerCommand = command.toLowerCase();
        if (lowerCommand.includes('משקאות חמים') || lowerCommand.includes('hot drinks')) {
            category = 'חמים';
        } else if (lowerCommand.includes('תפריט') || lowerCommand.includes('menu') || lowerCommand.includes('הכל')) {
            category = null;
        } else {
            const match = lowerCommand.match(/פרטים על (.*)/) || lowerCommand.match(/מה על (.*)/) || lowerCommand.match(/הצג את (.*)/);
            if (match) item_name = match[1].trim();
        }

        let query = supabase.from('menu_items').select('*');
        if (item_name) {
            query = query.ilike('name', `%${item_name}%`);
        } else if (category) {
            query = query.or(`category.ilike.%${category}%, name.ilike.%${category}%`);
        }
        const { data: menuItems, error } = await query;

        if (error) {
            console.error("Supabase Query Error (POST):", error.message);
            return res.status(500).json({ error: "שגיאת בסיס נתונים: " + error.message });
        }

        const data = menuItems || [];
        const response = data.length ? "הנה הפריטים המתאימים:" : "לא נמצאו פריטים.";
        const action = data.length ? "display_table" : "message";
        return res.json({ response, action, data, clarification: data.length ? null : "נסה שאלה אחרת?" });
    } catch (err) {
        console.error("Server Error (POST):", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.put("/item/:id", ensureSupabase, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updates = req.body;
        if (isNaN(id) || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Missing item ID or update data.' });
        }

        const { data, error } = await supabase
            .from('menu_items')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error("Supabase Update Error (PUT):", error.message);
            return res.status(500).json({ error: `שגיאת בסיס נתונים בעדכון: ${error.message}` });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        return res.json({ success: true, updatedItem: data[0] });
    } catch (err) {
        console.error("Server PUT Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// GET /item/:itemId/options - תוקן לעבוד עם שמות הטבלאות החדשים (קטנים)
app.get("/item/:itemId/options", ensureSupabase, async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        if (isNaN(itemId)) return res.status(400).json({ error: "Invalid item ID" });

        // שימוש ב-menuitemoptions (אותיות קטנות)
        const { data: links, error: linksError } = await supabase
            .from("menuitemoptions")
            .select("group_id")
            .eq("item_id", itemId);

        if (linksError) throw linksError;
        if (!links?.length) return res.json([]);

        const groupIds = links.map(l => l.group_id);

        // שימוש ב-optiongroups (אותיות קטנות)
        const { data: groups, error: groupsError } = await supabase
            .from("optiongroups")
            .select("id, name, is_required, is_multiple_select, display_order")
            .in("id", groupIds)
            .order("display_order");

        if (groupsError) throw groupsError;

        // שימוש ב-optionvalues (אותיות קטנות)
        const { data: values, error: valuesError } = await supabase
            .from("optionvalues")
            .select("id, value_name, price_adjustment, display_order, group_id")
            .in("group_id", groupIds);

        if (valuesError) throw valuesError;

        const result = (groups || []).map(g => ({
            id: g.id,
            name: g.name,
            is_required: g.is_required,
            is_multiple_select: g.is_multiple_select,
            display_order: g.display_order,
            values: (values || [])
                .filter(v => v.group_id === g.id)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map(v => ({
                    id: v.id,
                    value_name: v.value_name,
                    price_adjustment: v.price_adjustment || 0,
                    display_order: v.display_order || 0,
                    is_default: false
                }))
        }));

        res.json(result);
    } catch (err) {
        console.error("Options error:", err.message || err);
        res.status(500).json({ error: "Failed to load options" });
    }
});

// ------------------------------------------------------------------
// === 2. OPTIONS CRUD (תוקן לטבלאות קטנות) ===
// ------------------------------------------------------------------
app.post("/options/group", ensureSupabase, async (req, res) => {
    try {
        const newGroup = req.body;
        const { data, error } = await supabase
            .from('optiongroups') // תוקן
            .insert(newGroup)
            .select();

        if (error) {
            return res.status(400).json({ error: `שגיאה ביצירת קבוצה: ${error.message}` });
        }

        return res.status(201).json(data[0]);
    } catch (err) {
        console.error("Server POST Group Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.delete("/options/group/:groupId", ensureSupabase, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId, 10);
        // תמיכה ב-UUID אם המזהה לא מספר
        const isUUID = isNaN(groupId);
        const queryId = isUUID ? req.params.groupId : groupId;

        const { error } = await supabase
            .from('optiongroups') // תוקן
            .delete()
            .eq('id', queryId);

        if (error) {
            return res.status(400).json({ error: `שגיאה במחיקה: ${error.message}` });
        }

        return res.json({ success: true, message: 'קבוצה נמחקה בהצלחה.' });
    } catch (err) {
        console.error("Server DELETE Group Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 3. INVENTORY & DIRECT ORDERS ===
// ------------------------------------------------------------------
app.get("/inventory", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/orders", ensureSupabase, async (req, res) => {
    try {
        const newOrder = req.body;
        const { data, error } = await supabase.from('orders').insert(newOrder).select();
        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/orders/:id", ensureSupabase, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updates = req.body;
        const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// === 4. TASKS & KITCHEN LOGIC ===
// ------------------------------------------------------------------
app.post("/tasks", ensureSupabase, async (req, res) => {
    const { description, category, due_date, instructions, menu_item_id, preparation_quantity, quantity_unit, recipe_ingredients } = req.body;
    let taskId = null;
    let recipeId = null;
    try {
        const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .insert([{ description, category, due_date }])
            .select();
        if (taskError) {
            console.error("Task Insert Error:", taskError.message);
            return res.status(400).json({ error: `שגיאה ביצירת משימה: ${taskError.message}` });
        }
        taskId = taskData[0].id;

        if (instructions && menu_item_id) {
            const { data: recipeData, error: recipeError } = await supabase
                .from('recipes')
                .insert([{
                    task_id: taskId,
                    menu_item_id: menu_item_id,
                    instructions: instructions,
                    preparation_quantity: preparation_quantity || 0,
                    quantity_unit: quantity_unit
                }])
                .select();
            if (recipeError) {
                console.error("Recipe Insert Error:", recipeError.message);
                await supabase.from('tasks').delete().eq('id', taskId);
                return res.status(400).json({
                    error: `שגיאה ביצירת המתכון. ייתכן ש-menu_item_id אינו חוקי או שקיים כשל ב-FK: ${recipeError.message}`
                });
            }
            if (recipeData && recipeData.length > 0) {
                recipeId = recipeData[0].id;
            }
        }

        if (recipeId && recipe_ingredients && Array.isArray(recipe_ingredients) && recipe_ingredients.length > 0) {
            const ingredientsToInsert = recipe_ingredients
                .filter(item => item.inventory_item_id)
                .map(item => ({
                    recipe_id: recipeId,
                    inventory_item_id: item.inventory_item_id,
                    quantity_used: item.quantity_used || 0,
                    unit: item.unit || ''
                }));

            if (ingredientsToInsert.length > 0) {
                const { error: recipeIngredientsError } = await supabase
                    .from('recipe_ingredients')
                    .insert(ingredientsToInsert);

                if (recipeIngredientsError) {
                    console.error("Recipe Ingredients Insert Error:", recipeIngredientsError.message);
                }
            }
        }

        return res.status(201).json({ ...taskData[0], recipe_id: recipeId });

    } catch (err) {
        console.error("Server POST Task Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.get("/tasks", ensureSupabase, async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
				*,
				recipe:recipes!left(
					id,
					menu_item_id,
					instructions,
					preparation_quantity,
					quantity_unit
				)
			`)
            .order('due_date', { ascending: true });
        if (error) {
            console.error("Tasks Fetch Error:", error.message);
            return res.status(500).json({ error: `שגיאת בסיס נתונים בשליפת משימות: ${error.message}` });
        }
        const cleanedTasks = tasks.map(task => ({
            ...task,
            recipe: task.recipe.length > 0 ? task.recipe[0] : null
        }));
        return res.json(cleanedTasks || []);
    } catch (err) {
        console.error("Server GET Tasks Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.put("/tasks/:id/complete", ensureSupabase, async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const { ingredient_updates, skip_ingredient_deduction } = req.body;
    try {
        const { data: taskData, error: fetchTaskError } = await supabase
            .from('tasks')
            .select('id, status')
            .eq('id', taskId)
            .single();
        if (fetchTaskError || !taskData) {
            return res.status(404).json({ error: "Task not found." });
        }
        if (taskData.status !== 'Pending') {
            return res.status(400).json({ error: `Task ID ${taskId} is already marked as ${taskData.status}. Cannot complete again.` });
        }
        const { data: recipeData } = await supabase
            .from('recipes')
            .select(`id, menu_item_id, preparation_quantity, quantity_unit`)
            .eq('task_id', taskId);
        const recipe = recipeData && recipeData.length > 0 ? recipeData[0] : null;

        await supabase
            .from('tasks')
            .update({ status: 'Done' })
            .eq('id', taskId);

        let inventoryUpdateSuccess = false;
        let ingredientProcessStatus = 'No Recipe Found';

        if (recipe && recipe.menu_item_id && recipe.preparation_quantity > 0) {
            const { menu_item_id, preparation_quantity, quantity_unit } = recipe;
            const { error: upsertError } = await supabase
                .from('prepared_items_inventory')
                .upsert({
                    item_id: menu_item_id,
                    initial_stock: preparation_quantity,
                    current_stock: preparation_quantity,
                    unit: quantity_unit,
                    last_updated: new Date().toISOString()
                }, { onConflict: 'item_id', ignoreDuplicates: false });
            if (!upsertError) {
                inventoryUpdateSuccess = true;
                ingredientProcessStatus = 'None';
            } else {
                console.error("Inventory Upsert Error:", upsertError.message);
            }
        }

        if (skip_ingredient_deduction) {
            ingredientProcessStatus = 'Skipped by User';
        } else if (ingredient_updates && Array.isArray(ingredient_updates) && ingredient_updates.length > 0) {
            for (const update of ingredient_updates) {
                if (update.inventory_item_id && update.new_stock_amount !== undefined) {
                    await supabase
                        .from('ingredients')
                        .update({ current_stock: update.new_stock_amount })
                        .eq('id', update.inventory_item_id);
                }
            }
            ingredientProcessStatus = 'Manual Update Applied';
        } else if (recipe && recipe.id) {
            const { data: ingredientsData } = await supabase
                .from('recipe_ingredients')
                .select(`inventory_item_id, quantity_used`)
                .eq('recipe_id', recipe.id);

            if (ingredientsData && ingredientsData.length > 0) {
                const preparation_quantity = recipe.preparation_quantity || 0;
                for (const material of ingredientsData) {
                    const totalConsumption = preparation_quantity * material.quantity_used;
                    await supabase.rpc('deduct_ingredient_stock', {
                        material_id_in: material.inventory_item_id,
                        deduction_amount_in: totalConsumption
                    });
                }
                ingredientProcessStatus = 'Automatic Deduction Applied';
            } else {
                ingredientProcessStatus = 'Recipe Found, No Ingredients to Deduct';
            }
        }

        return res.status(200).json({
            message: "Task completed and inventory processed.",
            taskId: taskId,
            inventoryUpdated: inventoryUpdateSuccess,
            ingredientProcessStatus: ingredientProcessStatus
        });
    } catch (err) {
        console.error("Server Complete Task Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.get("/prep_tasks", ensureSupabase, async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
				id,
				description,
				category,
				status,
				due_date,
				created_at,
				recipe:recipes!left(
					id,
					menu_item_id,
					instructions,
					preparation_quantity,
					quantity_unit,
					recipe_ingredients!left(
						inventory_item_id,
						quantity_used,
						unit,
						ingredient:ingredients(name)
					)
				)
			`)
            .eq('status', 'Pending')
            .order('due_date', { ascending: true });
        if (error) {
            console.error("Prep Tasks Fetch Error:", error.message);
            return res.status(500).json({ error: `שגיאת בסיס נתונים בשליפת משימות הכנה: ${error.message}` });
        }
        const cleanedTasks = tasks.map(task => ({
            ...task,
            recipe: task.recipe.length > 0 ? {
                ...task.recipe[0],
                recipe_ingredients: task.recipe[0].recipe_ingredients.map(ri => ({
                    ...ri,
                    ingredient_name: ri.ingredient ? ri.ingredient.name : 'Unknown'
                }))
            } : null
        }));
        return res.json(cleanedTasks || []);
    } catch (err) {
        console.error("Server GET Prep Tasks Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 7. API ROUTE: SUBMIT ORDER (FINAL VERSION - SEPARATE FIELDS) ===
// ------------------------------------------------------------------
app.post("/submit-order", ensureSupabase, async (req, res) => {
    try {
        const {
            p_customer_phone,
            p_customer_name,
            p_items,
            p_is_paid,
            p_customer_id,
            p_payment_method,
            p_refund,
            edit_mode,
            order_id,
            original_total,
            is_refund,
            p_cancelled_items
        } = req.body;

        console.log(`Processing order. Items: ${p_items?.length || 0}, Cancelled: ${p_cancelled_items?.length || 0}`);

        // פונקציית עזר לבדיקת UUID
        const isUUID = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

        // 1. הכנת פריטים: פיצול מוחלט בין עדכון להוספה
        const orderItems = p_items.map((item) => {
            const rawId = item.menu_item_id || item.item_id || item.id || item.menuItemId;
            const idString = String(rawId);

            // שדות נפרדים!
            let orderItemUUID = null;
            let menuItemIdInt = null;

            if (isUUID(idString)) {
                orderItemUUID = idString; // זהו עדכון פריט קיים
            } else {
                menuItemIdInt = parseInt(idString, 10); // זוהי הוספה חדשה
            }

            // נרמול מודים - תומך בכל הפורמטים של הפרונט
            const modsData = item.selectedOptions || item.selected_options || item.mods || [];

            return {
                order_item_id: orderItemUUID, // יהיה מלא רק בעדכון
                menu_item_id: menuItemIdInt,  // יהיה מלא רק בהוספה
                quantity: Number(item.quantity) || 1,
                mods: modsData,
                notes: item.notes || null,
                item_id: menuItemIdInt // Ensure compatibility with SQL which expects item_id
            };
        });

        const payload = {
            p_customer_phone,
            p_customer_name,
            p_items: orderItems, // המערך המתוקן עם השדות הנפרדים
            p_is_paid,
            p_customer_id: p_customer_id || null,
            p_payment_method: p_payment_method || null,
            p_refund: p_refund || false,
            edit_mode: edit_mode || false,
            order_id: order_id || null,
            original_total: original_total || null,
            is_refund: is_refund || false,
            p_cancelled_items: p_cancelled_items || [],
            p_final_total: req.body.p_final_total || null
        };

        const { data, error } = await supabase.rpc('submit_order_v2', payload);

        if (error) {
            console.error("Supabase RPC submit_order Error:", error.message);
            return res.status(400).json({ error: `שגיאה בעיבוד ההזמנה (SQL): ${error.message}` });
        }

        // --- Transaction Logging Logic ---
        // If there's a payment or refund involved, log it to order_transactions
        const transactionAmount = req.body.transaction_amount;

        if (transactionAmount && transactionAmount !== 0) {
            const transactionType = transactionAmount > 0 ? 'charge' : 'refund';
            const orderIdToLog = data?.order_id || order_id; // Use returned ID for new orders, or passed ID for edits

            if (orderIdToLog) {
                const { error: txError } = await supabase
                    .from('order_transactions')
                    .insert({
                        order_id: orderIdToLog,
                        amount: transactionAmount,
                        type: transactionType,
                        payment_method: p_payment_method || 'cash',
                        external_reference: null // Can be added later if needed
                    });

                if (txError) {
                    console.error("Failed to log transaction:", txError.message);
                    // We don't fail the request here, as the order itself was successful
                } else {
                    console.log(`✅ Transaction logged: ${transactionType} ${transactionAmount} for order ${orderIdToLog}`);
                }
            }
        }
        // ---------------------------------

        return res.status(200).json({
            message: "Order processed successfully",
            data: data
        });

    } catch (err) {
        console.error("Server Submit Order Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 8. API ROUTE: MENU ITEMS (Simple GET) ===
// ------------------------------------------------------------------
app.get("/menu-items", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error("Menu items fetch error:", error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json({ data: data || [] });
    } catch (err) {
        console.error("Server GET Menu Items Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 9. API ROUTE: LOYALTY ===
// ------------------------------------------------------------------
app.get("/loyalty", ensureSupabase, async (req, res) => {
    try {
        const { customerId } = req.query;
        if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

        const { data, error } = await supabase
            .from('customers')
            .select('loyalty_coffee_count')
            .eq('id', customerId)
            .single();

        if (error) return res.status(500).json({ error: error.message });

        res.status(200).json({ count: data?.loyalty_coffee_count ?? 0 });
    } catch (err) {
        console.error("Server GET Loyalty Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

app.post("/loyalty", ensureSupabase, async (req, res) => {
    try {
        const { customerId, orderId } = req.body;
        if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

        // Get current loyalty count
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('loyalty_coffee_count')
            .eq('id', customerId)
            .single();

        if (customerError) return res.status(500).json({ error: customerError.message });

        // Count coffee items in this order
        let coffeeCount = 0;
        if (orderId) {
            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('menu_item_id, quantity, menu_items(is_hot_drink, category)')
                .eq('order_id', orderId);

            if (!itemsError && orderItems) {
                orderItems.forEach(item => {
                    const menuItem = item.menu_items;
                    if (menuItem?.is_hot_drink) {
                        coffeeCount += item.quantity || 1;
                    }
                });
            }
        }

        // Default to 1 if no items found (fallback)
        if (coffeeCount === 0) coffeeCount = 1;

        const currentCount = customerData?.loyalty_coffee_count ?? 0;

        // Calculate free items earned
        const totalAfterPurchase = currentCount + coffeeCount;
        const freeItemsEarned = Math.floor(totalAfterPurchase / 10) - Math.floor(currentCount / 10);
        const isFree = freeItemsEarned > 0;

        // Only count PAID coffees
        const paidCoffeesCount = coffeeCount - freeItemsEarned;

        // CORRECT LOGIC: Reset based on TOTAL items processed
        const persistedCount = (currentCount + coffeeCount) % 10;

        const { error: updateError } = await supabase
            .from('customers')
            .update({ loyalty_coffee_count: persistedCount })
            .eq('id', customerId);

        if (updateError) return res.status(500).json({ error: updateError.message });

        res.status(200).json({
            success: true,
            newCount: persistedCount,
            isFree,
            displayedCount: persistedCount,
            coffeeCountAdded: paidCoffeesCount,
            freeItemsEarned
        });
    } catch (err) {
        console.error("Server POST Loyalty Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 10. API ROUTE: IMAGE GENERATION (AI) ===
// ------------------------------------------------------------------
app.post("/generate-image", ensureSupabase, async (req, res) => {
    try {
        const { prompt, style } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

        console.log(`🎨 Generating image for: "${prompt}" (Style: ${style})`);

        // Enhance prompt based on style
        let enhancedPrompt = prompt;
        if (style === 'realistic') enhancedPrompt += ", hyper realistic, 8k resolution, professional food photography, appetizing";
        if (style === 'appetizing') enhancedPrompt += ", delicious, mouth watering, golden lighting, detailed texture, 4k";
        if (style === 'studio') enhancedPrompt += ", studio lighting, white background, clean composition, product photography";
        if (style === 'artistic') enhancedPrompt += ", artistic style, painting, vibrant colors, creative";

        // Use Pollinations.ai for instant, free AI image generation (no key required for demo)
        // This validates the frontend flow immediately.
        // For production using Google Imagen, we would use vertex-ai or similar.
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologin=true`;

        // We return the URL directly. The frontend can display it.
        // Note: Pollinations generates on the fly.

        return res.json({
            success: true,
            imageUrl: imageUrl
        });

    } catch (err) {
        console.error("Server Generate Image Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 11. API ROUTE: CUSTOMER IDENTIFY AND GREET ===
// ------------------------------------------------------------------
app.post("/customers/identify-and-greet", ensureSupabase, async (req, res) => {
    try {
        const { phoneNumber, customerName } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Phone number is required.' });
        }

        // 1. Call Postgres Upsert RPC
        const { data, error } = await supabase.rpc('upsert_customer', {
            p_phone_number: phoneNumber,
            p_name: customerName || null
        });

        if (error) {
            console.error('Database RPC Error:', error);
            return res.status(500).json({ success: false, error: 'DB error', errorDetails: error.message });
        }

        const customer = data && data[0] ? data[0] : null;
        if (!customer) {
            return res.status(500).json({ success: false, error: 'Customer not returned' });
        }

        // Update name if provided and different
        if (customerName && customerName.trim()) {
            const { error: updateError } = await supabase
                .from('customers')
                .update({ name: customerName.trim() })
                .eq('phone_number', phoneNumber);

            if (!updateError) {
                customer.customer_name = customerName.trim();
            } else {
                console.error("Failed to update customer name:", updateError);
            }
        }

        return res.status(200).json({
            success: true,
            isNewCustomer: !customer.customer_name || customer.customer_name === '',
            customer: {
                id: customer.customer_id,
                name: customer.customer_name || 'אורח',
                phone: customer.phone,
                loyalty_coffee_count: customer.loyalty_coffee_count || 0
            }
        });

    } catch (err) {
        console.error("Server Identify-And-Greet Error:", err);
        res.status(500).json({ success: false, error: `Internal Server Error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 12. MUSIC API ROUTES ===
// ------------------------------------------------------------------

// Stream audio file from disk
app.get("/music/stream", (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path || '');

        if (!filePath) {
            return res.status(400).json({ error: 'Missing path parameter' });
        }

        // Security: Prevent directory traversal
        if (filePath.includes('..')) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        // For demo purposes, try to serve from project public/music directory first
        let actualPath = filePath;
        const projectMusicPath = path.join(process.cwd(), 'public', 'music', path.basename(filePath));

        if (fs.existsSync(projectMusicPath)) {
            actualPath = projectMusicPath;
        } else if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Determine content type based on extension
        const ext = path.extname(actualPath).toLowerCase();
        const contentTypes = {
            '.mp3': 'audio/mpeg',
            '.flac': 'audio/flac',
            '.m4a': 'audio/mp4',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg'
        };
        const contentType = contentTypes[ext] || 'audio/mpeg';

        const stat = fs.statSync(actualPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Support range requests for seeking
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(actualPath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            });
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
            });
            fs.createReadStream(actualPath).pipe(res);
        }
    } catch (err) {
        console.error('Music stream error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Scan directory for music files.
// By default it returns the parsed data. If `saveToDb: true` is provided, it ALSO tries to upsert into Supabase (requires service key).
app.post("/music/scan", async (req, res) => {
    try {
        const { path: dirPath, saveToDb = false, forceClean = false } = req.body || {};

        if (!dirPath) {
            return res.status(400).json({ error: 'Missing path parameter' });
        }

        // Expand ~ to home directory
        const expandedPath = dirPath.replace(/^~/, process.env.HOME || '/Users');

        if (!fs.existsSync(expandedPath)) {
            return res.status(404).json({
                success: false,
                message: `הנתיב לא נמצא: ${expandedPath}`
            });
        }

        console.log(`🎵 Scanning music directory: ${expandedPath}`);

        const artists = [];
        const albums = [];
        const songs = [];

        const artistSet = new Set();

        // Helper to check if it's an audio file
        const isAudioFile = (name) => {
            const ext = name.toLowerCase();
            return ext.endsWith('.mp3') || ext.endsWith('.flac') || ext.endsWith('.m4a') || ext.endsWith('.wav');
        };

        // Helper to get file extension
        const getExt = (name) => path.extname(name).toLowerCase();

        // Helper to parse "Artist - Album" format
        const parseArtistAlbum = (folderName) => {
            // Try to split by " - " (with spaces around dash)
            const parts = folderName.split(' - ');
            if (parts.length >= 2) {
                const artistName = parts[0].trim();
                const albumName = parts.slice(1).join(' - ').trim()
                    .replace(/\s*\([^)]*\)\s*/g, ' ')  // Remove (year)
                    .replace(/\s*\[[^\]]*\]\s*/g, ' ') // Remove [tags]
                    .replace(/\s+/g, ' ')
                    .trim();
                return { artistName, albumName };
            }
            return { artistName: 'Unknown', albumName: folderName };
        };

        // Scan function
        const scanDirectory = (dir, parentArtist = null, parentAlbum = null, depth = 0) => {
            if (depth > 4) return;

            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch (err) {
                console.log(`Cannot read directory: ${dir}`);
                return;
            }

            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (depth === 0) {
                        // Top level: could be "Artist - Album" format
                        const parsed = parseArtistAlbum(entry.name);

                        // Add artist if new
                        if (!artistSet.has(parsed.artistName)) {
                            artistSet.add(parsed.artistName);
                            artists.push({
                                name: parsed.artistName,
                                folder_path: null
                            });
                        }

                        // Look for cover image
                        const coverFiles = ['cover.jpg', 'cover.png', 'folder.jpg', 'folder.png', 'album.jpg', 'Cover.jpg', 'Cover.png'];
                        let coverPath = null;
                        // Also check for any .jpg or .png in the folder
                        try {
                            const albumContents = fs.readdirSync(fullPath);
                            for (const file of albumContents) {
                                if (coverFiles.includes(file)) {
                                    coverPath = path.join(fullPath, file);
                                    break;
                                }
                                // Fallback: any image file
                                if (!coverPath && (file.endsWith('.jpg') || file.endsWith('.png')) && !file.startsWith('.')) {
                                    coverPath = path.join(fullPath, file);
                                }
                            }
                        } catch (e) { }

                        const album = {
                            name: parsed.albumName,
                            artist_name: parsed.artistName,
                            folder_path: fullPath,
                            cover_path: coverPath
                        };
                        albums.push(album);

                        // Scan subdirectories (CD 1, CD 2, etc.)
                        scanDirectory(fullPath, parsed.artistName, album, depth + 1);
                    } else {
                        // Subdirectory (like CD 1, CD 2) - continue scanning
                        scanDirectory(fullPath, parentArtist, parentAlbum, depth + 1);
                    }
                } else if (isAudioFile(entry.name)) {
                    // Audio file
                    const trackMatch = entry.name.match(/^(\d+)/);
                    const trackNumber = trackMatch ? parseInt(trackMatch[1], 10) : 0;

                    const ext = getExt(entry.name);
                    let title = entry.name
                        .replace(/\.(mp3|flac|m4a|wav)$/i, '')
                        .replace(/^[\d\.\-\s]+/, '')
                        .trim();

                    const song = {
                        title: title || entry.name.replace(/\.[^.]+$/, ''),
                        file_path: fullPath,
                        file_name: entry.name,
                        track_number: trackNumber,
                        artist_name: parentArtist || 'Unknown',
                        album_name: parentAlbum?.name || null
                    };
                    songs.push(song);
                }
            }
        };

        scanDirectory(expandedPath);

        console.log(`✅ Scan complete: ${artists.length} artists, ${albums.length} albums, ${songs.length} songs`);

        let saved = null;
        if (saveToDb) {
            console.log('🎯 Starting saveToDb process...');
            if (!supabase) {
                console.error("⚠️ Cannot save scan results - missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
                // Still return scan results so UI can show library immediately
                return res.json({
                    success: true,
                    message: `הסריקה הושלמה בהצלחה! (לא נשמר למסד נתונים - שרת לא מוגדר)`,
                    stats: {
                        artists: artists.length,
                        albums: albums.length,
                        songs: songs.length
                    },
                    saved: null,
                    data: {
                        artists,
                        albums,
                        songs
                    }
                });
            }

            console.log('💾 Saving music scan results to Supabase...');

            if (forceClean) {
                console.log('🗑️ forceClean enabled - deleting existing music library data...');
                // Delete in FK-safe order
                await supabase.from('music_songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('music_albums').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('music_artists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            }

            // 1) Artists
            const artistRows = artists.map(a => ({ name: a.name, folder_path: a.folder_path || null }));
            console.log(`💾 Inserting ${artistRows.length} artists...`);
            if (artistRows.length > 0) {
                // First try upsert, if fails try insert ignore
                let artistUpsertError = null;
                try {
                    const { error } = await supabase
                        .from('music_artists')
                        .upsert(artistRows, { onConflict: 'name', ignoreDuplicates: false });
                    artistUpsertError = error;
                } catch (e) {
                    console.log('Upsert failed, trying insert...');
                }

                if (artistUpsertError) {
                    console.log('Trying individual inserts...');
                    for (const artist of artistRows) {
                        try {
                            const { error } = await supabase
                                .from('music_artists')
                                .insert(artist);
                            if (error && !error.message?.includes('duplicate key')) {
                                console.error('❌ Artist insert error:', error);
                            }
                        } catch (e) {
                            // Ignore duplicate key errors
                        }
                    }
                    console.log('✅ Artists processed');
                } else {
                    console.log('✅ Artists upserted successfully');
                }
            }

            const { data: allArtists, error: allArtistsError } = await supabase
                .from('music_artists')
                .select('id, name');
            if (allArtistsError) {
                console.error('Failed to fetch artists for mapping:', allArtistsError);
            }
            const artistMap = {};
            (allArtists || []).forEach(a => { artistMap[a.name] = a.id; });

            // 2) Albums
            const albumRows = albums
                .filter(a => artistMap[a.artist_name])
                .map(a => ({
                    name: a.name,
                    artist_id: artistMap[a.artist_name],
                    folder_path: a.folder_path || null,
                    cover_url: a.cover_path || null
                }));

            console.log(`💾 Inserting ${albumRows.length} albums...`);
            if (albumRows.length > 0) {
                // Try upsert first, then individual inserts
                let albumUpsertError = null;
                try {
                    const { error } = await supabase
                        .from('music_albums')
                        .upsert(albumRows, { onConflict: 'name,artist_id', ignoreDuplicates: false });
                    albumUpsertError = error;
                } catch (e) {
                    console.log('Upsert failed, trying individual inserts...');
                }

                if (albumUpsertError) {
                    console.log('Trying individual album inserts...');
                    for (const album of albumRows) {
                        try {
                            const { error } = await supabase
                                .from('music_albums')
                                .insert(album);
                            if (error && !error.message?.includes('duplicate key')) {
                                console.error('❌ Album insert error:', error);
                            }
                        } catch (e) {
                            // Ignore duplicate key errors
                        }
                    }
                    console.log('✅ Albums processed');
                } else {
                    console.log('✅ Albums upserted successfully');
                }
            }

            const { data: allAlbums, error: allAlbumsError } = await supabase
                .from('music_albums')
                .select('id, name, artist_id');
            if (allAlbumsError) {
                console.error('Failed to fetch albums for mapping:', allAlbumsError);
            }

            const reverseArtistMap = {};
            Object.keys(artistMap).forEach(name => { reverseArtistMap[artistMap[name]] = name; });
            const albumMap = {};
            (allAlbums || []).forEach(a => {
                const artistName = reverseArtistMap[a.artist_id];
                if (artistName) {
                    albumMap[`${artistName}/${a.name}`] = a.id;
                }
            });

            // 3) Songs (chunked)
            const CHUNK_SIZE = 200;
            let savedSongs = 0;
            console.log(`💾 Upserting ${songs.length} songs in chunks of ${CHUNK_SIZE}...`);

            for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
                const chunk = songs.slice(i, i + CHUNK_SIZE);
                const rows = chunk
                    .filter(s => artistMap[s.artist_name])
                    .map(s => ({
                        title: s.title,
                        file_path: s.file_path,
                        file_name: s.file_name,
                        track_number: s.track_number,
                        artist_id: artistMap[s.artist_name],
                        album_id: s.album_name ? (albumMap[`${s.artist_name}/${s.album_name}`] || null) : null
                    }));

                if (rows.length === 0) continue;

                console.log(`💾 Inserting chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${rows.length} songs)...`);
                // Try upsert first, then individual inserts
                let songUpsertError = null;
                try {
                    const { error } = await supabase
                        .from('music_songs')
                        .upsert(rows, { onConflict: 'file_path', ignoreDuplicates: false });
                    songUpsertError = error;
                } catch (e) {
                    console.log('Upsert failed for songs, trying individual inserts...');
                }

                if (songUpsertError) {
                    console.log('Trying individual song inserts...');
                    for (const song of rows) {
                        try {
                            const { error } = await supabase
                                .from('music_songs')
                                .insert(song);
                            if (error && !error.message?.includes('duplicate key')) {
                                console.error('❌ Song insert error:', error);
                            } else {
                                savedSongs++;
                            }
                        } catch (e) {
                            // Ignore duplicate key errors
                            savedSongs++;
                        }
                    }
                    console.log(`✅ Chunk processed: ${savedSongs}/${songs.length} songs`);
                } else {
                    savedSongs += rows.length;
                    console.log(`✅ Chunk saved: ${savedSongs}/${songs.length} songs`);
                }
            }

            saved = {
                artists: Object.keys(artistMap).length,
                albums: Object.keys(albumMap).length,
                songs: savedSongs
            };

            console.log('✅ Saved scan results:', saved);
        }

        res.json({
            success: true,
            message: `הסריקה הושלמה בהצלחה!`,
            stats: {
                artists: artists.length,
                albums: albums.length,
                songs: songs.length
            },
            saved,
            data: {
                artists,
                albums,
                songs
            }
        });

    } catch (err) {
        console.error('Music scan error:', err);
        res.status(500).json({
            success: false,
            message: `שגיאה בסריקה: ${err.message}`
        });
    }
});

// ------------------------------------------------------------------
// MUSIC LIBRARY (DB) ROUTES - bypass RLS by using backend service key
// ------------------------------------------------------------------
app.get("/music/library/artists", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('music_artists')
            .select('*')
            .order('name');
        if (error) throw error;
        res.json({ success: true, artists: data || [] });
    } catch (err) {
        console.error('Error fetching artists (library):', err);
        res.status(500).json({ success: false, message: err.message, artists: [] });
    }
});

app.get("/music/library/albums", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('music_albums')
            .select(`
                *,
                artist:music_artists(id, name, image_url)
            `)
            .order('name');
        if (error) throw error;
        res.json({ success: true, albums: data || [] });
    } catch (err) {
        console.error('Error fetching albums (library):', err);
        res.status(500).json({ success: false, message: err.message, albums: [] });
    }
});

app.get("/music/library/albums/:albumId/songs", ensureSupabase, async (req, res) => {
    try {
        const { albumId } = req.params;
        const { data, error } = await supabase
            .from('music_songs')
            .select(`
                *,
                album:music_albums(id, name, cover_url),
                artist:music_artists(id, name)
            `)
            .eq('album_id', albumId)
            .order('track_number', { ascending: true });
        if (error) throw error;
        res.json({ success: true, songs: data || [] });
    } catch (err) {
        console.error('Error fetching album songs (library):', err);
        res.status(500).json({ success: false, message: err.message, songs: [] });
    }
});

app.get("/music/library/playlists", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('music_playlists')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, playlists: data || [] });
    } catch (err) {
        console.error('Error fetching playlists (library):', err);
        res.status(500).json({ success: false, message: err.message, playlists: [] });
    }
});

app.get("/music/library/playlists/:playlistId/songs", ensureSupabase, async (req, res) => {
    try {
        const { playlistId } = req.params;
        const { data, error } = await supabase
            .from('music_playlist_songs')
            .select(`
                id,
                position,
                song:music_songs(
                    *,
                    album:music_albums(id, name, cover_url),
                    artist:music_artists(id, name)
                )
            `)
            .eq('playlist_id', playlistId)
            .order('position', { ascending: true });
        if (error) throw error;

        const songs = (data || []).map(r => ({
            ...(r.song || {}),
            playlist_entry_id: r.id,
            position: r.position
        }));

        res.json({ success: true, songs });
    } catch (err) {
        console.error('Error fetching playlist songs (library):', err);
        res.status(500).json({ success: false, message: err.message, songs: [] });
    }
});

// Ratings map for current employee (like/dislike)
app.post("/music/library/ratings", ensureSupabase, async (req, res) => {
    try {
        const { employeeId, songIds } = req.body || {};
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Missing employeeId', ratings: [] });
        }

        let query = supabase
            .from('music_ratings')
            .select('song_id, rating, skip_count')
            .eq('employee_id', employeeId);

        if (Array.isArray(songIds) && songIds.length > 0) {
            query = query.in('song_id', songIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, ratings: data || [] });
    } catch (err) {
        console.error('Error fetching ratings map:', err);
        res.status(500).json({ success: false, message: err.message, ratings: [] });
    }
});

// Favorites (liked songs)
app.get("/music/library/favorites", ensureSupabase, async (req, res) => {
    try {
        const employeeId = req.query.employeeId;
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Missing employeeId', songs: [] });
        }

        const { data, error } = await supabase
            .from('music_ratings')
            .select(`
                song:music_songs(
                    *,
                    album:music_albums(id, name, cover_url),
                    artist:music_artists(id, name)
                )
            `)
            .eq('employee_id', employeeId)
            .eq('rating', 5);

        if (error) throw error;

        const songs = (data || [])
            .map(r => r.song)
            .filter(Boolean)
            .map(s => ({ ...s, myRating: 5 }));

        res.json({ success: true, songs });
    } catch (err) {
        console.error('Error fetching favorites:', err);
        res.status(500).json({ success: false, message: err.message, songs: [] });
    }
});

// Smart playlist (auto) - excludes disliked songs for this employee
app.post("/music/smart-playlist", ensureSupabase, async (req, res) => {
    try {
        const {
            name = 'פלייליסט חכם',
            artistIds = null,
            maxSongs = 100,
            saveToDb = true,
            employeeId,
            businessId
        } = req.body || {};

        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Missing employeeId' });
        }

        // 1) Disliked song ids
        const { data: dislikedRows, error: dislikedError } = await supabase
            .from('music_ratings')
            .select('song_id')
            .eq('employee_id', employeeId)
            .eq('rating', 1);

        if (dislikedError) throw dislikedError;
        const dislikedIds = new Set((dislikedRows || []).map(r => r.song_id));

        // 2) Songs query
        let songsQuery = supabase
            .from('music_songs')
            .select(`
                *,
                album:music_albums(id, name, cover_url),
                artist:music_artists(id, name)
            `);

        if (Array.isArray(artistIds) && artistIds.length > 0) {
            songsQuery = songsQuery.in('artist_id', artistIds);
        }

        const { data: songsRaw, error: songsError } = await songsQuery;
        if (songsError) throw songsError;

        let songs = (songsRaw || []).filter(s => !dislikedIds.has(s.id));

        // shuffle
        songs = songs.sort(() => Math.random() - 0.5).slice(0, maxSongs);

        if (songs.length === 0) {
            return res.json({ success: false, message: 'אין שירים זמינים (אולי סומנו כלא אהבתי)' });
        }

        if (!saveToDb) {
            return res.json({ success: true, playlist: { name, songs }, message: `נוצר פלייליסט עם ${songs.length} שירים` });
        }

        // 3) Create playlist
        const { data: playlist, error: playlistError } = await supabase
            .from('music_playlists')
            .insert({
                name,
                is_auto_generated: true,
                filter_artists: artistIds,
                business_id: businessId || null,
                created_by: employeeId
            })
            .select()
            .single();

        if (playlistError) throw playlistError;

        const playlistSongs = songs.map((song, idx) => ({
            playlist_id: playlist.id,
            song_id: song.id,
            position: idx
        }));

        const { error: addSongsError } = await supabase
            .from('music_playlist_songs')
            .insert(playlistSongs);
        if (addSongsError) throw addSongsError;

        res.json({
            success: true,
            playlist: { ...playlist, songs },
            message: `נוצר פלייליסט עם ${songs.length} שירים`
        });
    } catch (err) {
        console.error('Error creating smart playlist:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Like / Dislike (rating)
app.post("/music/rate", ensureSupabase, async (req, res) => {
    try {
        const { songId, employeeId, rating, businessId } = req.body || {};
        console.log('🎵 /music/rate called:', { songId, employeeId, rating, businessId });

        if (!songId || !employeeId) {
            return res.status(400).json({ success: false, message: 'Missing songId or employeeId' });
        }
        if (![0, 1, 5].includes(rating)) {
            return res.status(400).json({ success: false, message: 'Invalid rating (must be 0, 1 or 5)' });
        }

        // If rating is 0, delete the record
        if (rating === 0) {
            console.log('🗑️ Removing rating for song:', songId);
            const { error: deleteError } = await supabase
                .from('music_ratings')
                .delete()
                .eq('song_id', songId)
                .eq('employee_id', employeeId);

            if (deleteError) throw deleteError;
            console.log('✅ Rating removed successfully');
            return res.json({ success: true });
        }

        // Try upsert, if fails because of missing constraint, try manual flow
        try {
            const { error } = await supabase
                .from('music_ratings')
                .upsert({
                    song_id: songId,
                    employee_id: employeeId,
                    rating,
                    business_id: businessId || null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'song_id,employee_id', ignoreDuplicates: false });

            if (!error) {
                console.log('✅ Rating saved via upsert');
                return res.json({ success: true });
            }

            if (error.code !== '42P10') { // 42P10 is missing unique constraint
                throw error;
            }

            console.log('⚠️ Missing unique constraint for upsert, trying manual update/insert...');
        } catch (e) {
            console.log('⚠️ Upsert failed, falling back to manual update/insert...');
        }

        // Fallback: Manual check then update or insert
        const { data: existing } = await supabase
            .from('music_ratings')
            .select('id')
            .eq('song_id', songId)
            .eq('employee_id', employeeId)
            .maybeSingle();

        if (existing) {
            const { error: updateError } = await supabase
                .from('music_ratings')
                .update({
                    rating,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updateError) throw updateError;
            console.log('✅ Rating updated manually');
        } else {
            const { error: insertError } = await supabase
                .from('music_ratings')
                .insert({
                    song_id: songId,
                    employee_id: employeeId,
                    rating,
                    business_id: businessId || null
                });

            if (insertError) throw insertError;
            console.log('✅ Rating inserted manually');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error rating song:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get album cover image
app.get("/music/cover", (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path || '');

        if (!filePath || filePath.includes('..') || !fs.existsSync(filePath)) {
            return res.status(404).send('Not found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List available volumes/drives
app.get("/music/volumes", (req, res) => {
    try {
        const volumesPath = '/Volumes';
        const volumes = [];

        if (fs.existsSync(volumesPath)) {
            const entries = fs.readdirSync(volumesPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory() || entry.isSymbolicLink()) {
                    const fullPath = path.join(volumesPath, entry.name);
                    volumes.push({
                        name: entry.name,
                        path: fullPath
                    });
                }
            }
        }

        // Also add common paths
        const homePath = process.env.HOME || '/Users';
        const musicPath = path.join(homePath, 'Music');

        if (fs.existsSync(musicPath)) {
            volumes.push({
                name: 'מוזיקה מקומית',
                path: musicPath
            });
        }

        res.json({ volumes });
    } catch (err) {
        console.error('Error listing volumes:', err);
        res.json({ volumes: [] });
    }
});

// Import DriveSync using dynamic import since it's an ES module (assuming package.json type="module", otherwise require)
// import DriveSync from './src/lib/driveSync.js';

// ------------------------------------------------------------------
// === E2E TEST AUTOMATION ===
// ------------------------------------------------------------------
let e2eProcess = null;

app.post("/api/run-e2e", (req, res) => {
    if (e2eProcess) {
        return res.status(409).json({ error: "E2E Test already running" });
    }

    const scriptPath = path.join(process.cwd(), 'tests', 'e2e-live.test.cjs');

    console.log('🚀 Triggering E2E Test...');

    // Safety timeout: if it doesn't finish in 3 minutes, kill it
    const timeout = setTimeout(() => {
        if (e2eProcess) {
            console.log('⚠️ E2E Test timed out. Killing process.');
            e2eProcess.kill();
            e2eProcess = null;
        }
    }, 180000);

    try {
        e2eProcess = exec(`node "${scriptPath}"`, {
            cwd: process.cwd(),
            env: { ...process.env, BASE_URL: `http://localhost:${PORT}` }
        }, (error, stdout, stderr) => {
            clearTimeout(timeout);
            e2eProcess = null;
            if (error) {
                console.error(`❌ E2E process finished with error: ${error.message}`);
            } else {
                console.log('🏁 E2E Test finished successfully.');
            }
        });

        res.json({ message: "E2E Test started" });
    } catch (err) {
        clearTimeout(timeout);
        e2eProcess = null;
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/e2e/reset", (req, res) => {
    if (e2eProcess) {
        e2eProcess.kill();
        e2eProcess = null;
        return res.json({ message: "E2E process killed and status reset" });
    }
    res.json({ message: "No E2E process was running" });
});

app.get("/api/e2e/status", (req, res) => {
    res.json({ running: !!e2eProcess });
});

app.post("/api/music/sync-drive", async (req, res) => {
    res.status(501).json({ error: "Sync not implemented" });
});

// ------------------------------------------------------------------
const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// ------------------------------------------------------------------
// === 8. AI ONBOARDING: LIVE GENERATION (COMFYUI BRIDGE) ===
// ------------------------------------------------------------------
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

const COMFYUI_URL = 'http://127.0.0.1:8188';
const ONBOARDING_OUTPUT_DIR = path.resolve(__dirname, 'public/assets/generated');

if (!fs.existsSync(ONBOARDING_OUTPUT_DIR)) {
    fs.mkdirSync(ONBOARDING_OUTPUT_DIR, { recursive: true });
}

// Active generation jobs to allow cancellation
let activeJobs = new Map();
// Temporarily store items for generation to avoid URL length limits
let pendingGenerationData = new Map();

app.post('/api/onboarding/prepare-generate', (req, res) => {
    const { businessId, items } = req.body;
    if (!businessId || !items) {
        return res.status(400).json({ error: 'Missing businessId or items' });
    }
    const jobId = randomUUID();
    pendingGenerationData.set(jobId, { businessId, items, createdAt: Date.now() });

    // Auto-cleanup stale data after 10 minutes
    setTimeout(() => {
        pendingGenerationData.delete(jobId);
    }, 10 * 60 * 1000);

    res.json({ jobId });
});

app.get('/api/onboarding/generate', async (req, res) => {
    const { jobId } = req.query;
    if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId' });
    }

    const jobData = pendingGenerationData.get(jobId);
    if (!jobData) {
        return res.status(404).json({ error: 'Generation data not found or expired' });
    }

    const { businessId, items } = jobData;
    // Remove from map now that we have the data
    pendingGenerationData.delete(jobId);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = randomUUID();
    activeJobs.set(businessId, { clientId, cancelled: false });

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        console.log(`🚀 Starting Live Generation for Business: ${businessId}`);
        sendEvent({ type: 'start', total: items.length });

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Check for cancellation
            const job = activeJobs.get(businessId);
            if (!job || job.cancelled) {
                console.log(`🛑 Generation cancelled for ${businessId}`);
                sendEvent({ type: 'cancelled', message: 'User stopped generation' });
                break;
            }

            console.log(`🎨 [${i + 1}/${items.length}] Generating: ${item.name}`);
            sendEvent({ type: 'progress', index: i, item: item.name, status: 'generating' });

            const seed = Math.floor(Math.random() * 1000000000);

            // COMFYUI WORKFLOW (SIMPLIFIED & LOW RES)
            const workflow = {
                "3": {
                    "inputs": {
                        "seed": seed,
                        "steps": 20, // Faster steps
                        "cfg": 7,
                        "sampler_name": "dpmpp_2m",
                        "scheduler": "karras",
                        "denoise": 1,
                        "model": ["4", 0],
                        "positive": ["6", 0],
                        "negative": ["7", 0],
                        "latent_image": ["5", 0]
                    },
                    "class_type": "KSampler"
                },
                "4": {
                    "inputs": { "ckpt_name": "dreamshaper_8.safetensors" },
                    "class_type": "CheckpointLoaderSimple"
                },
                "5": {
                    "inputs": {
                        "width": 512, // LOW RES FOR SPEED
                        "height": 512,
                        "batch_size": 1
                    },
                    "class_type": "EmptyLatentImage"
                },
                "6": {
                    "inputs": {
                        "text": item.prompt,
                        "clip": ["4", 1]
                    },
                    "class_type": "CLIPTextEncode"
                },
                "7": {
                    "inputs": {
                        "text": item.negativePrompt || "text, watermark, logo, blurry, low quality, distorted, bad hands, mutated, people, hands",
                        "clip": ["4", 1]
                    },
                    "class_type": "CLIPTextEncode"
                },
                "8": {
                    "inputs": {
                        "samples": ["3", 0],
                        "vae": ["4", 2]
                    },
                    "class_type": "VAEDecode"
                },
                "9": {
                    "inputs": {
                        "filename_prefix": `onboarding_${businessId}_${item.id}`,
                        "images": ["8", 0]
                    },
                    "class_type": "SaveImage"
                }
            };

            // Queue Prompt
            const promptResp = await fetch(`${COMFYUI_URL}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: workflow, client_id: clientId })
            });

            if (!promptResp.ok) throw new Error('Failed to queue prompt');
            const { prompt_id } = await promptResp.json();

            // Wait for completion via WebSocket or History Polling
            // For SSE simplicity, we'll use polling history for this MVP
            let finished = false;
            while (!finished && !activeJobs.get(businessId).cancelled) {
                const histResp = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
                const history = await histResp.json();

                if (history[prompt_id]) {
                    const outputs = history[prompt_id].outputs;
                    if (outputs && outputs["9"]) {
                        const filename = outputs["9"].images[0].filename;

                        // Download and save locally
                        const viewUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=&type=output`;
                        const imgBuffer = await fetch(viewUrl).then(r => r.arrayBuffer());

                        const businessDir = path.join(ONBOARDING_OUTPUT_DIR, String(businessId));
                        if (!fs.existsSync(businessDir)) fs.mkdirSync(businessDir, { recursive: true });

                        const localFilename = `item_${item.id}_${Date.now()}.png`;
                        const localPath = path.join(businessDir, localFilename);
                        fs.writeFileSync(localPath, Buffer.from(imgBuffer));

                        const publicUrl = `/assets/generated/${businessId}/${localFilename}`;
                        sendEvent({ type: 'success', index: i, id: item.id, url: publicUrl });
                        finished = true;
                    }
                }
                if (!finished) await new Promise(r => setTimeout(r, 1000));
            }
        }

        sendEvent({ type: 'complete' });
        console.log(`✅ Generation completed for ${businessId}`);
    } catch (err) {
        console.error('Generation Error:', err.message);
        sendEvent({ type: 'error', message: err.message });
    } finally {
        activeJobs.delete(businessId);
        res.end();
    }
});

app.post('/api/onboarding/cancel', (req, res) => {
    const { businessId } = req.body;
    if (activeJobs.has(businessId)) {
        activeJobs.get(businessId).cancelled = true;
        res.json({ success: true, message: 'Cancellation signal sent' });
    } else {
        res.status(404).json({ error: 'No active generation for this business' });
    }
});

// ---------------------------------------------------------
// 🆕 MENU ONBOARDING: IMPORT TO SUPABASE
// ---------------------------------------------------------
app.post('/api/onboarding/import', async (req, res) => {
    const { businessId, items } = req.body;

    if (!businessId || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Missing businessId or items' });
    }

    console.log(`🚀 Finalizing Import for Business: ${businessId} (${items.length} items)`);

    try {
        for (const item of items) {
            // A. Insert Menu Item
            const { data: menuData, error: menuError } = await supabase
                .from('menu_items')
                .insert([{
                    business_id: businessId,
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    description: item.description,
                    image_url: item.imageUrl,
                    production_area: item.productionArea || 'Kitchen',
                    is_in_stock: true
                }])
                .select()
                .single();

            if (menuError) throw menuError;

            // B. Insert Modifiers
            if (item.modifiers && item.modifiers.length > 0) {
                for (const group of item.modifiers) {
                    const { data: groupData, error: groupError } = await supabase
                        .from('optiongroups')
                        .insert([{
                            business_id: businessId,
                            name: group.name,
                            is_required: group.requirement === 'M',
                            is_multiple_select: group.maxSelection > 1,
                            menu_item_id: menuData.id
                        }])
                        .select()
                        .single();

                    if (groupError) throw groupError;

                    const valuesToInsert = group.items.map(v => ({
                        business_id: businessId,
                        group_id: groupData.id,
                        value_name: v.name,
                        price_adjustment: v.price,
                        is_default: !!v.isDefault
                    }));

                    const { error: valError } = await supabase
                        .from('optionvalues')
                        .insert(valuesToInsert);

                    if (valError) throw valError;
                }
            }
        }

        res.json({ success: true, message: 'Menu imported successfully' });

    } catch (error) {
        console.error('Import failed:', error);
        res.status(500).json({ error: 'Failed to import menu data', details: error.message });
    }
});

// ---------------------------------------------------------
// 🆕 SINGLE ITEM REGENERATION (Per-Item)
// ---------------------------------------------------------
app.post('/api/onboarding/generate-single', async (req, res) => {
    const { businessId, itemId, prompt, negativePrompt, originalImageUrl } = req.body;
    if (!businessId || !itemId || !prompt) {
        return res.status(400).json({ error: 'Missing businessId, itemId, or prompt' });
    }

    const defaultNegative = "text, watermark, logo, blurry, low quality, distorted, bad hands, mutated, people, hands";
    const finalNegative = negativePrompt || defaultNegative;

    console.log(`🎨 Single Regeneration for Item: ${itemId} (Business: ${businessId})`);

    try {
        const seed = Math.floor(Math.random() * 1000000000);
        const clientId = randomUUID();

        // Build ComfyUI Workflow - Support both txt2img and img2img
        let workflow;

        if (originalImageUrl) {
            // 🆕 IMAGE-TO-IMAGE WORKFLOW (with seed image)
            console.log(`🖼️  Using img2img with seed: ${originalImageUrl}`);

            // ComfyUI requires images to be in its input directory
            // Copy seed image from our public folder to ComfyUI's input folder
            const seedFilename = originalImageUrl.split('/').pop();
            const seedLocalPath = path.join(__dirname, 'public', originalImageUrl.replace(/^\//, ''));
            const comfyInputPath = '/Users/user/AI/ComfyUI/input';
            const comfyInputFile = path.join(comfyInputPath, seedFilename);

            if (fs.existsSync(seedLocalPath)) {
                fs.copyFileSync(seedLocalPath, comfyInputFile);
                console.log(`✅ Copied seed image to ComfyUI input: ${seedFilename}`);
            } else {
                console.warn(`⚠️  Seed image not found at ${seedLocalPath}, falling back to txt2img`);
                // Fall through to txt2img workflow below
            }

            workflow = {
                "3": {
                    "inputs": {
                        "seed": seed,
                        "steps": 25,
                        "cfg": 7.5,
                        "sampler_name": "dpmpp_2m",
                        "scheduler": "karras",
                        "denoise": 0.75, // 75% denoise for img2img - preserves structure
                        "model": ["4", 0],
                        "positive": ["6", 0],
                        "negative": ["7", 0],
                        "latent_image": ["10", 0] // From VAE Encode
                    },
                    "class_type": "KSampler"
                },
                "4": {
                    "inputs": { "ckpt_name": "dreamshaper_8.safetensors" },
                    "class_type": "CheckpointLoaderSimple"
                },
                "6": {
                    "inputs": { "text": prompt, "clip": ["4", 1] },
                    "class_type": "CLIPTextEncode"
                },
                "7": {
                    "inputs": {
                        "text": finalNegative,
                        "clip": ["4", 1]
                    },
                    "class_type": "CLIPTextEncode"
                },
                "8": {
                    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
                    "class_type": "VAEDecode"
                },
                "9": {
                    "inputs": { "filename_prefix": `single_${businessId}_${itemId}`, "images": ["8", 0] },
                    "class_type": "SaveImage"
                },
                "10": {
                    "inputs": { "pixels": ["11", 0], "vae": ["4", 2] },
                    "class_type": "VAEEncode"
                },
                "11": {
                    "inputs": {
                        "image": seedFilename,
                        "upload": "image"
                    },
                    "class_type": "LoadImage"
                }
            };
        } else {
            // TEXT-TO-IMAGE WORKFLOW (original)
            console.log(`📝 Using txt2img (no seed image)`);

            workflow = {
                "3": {
                    "inputs": {
                        "seed": seed,
                        "steps": 20,
                        "cfg": 7,
                        "sampler_name": "dpmpp_2m",
                        "scheduler": "karras",
                        "denoise": 1,
                        "model": ["4", 0],
                        "positive": ["6", 0],
                        "negative": ["7", 0],
                        "latent_image": ["5", 0]
                    },
                    "class_type": "KSampler"
                },
                "4": {
                    "inputs": { "ckpt_name": "dreamshaper_8.safetensors" },
                    "class_type": "CheckpointLoaderSimple"
                },
                "5": {
                    "inputs": { "width": 512, "height": 512, "batch_size": 1 },
                    "class_type": "EmptyLatentImage"
                },
                "6": {
                    "inputs": { "text": prompt, "clip": ["4", 1] },
                    "class_type": "CLIPTextEncode"
                },
                "7": {
                    "inputs": {
                        "text": finalNegative,
                        "clip": ["4", 1]
                    },
                    "class_type": "CLIPTextEncode"
                },
                "8": {
                    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
                    "class_type": "VAEDecode"
                },
                "9": {
                    "inputs": { "filename_prefix": `single_${businessId}_${itemId}`, "images": ["8", 0] },
                    "class_type": "SaveImage"
                }
            };
        }

        const promptResp = await fetch(`${COMFYUI_URL}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow, client_id: clientId })
        });

        if (!promptResp.ok) throw new Error('Failed to queue prompt');
        const { prompt_id } = await promptResp.json();

        // Poll history for result
        let finished = false;
        let resultUrl = null;

        while (!finished) {
            const histResp = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
            const history = await histResp.json();

            if (history[prompt_id]) {
                const outputs = history[prompt_id].outputs;
                if (outputs && outputs["9"]) {
                    const filename = outputs["9"].images[0].filename;

                    const viewUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=&type=output`;
                    const imgBuffer = await fetch(viewUrl).then(r => r.arrayBuffer());

                    const businessDir = path.join(ONBOARDING_OUTPUT_DIR, String(businessId));
                    if (!fs.existsSync(businessDir)) fs.mkdirSync(businessDir, { recursive: true });

                    const localFilename = `item_${itemId}_${Date.now()}.png`;
                    const localPath = path.join(businessDir, localFilename);
                    fs.writeFileSync(localPath, Buffer.from(imgBuffer));

                    resultUrl = `/assets/generated/${businessId}/${localFilename}`;
                    finished = true;
                }
            }
            if (!finished) await new Promise(r => setTimeout(r, 1000));
        }

        res.json({ success: true, url: resultUrl });

    } catch (error) {
        console.error('Single generation failed:', error.message);
        res.status(500).json({ error: 'Generation failed', details: error.message });
    }
});

// ---------------------------------------------------------
// 🆕 UPLOAD SEED IMAGE FOR ITEM (For i2i)
// ---------------------------------------------------------
app.post('/api/onboarding/upload-seed', upload.single('image'), async (req, res) => {
    try {
        const { businessId, itemId } = req.body;
        if (!req.file || !businessId || !itemId) {
            return res.status(400).json({ error: 'Missing file, businessId, or itemId' });
        }

        const businessDir = path.join(ONBOARDING_OUTPUT_DIR, String(businessId), 'seeds');
        if (!fs.existsSync(businessDir)) fs.mkdirSync(businessDir, { recursive: true });

        const filename = `seed_${itemId}_${Date.now()}.png`;
        const localPath = path.join(businessDir, filename);
        fs.writeFileSync(localPath, req.file.buffer);

        const publicUrl = `/assets/generated/${businessId}/seeds/${filename}`;
        res.json({ success: true, url: publicUrl });

    } catch (error) {
        console.error('Seed upload failed:', error.message);
        res.status(500).json({ error: 'Upload failed', details: error.message });
    }
});
