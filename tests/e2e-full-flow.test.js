#!/usr/bin/env node
/**
 * =============================================================================
 * 🧪 בדיקת E2E מקיפה - iCaffeOS
 * =============================================================================
 * 
 * הסקריפט:
 * 1. יוצר 10 הזמנות ברצף במצב קופה
 * 2. עובר ל-KDS ומשנה סטטוסים עד שכל הכרטיסים נסגרים
 * 3. מייצר לוג מפורט עם השוואה לבסיס הנתונים
 * 
 * הרצה: node tests/e2e-full-flow.test.js
 */

const { execSync, exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// === CONFIG ===
const BASE_URL = 'http://localhost:4028';
const SESSION = `e2e-test-${Date.now()}`;
const EMAIL = 'ran@mail.com';
const PASSWORD = '1234';
const NUM_ORDERS = 10;

// === LOGGING ===
const LOG_FILE = `tests/logs/e2e-${new Date().toISOString().split('T')[0]}.log`;
const logs = [];

function log(action, result, details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        result,
        ...details
    };
    logs.push(entry);
    console.log(`${result === 'SUCCESS' ? '✅' : result === 'FAIL' ? '❌' : '📋'} ${action}`);
    if (details.error) console.log(`   └─ Error: ${details.error}`);
}

function saveLogs() {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    console.log(`\n📄 Logs saved to: ${LOG_FILE}`);
}

// === BROWSER HELPERS ===
function browser(cmd) {
    try {
        const result = execSync(`agent-browser --session "${SESSION}" ${cmd}`, {
            encoding: 'utf8',
            timeout: 30000
        });
        return { success: true, output: result.trim() };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function sleep(ms) {
    execSync(`sleep ${ms / 1000}`);
}

// === DATABASE HELPERS ===
async function getOrderCount() {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);
    return count || 0;
}

async function getOrdersByStatus() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
        .from('orders')
        .select('id, status, order_number')
        .gte('created_at', today)
        .order('created_at', { ascending: false })
        .limit(20);
    return data || [];
}

async function getPendingOrdersCount() {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today)
        .in('status', ['pending', 'preparing', 'ready']);
    return count || 0;
}

// === FLOW FUNCTIONS ===
async function login() {
    log('LOGIN', 'STARTED');

    browser(`open ${BASE_URL}`);
    sleep(3000);

    // Wait for login page
    browser(`snapshot`);
    browser(`fill "input[type='email'], input[placeholder*='email']" "${EMAIL}"`);
    browser(`fill "input[type='password']" "${PASSWORD}"`);
    browser(`click "button:has-text('התחבר')"`);
    sleep(3000);

    const urlResult = browser(`get url`);
    if (urlResult.output?.includes('mode-selection')) {
        log('LOGIN', 'SUCCESS');
        return true;
    } else {
        log('LOGIN', 'FAIL', { error: 'Did not reach mode-selection' });
        return false;
    }
}

async function selectKioskMode() {
    log('SELECT_KIOSK_MODE', 'STARTED');
    browser(`click "button:has-text('עמדת קופה')"`);
    sleep(3000);

    const urlResult = browser(`get url`);
    if (urlResult.output === `${BASE_URL}/` || urlResult.output === BASE_URL) {
        log('SELECT_KIOSK_MODE', 'SUCCESS');
        return true;
    }
    log('SELECT_KIOSK_MODE', 'FAIL');
    return false;
}

async function createOrder(orderNum) {
    const ordersBefore = await getOrderCount();
    log(`CREATE_ORDER_${orderNum}`, 'STARTED', { ordersBefore });

    // Select random item
    const items = ['אספרסו כפול', 'קפוצ׳ינו', 'שוקו גדול', 'תה', 'מוקה'];
    const item = items[orderNum % items.length];

    browser(`click "button:has-text('${item}')"`);
    sleep(1000);

    // Add to order
    browser(`click "button:has-text('הוסף להזמנה')"`);
    sleep(500);

    // Go to payment
    browser(`click "button:has-text('לתשלום')"`);
    sleep(1000);

    // Pay with cash
    browser(`click "button:has-text('מזומן')"`);
    sleep(2000);

    // Verify success
    const snapshot = browser(`snapshot -i`);
    if (snapshot.output?.includes('העסקה נרשמה')) {
        // Click to continue (close success modal)
        browser(`click "button:has-text('העסקה נרשמה')"`);
        sleep(500);

        const ordersAfter = await getOrderCount();
        log(`CREATE_ORDER_${orderNum}`, 'SUCCESS', {
            item,
            ordersBefore,
            ordersAfter,
            newOrders: ordersAfter - ordersBefore
        });
        return true;
    }

    log(`CREATE_ORDER_${orderNum}`, 'FAIL', { item });
    return false;
}

async function goToModeSelection() {
    log('GO_TO_MODE_SELECTION', 'STARTED');
    browser(`click "button:has-text('חזרה לדף הבית')"`);
    sleep(2000);

    const urlResult = browser(`get url`);
    if (urlResult.output?.includes('mode-selection')) {
        log('GO_TO_MODE_SELECTION', 'SUCCESS');
        return true;
    }
    log('GO_TO_MODE_SELECTION', 'FAIL');
    return false;
}

