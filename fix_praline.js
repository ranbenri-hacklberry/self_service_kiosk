import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const API_KEY = envConfig.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const SEED_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/capuchino.JPG';

async function run() {
    console.log("☕ Fixing Praline Hot Chocolate...");
    const response = await fetch(SEED_URL);
    const arrayBuffer = await response.arrayBuffer();
    const base64Seed = Buffer.from(arrayBuffer).toString('base64');

    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview", generationConfig: { responseModalities: ["image", "text"] } });
    
    const prompt = `Professional Beverage Photography of "שוקו פרלינים" (Praline Hot Chocolate).
    SETTING: Rustic wood surface.
    BACKGROUND: Blurred abstract nature (Green/Brown Bokeh). NO buildings.
    
    ITEM:
    - Praline Hot Chocolate in a WIDE FAT large paper cup.
    - On TOP of the drink: several MEDIUM-SIZED CHOCOLATE CHIPS scattered on the surface.
    - NO whipped cream. Just rich brown cocoa surface with chocolate chips.
    
    INSTRUCTIONS:
    - The chocolate chips should be clearly visible, medium size (not tiny, not huge).
    - Background matches Hasalak Salad style.`;

    try {
        const result = await model.generateContent([
            { inlineData: { data: base64Seed, mimeType: "image/jpeg" } },
            { text: prompt }
        ]);
        
        const response = await result.response;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const buffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync('public/cafe-images/item_17_שוקו פרלינים.png', buffer);
                console.log("✅ Saved: item_17_שוקו פרלינים.png");
                break;
            }
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

run();
