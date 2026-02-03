// SMS Service - Cloud Function Proxy (Production)
// Production endpoint for sending SMS via Google Cloud Function
// Production endpoint for sending SMS via Google Cloud Function
export const CLOUD_FUNCTION_URL = 'https://us-central1-repos-477613.cloudfunctions.net/sendSms';

// Use Cloud Function for all SMS sending (set to true for production)
export const USE_CLOUD_FUNCTION = true;

/**
 * Send SMS to a recipient with retry logic.
 * @param {string} phone - Phone number (e.g., "0501234567")
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, error?: string, data?: any}>}
 */
export const sendSms = async (phone, message) => {
    // Block specific test number (System Configuration)
    const cleanPhone = phone?.replace(/\D/g, '');

    // Safety Check: If no phone number or invalid format, do not attempt to send
    // Must start with '05' and be 10 digits long
    if (!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('05')) {
        console.log('🚫 SMS skipped: Invalid or missing phone number', { phone, cleanPhone });
        return { success: true, skipped: true };
    }

    if (cleanPhone === '0548888888') {
        console.warn('🚫 SMS blocked by system configuration (Test Number):', phone);
        return { success: false, error: 'הודעה לא נשלחה כהגדרת מערכת', isBlocked: true };
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`📨 Sending SMS (Attempt ${attempt}/${MAX_RETRIES}):`, { to: phone });

            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message }),
            });

            // Parse JSON response
            let data;
            try {
                data = await response.json();
            } catch (e) {
                // If JSON parsing fails, treat as server error if status is 5xx, else unknown
                if (response.status >= 500) throw new Error(`Server Error ${response.status} (Invalid JSON)`);
                return { success: false, error: `Invalid response from server (${response.status})` };
            }

            // Handle HTTP Errors
            if (!response.ok) {
                // If 5xx error, throw to trigger retry
                if (response.status >= 500) {
                    throw new Error(data?.error || `Server Error ${response.status}`);
                }
                // If 4xx error (e.g. Bad Request), do NOT retry
                return { success: false, error: data?.error || `Client Error ${response.status}` };
            }

            // Handle Business Logic Errors (returned as 200 OK but with error field)
            if (data?.error) {
                return { success: false, error: data.error };
            }

            // Success!
            console.log('✅ SMS sent successfully:', data);

            // Check balance silently
            getSmsBalance().catch(e => console.warn('Silent balance check failed', e));

            return { success: true, data };

        } catch (err) {
            console.error(`❌ SMS Attempt ${attempt} failed:`, err.message);

            // If this was the last attempt, return failure
            if (attempt === MAX_RETRIES) {
                return { success: false, error: `Network/Server Error: ${err.message}` };
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
};


/**
 * Check the remaining SMS balance.
 * Uses local backend proxy if available, otherwise expects a deployed Cloud Function (check-balance).
 * @returns {Promise<number|null>} Balance amount or null if failed
 */
export const getSmsBalance = async () => {
    try {
        // Try local backend first (for development/hybrid)
        // Hardcode localhost:8082 for local dev if window.location is on different port (like 4028)
        let baseUrl = '';
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
                // If we are on dev port (4028/5173), point to backend at 8082
                if (window.location.port !== '8082') {
                    baseUrl = 'http://localhost:8082';
                }
            } else {
                // Production: Use relative path (assuming served from same origin)
                // OR if Vercel functions, it might be /api/sms/balance directly
                baseUrl = '';
            }
        } else {
            // SSR / Server Side:
            // If we are in production (NODE_ENV), do NOT use localhost.
            // If we are local dev, maybe localhost is fine, but safer to skip or use env var.
            // For Vercel, this should likely be empty string or full URL from env
            baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
        }

        const response = await fetch(`${baseUrl}/api/sms/balance`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && typeof data.balance === 'number') {
                console.log('💳 SMS Balance:', data.balance);

                // Dispatch event for UI updates
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sms-balance-updated', { detail: data.balance }));
                }

                return data.balance;
            }
        }
    } catch (err) {
        console.warn('⚠️ Failed to check SMS balance:', err);
    }
    return null;
};

// Deprecated internal helper - kept for reference if needed, but sendSms now handles logic directly
const sendSmsViaCloudFunction = async (phone, message) => {
    return sendSms(phone, message);
};

// ---------------------------------------------------------------------
// NOTE: The older direct‑API implementation (sendSmsDirectly) and related
// constants (API_KEY, API_URL, SENDER_NUMBER) have been removed to avoid
// exposing secrets in client‑side code. All SMS traffic should now go
// through the secure Cloud Function.
// ---------------------------------------------------------------------
