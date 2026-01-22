import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

const COFFEE_CART_ID = '11111111-1111-1111-1111-111111111111';

// Seed image for style consistency
const SEED_IMAGE_PATH = 'public/cafe-images/item_22_קפה קר.png';
let base64Seed = null;
try {
    const seedData = fs.readFileSync(path.resolve(SEED_IMAGE_PATH));
    base64Seed = seedData.toString('base64');
} catch (e) {
    console.warn("⚠️ Could not load seed image, will generate without it.");
}

async function generateAndUpload() {
    console.log("🚀 Starting batch image generation for Coffee Cart - Cold Drinks...");

    // 1. Fetch items
    const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('business_id', COFFEE_CART_ID)
        .eq('category', 'שתיה קרה');

    if (error) {
        console.error("Error fetching items:", error);
        return;
    }

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const item of items) {
        console.log(`🎨 Generating image for: ${item.name}...`);

        const isShake = item.name.includes('שייק') || item.name.includes('מילקשייק');
        const isCocoa = item.name.includes('שוקו');

        const prompt = `PRODUCT PHOTOGRAPHY for Israeli boutique cafe menu.
**MAIN SUBJECT:** "${item.name}"
**STRICT RULES:**
- THE SUBJECT IS PERFECTLY CENTERED and fills 75-80% of the frame.
- NO DECORATIONS: No mint leaves, no straws, no umbrellas.
- ICE: ${isShake ? 'NO ICE CUBES.' : 'Filled with crystal clear ice cubes.'}
- SPECIAL: ${isCocoa ? 'Beautiful rich chocolate syrup swirls merging with the milk.' : 'Clean presentation.'}
- CONTAINER: Clear plastic cup.
- SETTING: Placed on a rustic weathered wooden table.
- BACKGROUND: Beautifully blurred lush green botanical garden with natural sunlight (Jordan Valley style).
- STYLE: High-end, hyper-realistic, 4K resolution.
- NO TEXT, NO LOGOS.`;

        try {
            const contents = [];
            if (base64Seed) {
                contents.push({
                    inlineData: {
                        data: base64Seed,
                        mimeType: 'image/png'
                    }
                });
                contents.push({ text: `REFERENCE STYLE: Use this image for style consistency (lighting, table, background). ${prompt}` });
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
