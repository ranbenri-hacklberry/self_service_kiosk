
import fetch from 'node-fetch';
import fs from 'fs';

const API_KEY = 'AIzaSyA4cvvNi-jbhnePCtM_ERiXtVHplkojZYk';
const SUBJECT_PATH = '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_1_1769088695619.jpg';
const BACK_PATH = '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_0_1769088695619.jpg';

async function run() {
    console.log('🧐 Analyzing original seeds with Gemini 3 Flash Preview...');
    const subjectData = fs.readFileSync(SUBJECT_PATH).toString('base64');
    const backgroundData = fs.readFileSync(BACK_PATH).toString('base64');

    const payload = {
        contents: [{
            parts: [
                { text: 'Look at these two images. IMAGE 1 is the subject (a pansy in a brown nursery pot). IMAGE 2 is the background (hills). I need a prompt for a high-end image generator (Gemini 3 Pro Image) to place IMAGE 1 into IMAGE 2 as a literal photographic composite. The pot MUST BE KEPT. The flowers MUST NOT CHANGE. It should look like the pot was physically placed on the ground in that landscape. Give me 3 POWERFUL and DIFFERENT prompting strategies. Strategy 1: Material Composite (Focus on the object+vessel). Strategy 2: Ecological Placement (Focus on the setting). Strategy 3: Hyper-Fidelity Product Integration. Return JSON: { "strategies": [{ "name": string, "logic": string, "prompt": string, "negative_prompt": string }] }' },
                { text: 'IMAGE 1 (Subject):' },
                { inline_data: { mime_type: 'image/jpeg', data: subjectData } },
                { text: 'IMAGE 2 (Background):' },
                { inline_data: { mime_type: 'image/jpeg', data: backgroundData } }
            ]
        }],
        generationConfig: { response_mime_type: 'application/json' }
    };

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (data.error) {
        console.error('API Error:', JSON.stringify(data.error, null, 2));
        return;
    }

    try {
        const textResponse = data.candidates[0].content.parts[0].text;
        const strategies = JSON.parse(textResponse);

        console.log('\n--- 🎯 GEMINI 3 PROMPTING STRATEGIES ---');
        console.log(JSON.stringify(strategies, null, 2));
    } catch (e) {
        console.error('Parse Error:', e);
        console.log('Raw text:', data.candidates[0].content.parts[0].text);
    }
}

run();
