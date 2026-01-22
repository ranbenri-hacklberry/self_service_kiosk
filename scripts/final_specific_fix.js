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

const SPECIFIC_FIXES = [
    { name: 'תפוזים', logic: 'A tall clear disposable plastic cup filled with bright orange juice and ice. STANDING ON THE WOODEN TABLE. MATCH CUP STYLE FROM REFERENCE. Background: LUSH WINTER GREEN Jordan Valley.' },
    { name: 'פחית קטנה', logic: 'A slim silver/gray aluminum soda can (cold, with condensation). STANDING DIRECTLY ON THE WOODEN TABLE. NO PLASTIC CUP. NO GLASS. Background: LUSH WINTER GREEN Jordan Valley.' },
    { name: 'פחית', logic: 'A classic colorful aluminum soda can (cold, with condensation). STANDING DIRECTLY ON THE WOODEN TABLE. NO PLASTIC CUP. NO GLASS. Background: LUSH WINTER GREEN Jordan Valley.' },
    { name: 'טרופית', logic: 'A standard Israeli "Tropit" pouch (juice pouch) with the straw poked into it. STANDING ON THE WOODEN TABLE. NO CUP. Background: LUSH WINTER GREEN Jordan Valley.' }
];

async function finalSpecificFix() {
    console.log("🌦️ Fixing specific items: תפוזים, פחיות, טרופית (Lush Winter Jordan Valley)...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const target of SPECIFIC_FIXES) {
        const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', COFFEE_CART_ID)
            .ilike('name', target.name);

        if (!items || items.length === 0) continue;

        for (const item of items) {
            console.log(`🎨 Regenerating: ${item.name} (${item.id})...`);

            const prompt = `PRODUCT PHOTOGRAPHY for a cafe in the Jordan Valley desert in peak winter (everything is lush and green).
**SUBJECT:** "${item.name}". 
**VISUALS:** ${target.logic}
**SURFACE:** Exactly the same rustic weathered wooden table from the reference image.
**BACKGROUND:** MATCH THE REFERENCE STYLE: The background must be EXTREMELY LUSH, VIBRANT GREEN WINTER BOTANICAL (grass, palms, shrubs). Professional bokeh blur. Warm winter sunlight.
**STRICT RULES:**
- CENTERED PERFECTLY.
- NO DECORATIONS (No mint, no straws, no napkins).
- NO PLASTIC CUPS FOR CANS.`;

            try {
                const contents = [
                    { inlineData: { data: base64Seed, mimeType: 'image/png' } },
                    { text: `REFERENCE FOR LIGHTING, TABLE, AND BLUR: ${prompt}` }
                ];

                const result = await model.generateContent(contents);
                const response = await result.response;

                if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                            await supabase.from('menu_items').update({ image_url: base64Image }).eq('id', item.id);
                            console.log(`✅ ${item.name} fixed.`);
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Error on ${item.name}:`, err.message);
            }
            await new Promise(r => setTimeout(r, 4000));
        }
    }
    console.log("🏁 All specific fixes done.");
}

finalSpecificFix();
