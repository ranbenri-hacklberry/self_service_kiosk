
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
    // Try both IDs
    const businessIds = ['22222222-2222-2222-2222-222222222222'];

    console.log('---REPORT_START---');

    const results = [];

    for (const bId of businessIds) {
        const { data: items, error: itemError } = await supabase
            .from('menu_items')
            .select('id, name, category')
            .eq('business_id', bId)
            .ilike('category', '%שתיה חמה%');

        if (itemError) {
            console.error('Error fetching items for ' + bId, itemError);
            continue;
        }

        if (!items || items.length === 0) continue;

        for (const item of items) {
            const { data: links } = await supabase
                .from('menuitemoptions')
                .select('group_id')
                .eq('item_id', item.id);

            const { data: privateGroups } = await supabase
                .from('optiongroups')
                .select('id, title, name, is_required')
                .eq('menu_item_id', item.id);

            const groupIds = [...new Set([
                ...(links || []).map(l => l.group_id),
                ...(privateGroups || []).map(g => g.id)
            ])];

            const itemGroups = [];

            if (groupIds.length > 0) {
                const { data: groups } = await supabase
                    .from('optiongroups')
                    .select('id, title, name, is_required')
                    .in('id', groupIds);

                if (groups) {
                    for (const group of groups) {
                        const { data: values } = await supabase
                            .from('optionvalues')
                            .select('value_name, price_adjustment, is_default')
                            .eq('group_id', group.id);

                        itemGroups.push({
                            groupName: group.title || group.name,
                            isRequired: group.is_required,
                            options: values ? values.map(v => ({
                                name: v.value_name,
                                price: v.price_adjustment,
                                isDefault: v.is_default
                            })) : []
                        });
                    }
                }
            }

            results.push({
                itemName: item.name,
                groups: itemGroups
            });
        }
    }

    console.log(JSON.stringify(results, null, 2));
    console.log('---REPORT_END---');
}

generateReport();
