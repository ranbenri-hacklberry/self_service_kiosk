
import fetch from 'node-fetch';
import fs from 'fs';

const API_KEY = 'AIzaSyA4cvvNi-jbhnePCtM_ERiXtVHplkojZYk';
const IMAGES = [
    '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_0_1769097670782.jpg',
    '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_1_1769097670782.jpg',
    '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_2_1769097670782.jpg',
    '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_3_1769097670782.jpg',
    '/Users/user/.gemini/antigravity/brain/da216269-b98f-45d1-ab2f-eed19dd6268e/uploaded_image_4_1769097670782.jpg'
];

async function identify() {
    const parts = [{ text: 'Identify these 5 plants. For each, give the EXACT Hebrew common name used in Israeli nurseries (משתלה) and the Scientific name. Return as JSON: { \"plants\": [{ \"hebrewName\": string, \"scientificName\": string, \"index\": number }] }' }];

    for (let i = 0; i < IMAGES.length; i++) {
        const data = fs.readFileSync(IMAGES[i]).toString('base64');
        parts.push({ text: `IMAGE ${i}:` });
        parts.push({ inline_data: { mime_type: 'image/jpeg', data } });
    }

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: 'application/json' } })
    });

    const result = await resp.json();
    console.log(result.candidates[0].content.parts[0].text);
}

identify();
