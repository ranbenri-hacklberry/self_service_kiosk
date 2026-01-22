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
        prompt: 'Hot Tea in a white paper cup. Steam rising. Next to the cup: Luxury black tea boxes/sachets with a PINK FLOWER LOGO and pink cinematic text. Elegant tea service vibe.',
        container: 'White paper cup'
    },
    {
        id: 126, name: 'סחלב', 
        prompt: 'Sahlab dessert drink. Thick white creamy drink in a paper cup. Topped with cinnamon powder and coconut flakes and walnuts. Winter comfort drink.',
        container: 'White paper cup'
    },
    {
        id: 20, name: 'קפה שחור', 
        prompt: 'Black Coffee (Turkish style) in a paper cup. Dark intense liquid, small foam bubbles on top. Steam rising.',
        container: 'White paper cup'
    },
    {
        id: 19, name: 'נס על חלב', 
        prompt: 'Nes al Halav (Instant Coffee on Milk). Light creamy brown color. Simple comforting home-style coffee in a paper cup.',
        container: 'White paper cup'
    },
    {
        id: 18, name: 'מוקה', 
        prompt: 'Cafe Mocha. Coffee mixed with chocolate. Darker foam, chocolate sprinkles on top.',
        container: 'White paper cup'
    },
    {
        id: 15, name: 'שוקו קטן', 
        prompt: 'Hot Chocolate (Small). Rich brown creamy cocoa drink. Marshmallows or foam on top.',
        container: 'Small compact paper cup'
    },
    {
        id: 16, name: 'שוקו גדול', 
        prompt: 'Hot Chocolate (Large). Very wide FAT cup. Rich brown cocoa. Whipped cream topping.',
        container: 'Wide/Fat paper cup'
    },
    {
        id: 17, name: 'שוקו פרלינים', 
        prompt: 'Praline Hot Chocolate. Luxurious hot cocoa with visible chocolate Pralines/Cubes melting inside/next to it. Rich texture.',
        container: 'White paper cup'
    },
    {
        id: 10, name: 'אספרסו', 
        prompt: 'Espresso shot in a VERY SMALL (Short) paper cup. Dark crema. Intense coffee.',
        container: 'Mini/Espresso paper cup'
    },
    {
        id: 14, name: 'אמריקנו', 
        prompt: 'Americano. Black coffee with hot water. Thin crema layer. Clean look.',
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
    console.log(`☕ Generating: ${item.name}...`);
    const base64Seed = await getBase64FromUrl(GLOBAL_SEED_URL);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    // We override the visual content while keeping the composition
    const fullPrompt = `Professional Beverage Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM:
    - ${item.prompt}
    
    INSTRUCTIONS:
    - MODIFY the content of the cup to match "${item.name}" (Tea, Black Coffee, Choco, etc.).
    - Maintain the "Hasalak Salad" background style.
    - ${item.name.includes('גדול') ? 'MAKE IT WIDE/FAT' : ''}
    - ${item.name.includes('קטן') || item.name.includes('אספרסו') ? 'MAKE IT COMPACT/SHORT' : ''}`;

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
                console.log(`✅ Saved: ${filename}`);
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Error: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Hot Drinks Generation...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
