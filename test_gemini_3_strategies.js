
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_KEY = 'AIzaSyA4cvvNi-jbhnePCtM_ERiXtVHplkojZYk';

// The images we are testing with
const SUBJECT_IMAGE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/menu-images/pansy_pot_seed.jpg'; // Assuming the name
const BACKGROUND_IMAGE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/menu-images/samaria_hills_bg.jpg';

async function getImageBase64(url) {
    const response = await fetch(url);
    const buffer = await response.buffer();
    return buffer.toString('base64');
}

const STRATEGIES = [
    {
        name: 'A_LITERAL_COMPOSITE',
        instruction: `
            MISSION: Perform a literal photographic composite. 
            The REFERENCE SUBJECT (pot + plant) must be kept 100% intact. 
            Do not separate the plant from the pot. 
            Place the entire object from the reference image onto the surface of the background image.
            Describe the physical interface (shadows, lighting) between the pot and the ground.
        `
    },
    {
        name: 'B_GEOMETRIC_FIDELITY',
        instruction: `
            MISSION: Absolute geometric and color fidelity. 
            The brown plastic nursery pot from the reference is the HERO as much as the flowers.
            Describe the specific texture of the pot, the soil line, and the leaf cluster.
            Instruction: "Place this exact pot and plant onto the foreground rock/soil of the background image."
        `
    },
    {
        name: 'C_CONSTRAINED_NEGATIVE',
        instruction: `
            MISSION: Prevent the AI from 'planting' the subject.
            Use heavy negative constraints.
            Describe the pot sitting ON TOP of the background surface as a separate object.
            Explicitly forbid the AI from blending the roots into the background soil.
        `
    }
];

async function runTest() {
    console.log('🚀 Downloading test images...');
    const subjectData = await getImageBase64(SUBJECT_IMAGE_URL).catch(() => null);
    const backgroundData = await getImageBase64(BACKGROUND_IMAGE_URL).catch(() => null);

    if (!subjectData || !backgroundData) {
        console.error('❌ Failed to download images. Please check URLs.');
        // Fallback to placeholders or local files if needed
        return;
    }

    for (const strategy of STRATEGIES) {
        console.log(`\n--- Testing Strategy: ${strategy.name} ---`);

        // 1. Get Prompt from Gemini 3 Pro (Architect)
        const architectPayload = {
            contents: [{
                parts: [
                    { text: `SYSTEM: You are the Architect. ${strategy.instruction}` },
                    { text: "REFERENCE SUBJECT (Keep the pot!):" },
                    { inline_data: { mime_type: "image/jpeg", data: subjectData } },
                    { text: "BACKGROUND ENVIRONMENT:" },
                    { inline_data: { mime_type: "image/jpeg", data: backgroundData } },
                    { text: "TASK: Generate a prompt for a high-fidelity image generator (Gemini 3) to combine these." }
                ]
            }],
            generationConfig: { temperature: 0, response_mime_type: "application/json" }
        };

        const architectResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent?key=${API_KEY}`, {
            method: 'POST',
            body: JSON.stringify(architectPayload)
        });

        const architectData = await architectResp.json();
        const { prompt, negativePrompt } = JSON.parse(architectData.candidates[0].content.parts[0].text);

        console.log('📝 Generated Prompt:', prompt);

        // 2. Generate Image from Gemini 3 Pro Image (Artist)
        const artistPayload = {
            contents: [{
                parts: [
                    { text: `TASK: ${prompt}` },
                    { text: `NEGATIVE: ${negativePrompt}` },
                    { text: "REF_PRODUCT:" },
                    { inline_data: { mime_type: "image/jpeg", data: subjectData } },
                    { text: "REF_BG:" },
                    { inline_data: { mime_type: "image/jpeg", data: backgroundData } }
                ]
            }],
            generationConfig: { responseModalities: ["image"] }
        };

        const artistResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`, {
            method: 'POST',
            body: JSON.stringify(artistPayload)
        });

        const artistData = await artistResp.json();
        const base64Image = artistData.candidates[0].content.parts.find(p => p.inlineData).inlineData.data;

        const fileName = `test_result_${strategy.name}.png`;
        fs.writeFileSync(fileName, Buffer.from(base64Image, 'base64'));
        console.log(`✅ Saved result to: ${fileName}`);
    }
}

runTest();
