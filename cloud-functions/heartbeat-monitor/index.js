const functions = require('@google-cloud/functions-framework');
const { createClient } = require('@supabase/supabase-js');

/**
 * Heartbeat Monitor - Check for offline devices and send SMS alerts
 * Triggered by Cloud Scheduler every 1 minute
 * 
 * Uses Supabase to persist offline state so recovery alerts work
 */

// Configuration
const CONFIG = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://gxzsxvbercpkgxraiaex.supabase.co',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    SMS_FUNCTION_URL: 'https://us-central1-repos-477613.cloudfunctions.net/sendSms',
    OFFLINE_THRESHOLD_MINUTES: 3, // Consider offline after 3 minutes without heartbeat
    ALERT_COOLDOWN_MINUTES: 30, // Don't send repeated offline alerts within 30 min
    TEST_PHONE: '0548317887',
};

/**
 * Send SMS via existing Cloud Function
 */
async function sendSms(phone, message) {
    try {
        const response = await fetch(CONFIG.SMS_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message }),
        });
        const result = await response.json();
        console.log(`📨 SMS to ${phone}:`, result);
        return result;
    } catch (error) {
        console.error('SMS send error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Main HTTP function
 */
functions.http('checkHeartbeats', async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    console.log('💓 Starting heartbeat check...');

    try {
        if (!CONFIG.SUPABASE_SERVICE_KEY) {
            throw new Error('SUPABASE_SERVICE_KEY not configured');
        }

        const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);

        // Get threshold timestamp
        const thresholdTime = new Date();
        thresholdTime.setMinutes(thresholdTime.getMinutes() - CONFIG.OFFLINE_THRESHOLD_MINUTES);

        // Get all businesses
        const { data: businesses, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, settings');

        if (bizError) throw bizError;

        console.log(`📊 Checking ${businesses.length} businesses...`);

        let offlineAlerts = 0;
        let recoveryAlerts = 0;

        for (const business of businesses) {
            // Get latest heartbeat
            const { data: sessions, error: sessError } = await supabase
                .from('device_sessions')
                .select('last_seen_at, device_type')
                .eq('business_id', business.id)
                .order('last_seen_at', { ascending: false })
                .limit(1);

            if (sessError) {
                console.warn(`Error checking ${business.name}:`, sessError);
                continue;
            }

            if (!sessions || sessions.length === 0) {
                console.log(`⚪ ${business.name}: Never connected`);
                continue;
            }

            const lastSeen = new Date(sessions[0].last_seen_at);
            const isCurrentlyOffline = lastSeen < thresholdTime;
            const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 1000 / 60);

            // Get current alert state from settings
            const settings = business.settings || {};
            const wasAlertedOffline = settings.offline_alerted === true;
            const lastOfflineAlert = settings.last_offline_alert ? new Date(settings.last_offline_alert) : null;
            const managerPhone = settings.manager_phone || CONFIG.TEST_PHONE;

            if (isCurrentlyOffline) {
                console.log(`🔴 ${business.name}: OFFLINE for ${minutesAgo} min`);

                // Check cooldown - only alert if never alerted or cooldown passed
                const cooldownPassed = !lastOfflineAlert ||
                    (Date.now() - lastOfflineAlert.getTime()) / 1000 / 60 >= CONFIG.ALERT_COOLDOWN_MINUTES;

                if (!wasAlertedOffline || cooldownPassed) {
                    // Send offline alert
                    const message = `⚠️ ${business.name} - המערכת לא מחוברת כבר ${minutesAgo} דקות!`;
                    await sendSms(managerPhone, message);
                    offlineAlerts++;

                    // Update state in Supabase
                    await supabase
                        .from('businesses')
                        .update({
                            settings: {
                                ...settings,
                                offline_alerted: true,
                                last_offline_alert: new Date().toISOString()
                            }
                        })
                        .eq('id', business.id);

                    console.log(`📨 Sent offline alert for ${business.name}`);
                } else {
                    console.log(`⏸️ ${business.name}: Cooldown active`);
                }

            } else {
                // Business is ONLINE
                console.log(`🟢 ${business.name}: Online (${minutesAgo}min ago)`);

                // If it was previously marked as offline, send recovery SMS
                if (wasAlertedOffline) {
                    const recoveryMsg = `✅ ${business.name} חזר לפעילות! המערכת שוב מחוברת.`;
                    await sendSms(managerPhone, recoveryMsg);
                    recoveryAlerts++;

                    // Clear the offline flag
                    await supabase
                        .from('businesses')
                        .update({
                            settings: {
                                ...settings,
                                offline_alerted: false,
                                last_recovery_alert: new Date().toISOString()
                            }
                        })
                        .eq('id', business.id);

                    console.log(`📨 Sent recovery alert for ${business.name}`);
                }
            }
        }

        const summary = {
            checked: businesses.length,
            offlineAlerts,
            recoveryAlerts,
            timestamp: new Date().toISOString(),
        };

        console.log('✅ Heartbeat check complete:', summary);
        res.status(200).json({ success: true, ...summary });

    } catch (error) {
        console.error('❌ Heartbeat check failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
