
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    const payload = {
        supplier_id: 2, // Assuming ID 2 exists (Kochav HaShachar)
        supplier_name: 'Test Supplier',
        items: [{ itemId: 999, name: 'Test Item', qty: 5, unit: 'kg' }],
        status: 'sent',
        created_at: new Date().toISOString()
    };

    console.log("Attempting insert with:", payload);

    const { data, error } = await supabase.from('supplier_orders').insert(payload).select();

    if (error) {
        console.error("Insert Error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Insert Success:", data);
        // Clean up
        await supabase.from('supplier_orders').delete().eq('id', data[0].id);
    }
}

testInsert();
