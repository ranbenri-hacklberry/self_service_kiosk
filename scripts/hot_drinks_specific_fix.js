
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Force the API key from environment if dotenv fails
const apiKey = process.env.VITE_GEMINI_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });

const WINTER_JORDAN_VALLEY_PROMPT = `Background is a VERY LUSH VIBRANT GREEN WINTER Jordan Valley vegetation. Soft, misty winter morning atmosphere with vibrant green palms, desert shrubs, and blooming local greenery. EXTREME BOKEH BLUR so the background is a beautiful wash of vibrant greens and soft light.`;

const HOT_DRINKS_FIX = [
    {
        name: 'הפוך קטן',
        prompt: `A small disposable white paper coffee cup with a regular cappuccino inside. Smooth, creamy, PURE WHITE microfoam on top with a simple latte art heart. ABSOLUTELY NO CHOCOLATE SPRINKLES. NO CINNAMON. Pure white foam. Perfectly centered on a rustic weathered wooden surface. ${WINTER_JORDAN_VALLEY_PROMPT} Soft winter morning lighting.`
    },
    {
        name: 'הפוך גדול',
        prompt: `A TALL disposable white paper coffee cup with a large cappuccino inside. Smooth, creamy, PURE WHITE microfoam on top with a simple latte art heart. The cup MUST be visibly taller and larger than a standard cup. ABSOLUTELY NO CHOCOLATE SPRINKLES. Perfectly centered on a rustic weathered wooden surface. ${WINTER_JORDAN_VALLEY_PROMPT} Soft winter morning lighting.`
    },
    {
        name: 'אספרסו',
        prompt: `A small disposable paper mini espresso cup (4oz size). Rich brown crema with beautiful marbling on top. ABSOLUTELY NO CERAMIC MUGS. Only a tiny disposable paper cup. Perfectly centered on a rustic weathered wooden surface. ${WINTER_JORDAN_VALLEY_PROMPT} Soft winter morning lighting.`
    },
    {
        name: 'סחלב',
        prompt: `A standard disposable white paper cup filled with hot Sahlab (creamy white Middle Eastern pudding drink). Topped with crushed pistachios and a pinch of cinnamon. ABSOLUTELY NO CERAMIC MUGS. Only a disposable white paper cup. Perfectly centered on a rustic weathered wooden surface. ${WINTER_JORDAN_VALLEY_PROMPT} Soft winter morning lighting.`
    }
];

async function updateHotDrinks() {
    if (!apiKey) {
        console.error('❌ Missing VITE_GEMINI_API_KEY in environment');
        return;
    }

    console.log('🚀 Starting Hot Drinks Aesthetic Fix (including Sahlab)...');

    for (const target of HOT_DRINKS_FIX) {
        console.log(`\n🔍 Processing: ${target.name}`);

        const { data: items } = await supabase
            .from('menu_items')
            .select('id, name')
            .ilike('name', target.name);

        if (!items || items.length === 0) {
            console.log(`❌ Item not found: ${target.name}`);
            continue;
        }

        for (const item of items) {
            try {
                console.log(`🎨 Generating for ${item.name} (ID: ${item.id})...`);
                const result = await model.generateContent(target.prompt);
                const response = await result.response;
                const base64Image = response.candidates[0].content.parts[0].inlineData.data;

                const { error: updateError } = await supabase
                    .from('menu_items')
                    .update({ image_url: `data:image/png;base64,${base64Image}` })
                    .eq('id', item.id);

                if (updateError) throw updateError;
                console.log(`✅ Updated ${item.name}`);
            } catch (e) {
                console.error(`Error for ${item.name}:`, e.message);
            }
        }
    }
    console.log('\n✨ Hot drinks update complete.');
}

updateHotDrinks();
