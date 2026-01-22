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
let base64Seed = fs.readFileSync(path.resolve(SEED_IMAGE_PATH)).toString('base64');

const ITEMS_TO_FIX = [
    { name: 'שוקו קר', logic: 'Tall clear plastic cup with internal dark chocolate syrup swirls and ice. Background: LUSH WINTER GREEN.' },
    { name: 'פחית קטנה', logic: 'A slim silver aluminum soda can with condensation droplets. ABSOLUTELY NO PLASTIC CUP. Standing directly on the wood.' },
    { name: 'פחית', logic: 'A classic red aluminum soda can with condensation droplets. ABSOLUTELY NO PLASTIC CUP. Standing directly on the wood.' },
    { name: 'תפוזים', logic: 'Tall clear plastic cup with bright orange juice and ice. Background: LUSH WINTER GREEN.' },
    { name: 'תפוחים', logic: 'Tall clear plastic cup with DARK OPAQUE COLD-PRESSED APPLE JUICE and ice. Background: LUSH WINTER GREEN.' },
    { name: 'אייסקפה', logic: 'Tall clear plastic cup with brown coffee slushie texture. Background: LUSH WINTER GREEN.' },
    { name: 'קפה קר', logic: 'Tall clear plastic cup with iced coffee and ice. Background: LUSH WINTER GREEN.' }
];

async function winterFix() {
    console.log("🌦️ Applying Winter Jordan Valley aesthetic (Lush Green) and fixing Cans...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const target of ITEMS_TO_FIX) {
        const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', COFFEE_CART_ID)
            .ilike('name', `%${target.name}%`);

        if (!items || items.length === 0) continue;
        const item = items[0];
        console.log(`🎨 Fixing ${item.name}...`);

        const prompt = `PRODUCT PHOTOGRAPHY. 
**SUBJECT:** "${item.name}". 
**SPECIFICS:** ${target.logic}
**SURFACE:** Rustic weathered wooden table (matching reference).
**BACKGROUND:** MATCH REFERENCE BLUR STYLE but change to PEAK WINTER JORDAN VALLEY: Extremely LUSH, VIBRANT GREEN vegetation, green palm trees, distant desert mountains, misty atmosphere, soft winter sunlight. HIGH-END BOKEH BLUR.
**STRICT RULES:**
- CENTERED PERFECTLY.
- NO DECORATIONS (No mint, no straws, no napkins).
- NO PLASTIC CUP for cans - show the metal can only.`;

        try {
            const contents = [
                { inlineData: { data: base64Seed, mimeType: 'image/png' } },
                { text: `STYLE REFERENCE FOR TABLE AND BLUR INTENSITY: ${prompt}` }
            ];

            const result = await model.generateContent(contents);
            const response = await result.response;

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    await supabase.from('menu_items').update({ image_url: base64Image }).eq('id', item.id);
                    console.log(`✅ ${item.name} updated with Winter Green.`);
                }
            }
        } catch (err) {
            console.error(`❌ Error on ${item.name}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 4000));
    }
    console.log("🏁 Winter Green aesthetic applied.");
}

winterFix();
