const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    const { data, error } = await supabase.rpc('authenticate_employee', {
        p_email: 'ran@mail.com',
        p_password: '1234'
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }
    console.log('RPC Response:', data);
}

test();
