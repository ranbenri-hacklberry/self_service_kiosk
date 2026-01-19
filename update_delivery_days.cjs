require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function updateDeliveryDays() {
    console.log('🚀 Starting Delivery Days migration...');

    // 1. Fetch all suppliers
    const { data: suppliers, error: fetchError } = await supabase
        .from('suppliers')
        .select('id, business_id, name, delivery_days');

    if (fetchError) {
        console.error('❌ Error fetching suppliers:', fetchError);
        return;
    }

    console.log(`📦 Found ${suppliers.length} suppliers.`);

    const demoBusinessId = '22222222-2222-2222-2222-222222222222';
    const allDays = "1,2,3,4,5,6,7";

    for (const supplier of suppliers) {
        let newDays = supplier.delivery_days;

        // If it's the demo business, set to all days
        if (supplier.business_id === demoBusinessId) {
            newDays = allDays;
            console.log(`✨ Setting all days for demo supplier: ${supplier.name}`);
        } else if (supplier.delivery_days) {
            // Otherwise, shift days by +1
            try {
                let daysArray = [];
                if (typeof supplier.delivery_days === 'string') {
                    if (supplier.delivery_days.includes('[')) {
                        daysArray = JSON.parse(supplier.delivery_days);
                    } else {
                        daysArray = supplier.delivery_days.split(',').map(d => d.trim());
                    }
                } else if (Array.isArray(supplier.delivery_days)) {
                    daysArray = supplier.delivery_days;
                }

                // Shift all days by +1 (assuming 0-6 became 1-7)
                const shiftedDays = daysArray
                    .map(d => parseInt(d))
                    .filter(d => !isNaN(d))
                    .map(d => d + 1)
                    .filter(d => d >= 1 && d <= 7);

                newDays = shiftedDays.join(',');
                console.log(`🔄 Shifting days for ${supplier.name}: ${supplier.delivery_days} -> ${newDays}`);
            } catch (e) {
                console.error(`⚠️ Error parsing days for ${supplier.name}:`, e);
            }
        }

        if (newDays !== supplier.delivery_days) {
            const { error: updateError } = await supabase
                .from('suppliers')
                .update({ delivery_days: String(newDays) })
                .eq('id', supplier.id);

            if (updateError) {
                console.error(`❌ Failed to update ${supplier.name}:`, updateError);
            } else {
                console.log(`✅ Updated ${supplier.name}`);
            }
        }
    }

    console.log('🏁 Migration finished.');
}

updateDeliveryDays();
