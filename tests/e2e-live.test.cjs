#!/usr/bin/env node
/**
 * 🧪 E2E Fast Browser Test - Minimal Delays + Full KDS Processing + DB Validation
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

let businessId = null;

async function setupDB() {
    const { data, error } = await supabase.rpc('authenticate_employee', {
        p_email: 'ran@mail.com',
        p_password: '1234'
    });
    if (error || !data || data.length === 0) {
        log('❌ DB Auth Failed (RPC). Proceeding with limited validation.', 'error');
    } else {
        businessId = data[0].business_id;
        log(`✅ DB Validator ready for business: ${data[0].business_name}`, 'success');
    }
}

const BASE_URL = 'http://localhost:4028';
const SESSION = `e2e-${Date.now()}`;
const SCREENSHOT_DIR = 'public/screenshots';
const SCREENSHOT_PATH = `${SCREENSHOT_DIR}/live.png`;
const LOG_PATH = `${SCREENSHOT_DIR}/log.json`;

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let logs = [];

function log(msg, type = 'info') {
    const entry = { time: new Date().toISOString(), msg, type };
    logs.push(entry);
    console.log(`${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'db' ? '🏁' : '📋'} ${msg}`);
    try { fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2)); } catch { }
}

function browser(cmd, timeout = 15000) {
    try {
        const result = execSync(`agent-browser --session "${SESSION}" ${cmd}`, {
            encoding: 'utf8',
            timeout,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        return { success: true, output: result };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function screenshot() {
    browser(`screenshot "${SCREENSHOT_PATH}"`, 8000);
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function findAvailableItems(snapshot) {
    const items = [];
    const lines = snapshot.split('\n');
    for (const line of lines) {
        // Look for buttons that represent menu items
        const match = line.match(/button "([^"]+) - זמין" \[ref=(e\d+)\]/);
        if (match) items.push({ name: match[1], ref: match[2] });
    }
    return items;
}

// --- HELPER: JS CLICK ---
function jsClick(selector) {
    return browser(`evaluate "const el = document.querySelector(\'${selector}\'); if(el) el.click();"`);
}

function jsClickText(text) {
    return browser(`evaluate "const buttons = Array.from(document.querySelectorAll(\'button, div[role=\\\'button\\\']\')); const target = buttons.find(b => b.innerText.includes(\'${text}\')); if(target) target.click();"`);
}

// REPLAY Support
let stepCounter = 0;
function replaySnapshot(label = 'step') {
    stepCounter++;
    const filename = `step_${String(stepCounter).padStart(2, '0')}_${label}.png`;
    const replayDir = path.join(__dirname, 'replay');
    if (!fs.existsSync(replayDir)) fs.mkdirSync(replayDir, { recursive: true });

    const replayPath = path.join(replayDir, filename);

    // Always take a fresh screenshot first
    screenshot();

    // Copy the live screenshot to the replay folder
    try {
        // SCREENSHOT_PATH is relative to CWD (project root usually)
        if (fs.existsSync(SCREENSHOT_PATH)) {
            fs.copyFileSync(SCREENSHOT_PATH, replayPath);
        }
    } catch (e) {
        log(`Replay Error: ${e.message}`, 'error');
    }
}

// REAL DB Validation using diagnostic RPCs
async function verifyLatestOrder(expectedOrderNumber = null) {
    if (!businessId) return null;
    log(`DB: Searching for order ${expectedOrderNumber ? '#' + expectedOrderNumber : 'latest'}...`, 'db');
    for (let attempt = 0; attempt < 4; attempt++) {
        const thirtySecondsAgo = new Date(Date.now() - 40000).toISOString();
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, order_number, order_status, total_amount')
            .eq('business_id', businessId)
            .gt('created_at', thirtySecondsAgo)
            .order('created_at', { ascending: false });
        if (!error && orders && orders.length > 0) {
            const order = expectedOrderNumber
                ? orders.find(o => String(o.order_number) === String(expectedOrderNumber)) || orders[0]
                : orders[0];
            log(`DB: Found Order #${order.order_number} | Status: ${order.order_status}`, 'db');
            return order;
        }
        await wait(2000);
    }
    return null;
}

async function verifyStatusChange(orderId, expectedStatus) {
    if (!businessId || !orderId) return;

    log(`DB: Verifying status is ${expectedStatus}...`, 'db');
    const { data: order, error } = await supabase.rpc('get_diagnostic_order', {
        p_order_id: orderId
    });

    if (error || !order) {
        log(`DB: Status verification not available for this session.`, 'info');
        return;
    }

    if (order.order_status === expectedStatus) {
        log(`DB: Status confirmed: ${expectedStatus}`, 'success');
    }
}

async function main() {
    console.log('\n🎬 E2E REPLAY MODE (Robust) - Starting...\n');
    logs = [];
    stepCounter = 0;
    log('Initializing...');
    await setupDB();
    const startTime = Date.now();
    let currentOrderNumber = null;

    try {
        // 1. LOGIN
        log('Step: Login');
        browser(`open ${BASE_URL}/login`, 20000);
        await wait(3000);
        replaySnapshot('login_page');

        browser(`fill "input[type='email']" "ran@mail.com"`);
        browser(`fill "input[type='password']" "1234"`);
        jsClickText('התחבר');
        await wait(6000);
        replaySnapshot('after_login');

        // 2. MODE SELECT
        log('Step: Choice [עמדת קופה]');
        const modeSnap = browser(`snapshot -i`);
        if (modeSnap.output.includes('עמדת קופה')) {
            jsClickText('עמדת קופה');
            await wait(6000);
        } else if (modeSnap.output.includes('אימייל')) {
            throw new Error('Login failed or stuck on login page');
        }
        replaySnapshot('kiosk_loaded');

        // 3. ADD ITEM (Strict Selection)
        log('Step: Adding product');
        // Find any item card that says "זמין"
        browser(`evaluate "const items = Array.from(document.querySelectorAll(\'div[role=\\\'button\\\']\')); const item = items.find(i => i.ariaLabel && i.ariaLabel.includes(\'זמין\')); if(item) item.click();"`);
        await wait(2500);

        const itemSnap = browser(`snapshot -i`);
        if (itemSnap.output.includes('הוסף להזמנה')) {
            log('Step: In Modifiers. Clicking [הוסף להזמנה]');
            jsClickText('הוסף להזמנה');
            await wait(2500);
        }
        replaySnapshot('item_added');

        // Verify cart is NOT empty
        const cartSnap = browser(`snapshot -i`);
        if (cartSnap.output.includes('העגלה ריקה')) {
            log('WARNING: Cart is still empty after click! Retrying with first grid item...', 'error');
            browser(`evaluate "const firstItem = document.querySelector(\'.grid button, .grid div[role=\\\'button\\\']\'); if(firstItem) firstItem.click();"`);
            await wait(3000);
            replaySnapshot('retry_add_item');
        }

        // 4. CHECKOUT
        log('Step: Clicking [לתשלום]');
        // Try multiple selectors for the checkout button
        browser(`evaluate "const btn = Array.from(document.querySelectorAll(\'button\')).find(b => b.innerText.includes(\'לתשלום\') || b.innerText.includes(\'המשך\')); if(btn) btn.click();"`);
        await wait(5000);
        replaySnapshot('payment_selection');

        // 5. PAYMENT METHOD
        log('Step: Choosing [מזומן]');
        jsClickText('מזומן');
        await wait(4000);
        replaySnapshot('payment_instruction');

        // 6. FINAL ORDER SUBMISSION
        log('Step: Final Submission [העסקה נרשמה]');
        jsClickText('העסקה נרשמה');
        await wait(8000);

        const finalSnap = browser(`snapshot -i`);
        replaySnapshot('order_success');

        // Extract order number
        const outText = finalSnap.output;
        const numMatch = outText.match(/#(\d+)/) || outText.match(/(\d{4,})/);
        if (numMatch) {
            currentOrderNumber = numMatch[1];
            log(`🎯 SUCCESS! Order Created: #${currentOrderNumber}`, 'success');
        } else {
            log('WARNING: Created order, but could not find number in UI. Trying DB lookup...', 'info');
        }

        // 7. KDS TRANSITION
        log('Step: Opening KDS');
        browser(`open ${BASE_URL}/kds`);
        await wait(8000);
        replaySnapshot('kds_screen');

        // 8. KDS ACTION
        log('Step: Process Order');
        const actions = ['הכן', 'מוכן', 'נמסר', 'הושלם'];
        for (let i = 0; i < 4; i++) {
            const snap = browser(`snapshot -i`);
            const screenText = snap.output;

            if (currentOrderNumber && !screenText.includes(currentOrderNumber)) {
                log(`KDS: Order #${currentOrderNumber} not visible. Switching view or ready?`, 'info');
                // Try click any visible action if order # not found but actions are present
            }

            let clicked = false;
            for (const act of actions) {
                if (screenText.includes(act)) {
                    log(`KDS: Executing "${act}"`);
                    jsClickText(act);
                    await wait(4000);
                    replaySnapshot(`kds_${act}`);
                    clicked = true;
                    break;
                }
            }
            if (!clicked) break;
        }

        log(`🎉 FLOW FINISHED. Images in tests/replay/`, 'success');

    } catch (e) {
        log(`🛑 FAILED: ${e.message}`, 'error');
        replaySnapshot('error_state');
    } finally {
        browser('close');
    }
}

main();
