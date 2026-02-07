
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Constants
const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('Environment Debug:', {
        hasGemini: !!GEMINI_API_KEY,
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SUPABASE_SERVICE_KEY
    });
    console.error('❌ Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Image Assets
const LOGO_PATH = path.join(__dirname, '../public/assets/logo-text.png');
const BACKGROUND_IMAGE_PATH = path.join(__dirname, '../uploaded_media_1770193838744.jpg');

async function getBase64(filePath) {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${data.toString('base64')}`;
    }
    return null;
}

async function generateWithGemini(prompt, businessLogoBase64, backgroundBase64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`;

    const contents = [];

    if (businessLogoBase64) {
        contents.push({
            inlineData: {
                data: businessLogoBase64.split(',')[1],
                mimeType: "image/png"
            }
        });
        contents.push({ text: "REFERENCE LOGO: Use this logo on the coffee cup sticker." });
    }

    if (backgroundBase64) {
        contents.push({
            inlineData: {
                data: backgroundBase64.split(',')[1],
                mimeType: "image/jpeg"
            }
        });
        contents.push({ text: "REFERENCE BACKGROUND: Place the coffee cup on the white wooden counter in this exact desert nursery setting." });
    }

    contents.push({ text: prompt });

    const payload = {
        contents: [{ parts: contents }],
        generationConfig: {
            responseModalities: ["IMAGE"]
        }
    };

    try {
        const response = await axios.post(url, payload);
        const candidates = response.data.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (error) {
        console.error('❌ Gemini Error:', error.response?.data || error.message);
    }
    return null;
}

// Menu Items to process
const ITEMS_TO_UPDATE = [
    {
        name: 'הפוך גדול',
        prompt: 'A large tall disposable paper cup with "הפוך גדול" (Cappuccino/Latte) and latte art. Kraft sticker shows logo and handwritten Hebrew: "נועה - הפוך גדול - חלב שיבולת". Extreme close-up on counter.'
    },
    {
        name: 'הפוך קטן',
        prompt: 'A small short disposable paper cup with "הפוך קטן" (Cappuccino/Latte) and latte art. Kraft sticker shows logo and handwritten Hebrew: "ליאת - הפוך קטן - חלב סויה". Extreme close-up on counter.'
    },
    {
        name: 'קפה שחור',
        prompt: 'A disposable paper cup with steaming hot black coffee (קפה שחור). Kraft sticker shows logo and handwritten Hebrew: "אבי - קפה שחור - רותח!". Extreme close-up on counter.'
    },
    {
        name: 'שוקו גדול',
        prompt: 'A large tall disposable paper cup with hot chocolate (שוקו). Kraft sticker shows logo and handwritten Hebrew: "עידו - שוקו גדול". Extreme close-up on counter.'
    },
    {
        name: 'שוקו קטן',
        prompt: 'A small disposable paper cup with hot chocolate (שוקו). Kraft sticker shows logo and handwritten Hebrew: "אלון - שוקו קטן". Extreme close-up on counter.'
    },
    {
        name: 'סחלב',
        prompt: 'A disposable paper cup with creamy Sahlab topped with coconut and nuts. Kraft sticker shows logo and handwritten Hebrew: "יעל - סחלב - בלי קצף". Extreme close-up on counter.'
    },
    {
        name: 'נס על חלב',
        prompt: 'A disposable paper cup with Nes coffee on milk. Kraft sticker shows logo and handwritten Hebrew: "משה - נס על חלב". Extreme close-up on counter.'
    },
    {
        name: 'אמריקנו',
        prompt: 'A disposable paper cup with hot Americano. Kraft sticker shows logo and handwritten Hebrew: "רועי - אמריקנו חם - רותח". Extreme close-up on counter.'
    },
    {
        name: 'אמריקנו קר',
        prompt: 'A clear disposable plastic cup with iced Americano and ice cubes. Kraft sticker shows logo and handwritten Hebrew: "עומר - אמריקנו קר". Extreme close-up on counter.'
    },
    {
        name: 'אספרסו',
        prompt: 'A tiny disposable paper cup for a single espresso shot. Kraft sticker shows logo and handwritten Hebrew: "יוסי - אספרסו קצר". Extreme close-up on counter.'
    }
];

async function run() {
    console.log('🚀 Starting Midbar Menu Image Update for business עגלת קפה...');

    const logoBase64 = await getBase64(LOGO_PATH);
    const backgroundBase64 = await getBase64(BACKGROUND_IMAGE_PATH);

    for (const item of ITEMS_TO_UPDATE) {
        console.log(`🖼️ Processing: ${item.name}...`);

        // Find existing item to get its ID
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('id')
            .eq('business_id', BUSINESS_ID)
            .ilike('name', `%${item.name}%`);

        if (!menuItems || menuItems.length === 0) {
            console.warn(`⚠️ Could not find item: ${item.name}`);
            continue;
        }

        const fullPrompt = `${item.prompt} 
        CRITICAL: Use a rectangular kraft brown sticker. Place the logo at the top. 
        Hebrew text must be clear. Style is factual product photography with blurred desert nursery background.`;

        const imageBase64 = await generateWithGemini(fullPrompt, logoBase64, backgroundBase64);

        if (imageBase64) {
            console.log(`✅ Image generated for ${item.name}. Updating Database...`);

            const { error: updateError } = await supabase
                .from('menu_items')
                .update({ image_url: imageBase64 })
                .eq('business_id', BUSINESS_ID)
                .in('id', menuItems.map(m => m.id));

            if (updateError) {
                console.error(`❌ DB Update Error for ${item.name}:`, updateError.message);
            } else {
                console.log(`✨ ${item.name} updated successfully!`);
            }
        } else {
            console.error(`❌ Failed to generate image for ${item.name}`);
        }

        // Wait 2 seconds between generations
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('🏁 Batch Update Complete!');
}

run();
