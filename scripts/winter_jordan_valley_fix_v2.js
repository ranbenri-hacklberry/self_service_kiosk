import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

const COFFEE_CART_ID = '11111111-1111-1111-1111-111111111111';
const SEED_IMAGE_PATH = 'public/cafe-images/item_22_קפה קר.png';
const base64Seed = fs.readFileSync(path.resolve(SEED_IMAGE_PATH)).toString('base64');

const ITEMS_TO_FIX = [
    { name: 'שוקו קר', logic: 'Tall clear plastic cup with internal dark chocolate syrup swirls and ice. Background: VERY LUSH VIBRANT GREEN WINTER VEGETATION.' },
    { name: 'פחית קטנה', logic: 'A slim silver aluminum soda can with condensation droplets. ABSOLUTELY NO PLASTIC CUP. Standing directly on the wood.' },
    { name: 'פחית', logic: 'A standard colorful aluminum soda can (like a classic soda brand) covered in condensation. ABSOLUTELY NO PLASTIC CUP.' },
    { name: 'תפוזים', logic: 'Tall clear plastic cup with bright orange juice and ice. Background: VERY LUSH VIBRANT GREEN WINTER VEGETATION.' },
    { name: 'תפוחים', logic: 'Tall clear plastic cup with DARK OPAQUE COLD-PRESSED APPLE JUICE and ice. Background: VERY LUSH VIBRANT GREEN WINTER VEGETATION.' }
];

async function winterFix() {
    console.log("🌦️ Starting Winter Fix (v2)...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const target of ITEMS_TO_FIX) {
        console.log(`🔍 Searching for ${target.name}...`);
        const { data: items, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', COFFEE_CART_ID)
            .eq('category', 'שתיה קרה')
            .ilike('name', target.name); // Use exact name match for these specific ones

        if (error) {
            console.error(`Error searching for ${target.name}:`, error);
            continue;
        }

        if (!items || items.length === 0) {
            console.log(`⚠️ No items found for ${target.name}`);
            continue;
        }

        for (const item of items) {
            console.log(`🎨 Generating NEW image for ${item.name} (${item.id})...`);

            const prompt = `PRODUCT PHOTOGRAPHY for a cafe in the Jordan Valley. 
**SUBJECT:** "${item.name}". 
**VISUALS:** ${target.logic}
**SURFACE:** Exactly the same rustic weathered wooden table from the reference image.
**BACKGROUND:** MATCH THE REFERENCE STYLE BUT CHANGE THE COLORS: The background must be EXTREMELY LUSH, VIBRANT GREEN. Peak winter in the Jordan Valley - everything is carpeted in green grass, green palm fronds, lush desert shrubs. High-end professional bokeh blur (very blurred). Misty winter sunlight.
**STRICT RULES:**
- PERFECTLY CENTERED.
- NO DECORATIONS (No mint, no straws, no napkins).
- NO PLASTIC CUP for cans - show the metal can only.
- NO GLASS CUPS. ONLY DISPOSABLE CLEAR PLASTIC CUPS or METAL CANS.`;

            try {
                const contents = [
                    { inlineData: { data: base64Seed, mimeType: 'image/png' } },
                    { text: `USE THIS AS REFERENCE FOR TABLE, LIGHTING, AND BLUR: ${prompt}` }
                ];

                const result = await model.generateContent(contents);
                const response = await result.response;

                if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                            const { error: updateError } = await supabase.from('menu_items').update({ image_url: base64Image }).eq('id', item.id);
                            if (updateError) console.error(`Failed to update ${item.name}:`, updateError);
                            else console.log(`✅ ${item.name} updated.`);
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Error generating ${item.name}:`, err.message);
            }
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    console.log("🏁 All requested winter fixes complete!");
}

winterFix().catch(err => {
    console.error("Fatal error in script:", err);
});
