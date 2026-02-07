
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: businesses } = await supabase.from('businesses').select('id, name');
        for (const b of businesses) {
            const { data: tasks } = await supabase
                .from('recurring_tasks')
                .select('*')
                .eq('business_id', b.id);

            console.log(`Business ${b.name} (${b.id}) has ${tasks?.length || 0} tasks.`);
            if (tasks) {
                tasks.forEach(t => {
                    console.log(` - [${t.category}] ${t.name} (Active: ${t.is_active}, Schedule: ${JSON.stringify(t.weekly_schedule)})`);
                });
            }
        }
    } catch (e) {
        console.error(e);
    }
}
check();
