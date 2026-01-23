import { GoogleGenerativeAI } from "@google/generative-ai";
import { AI_MODELS, FALLBACK_MODELS } from '../config/models';

/**
 * Gemini Service for OCR tasks using the official Google SDK
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const SUPPLIERS_LIST = [
    { id: 1, name: 'ביסקוטי' },
    { id: 2, name: 'כוכב השחר' },
    { id: 3, name: 'פיצה מרקט' },
    { id: 5, name: 'ברכת האדמה' },
    { id: 6, name: 'תנובה' }
];

/**
 * Processes an invoice image or PDF with Gemini Vision API.
 * Includes retries and model fallback for stability.
 */
export const processInvoiceWithGemini = async (base64String, retryCount = 0) => {
    if (!genAI) {
        throw new Error('Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment.');
    }

    // Use centralized model configuration with fallback strategy
    const modelName = FALLBACK_MODELS[retryCount % FALLBACK_MODELS.length];
    console.log(`🤖 Using AI Model: ${modelName} (Attempt ${retryCount + 1})`);

    const model = genAI.getGenerativeModel({ model: modelName });

    const mimeMatch = base64String.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = mimeMatch ? mimeMatch[2] : base64String;

    const prompt = `נתח את המסמך המצורף (חשבונית, תעודת משלוח, או הזמנה) וחלץ את כל הפריטים למערך JSON.

**חשוב מאוד:**
1. זהה את **סוג המסמך** - האם כתוב "חשבונית", "תעודת משלוח", "משלוח", "הזמנה" או אחר
2. חלץ את **התאריך שמופיע על המסמך** (לא תאריך של היום!) - חפש תאריך ליד "תאריך:", "ת.משלוח", "תאריך הפקה" וכו'
3. זהה את **שם הספק** בדיוק כפי שמופיע על המסמך (בראש המסמך, בלוגו, או בחותמת)

**המרת יחידות - קריטי!**
המערכת שלנו עובדת בגרמים. אם המחיר בחשבונית הוא "לק\"ג" או "לקילו" או "ל-1 ק\"ג":
- המר את המחיר מ-₪/ק"ג ל-₪/גרם על ידי חלוקה ב-1000
- לדוגמה: 29₪ לק"ג → price: 0.029, unit: "גרם", price_source: "kg"
- אם המחיר הוא ליחידה רגילה (פריט, קרטון, ליטר) - השאר כמו שהוא

עבור כל פריט, ספק את השדות הבאים:
- name: שם הפריט המלא בעברית (כולל משקל אם מופיע)
- category: קטגוריה מתאימה (חלבי, ירקות, קפואים, פירות, יבשים, משקאות)
- unit: יחידת מידה - אם המקור היה ק"ג, רשום "גרם"
- quantity: הכמות המספרית - אם הכמות היתה בק"ג, המר לגרמים (x1000)
- price: מחיר ליחידה אחת - אם המקור היה לק"ג, חלק ב-1000
- price_source: "kg" אם המחיר המקורי היה לקילו, "unit" אם היה ליחידה
- original_price_per_kg: המחיר המקורי לק"ג (רק אם price_source="kg")

החזר **רק** אובייקט JSON תקין בפורמט הבא:
{
  "document_type": "חשבונית" או "תעודת משלוח" או "הזמנה",
  "supplier_name": "שם הספק בדיוק כפי שמופיע על המסמך",
  "invoice_number": "מספר המסמך",  
  "document_date": "YYYY-MM-DD (התאריך שמופיע על המסמך!)",
  "total_amount": 0,
  "items": [
    { "name": "...", "category": "...", "unit": "גרם או יח' או ליטר", "quantity": 0, "price": 0, "price_source": "kg או unit", "original_price_per_kg": 0 }
  ]
}`;

    try {
        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ]);

        const response = await result.response;
        const content = response.text();
        const usage = response.usageMetadata;

        if (!content || content.trim() === "") {
            throw new Error('Empty response from model');
        }

        let cleanedContent = content.trim();
        if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(cleanedContent);
        if (!parsed.items || !Array.isArray(parsed.items)) {
            parsed.items = [];
        }

        return {
            ...parsed,
            usageMetadata: usage
        };

    } catch (error) {
        console.error(`Error with model ${modelName} (attempt ${retryCount + 1}):`, error);

        // If high-tier model fails (common for 404 or Billing), try one more time with simple flash
        if (retryCount < 2) {
            console.log(`Retrying with safety fallback...`);
            return processInvoiceWithGemini(base64String, retryCount + 1);
        }

        // Clean up error message for user
        let userMessage = error.message;
        if (userMessage.includes('404')) {
            userMessage = `המודל ${modelName} לא נמצא. כנראה שהמפתח שלך לא תומך בו.`;
        } else if (userMessage.includes('API_KEY_INVALID')) {
            userMessage = "מפתח ה-API של Gemini אינו תקין.";
        } else if (userMessage.includes('SAFETY')) {
            userMessage = "הקובץ נחסם על ידי מסנני הבטיחות של גוגל.";
        }

        const finalError = new Error(userMessage);
        finalError.originalError = error;
        throw finalError;
    }
};

