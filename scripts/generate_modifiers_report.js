
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Manually parse .env.local because dotenv might not handle relative paths easily in this env
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const businessId = '222';

    const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, category')
        .eq('business_id', businessId)
        .ilike('category', '%שתיה חמה%');

    if (!items) { console.log('No items found'); return; }

    const results = [];
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

        const itemData = {
            name: item.name,
            groups: []
        };

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

                    itemData.groups.push({
                        name: group.title || group.name,
                        isRequired: group.is_required,
                        values: values || []
                    });
                }
            }
        }
        results.push(itemData);
    }

    fs.writeFileSync('item_modifiers_report.json', JSON.stringify(results, null, 2));
    console.log('Report generated: item_modifiers_report.json');
}

check().catch(console.error);
