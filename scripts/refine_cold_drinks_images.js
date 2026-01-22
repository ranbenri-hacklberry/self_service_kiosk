import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

const COFFEE_CART_ID = '11111111-1111-1111-1111-111111111111';

// Targeted items for refinement
const TARGET_ITEMS = [
    { name: 'שוקו קר', logic: 'Premium iced cocoa in a clear cup with HEAVY, DISTINCT dark chocolate syrup swirls merging with milk. Filled with ice.' },
    { name: 'קפה קר', logic: 'Classic iced coffee (latte style) in a clear cup. Light coffee-brown milky swirls. Filled with ice. Distinct from cocoa.' },
    { name: 'אייסקפה', logic: 'Coffee slushie (Granita style) with a frosted, crystalline frozen texture. Smooth slush surface. Absolutely NO ice cubes.' },
    { name: 'ברד ענבים', logic: 'Vibrant purple grape slushie with a frosted, crystalline frozen texture. Smooth slush surface. Absolutely NO ice cubes.' },
    { name: 'תפוחים', logic: '100% natural cold-pressed apple juice. Darker, natural opaque green color. Refreshing, filled with ice.' },
    { name: 'פחית', logic: 'A cold aluminum soda can dripping with heavy condensation, sitting on the wooden table. NO CUP.' },
    { name: 'פחית קטנה', logic: 'A small cold aluminum soda can (slim style) dripping with condensation, sitting on the wooden table. NO CUP.' }
];

async function refineImages() {
    console.log("🚀 Starting REFINEMENT for specific Cold Drinks...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const target of TARGET_ITEMS) {
        // 1. Fetch item to get ID
        const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', COFFEE_CART_ID)
            .ilike('name', `%${target.name}%`)
            .eq('category', 'שתיה קרה');

        if (!items || items.length === 0) {
            console.warn(`⚠️ Could not find item: ${target.name}`);
            continue;
        }

        const item = items[0];
        console.log(`🎨 Refining image for: ${item.name} (ID: ${item.id})...`);

        const prompt = `PRODUCT PHOTOGRAPHY for Israeli boutique cafe menu.
**MAIN SUBJECT:** "${item.name}"
**STRICT RULES:**
- THE SUBJECT IS PERFECTLY CENTERED and elevated so it is in the middle of the frame.
- NO DECORATIONS: No mint, no straws, no napkins.
- SPECIFIC TEXTURE: ${target.logic}
- SETTING: Placed on a rustic weathered wooden table.
- BACKGROUND: Beautifully blurred lush green botanical garden with natural sunlight (Jordan Valley style).
- STYLE: High-end, hyper-realistic, 4K resolution.
- NO TEXT, NO LOGOS.`;

        try {
            const result = await model.generateContent([{ text: prompt }]);
            const response = await result.response;

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;

                    // 2. Update Database
                    const { error: updateError } = await supabase
                        .from('menu_items')
                        .update({ image_url: base64Image })
                        .eq('id', item.id);

                    if (updateError) console.error(`❌ Failed to update DB for ${item.name}:`, updateError);
                    else console.log(`✅ ${item.name} refined successfully.`);
                }
            }
        } catch (err) {
            console.error(`❌ Error refining ${item.name}:`, err.message);
        }

        await new Promise(r => setTimeout(r, 2500));
    }

    console.log("🏁 Refinement process finished!");
}

refineImages();
