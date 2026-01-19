import { createClient } from '@supabase/supabase-js';

// Real Config from .env
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runUpdates() {
    console.log('Updating business settings SMS Numbers...');

    // 1. Fetch businesses
    const { data: businesses, error } = await supabase.from('business_settings').select('id, business_name, whatsapp_phone');

    if (error) {
        console.error('Error fetching businesses:', error);
        return;
    }

    console.log(`Found ${businesses.length} businesses.`);

    for (const biz of businesses) {
        let smsNumber = biz.whatsapp_phone; // Default to existing WA number

        const idStr = biz.id.toString();

        // Override for '22222' (or similar logic/name as requested)
        // User explicitly asked for: "business starting with 11111 -> whatsapp_phone" (Already default)
        // "business starting with 22222 -> 0548317887"

        if (idStr.startsWith('22222') || biz.business_name.includes('עגלת קפה')) {
            smsNumber = '0548317887';
        }

        console.log(`Updating '${biz.business_name}' (${idStr.substring(0, 8)}...) -> SMS: ${smsNumber}`);

        const { error: updateError } = await supabase
            .from('business_settings')
            .update({ sms_number: smsNumber })
            .eq('id', biz.id);

        if (updateError) {
            console.error(`  Failed to update: ${updateError.message}`);
        } else {
            console.log('  Success.');
        }
    }
}

runUpdates();