/**
 * Generate Menu Item Image with Gemini Pro Image
 * Style: "Desert Edge" - professional cafe product photography
 */
/**
 * Generate Menu Item Image with Gemini Pro Image
 * Style: "Desert Edge" - professional cafe product photography
 */
export const generateMenuImage = async (itemName, seedHint = '', backgroundHint = '', itemInfo = {}, base64Seed = null, aiSettings = null, backgroundSeed = null) => {
    if (!genAI) {
        throw new Error('Gemini API Key missing. Set VITE_GEMINI_API_KEY in .env');
    }

    const { description = '' } = itemInfo;
    const name = itemName.toLowerCase();

    // Detect type for internallyDetectedDescription (Internal fallback logic)
    const isCoffee = ['קפה', 'אספרסו', 'הפוך', 'קפוצ', 'לאטה', 'מוקה', 'מקיאטו', 'שחור'].some(k => name.includes(k));
    const isColdDrink = ['קר', 'אייס', 'מיץ', 'לימונדה', 'שייק', 'סמוזי'].some(k => name.includes(k));
    const isSalad = name.includes('סלט');
    const isPastry = ['מאפה', 'קרואסון', 'דניש', 'עוגה', 'בורקס', 'רוגלך'].some(k => name.includes(k));
    const isTea = ['תה', 'חליטה', 'סחלב', 'שוקו'].some(k => name.includes(k));

    let internallyDetectedDescription = '';
    if (isCoffee) {
        if (name.includes('אמריקנו')) internallyDetectedDescription = 'Americano - a light, smooth coffee with a thin crema layer';
        else if (name.includes('הפוך')) internallyDetectedDescription = 'Israeli Hafuch (Latte) - creamy milk coffee with beautiful latte art';
        else if (name.includes('קפוצ')) internallyDetectedDescription = 'Cappuccino - rich espresso with thick foamy milk crown';
        else if (name.includes('לאטה')) internallyDetectedDescription = 'Café Latte - smooth steamed milk with espresso, latte art on top';
        else if (name.includes('אספרסו')) internallyDetectedDescription = 'Espresso shot - intense, dark, with golden crema';
        else internallyDetectedDescription = 'Premium coffee beverage';
    } else if (isTea) {
        if (name.includes('סחלב')) internallyDetectedDescription = 'Sahlab - creamy warm Middle Eastern orchid root drink with cinnamon';
        else if (name.includes('שוקו')) internallyDetectedDescription = 'Hot Chocolate - rich, creamy chocolate drink';
        else internallyDetectedDescription = 'Hot tea with herbs or classic blend';
    } else if (isSalad) {
        internallyDetectedDescription = 'Fresh Israeli salad with vibrant vegetables, herbs, olive oil drizzle';
    } else if (isPastry) {
        internallyDetectedDescription = 'Freshly baked pastry with golden crust';
    }

    // Determine final prompt
    let finalPrompt = '';

    if (aiSettings?.ai_prompt_template) {
        // USE BUSINESS SPECIFIC TEMPLATE
        finalPrompt = aiSettings.ai_prompt_template
            .replace(/{{itemName}}/g, itemName)
            .replace(/{{description}}/g, description || internallyDetectedDescription)
            .replace(/{{container}}/g, seedHint || 'no container')
            .replace(/{{background}}/g, backgroundHint || 'default desert background')
            .replace(/{{composition_style}}/g, aiSettings.composition_style || 'professional product photography')
            .replace(/{{blur}}/g, aiSettings.background_blur_radius ? `${aiSettings.background_blur_radius}px` : 'high bokeh');
    } else {
        // FALLBACK TO ORIGINAL LOGIC
        let presentation = '';
        let noContainerMode = !seedHint;

        if (seedHint) {
            presentation = `Container style: ${seedHint}.`;
        } else {
            presentation = `⚠️ NO CONTAINER! The item appears without any serving vessel.`;
        }

        let background = backgroundHint || `A breathtaking, extremely blurred (bokeh) panoramic vista of the Jordan Valley desert. Distant desert mountains, soft golden sunrise light, sparse desert flora.`;

        finalPrompt = `PRODUCT PHOTOGRAPHY for Israeli boutique cafe menu.
**ESTABLISHMENT TYPE:** DAIRY & VEGETARIAN CAFE. 
**STRICT RULES:** NO MEAT!
**CRITICAL - THE MAIN SUBJECT IS:** "${itemName}"
${description ? `**USER DESCRIPTION:** ${description}` : ''}
**PRODUCT DETAILS:** ${internallyDetectedDescription}
**CONTAINER/PRESENTATION:**
${presentation}
- The container/packaging must be BRAND NEW, perfectly symmetric, and flawless.
- NO DENTS, no warping, no deformation. Perfectly straight edges.
**PHOTOGRAPHIC GUIDELINES:**
- Background: ${background}
- Composition: THE "${itemName}" IS PERFECTLY CENTERED AND FILLS 75-80% OF THE FRAME.
- Focus: RAZOR-SHARP FOCUS on the ${itemName}.
- Aesthetic: "Desert Edge" (שפת המדבר) Israeli boutique cafe style.
- Resolution: 4K.
- STRICT: No text, no watermarks, no logos.`;
    }

    try {
        console.log(`🎨 [AI Image] Generating image for: ${itemName} using ${aiSettings ? 'Business Settings' : 'Default Settings'}...`);

        const timeout = (aiSettings?.generation_timeout_seconds || 30) * 1000;

        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview",
            generationConfig: { responseModalities: ["image", "text"] }
        });

        const contents = [];

        if (base64Seed) {
            const mimeMatch = base64Seed.match(/^data:([^;]+);base64,(.+)$/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64Data = mimeMatch ? mimeMatch[2] : base64Seed;

            contents.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            });
            contents.push({ text: `REFERENCE PHOTO (ITEM): Use this image for subject guidance. ${finalPrompt}` });
        }

        if (backgroundSeed) {
            const bMimeMatch = backgroundSeed.match(/^data:([^;]+);base64,(.+)$/);
            const bMimeType = bMimeMatch ? bMimeMatch[1] : 'image/jpeg';
            const bBase64Data = bMimeMatch ? bMimeMatch[2] : backgroundSeed;

            contents.push({
                inlineData: {
                    data: bBase64Data,
                    mimeType: bMimeType
                }
            });
            contents.push({ text: `REFERENCE PHOTO (BACKGROUND/ATMOSPHERE): Use this image for background style guidance. Apply blur/bokeh as requested. ${finalPrompt}` });
        }

        if (!base64Seed && !backgroundSeed) {
            contents.push({ text: finalPrompt });
        }

        // Implementation of timeout if needed (though Gemini SDK might not have it directly on the call, 
        // we can wrap it in a Promise.race if we want strict enforcement)
        const generatePromise = model.generateContent(contents);

        const result = await Promise.race([
            generatePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI Generation Timeout')), timeout))
        ]);

        const response = await result.response;

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('No image candidates returned');
        }

        const candidate = response.candidates[0];
        for (const part of candidate.content.parts) {
            if (part && part.inlineData) {
                console.log("✅ [AI Image] Image generated successfully!");
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }

        throw new Error('No image data found in response parts');
    } catch (error) {
        console.error('❌ [AI Image] Error:', error);
        throw error;
    }
};

export default { processInvoiceWithGemini, generateMenuImage };
