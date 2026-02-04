import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Load from environment or fallback to defaults
const URL = process.env.LOCAL_SUPABASE_URL || process.env.VITE_LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
// In Docker, the service key is usually standardized or passed in .env
const KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY;

if (!KEY) {
    console.error("❌ ERROR: LOCAL_SUPABASE_SERVICE_KEY is missing in .env");
    console.log("Tip: Check your local docker-compose for the service role key.");
    process.exit(1);
}

const supabase = createClient(URL, KEY);

async function createAdmin() {
    const email = 'ranbenri@gmail.com';
    const password = '2102';

    console.log(`🚀 [Admin Creator] Target: ${email} at ${URL} (Super Admin Mode)`);

    try {
        // 1. Create User via Admin Auth API
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        let user = users.find(u => u.email === email);

        if (!user) {
            console.log("   - Creating new user...");
            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { role: 'admin', is_super_admin: true }
            });
            if (error) throw error;
            user = data.user;
            console.log(`✅ User created: ${user.id}`);
        } else {
            console.log("   - User exists. Updating password and metadata...");
            const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
                password: password,
                user_metadata: { role: 'admin', is_super_admin: true }
            });
            if (error) throw error;
            console.log(`✅ User updated: ${user.id}`);
        }

        // 2. Ensure synchronization with public.employees table
        // We link them to the Pilot business if it exists
        const businessId = '11111111-1111-1111-1111-111111111111';

        const { error: empError } = await supabase
            .from('employees')
            .upsert({
                email: email,
                name: 'Ran Benri',
                business_id: businessId,
                pin_code: password,
                access_level: 'admin',
                is_admin: true,
                is_super_admin: true, // Super Admin flag
                auth_user_id: user.id
            }, { onConflict: 'email' });

        if (empError) {
            console.warn("⚠️ Warning: Failed to sync to employees table:", empError.message);
        } else {
            console.log("✅ Synced to employees table successfully as Super Admin.");
        }

        console.log("\n✨ Admin setup complete. You can now login locally as Super Admin.");

    } catch (err) {
        console.error("❌ Critical Failure:", err.message);
    }
}

createAdmin();
