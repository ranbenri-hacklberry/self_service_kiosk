import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

const COFFEE_CART_ID = '11111111-1111-1111-1111-111111111111';

// Seed image for style consistency (using the successful cocoa centered one)
const SEED_IMAGE_PATH = 'public/cafe-images/item_18_מוקה.png';
let base64Seed = null;
try {
    const seedData = fs.readFileSync(path.resolve(SEED_IMAGE_PATH));
    base64Seed = seedData.toString('base64');
} catch (e) {
    console.warn("⚠️ Could not load seed image, will generate without it.");
}

async function generateAndUpload() {
    console.log("🚀 Starting batch image generation for Coffee Cart - Hot Drinks...");

    // 1. Fetch items
    const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('business_id', COFFEE_CART_ID)
        .eq('category', 'שתיה חמה');

    if (error) {
        console.error("Error fetching items:", error);
        return;
    }

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const item of items) {
        // Skip items that already have Base64 images if you want, but user asked to update all
        console.log(`🎨 Generating image for: ${item.name}...`);

        const isEspresso = item.name.includes('אספרסו');
        const isMilkBased = item.name.includes('הפוך') || item.name.includes('קפוצ') || item.name.includes('לאטה') || item.name.includes('נס');
        const isTea = item.name.includes('תה');
        const isSahlab = item.name.includes('סחלב');

        let customLogic = '';
        if (isEspresso) customLogic = 'Small white ceramic espresso cup with a rich golden crema on top.';
        else if (isMilkBased) customLogic = 'Premium paper coffee cup with beautiful latte art on the foam (heart or rosette).';
        else if (isSahlab) customLogic = 'Creamy white drink in a cup, topped with ground cinnamon and crushed nuts.';
        else if (isTea) customLogic = 'Tea in a premium paper cup, steam rising softly.';
        else customLogic = 'Premium paper coffee cup.';

        const prompt = `PRODUCT PHOTOGRAPHY for Israeli boutique cafe menu.
**MAIN SUBJECT:** "${item.name}"
**STRICT RULES:**
- THE SUBJECT IS PERFECTLY CENTERED vertically and horizontally. Ensure the item is middle-aligned so it is NOT obscured by any UI overlays at the bottom.
- NO DECORATIONS: No spoons outside, no napkins, no cookies on the side.
- ${customLogic}
- SETTING: Placed on a rustic weathered wooden table.
- BACKGROUND: Beautifully blurred lush green botanical garden with natural sunlight (Jordan Valley style).
- STYLE: High-end, hyper-realistic, 4K resolution.
- NO TEXT, NO LOGOS besides generic coffee cup marks.`;

        try {
            const contents = [];
            if (base64Seed) {
                contents.push({
                    inlineData: {
                        data: base64Seed,
                        mimeType: 'image/png'
                    }
                });
                contents.push({ text: `REFERENCE STYLE: Use this image for consistency (lighting, table, background). ${prompt}` });
            } else {
                contents.push({ text: prompt });
            }

            const result = await model.generateContent(contents);
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
                    else console.log(`✅ ${item.name} updated successfully with Base64 image.`);
                }
            }
        } catch (err) {
            console.error(`❌ Error generating ${item.name}:`, err.message);
        }

        // Brief pause to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("🏁 Batch process finished!");
}

generateAndUpload();
