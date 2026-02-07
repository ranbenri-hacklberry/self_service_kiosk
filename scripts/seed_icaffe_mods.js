
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const businessId = '22222222-2222-2222-2222-222222222222';

    const values = [
        // סוג חלב (d95846af-7c38-4a4a-91eb-048cfb933c1b)
        { group_id: 'd95846af-7c38-4a4a-91eb-048cfb933c1b', value_name: 'חלב רגיל', price_adjustment: 0, is_default: true },
        { group_id: 'd95846af-7c38-4a4a-91eb-048cfb933c1b', value_name: 'חלב שיבולת שועל', price_adjustment: 3, is_default: false },
        { group_id: 'd95846af-7c38-4a4a-91eb-048cfb933c1b', value_name: 'חלב סויה', price_adjustment: 2, is_default: false },

        // קצף (836c6c3d-dcea-43bf-8ce4-99e332b60747)
        { group_id: '836c6c3d-dcea-43bf-8ce4-99e332b60747', value_name: 'בלי קצף', price_adjustment: 0, is_default: false },
        { group_id: '836c6c3d-dcea-43bf-8ce4-99e332b60747', value_name: 'מעט קצף', price_adjustment: 0, is_default: true },
        { group_id: '836c6c3d-dcea-43bf-8ce4-99e332b60747', value_name: 'הרבה קצף', price_adjustment: 0, is_default: false },

        // טמפרטורה (ec8eb3f4-a33e-4ba5-826f-9be8b3f67df2)
        { group_id: 'ec8eb3f4-a33e-4ba5-826f-9be8b3f67df2', value_name: 'חם', price_adjustment: 0, is_default: true },
        { group_id: 'ec8eb3f4-a33e-4ba5-826f-9be8b3f67df2', value_name: 'רותח', price_adjustment: 0, is_default: false },
        { group_id: 'ec8eb3f4-a33e-4ba5-826f-9be8b3f67df2', value_name: 'פושר', price_adjustment: 0, is_default: false },

        // חוזק (3beef94e-41fc-4eb5-9eaf-dde74b1c57b5)
        { group_id: '3beef94e-41fc-4eb5-9eaf-dde74b1c57b5', value_name: 'רגיל', price_adjustment: 0, is_default: true },
        { group_id: '3beef94e-41fc-4eb5-9eaf-dde74b1c57b5', value_name: 'חזק', price_adjustment: 0, is_default: false },
        { group_id: '3beef94e-41fc-4eb5-9eaf-dde74b1c57b5', value_name: 'חלש', price_adjustment: 0, is_default: false }
    ];

    console.log(`🚀 Seeding ${values.length} option values for iCaffe...`);

    for (const val of values) {
        const { error } = await supabase
            .from('optionvalues')
            .insert({ ...val, business_id: businessId });

        if (error) {
            console.error(`❌ Failed to insert ${val.value_name}:`, error.message);
        } else {
            console.log(`✅ Inserted ${val.value_name}`);
        }
    }
}

run();
