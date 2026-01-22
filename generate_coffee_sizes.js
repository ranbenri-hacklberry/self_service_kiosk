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
    SETTING: Rustic wood surface.
    BACKGROUND: Blurred abstract nature (Green/Brown Bokeh).
    CONTENT: NO buildings.
`;

const ITEMS = [
    {
        id: 12, name: 'הפוך קטן', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        // KEY: Focus on the TOP ART and COMPACTNESS
        prompt: 'Small Cappuccino (Hafuch) in a SHORT, COMPACT white paper cup. View Angle: 60 degrees (Top-Side). Focus on the heart art. Looks cute and concentrated.',
        container: 'Short white paper cup'
    },
    {
        id: 13, name: 'הפוך גדול', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        // KEY: Focus on HEIGHT and SIZE
        prompt: 'EXTRA LARGE Cappuccino (Hafuch) in a VERY TALL white paper cup. View Angle: 15 degrees (Side View). Shows the vertical height of the cup. Looks massive and generous. A teaspoon leans against it for scale.',
        container: 'Tall/XL white paper cup'
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
    console.log(`☕ Generating Size Diff: ${item.name}...`);
    const base64Seed = await getBase64FromUrl(item.seedUrl);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    // We add distinct instructions for aspect ratio illusion
    const fullPrompt = `Professional Coffee Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM:
    - ${item.prompt}
    
    INSTRUCTIONS:
    - MAKE THE SIZE DIFFERENCE OBVIOUS through angle and proportions.
    - Small = Top heavy, short.
    - Large = Tall, side heavy.
    - Background matches the Hasalak Salad style.`;

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
                console.log(`✅ Saved Size Diff: ${filename}`);
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Error: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Coffee Size Difference Generation...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
