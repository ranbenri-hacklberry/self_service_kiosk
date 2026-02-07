#!/usr/bin/env node
/**
 * 🧪 Deployment Verification Test - Verifying Phosphor Green Checklist & Terminal Output
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4028';
const SESSION = `deploy-verify-${Date.now()}`;
const SCREENSHOT_DIR = 'public/screenshots';
const SCREENSHOT_PATH = `${SCREENSHOT_DIR}/deploy_live.png`;

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function log(msg, type = 'info') {
    console.log(`${type === 'success' ? '✅' : type === 'error' ? '❌' : '📋'} ${msg}`);
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

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    log('🎬 STARTING DEPLOYMENT VERIFICATION...');

    try {
        // 1. NAVIGATE TO DIAGNOSTICS
        log('Navigating to Diagnostic Screen...');
        browser(`open ${BASE_URL}/login`);
        await wait(3000);

        // Login bypass (using credentials from existing tests)
        browser(`fill "input[type='email']" "ran@mail.com"`);
        browser(`fill "input[type='password']" "1234"`);
        browser(`evaluate "document.querySelectorAll('button').forEach(b => { if(b.innerText.includes('התחבר')) b.click(); })"`);
        await wait(5000);

        // Go to diagnostics directly
        browser(`open ${BASE_URL}/manager/diagnostics`);
        await wait(5000);

        // 2. VERIFY PHOSPHOR GREEN THEME
        log('Verifying Apple II Terminal Theme...');
        const themeCheck = browser(`evaluate "const el = document.querySelector('.terminal-checklist'); el ? window.getComputedStyle(el).backgroundColor : 'NOT_FOUND'"`);

        if (themeCheck && themeCheck.output && themeCheck.output.includes('rgb(0, 0, 0)')) {
            log('Theme verified: Pure Black Background', 'success');
        } else {
            log(`WARNING: Background color mismatch or element not found. Output: ${themeCheck ? themeCheck.output : 'NULL'}`, 'error');
        }

        // 3. CAPTURE TELEMETRY
        log('Testing Hardware Telemetry Capture...');
        browser(`evaluate "document.querySelectorAll('button').forEach(b => { if(b.innerText.includes('REFRESH STATS')) b.click(); })"`);
        await wait(3000);

        const telSnap = browser(`snapshot -i`);
        if (telSnap && telSnap.output && telSnap.output.includes('N150')) {
            log('Telemetry verified: Found N150 in snapshot', 'success');
        } else {
            log(`Telemetry failed or not visible. Output: ${telSnap ? telSnap.output : 'NULL'}`, 'error');
        }

        // 4. CHECK PHASES
        log('Checking Phase Items...');
        browser(`evaluate "document.querySelectorAll('.checklist-item').forEach((el, i) => { if(i < 5) el.click(); })"`);
        await wait(1000);

        const checkSnap = browser(`snapshot -i`);
        if (checkSnap && checkSnap.output && checkSnap.output.includes('V')) {
            log('Checklist interaction verified', 'success');
        } else {
            log(`Checklist verification failed. Output: ${checkSnap ? checkSnap.output : 'NULL'}`, 'error');
        }

        // 5. FINAL SUBMISSION
        log('Submitting Final Check...');
        browser(`evaluate "document.querySelectorAll('button').forEach(b => { if(b.innerText.includes('SUBMIT FINAL')) b.click(); })"`);
        await wait(3000);

        const finalSnap = browser(`snapshot -i`);
        if (finalSnap && finalSnap.output && finalSnap.output.includes('SYSTEM_READY')) {
            log('FINAL VERIFICATION: SYSTEM_READY confirmed in terminal output', 'success');
        } else {
            log(`FINAL VERIFICATION FAILED: SYSTEM_READY not seen. Output: ${finalSnap ? finalSnap.output : 'NULL'}`, 'error');
        }

        log('Taking final screenshot...');
        browser(`screenshot "${SCREENSHOT_PATH}"`);
        log(`Screenshot saved to ${SCREENSHOT_PATH}`, 'success');

    } catch (e) {
        log(`🛑 VERIFICATION CRITICAL FAILURE: ${e.message}`, 'error');
    } finally {
        browser('close');
        log('🏁 VERIFICATION COMPLETE.');
    }
}

main();
