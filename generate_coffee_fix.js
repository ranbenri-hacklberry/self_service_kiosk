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

const BACKGROUND_PROMPT = `
    SETTING: Placed on a natural wooden surface close up.
    BACKGROUND: Extremely blurred natural background (Heavy Bokeh).
    COLORS: Mix of earthy brown tones and soft green vegetation.
    CONTENT: NO buildings. Just abstract nature colors.
`;

const ITEMS = [
    {
        id: 12, name: 'הפוך קטן', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        prompt: 'Small Cappuccino (Hafuch) in a white paper takeaway cup. Viewing angle 45 degrees to see the beautiful HEART SHAPE latte art on top. Rich coffee color.',
        container: 'Small White paper takeaway cup'
    },
    {
        id: 13, name: 'הפוך גדול', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        prompt: 'Large Cappuccino (Hafuch) in a LARGE white paper takeaway cup. Viewing angle 45 degrees. Impressive latte art. Steam rising gently.',
        container: 'Large White paper takeaway cup'
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
    console.log(`☕ Generating Coffee Fix: ${item.name}...`);
    const base64Seed = await getBase64FromUrl(item.seedUrl);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    const fullPrompt = `Professional Coffee Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM:
    - ${item.prompt}
    - Container: ${item.container}
    
    INSTRUCTIONS:
    - FOCUS on the foam texture and the cup.
    - MAKE IT LOOK APPETIZING and WARM.
    - Background matches the "Hasalak Salad" style (green/brown blur).`;

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
                console.log(`✅ Saved Coffee: ${filename}`);
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Error: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Coffee Fix...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
