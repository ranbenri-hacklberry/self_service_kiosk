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

// V3 Update: EXTREME FOCUS on subject, BLURRED background
const BACKGROUND_PROMPT = `
    SETTING: Placed on a rustic wooden surface (very close up).
    BACKGROUND: Extreme Bokeh / Blur. Just hints of green nature and mountains. 
    The background MUST be out of focus.
    COMPOSITION: The food/drink item FILLS 80% OF THE FRAME.
    It is a MACRO / CLOSE-UP shot.
`;

const ITEMS = [
    {
        id: 12, name: 'הפוך קטן', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        prompt: 'Small Cappuccino foam art close up. White paper takeaway cup.',
        container: 'White paper takeaway cup'
    },
    {
        id: 48, name: 'שלושת השוקולדים', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/3chocolate.jpeg',
        prompt: 'Tricolad Mousse Cake slice close up. Visible layers of chocolate.',
        container: 'Small minimalist plate'
    },
    {
        id: 3, name: 'סלט חסלק', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beetrootsalad.png',
        prompt: 'Beet and Salanova Lettuce Salad (Hasalak) bowl close up. Fresh texture.',
        container: 'Brown kraft paper bowl'
    },
    {
        id: 5, name: 'כריך סלק', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beets.png',
        prompt: 'Beet Sandwich close up. Generous filling bursting out.',
        container: 'Wooden serving board'
    },
    {
        id: 49, name: 'אלפחורס', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/alphaores.jpeg',
        prompt: 'Alfajores cookies macro shot. Crumbly texture.',
        container: 'Classic cafe saucer'
    },
    {
        id: 22, name: 'קפה קר',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/coldcoffee.png',
        prompt: 'Iced Coffee close up. Ice cubes and condensation droplets.',
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
    console.log(`🎨 Generating V3 (Macro): ${item.name}...`);
    const base64Seed = await getBase64FromUrl(item.seedUrl);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    const fullPrompt = `Professional MACRO Food Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM:
    - ${item.prompt} (Container: ${item.container})
    
    INSTRUCTIONS:
    - SUBJECT IS HUGE IN THE FRAME.
    - BACKGROUND IS VERY BLURRED.
    - SHARP DETAILS on the food texture/foam/droplets.
    - Use REFERENCE IMAGE for visual identity.`;

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
                console.log(`✅ Saved V3: ${filename}`);
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Error: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Round 3 (Macro Focus)...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
