// Check for "מפורק" option in database
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

async function query(table, select = '*', filter = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    return response.json();
}

async function findMeforakOption() {
    console.log('\n=== 🔍 SEARCHING FOR מפורק OPTION ===\n');

    // Search in optionvalues
    const optionValues = await query('optionvalues', 'id,value_name,group_id,is_default', '&value_name=ilike.%מפורק%');

    console.log('📋 Option values with "מפורק":', optionValues.length);
    optionValues.forEach(ov => {
        console.log(`  - ID: ${ov.id}`);
        console.log(`    Name: ${ov.value_name}`);
        console.log(`    Group ID: ${ov.group_id}`);
        console.log(`    Is Default: ${ov.is_default}`);
        console.log('');
    });

    // Get the group names
    if (optionValues.length > 0) {
        const groupIds = [...new Set(optionValues.map(ov => ov.group_id))];
        for (const groupId of groupIds) {
            const groups = await query('optiongroups', 'id,name', `&id=eq.${groupId}`);
            if (groups.length > 0) {
                console.log(`📁 Group: ${groups[0].name} (${groups[0].id})`);
            }
        }
    }

    console.log('\n=== ✅ SEARCH COMPLETE ===\n');
}

findMeforakOption().catch(console.error);