async function selectKDSMode() {
    log('SELECT_KDS_MODE', 'STARTED');
    browser(`click "button:has-text('סרוויס')"`);
    sleep(3000);

    const urlResult = browser(`get url`);
    if (urlResult.output?.includes('kds')) {
        log('SELECT_KDS_MODE', 'SUCCESS');
        return true;
    }
    log('SELECT_KDS_MODE', 'FAIL');
    return false;
}

async function processKDSOrders() {
    log('KDS_PROCESSING', 'STARTED');

    let pendingCount = await getPendingOrdersCount();
    let iterations = 0;
    const maxIterations = 30; // Safety limit

    while (pendingCount > 0 && iterations < maxIterations) {
        iterations++;

        // Get fresh snapshot
        const snapshot = browser(`snapshot -i`);

        // Look for action buttons
        if (snapshot.output?.includes('הכן')) {
            browser(`click "button:has-text('הכן')"`);
            log(`KDS_ACTION_${iterations}`, 'INFO', { action: 'הכן', remaining: pendingCount });
            sleep(1000);
        } else if (snapshot.output?.includes('מוכן')) {
            browser(`click "button:has-text('מוכן')"`);
            log(`KDS_ACTION_${iterations}`, 'INFO', { action: 'מוכן', remaining: pendingCount });
            sleep(1000);
        } else if (snapshot.output?.includes('נמסר')) {
            browser(`click "button:has-text('נמסר')"`);
            log(`KDS_ACTION_${iterations}`, 'INFO', { action: 'נמסר', remaining: pendingCount });
            sleep(1000);
        } else if (snapshot.output?.includes('סיים')) {
            browser(`click "button:has-text('סיים')"`);
            log(`KDS_ACTION_${iterations}`, 'INFO', { action: 'סיים', remaining: pendingCount });
            sleep(1000);
        } else {
            // No action buttons found, maybe need to scroll or all done
            sleep(2000);
        }

        // Screenshot every 5 iterations
        if (iterations % 5 === 0) {
            browser(`screenshot "tests/screenshots/kds-iteration-${iterations}.png"`);
        }

        // Check remaining
        pendingCount = await getPendingOrdersCount();
        sleep(500);
    }

    log('KDS_PROCESSING', 'SUCCESS', {
        totalIterations: iterations,
        remainingOrders: pendingCount
    });

    return pendingCount === 0;
}

async function generateReport() {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    📊 דוח בדיקת E2E');
    console.log('═══════════════════════════════════════════════════════════════');

    const orders = await getOrdersByStatus();

    console.log('\n📋 הזמנות היום:');
    console.log('─────────────────────────────────────────');
    orders.forEach(o => {
        const statusEmoji = {
            'pending': '🟡',
            'preparing': '🟠',
            'ready': '🟢',
            'completed': '✅',
            'cancelled': '❌'
        }[o.status] || '⚪';
        console.log(`   ${statusEmoji} #${o.order_number} - ${o.status}`);
    });

    console.log('\n📈 סיכום פעולות:');
    console.log('─────────────────────────────────────────');
    const successCount = logs.filter(l => l.result === 'SUCCESS').length;
    const failCount = logs.filter(l => l.result === 'FAIL').length;
    const infoCount = logs.filter(l => l.result === 'INFO').length;

    console.log(`   ✅ הצלחות: ${successCount}`);
    console.log(`   ❌ כשלונות: ${failCount}`);
    console.log(`   📋 פעולות KDS: ${infoCount}`);

    console.log('\n═══════════════════════════════════════════════════════════════');
}

// === MAIN ===
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('        🧪 בדיקת E2E מקיפה - iCaffeOS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📍 URL: ${BASE_URL}`);
    console.log(`📧 User: ${EMAIL}`);
    console.log(`🔢 Orders to create: ${NUM_ORDERS}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // Phase 1: Login
        if (!await login()) throw new Error('Login failed');

        // Phase 2: Enter Kiosk
        if (!await selectKioskMode()) throw new Error('Failed to enter kiosk mode');

        // Phase 3: Create orders
        console.log('\n📦 Phase 3: Creating orders...\n');
        for (let i = 1; i <= NUM_ORDERS; i++) {
            await createOrder(i);
            sleep(500); // Small delay between orders
        }

        // Phase 4: Go back to mode selection
        console.log('\n🚪 Phase 4: Switching to KDS...\n');
        if (!await goToModeSelection()) throw new Error('Failed to go back');
        if (!await selectKDSMode()) throw new Error('Failed to enter KDS mode');

        // Phase 5: Process orders in KDS
        console.log('\n🍳 Phase 5: Processing orders in KDS...\n');
        await processKDSOrders();

        // Phase 6: Report
        await generateReport();

    } catch (e) {
        log('FATAL_ERROR', 'FAIL', { error: e.message });
        console.error('\n💥 Fatal error:', e.message);
    } finally {
        // Cleanup
        browser('close');
        saveLogs();
    }
}

main().catch(console.error);
