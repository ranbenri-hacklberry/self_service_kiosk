
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function generateReport() {
    const businessId = '22222222-2222-2222-2222-222222222222';

    // 1. Get hot drinks
    const { data: items } = await supabase
        .from('menu_items')
        .select('id, name')
        .eq('business_id', businessId)
        .ilike('category', '%שתיה חמה%');

    if (!items) return;

    const allGroups = await supabase.from('optiongroups').select('*');
    const allValues = await supabase.from('optionvalues').select('*');
    const allLinks = await supabase.from('menuitemoptions').select('*');

    const report = [];

    for (const item of items) {
        const itemLinks = allLinks.data.filter(l => l.item_id === item.id);
        const privateGroups = allGroups.data.filter(g => g.menu_item_id === item.id);

        const groupIds = [
            ...itemLinks.map(l => l.group_id),
            ...privateGroups.map(g => g.id)
        ];

        const itemGroups = [];
        for (const gId of groupIds) {
            const group = allGroups.data.find(g => g.id === gId);
            if (!group) continue;

            const values = allValues.data.filter(v => v.group_id === gId);

            itemGroups.push({
                name: group.title || group.name,
                isRequired: group.is_required,
                options: values.map(v => ({
                    name: v.value_name,
                    price: v.price_adjustment,
                    isDefault: v.is_default
                }))
            });
        }

        if (itemGroups.length > 0) {
            report.push({
                itemName: item.name,
                groups: itemGroups
            });
        }
    }

    console.log(JSON.stringify(report, null, 2));
}

generateReport();
