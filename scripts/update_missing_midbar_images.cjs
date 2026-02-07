
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

// Image Assets - Use absolute paths to be safe
const LOGO_PATH = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/public/assets/logo-text.png';
const BACKGROUND_IMAGE_PATH = '/Users/user/.gemini/antigravity/brain/554aaba7-7b8b-40e3-a901-58c20a81c050/uploaded_media_1770193838744.jpg';

async function getBase64(filePath) {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${data.toString('base64')}`;
    } else {
        console.warn(`⚠️ File not found: ${filePath}`);
    }
    return null;
}

async function generateWithGemini(prompt, businessLogoBase64, backgroundBase64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`;

    const contents = [];

    // Add reference background first
    if (backgroundBase64) {
        contents.push({
            inlineData: {
                data: backgroundBase64.split(',')[1],
                mimeType: "image/jpeg"
            }
        });
        contents.push({ text: "REFERENCE IMAGE: This is the EXACT environment. Use the white wooden counter and the desert hill nursery background from this image. DO NOT CREATE A NEW BACKGROUND." });
    }

    // Add logo
    if (businessLogoBase64) {
        contents.push({
            inlineData: {
                data: businessLogoBase64.split(',')[1],
                mimeType: "image/png"
            }
        });
        contents.push({ text: "REFERENCE LOGO: Use this logo on the kraft sticker." });
    }

    // Final detailed prompt
    const enhancedPrompt = `${prompt} 
    CRITICAL INSTRUCTIONS:
    1. REPLICATE THE ENVIRONMENT: The coffee cup must sit on the WHITE WOODEN COUNTER from the reference photo. 
    2. BACKGROUND: The background MUST BE the desert hill and nursery from the reference photo, but with a SOFT BOKEH (blur).
    3. STICKER: Pure kraft brown (חומה) rectangular sticker on the cup.
    4. LOGO: The provided 'שפת מדבר' logo must be printed at the top center of the sticker.
    5. TEXT: Clear handwritten Hebrew text below the logo as specified.
    6. STYLE: Premium product photography close-up.`;

    contents.push({ text: enhancedPrompt });

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

// Missing items to process
const ITEMS_TO_UPDATE = [
    {
        name: 'שוקו פרלינים',
        prompt: 'A large premium disposable paper cup with steaming rich hot chocolate topped with chocolate pralines. Kraft sticker shows logo and handwritten Hebrew: "מיקה - שוקו פרלינים - 6 דק".'
    },
    {
        name: 'מוקה',
        prompt: 'A disposable paper cup with a hot Mocha beverage. Kraft sticker shows logo and handwritten Hebrew: "דני - מוקה חמה - 4 דק".'
    },
    {
        name: 'תה',
        prompt: 'A disposable paper cup with premium hot tea, a tea bag string visible. Kraft sticker shows logo and handwritten Hebrew: "חנה - תה צמחים - 3 דק".'
    }
];

async function run() {
    console.log('🚀 Starting Update for MISSING items with CORRECT SEED...');

    const logoBase64 = await getBase64(LOGO_PATH);
    const backgroundBase64 = await getBase64(BACKGROUND_IMAGE_PATH);

    if (!backgroundBase64) {
        console.error('❌ Background seed image missing! Aborting.');
        return;
    }

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

        const imageBase64 = await generateWithGemini(item.prompt, logoBase64, backgroundBase64);

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

        // Wait 3 seconds between generations
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('🏁 Missing samples update complete!');
}

run();
