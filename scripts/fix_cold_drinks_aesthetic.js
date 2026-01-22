import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

const COFFEE_CART_ID = '11111111-1111-1111-1111-111111111111';

// Seed image for style consistency - strictly using the original iced coffee style
const SEED_IMAGE_PATH = 'public/cafe-images/item_22_קפה קר.png';
let base64Seed = null;
try {
    const seedData = fs.readFileSync(path.resolve(SEED_IMAGE_PATH));
    base64Seed = seedData.toString('base64');
} catch (e) {
    console.error("❌ CRITICAL: Could not load seed image. Aesthetic will fail.");
    process.exit(1);
}

const ITEMS_TO_FIX = [
    { name: 'שוקו קר', logic: 'Premium iced cocoa. HEAVY dark chocolate syrup swirls on cup walls. Clear cup. Ice cubes.' },
    { name: 'אייסקפה', logic: 'Coffee slushie (Granita). Frosted crystalline frozen texture. NO ICE CUBES. Uniform slush.' },
    { name: 'ברד ענבים', logic: 'Purple grape slushie. Frosted crystalline frozen texture. NO ICE CUBES.' },
    { name: 'תפוחים', logic: 'Natural apple juice. Darker forest green/opaque color. Transparent with ice cubes.' },
    { name: 'פחית', logic: 'Aluminum soda can with water droplets (condensation). NO CUP.' },
    { name: 'פחית קטנה', logic: 'Slim aluminum soda can with condensation. NO CUP.' },
    { name: 'תפוזים', logic: 'Bright orange juice with ice. Minimalist.' },
    { name: 'שייק אדום', logic: 'Thick red smoothie. No ice.' },
    { name: 'שייק צהוב', logic: 'Thick yellow smoothie. No ice.' }
];

async function fixAesthetic() {
    console.log("🚀 Fixing aesthetic and background sync for Cold Drinks...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const target of ITEMS_TO_FIX) {
        const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', COFFEE_CART_ID)
            .ilike('name', `%${target.name}%`)
            .eq('category', 'שתיה קרה');

        if (!items || items.length === 0) continue;

        const item = items[0];
        console.log(`🎨 Fixing: ${item.name}...`);

        const prompt = `PRODUCT PHOTOGRAPHY. Center the ${item.name} perfectly. 
BACKGROUND: MATCH THE REFERENCE PHOTO EXACTLY. EXTREMELY BLURRED haze of green leaves and golden sunlight (bokeh). No sharp details in background.
SURFACE: Same weathered rustic wooden table as reference.
ITEM: ${target.logic}
STRICT: NO decorations, NO straws, NO mint. CENTERED perfectly vertically.`;

        try {
            const contents = [
                { inlineData: { data: base64Seed, mimeType: 'image/png' } },
                { text: `STYLE REFERENCE: Match this lighting, background blur, and table exactly. ${prompt}` }
            ];

            const result = await model.generateContent(contents);
            const response = await result.response;

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    await supabase.from('menu_items').update({ image_url: base64Image }).eq('id', item.id);
                    console.log(`✅ ${item.name} fixed.`);
                }
            }
        } catch (err) {
            console.error(`❌ Error fixing ${item.name}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
}

fixAesthetic();
