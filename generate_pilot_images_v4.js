import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const API_KEY = envConfig.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ No VITE_GEMINI_API_KEY");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// V4: THE GOLD STANDARD BACKGROUND (Based on Hasalak Salad success)
const BACKGROUND_PROMPT = `
    SETTING: Placed on a natural wooden surface/counter close up.
    BACKGROUND: Extremely blurred natural background (Heavy Bokeh).
    COLORS: Mix of earthy brown tones and soft green vegetation.
    CONTENT: NO buildings, NO walls, NO architecture, NO people. Just abstract nature colors.
    FOCUS: The item is the only sharp thing in the image.
`;

const ITEMS = [
    {
        id: 12, name: 'הפוך קטן', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        prompt: 'Small Cappuccino (Hafuch) in a white paper takeaway cup. Perfect foam art. Close up macro.',
        container: 'White paper takeaway cup'
    },
    {
        id: 48, name: 'שלושת השוקולדים', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/3chocolate.jpeg',
        prompt: 'Tricolad Mousse Cake slice macro. Layers of white, milk, and dark chocolate. Moist texture.',
        container: 'Small minimalist plate'
    },
    // Skipping Salad 3 because it is already perfect as per user feedback
    {
        id: 5, name: 'כריך סלק', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beets.png',
        prompt: 'Fresh Beet Sandwich close up. Generous filling of beets, cheese, and greens. Rustic fresh bread.',
        container: 'Wooden serving board'
    },
    {
        id: 49, name: 'אלפחורס', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/alphaores.jpeg',
        prompt: 'Alfajores cookies macro shot. Soft cookie texture, coconut flakes visible.',
        container: 'Classic cafe saucer'
    },
    {
        id: 22, name: 'קפה קר',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/coldcoffee.png',
        prompt: 'Iced Coffee in clear plastic cup macro. Distinct coffee and milk layers. Ice cubes. ZERO background structures.',
        container: 'Clear plastic cup'
    }
];

const OUTPUT_DIR = 'public/cafe-images';

async function getBase64FromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer).toString('base64');
    } catch (e) { return null; }
}

async function generateImage(item) {
    console.log(`🎨 Generating V4 (Gold Standard): ${item.name}...`);
    const base64Seed = await getBase64FromUrl(item.seedUrl);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    const fullPrompt = `Professional MACRO Food Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM:
    - ${item.prompt} (Container: ${item.container})
    
    INSTRUCTIONS:
    - MAKE IT LOOK LIKE THE "HASALAK SALAD" REFERENCE STYLE.
    - BACKGROUND MUST BE AMBIGUOUS NATURE BLUR (Green/Brown).
    - NO BUILDINGS OR STRUCTURES!
    - Use REFERENCE IMAGE for composition.`;

    try {
        const result = await model.generateContent([
            { inlineData: { data: base64Seed, mimeType: "image/jpeg" } },
            { text: fullPrompt }
        ]);
        
        const response = await result.response;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const buffer = Buffer.from(part.inlineData.data, 'base64');
                const filename = `item_${item.id}_${item.name}.png`;
                fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);
                console.log(`✅ Saved V4: ${filename}`);
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Error: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Round 4 (Fixing Backgrounds)...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
