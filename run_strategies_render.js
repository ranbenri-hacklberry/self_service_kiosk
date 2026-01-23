
import fetch from 'node-fetch';
import fs from 'fs';

const API_KEY = 'AIzaSyA4cvvNi-jbhnePCtM_ERiXtVHplkojZYk';
const SUBJECT_PATH = '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_1_1769088695619.jpg';
const BACK_PATH = '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_0_1769088695619.jpg';

const STRATEGIES = [
    {
        "name": "Material_Composite",
        "prompt": "Literal photographic composite: Place the exact brown plastic nursery pot and the purple-and-white pansies from IMAGE 1 onto the dry, grassy foreground of the hillside in IMAGE 2. The pot must be resting naturally on the dirt. Match the diffused, bright daylight of the landscape to the lighting on the plant. The focus should be sharp on the pot's texture and the green leaves, with the vast, rolling hills and dirt path of IMAGE 2 extending into the background.",
        "negative": "distorted pot, changed flower colors, missing container, floating object, cartoonish, oversaturated, painting, illustration."
    },
    {
        "name": "Ecological_Placement",
        "prompt": "A wide-angle landscape photograph of the hills from IMAGE 2, featuring the specific potted pansies from IMAGE 1 nestled among the rocks and dry grass in the immediate foreground. The brown nursery pot must cast a soft, realistic shadow onto the uneven ground of the hill. Preserve the hazy atmosphere and muted green-brown palette of the terrain while maintaining the vibrant purple and white contrast of the flowers. The pot must look physically integrated into the landscape.",
        "negative": "low resolution, blurry foreground, unrealistic lighting, changed flower arrangement, messy edges, digital artifacts, CGI look."
    },
    {
        "name": "HyperFidelity_Integration",
        "prompt": "High-end commercial photography composite: Integrate the subject of IMAGE 1—the terracotta-toned plastic pot and its vibrant pansies—into the mid-ground of the landscape in IMAGE 2. Utilize a shallow depth of field where the pot is in crisp, high-definition focus while the distant hills and winding road from IMAGE 2 recede into a soft bokeh. Harmonize the color grading so the warm tones of the pot match the sun-drenched, hazy hills. 8k resolution, photorealistic, precise edge blending.",
        "negative": "grainy, flat lighting, inconsistent shadows, warped pot, text, watermark, fake-looking grass, distorted petals."
    }
];

async function generate(strategy) {
    console.log(`🎨 Generating: ${strategy.name}...`);
    const subjectData = fs.readFileSync(SUBJECT_PATH).toString('base64');
    const backgroundData = fs.readFileSync(BACK_PATH).toString('base64');

    const payload = {
        contents: [{
            parts: [
                { text: `TASK: ${strategy.prompt}` },
                { text: `NEGATIVE_CONSTRAINTS: ${strategy.negative}` },
                { text: 'IMAGE 1 (Reference Product):' },
                { inline_data: { mime_type: 'image/jpeg', data: subjectData } },
                { text: 'IMAGE 2 (Reference Background):' },
                { inline_data: { mime_type: 'image/jpeg', data: backgroundData } }
            ]
        }],
        generationConfig: {
            responseModalities: ["image"]
        }
    };

    let attempts = 0;
    while (attempts < 5) {
        const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' + API_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();

        if (data.error) {
            console.warn(`⚠️ Attempt ${attempts + 1} failed for ${strategy.name}: ${data.error.message}`);
            attempts++;
            await new Promise(r => setTimeout(r, 5000)); // Wait 5s between retries
            continue;
        }

        if (data.candidates && data.candidates[0].content.parts) {
            const imagePart = data.candidates[0].content.parts.find(p => p.inlineData);
            if (imagePart) {
                const fileName = `result_${strategy.name}.png`;
                fs.writeFileSync(fileName, Buffer.from(imagePart.inlineData.data, 'base64'));
                console.log(`✅ Saved: ${fileName}`);
                return fileName;
            }
        }

        console.error(`❌ Unexpected response for ${strategy.name}:`, JSON.stringify(data, null, 2));
        return null;
    }
    console.error(`❌ Strategy ${strategy.name} failed after 5 attempts.`);
    return null;
}

async function runAll() {
    for (const s of STRATEGIES) {
        await generate(s);
        await new Promise(r => setTimeout(r, 2000)); // Gap between strategies
    }
}

runAll();
