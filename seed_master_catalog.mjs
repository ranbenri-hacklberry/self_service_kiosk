import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Ideally service_role for seeding, trying anon if policies allow insert
const supabase = createClient(supabaseUrl, supabaseKey);

// DATA
const CATEGORIES = [
    { name: 'מנות ראשונות', type: 'food', course_type: 'starter', display_order: 10 },
    { name: 'מנות עיקריות', type: 'food', course_type: 'main', display_order: 20 },
    { name: 'קינוחים', type: 'food', course_type: 'dessert', display_order: 30 },
    { name: 'שתיה קלה', type: 'drink', course_type: 'beverage', display_order: 40 },
    { name: 'אלכוהול', type: 'drink', course_type: 'beverage', display_order: 50 },
    { name: 'קפה ותה', type: 'drink', course_type: 'beverage', display_order: 60 },
];

const SUPPLIERS = [
    { name: 'תנובה', departments: ['Dairy', 'Frozen'] },
    { name: 'שטראוס', departments: ['Dairy', 'Salads'] },
    { name: 'אוסם', departments: ['Dry Goods', 'Frozen'] },
    { name: 'החברה המרכזית (קוקה קולה)', departments: ['Alcohol', 'Beverages'] },
    { name: 'טמפו', departments: ['Alcohol', 'Beverages'] },
    { name: 'ביכורי שדה', departments: ['Produce'] },
    { name: 'נטו', departments: ['Meat', 'Frozen'] },
];

const INGREDIENTS = [
    // Produce
    { name: 'עגבניה', default_unit: 'Kg', department: 'Produce' },
    { name: 'מלפפון', default_unit: 'Kg', department: 'Produce' },
    { name: 'חסה', default_unit: 'Unit', department: 'Produce' },
    { name: 'בצל', default_unit: 'Kg', department: 'Produce' },
    { name: 'לימון', default_unit: 'Kg', department: 'Produce' },
    // Dairy
    { name: 'חלב 3%', default_unit: 'Liter', department: 'Dairy' },
    { name: 'גבינה צהובה', default_unit: 'Kg', department: 'Dairy' },
    { name: 'שמנת מתוקה', default_unit: 'Liter', department: 'Dairy' },
    { name: 'חמאה', default_unit: 'Kg', department: 'Dairy' },
    // Dry
    { name: 'קמח לבן', default_unit: 'Kg', department: 'Dry Goods' },
    { name: 'סוכר', default_unit: 'Kg', department: 'Dry Goods' },
    { name: 'מלח', default_unit: 'Kg', department: 'Dry Goods' },
    { name: 'פסטה פנה', default_unit: 'Kg', department: 'Dry Goods' },
    { name: 'שמן זית', default_unit: 'Liter', department: 'Dry Goods' },
    // Meat
    { name: 'חזה עוף', default_unit: 'Kg', department: 'Meat' },
    { name: 'בשר טחון', default_unit: 'Kg', department: 'Meat' },
    // Drinks
    { name: 'קוקה קולה (בקבוק זכוכית)', default_unit: 'Box', department: 'Beverages' },
    { name: 'ספרייט', default_unit: 'Box', department: 'Beverages' },
    { name: 'מים מינרלים', default_unit: 'Box', department: 'Beverages' },
    { name: 'יין אדום', default_unit: 'Bottle', department: 'Alcohol' },
    { name: 'בירה', default_unit: 'Keg', department: 'Alcohol' },
];

async function seed() {
    console.log('🌱 Seeding Master Catalog...');

    // 1. Categories
    console.log('... Seeding Categories');
    for (const cat of CATEGORIES) {
        const { error } = await supabase.from('master_categories').upsert(cat, { onConflict: 'name' });
        if (error) console.error('Error cat:', cat.name, error.message);
    }

    // 2. Suppliers
    console.log('... Seeding Suppliers');
    let supplierMap = {}; // name -> id
    for (const sup of SUPPLIERS) {
        const { data, error } = await supabase.from('master_suppliers').upsert(sup, { onConflict: 'name' }).select().single();
        if (error) console.error('Error sup:', sup.name, error.message);
        if (data) supplierMap[sup.name] = data.id;
    }

    // 3. Ingredients
    console.log('... Seeding Ingredients');
    let ingredientMap = {}; // name -> id
    for (const ing of INGREDIENTS) {
        const { data, error } = await supabase.from('master_ingredients').upsert(ing, { onConflict: 'name' }).select().single();
        if (error) console.error('Error ing:', ing.name, error.message);
        if (data) ingredientMap[ing.name] = data.id;
    }

    // 4. Link Tnuva to Dairy
    console.log('... Linking Catalog');
    if (supplierMap['תנובה']) {
        await linkSupplier(supplierMap['תנובה'], ['חלב 3%', 'גבינה צהובה', 'שמנת מתוקה', 'חמאה'], ingredientMap);
    }
    if (supplierMap['ביכורי שדה']) {
        await linkSupplier(supplierMap['ביכורי שדה'], ['עגבניה', 'מלפפון', 'חסה', 'בצל', 'לימון'], ingredientMap);
    }
    if (supplierMap['החברה המרכזית (קוקה קולה)']) {
        await linkSupplier(supplierMap['החברה המרכזית (קוקה קולה)'], ['קוקה קולה (בקבוק זכוכית)', 'ספרייט', 'מים מינרלים'], ingredientMap);
    }

    console.log('✅ Seeding Complete.');
}

async function linkSupplier(supId, itemNames, ingMap) {
    const links = itemNames.map(name => {
        const ingId = ingMap[name];
        if (!ingId) return null;
        return { supplier_id: supId, ingredient_id: ingId };
    }).filter(Boolean);

    if (links.length) {
        const { error } = await supabase.from('master_supplier_catalog').upsert(links, { onConflict: 'supplier_id,ingredient_id' });
        if (error) console.error('Link error', error.message);
    }
}

seed();
