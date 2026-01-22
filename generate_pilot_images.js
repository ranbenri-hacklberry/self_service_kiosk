import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const API_KEY = envConfig.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ No VITE_GEMINI_API_KEY found in .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

const PILOT_ITEMS = [
    {
        id: 12, 
        name: 'הפוך קטן', 
        category: 'שתיה חמה',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG',
        prompt: 'Israeli Hafuch (Cappuccino) in a branded white paper takeaway cup. Professional coffee photography, desert landscape background in soft bokeh. The coffee has perfect latte art on the foam.',
        container: 'White paper takeaway cup'
    },
    {
        id: 48, 
        name: 'שלושת השוקולדים', 
        category: 'קינוחים',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/3chocolate.jpeg',
        prompt: 'Tricolad Cake (Three Chocolates Mousse) slice. Layers of white, milk, and dark chocolate clearly visible. Served on a minimalist white plate. Soft, appetizing desert golden hour lighting.',
        container: 'Minimalist white plate'
    },
    {
        id: 3, 
        name: 'סלט חסלק', 
        category: 'סלטים',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beetrootsalad.png',
        prompt: 'Fresh Salanova lettuce and beet salad (Hasalak) in a brown kraft paper salad bowl. Vibrant red beets, green leaves, walnuts/cheese toppings. Desert picnic style background.',
        container: 'Brown kraft paper bowl'
    },
    {
        id: 5, 
        name: 'כריך סלק', 
        category: 'טוסטים וכריכים',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/beets.png',
        prompt: 'Fresh Beet Sandwich on rustic bread (or croissant/baguette depending on seed). Fresh ingredients bursting out. Served on a wooden board or butcher paper. High quality deli style.',
        container: 'Wooden serving board'
    },
    {
        id: 49,
        name: 'אלפחורס',
        category: 'מאפים',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/alphaores.jpeg',
        prompt: 'Alfajores cookies (dulce de leche sandwich cookie with coconut). Stacked or arranged beautifully on a small ceramic plate. Bakery freshness, crumbly texture using macro lens.',
        container: 'Small ceramic plate'
    },
    {
        id: 22,
        name: 'קפה קר',
        category: 'שתיה קרה',
        seedUrl: 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/coldcoffee.png',
        prompt: 'Iced Coffee in a clear plastic takeaway cup with straw. Layers of coffee and milk, ice cubes visible. Condensation on the cup (fresh and cold). Desert background.',
        container: 'Clear plastic takeaway cup'
    }
];

const OUTPUT_DIR = 'public/cafe-images'; // We write directly to the main folder now as per user request flow implies replacing
if (!fs.existsSync(OUTPUT_DIR)){
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getBase64FromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer).toString('base64');
    } catch (e) {
        console.error(`Failed to fetch ${url}: ${e.message}`);
        return null;
    }
}

async function generateImage(item) {
    console.log(`🎨 Generating: ${item.name}...`);
    
    const base64Seed = await getBase64FromUrl(item.seedUrl);
    if (!base64Seed) {
        console.log("Skipping due to missing seed.");
        return;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    // We construct a prompt that uses the seed image heavily but applies the "Desert Edge" style
    const prompt = `Product Photography of "${item.name}".
    CONTEXT: Israeli boutique cafe menu.
    STYLE: "Desert Edge" (clean, bright, soft shadows, desert landscape background hint).
    CONTAINER: ${item.container}.
    
    INSTRUCTIONS:
    - Use the REFERENCE IMAGE for the composition and subject appearance.
    - IMPROVE the lighting to professional food photography standards.
    - Ensure the subject is CENTERED and fills 75% of frame.
    - NO TEXT, NO WATERMARKS.
    - ${item.prompt}`;

    try {
        const result = await model.generateContent([
            { inlineData: { data: base64Seed, mimeType: "image/jpeg" } }, // Assuming jpegs/pngs, model handles generic image types well or we can detect.
            { text: prompt }
        ]);
        
        const response = await result.response;
        const candidate = response.candidates[0];
        
        let saved = false;
        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    const buffer = Buffer.from(part.inlineData.data, 'base64');
                    // We save with the exact filename format expected by the frontend hook
                    // /cafe-images/item_{id}_{name}.png
                    const filename = `item_${item.id}_${item.name}.png`; 
                    const filepath = path.join(OUTPUT_DIR, filename);
                    
                    fs.writeFileSync(filepath, buffer);
                    console.log(`✅ Saved: ${filename}`);
                    saved = true;
                    break;
                }
            }
        }
        
        if (!saved) console.error(`❌ No image data returned for ${item.name}`);

    } catch (error) {
        console.error(`❌ Error generating ${item.name}: `, error.message);
    }
}

async function run() {
    console.log("🚀 Starting Pilot Generation with Remote Seeds...");
    for (const item of PILOT_ITEMS) {
        await generateImage(item);
    }
    console.log("🏁 Done!");
}

run();
