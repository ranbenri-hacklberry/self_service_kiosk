require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixUnits() {
  console.log('🛠 Starting units cleanup...');

  const { data: items, error: fetchErr } = await supabase
    .from('inventory_items')
    .select('id, name, order_step, min_order, weight_per_unit')
    .gt('weight_per_unit', 0);

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  console.log(`Found ${items.length} items with weight_per_unit > 0.`);

  for (const item of items) {
    const wpu = parseFloat(item.weight_per_unit);
    const step = parseFloat(item.order_step);
    const min = parseFloat(item.min_order);

    console.log(`- ${item.name}: step=${step}, min=${min}, wpu=${wpu}`);

    if (wpu > 1 && (step >= wpu || min >= wpu)) {
      const newStep = Math.max(1, Math.round(step / wpu));
      const newMin = Math.max(1, Math.round(min / wpu));

      console.log(`  🚀 Fixing ${item.name}: step ${step}->${newStep}, min ${min}->${newMin}`);

      const { error: updErr } = await supabase
        .from('inventory_items')
        .update({
          order_step: newStep,
          min_order: newMin
        })
        .eq('id', item.id);
      if (updErr) console.error(`  ❌ Error updating ${item.name}:`, updErr);
    }
  }
  console.log('✅ Done.');
}

fixUnits();
