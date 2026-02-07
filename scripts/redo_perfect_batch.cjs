
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Constants
const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Image Assets
const LOGO_PATH = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/public/assets/logo-text.png';
const BACKGROUND_IMAGE_PATH = '/Users/user/.gemini/antigravity/brain/554aaba7-7b8b-40e3-a901-58c20a81c050/uploaded_media_1770193838744.jpg';

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

    // ATTACH THE SEED AS THE PRIMARY REFERENCE
    if (backgroundBase64) {
        contents.push({
            inlineData: {
                data: backgroundBase64.split(',')[1],
                mimeType: "image/jpeg"
            }
        });
        contents.push({ text: "SEED IMAGE (ENVIRONMENT): This image shows the EXACT white wooden counter and desert nursery background to use. REPLICATE THIS ENVIRONMENT PERFECTLY." });
    }

    if (businessLogoBase64) {
        contents.push({
            inlineData: {
                data: businessLogoBase64.split(',')[1],
                mimeType: "image/png"
            }
        });
        contents.push({ text: "SEED LOGO: Use this logo on the kraft sticker." });
    }

    const enhancedPrompt = `${prompt} 
    CRITICAL FIDELITY RULES:
    1. The coffee cup must be placed on the WHITE WOODEN COUNTER from the seed image.
    2. The background must be the EXACT desert hills and green nursery plants from the seed image, but with a professional soft bokeh (blur).
    3. Use a rectangular kraft paper sticker.
    4. Print the 'שפת מדבר' logo from the seed at the top of the sticker.
    5. Add handwritten Hebrew text as specified below the logo.
    6. Ensure the cup type (plastic vs paper) and size (tall vs short) is clearly visible.`;

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

const ITEMS_TO_REDO = [
    { name: 'הפוך גדול', prompt: 'A large tall disposable paper cup with hot latte art. Kraft sticker shows logo and Hebrew: "נועה - הפוך גדול - חלב שיבולת". Extreme close-up on the white counter.' },
    { name: 'הפוך קטן', prompt: 'A small short disposable paper cup with latte art. Kraft sticker shows logo and Hebrew: "ליאת - הפוך קטן - חלב סויה". Extreme close-up on the white counter.' },
    { name: 'קפה שחור', prompt: 'A disposable paper cup with steaming hot black coffee (קפה שחור). Kraft sticker shows logo and Hebrew: "אבי - קפה שחור - רותח!".' },
    { name: 'שוקו גדול', prompt: 'A large tall disposable paper cup with rich hot chocolate. Kraft sticker shows logo and Hebrew: "עידו - שוקו גדול".' },
    { name: 'שוקו קטן', prompt: 'A small short disposable paper cup with hot chocolate. Kraft sticker shows logo and Hebrew: "אלון - שוקו קטן".' },
    { name: 'סחלב', prompt: 'A disposable paper cup with Sahlab, coconut, and nuts. Kraft sticker shows logo and Hebrew: "יעל - סחלב - בלי קצף".' },
    { name: 'נס על חלב', prompt: 'A disposable paper cup with Nes coffee on milk. Kraft sticker shows logo and Hebrew: "משה - נס על חלב".' },
    { name: 'אמריקנו', prompt: 'A disposable paper cup with steaming Americano. Kraft sticker shows logo and Hebrew: "רועי - אמריקנו חם - רותח".' },
    { name: 'אמריקנו קר', prompt: 'A clear plastic cup with iced Americano, ice cubes, and condensation. Kraft sticker shows logo and Hebrew: "עומר - אמריקנו קר".' },
    { name: 'אספרסו', prompt: 'A tiny paper espresso cup. Kraft sticker shows logo and Hebrew: "יוסי - אספרסו קצר".' }
];

async function run() {
    console.log('🚀 Redoing first batch with seed correctly attached to prompt...');

    const logoBase64 = await getBase64(LOGO_PATH);
    const backgroundBase64 = await getBase64(BACKGROUND_IMAGE_PATH);

    for (const item of ITEMS_REDO) {
        console.log(`🖼️ Processing: ${item.name}...`);
        const { data: menuItems } = await supabase.from('menu_items').select('id').eq('business_id', BUSINESS_ID).ilike('name', `%${item.name}%`);
        if (!menuItems || menuItems.length === 0) continue;
        const imageBase64 = await generateWithGemini(item.prompt, logoBase64, backgroundBase64);
        if (imageBase64) {
            await supabase.from('menu_items').update({ image_url: imageBase64 }).eq('business_id', BUSINESS_ID).in('id', menuItems.map(m => m.id));
            console.log(`✨ ${item.name} redeployed!`);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}
// Fixing the run function to use correct variable name
async function runCorrected() {
    console.log('🚀 Redoing first batch with seed correctly attached to prompt...');
    const logoBase64 = await getBase64(LOGO_PATH);
    const backgroundBase64 = await getBase64(BACKGROUND_IMAGE_PATH);
    for (const item of ITEMS_TO_REDO) {
        console.log(`🖼️ Processing: ${item.name}...`);
        const { data: menuItems } = await supabase.from('menu_items').select('id').eq('business_id', BUSINESS_ID).ilike('name', `%${item.name}%`);
        if (!menuItems || menuItems.length === 0) continue;
        const imageBase64 = await generateWithGemini(item.prompt, logoBase64, backgroundBase64);
        if (imageBase64) {
            await supabase.from('menu_items').update({ image_url: imageBase64 }).eq('business_id', BUSINESS_ID).in('id', menuItems.map(m => m.id));
            console.log(`✨ ${item.name} redeployed!`);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log('🏁 Perfect batch complete!');
}
runCorrected();
