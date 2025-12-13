import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually
const envPath = path.join(__dirname, '.env');
let supabaseUrl, supabaseKey;

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
            supabaseUrl = trimmed.split('=')[1].trim();
        } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            supabaseKey = trimmed.split('=')[1].trim();
        }
    }
} catch (error) {
    console.error('❌ Could not read .env file:', error.message);
    process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPrices() {
    console.log('🔧 Fixing Soy and Oat milk prices...');

    const updates = [
        { term: 'סויה', price: 3 },
        { term: 'שיבולת', price: 3 },
        { term: 'שקדים', price: 3 }
    ];

    for (const { term, price } of updates) {
        console.log(`Updating prices for *${term}* to ${price} NIS...`);

        // 1. Find the IDs of the values to update
        const { data: values, error: findError } = await supabase
            .from('optionvalues')
            .select('id, value_name, price_adjustment')
            .ilike('value_name', `%${term}%`);

        if (findError) {
            console.error(`Error finding values for ${term}:`, findError);
            continue;
        }

        if (!values || values.length === 0) {
            console.log(`No values found for ${term}`);
            continue;
        }

        console.log(`Found ${values.length} items for ${term}:`);
        values.forEach(v => console.log(` - ${v.value_name} (current price: ${v.price_adjustment})`));

        // 2. Update them
        const { error: updateError } = await supabase
            .from('optionvalues')
            .update({ price_adjustment: price })
            .ilike('value_name', `%${term}%`);

        if (updateError) {
            console.error(`Error updating ${term}:`, updateError);
        } else {
            console.log(`✅ Successfully updated prices for ${term}`);
        }
    }
}

fixPrices();
