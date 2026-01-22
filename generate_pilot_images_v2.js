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

// Updated Background Vibe based on user photo
const BACKGROUND_PROMPT = `
    SETTING: Placed on a high-quality rustic wooden counter/table.
    BACKGROUND: A stunning panoramic view of the Jordan Valley/Desert mountains in WINTER. 
    The landscape is GREEN and lush due to rain, with a wooden deck terrace visible.
    Atmosphere is fresh, airy, with soft natural finish. 
    NO placing food on the ground. ALWAYS on a table/counter.
`;

const ITEMS = [
    {
        id: 12, name: 'הפוך קטן', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        prompt: 'Small Cappuccino (Hafuch) in a white paper takeaway cup. Professional art on foam.',
        container: 'White paper takeaway cup'
    },
    {
        id: 48, name: 'שלושת השוקולדים', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/3chocolate.jpeg',
        prompt: 'Tricolad Mousse Cake slice. Layers of white, milk, and dark chocolate. Appetizing, moist texture.',
        container: 'Small minimalist plate'
    },
    {
        id: 3, name: 'סלט חסלק', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beetrootsalad.png',
        prompt: 'Beet and Salanova Lettuce Salad (Hasalak) in a brown kraft paper salad bowl. Fresh red beets, green leaves, toppings.',
        container: 'Brown kraft paper bowl'
    },
    {
        id: 5, name: 'כריך סלק', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beets.png',
        prompt: 'Fresh Beet Sandwich with cheese and greens. Generous filling. Rustic bread.',
        container: 'Wooden serving board or butcher paper'
    },
    {
        id: 49, name: 'אלפחורס', 
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/alphaores.jpeg',
        prompt: 'Alfajores cookies (dulce de leche & coconut). Soft, crumbly, sweet. Stacked nicely.',
        container: 'Classic cafe saucer'
    },
    {
        id: 22, name: 'קפה קר',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/coldcoffee.png',
        prompt: 'Iced Coffee in clear plastic cup. Distinct layers of espresso and milk. Ice cubes. Condensation on cup.',
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
    console.log(`🎨 Generating V2: ${item.name}...`);
    const base64Seed = await getBase64FromUrl(item.seedUrl);
    if (!base64Seed) return;

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    // Combine item prompt with the new global background prompt
    const fullPrompt = `Professional Food Photography of "${item.name}".
    ${BACKGROUND_PROMPT}

    ITEM SPECIFIC:
    - ${item.prompt}
    - Container: ${item.container}
    
    INSTRUCTIONS:
    - CENTERED subject.
    - SHARP FOCUS on the food/drink.
    - Background slightly blurred (bokeh) but clearly showing the green mountain view/deck.
    - Use the REFERENCE IMAGE for composition.`;

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
    console.log("🚀 Starting Round 2 (Winter/Green View)...");
    for (const item of ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
