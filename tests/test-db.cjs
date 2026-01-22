const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'ran@mail.com',
        password: '1234'
    });

    if (loginError) {
        console.error('Login Error:', loginError.message);
        return;
    }
    console.log('Logged in as:', user.email);

    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (ordersError) {
        console.error('Orders Error:', ordersError.message);
    } else {
        console.log('Orders sample:', orders);
    }
}

test();
