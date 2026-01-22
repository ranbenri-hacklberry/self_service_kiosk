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
const GLOBAL_SEED_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG';

const BACKGROUND_PROMPT = `
    SETTING: Rustic wood surface.
    BACKGROUND: Blurred abstract nature (Green/Brown Bokeh).
    CONTENT: NO buildings.
    FOCUS: Macro / Close up on the cup.
`;

const ITEMS = [
    {
        id: 21, name: 'תה', 
        prompt: 'Hot Tea in a WIDE FAT white paper cup. Steam rising. Next to the cup: SMALL luxury tea boxes with a PINK FLOWER LOGO (boxes are small, about 1/4 of cup size).',
        container: 'Wide FAT white paper cup'
    },
    {
        id: 18, name: 'מוקה', 
        prompt: 'Cafe Mocha in a WIDE FAT large cup. Coffee mixed with chocolate. Dark rich foam, NO whipped cream.',
        container: 'Wide FAT white paper cup'
    },
    {
        id: 15, name: 'שוקו קטן', 
        prompt: 'Hot Chocolate (Small) in a compact paper cup. Rich brown creamy cocoa. NO whipped cream, just natural hot cocoa surface.',
        container: 'Small compact paper cup'
    },
    {
        id: 16, name: 'שוקו גדול', 
        prompt: 'Hot Chocolate (Large) in a VERY WIDE FAT cup. Rich brown cocoa. NO whipped cream, natural surface.',
        container: 'Wide/Fat paper cup'
    },
    {
        id: 17, name: 'שוקו פרלינים', 
        prompt: 'Praline Hot Chocolate in a WIDE FAT large cup. Luxurious hot cocoa with visible chocolate Pralines pieces on top. NO whipped cream.',
        container: 'Wide FAT white paper cup'
    },
    {
        id: 14, name: 'אמריקנו', 
        prompt: 'Americano in a WIDE FAT large cup. Black coffee with hot water. Thin crema layer.',
        container: 'Wide FAT white paper cup'
    },
    {
        id: 19, name: 'נס על חלב', 
        prompt: 'Nes al Halav (Instant Coffee on Milk). White milk with foam on top, and VISIBLE 2 TEASPOONS OF INSTANT COFFEE POWDER sprinkled on the foam surface (not mixed in). The powder is dark brown, sitting on white foam.',
        container: 'Standard white paper cup'
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
    console.log(`☕ Generating V2: ${item.name}...`);
    const base64Seed = await getBase64FromUrl(GLOBAL_SEED_URL);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    const fullPrompt = `Professional Beverage Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM:
    - ${item.prompt}
    - Container: ${item.container}
    
    INSTRUCTIONS:
    - Apply all size/style rules from the prompt.
    - NO WHIPPED CREAM unless explicitly stated.
    - Background matches Hasalak Salad style.`;

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
                console.log(`✅ Saved V2: ${filename}`);
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Error: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Hot Drinks V2 (Fixes)...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
