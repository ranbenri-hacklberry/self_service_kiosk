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
export const generateMenuImage = async (itemName, seedHint = '', backgroundHint = '', itemInfo = {}, base64Seed = null) => {
    if (!genAI) {
        throw new Error('Gemini API Key missing. Set VITE_GEMINI_API_KEY in .env');
    }

    const { description = '' } = itemInfo;
    const name = itemName.toLowerCase();
    const isLarge = name.includes('גדול') || name.includes('כפול');

    // Detect type for container
    const isCoffee = ['קפה', 'אספרסו', 'הפוך', 'קפוצ', 'לאטה', 'מוקה', 'מקיאטו', 'שחור'].some(k => name.includes(k));
    const isColdDrink = ['קר', 'אייס', 'מיץ', 'לימונדה', 'שייק', 'סמוזי'].some(k => name.includes(k));
    const isSalad = name.includes('סלט');
    const isPastry = ['מאפה', 'קרואסון', 'דניש', 'עוגה', 'בורקס', 'רוגלך'].some(k => name.includes(k));
    const isSandwich = ['כריך', 'טוסט', 'באגט', 'טורטייה', 'פיתה'].some(k => name.includes(k));
    const isPizza = name.includes('פיצה');
    const isTea = ['תה', 'חליטה', 'סחלב', 'שוקו'].some(k => name.includes(k));

    // Default presentation based on type - ONLY if user selected a container seed
    let presentation = '';
    let noContainerMode = !seedHint; // Track if no container was selected

    if (seedHint) {
        // User selected a container - use their choice
        presentation = `Container style: ${seedHint}.`;
    } else {
        // NO CONTAINER SELECTED - the item will be placed based on background
        if (backgroundHint && (backgroundHint.includes('table') || backgroundHint.includes('cafe') || backgroundHint.includes('wooden'))) {
            // Background has a surface like a table - place it there without a container
            presentation = `⚠️ NO CONTAINER! The ${itemName} is placed DIRECTLY on the table/surface without any cup, plate, or bowl. 
            It sits bare on the wooden table, which looks casual but unprofessional.`;
        } else if (backgroundHint) {
            // Background exists but has no clear surface (like desert/garden) - on the ground
            presentation = `⚠️ NO CONTAINER! The ${itemName} is placed DIRECTLY ON THE GROUND! 
            No cup, no plate, no bowl - just the raw food/drink sitting awkwardly on the bare earth/floor. 
            This looks WRONG and UNPROFESSIONAL on purpose!`;
        } else {
            presentation = `⚠️ NO CONTAINER! The item appears without any serving vessel.`;
        }
    }

    // Background style
    let background = '';
    if (backgroundHint) {
        // User selected a background
        background = backgroundHint;
    } else if (noContainerMode) {
        // 🤣 NO CONTAINER + NO BACKGROUND = The item is FLOATING IN EMPTY SPACE!
        background = `The item is FLOATING IN THE AIR against a pure white/gray empty void! 
        STRICT ANTI-GRAVITY DECONSTRUCTED VIEW: 
        - SHOW ONLY ONE SINGLE UNIT OF "${itemName}". No duplicates.
        - VERTICAL LAYERING: The ingredients are neatly separated and hovering in a VERTICAL STACK, one ABOVE the other.
        - ATOMIC LAYERS: For a coffee, show the liquid coffee at the bottom, a layer of milk hovering above it, milk foam above that, and the latte art hovering at the very top.
        - For a sandwich or pastry, show the base, then the filling, then the top crust/bread, all hovering vertically.
        - This is a clean, professional, high-end deconstructed artistic view.
        - The components must be close enough to be recognized as one "${itemName}" but separated enough to see each ingredient clearly.`;
    } else {
        // Has container but no background - use nice desert default
        background = `A breathtaking, extremely blurred (bokeh) panoramic vista of the Jordan Valley desert. Distant desert mountains, soft golden sunrise light, sparse desert flora.`;
    }

    // Build internal item description for the AI
    let internallyDetectedDescription = '';
    if (isCoffee) {
        if (name.includes('אמריקנו')) internallyDetectedDescription = 'Americano - a light, smooth coffee with a thin crema layer';
        else if (name.includes('הפוך')) internallyDetectedDescription = 'Israeli Hafuch (Latte) - creamy milk coffee with beautiful latte art';
        else if (name.includes('קפוצ')) internallyDetectedDescription = 'Cappuccino - rich espresso with thick foamy milk crown';
        else if (name.includes('לאטה')) internallyDetectedDescription = 'Café Latte - smooth steamed milk with espresso, latte art on top';
        else if (name.includes('מוקה')) internallyDetectedDescription = 'Café Mocha - chocolate espresso drink with whipped cream';
        else if (name.includes('מקיאטו')) internallyDetectedDescription = 'Macchiato - espresso "stained" with a dollop of milk foam';
        else if (name.includes('שחור')) internallyDetectedDescription = 'Black Coffee / Filter Coffee - rich dark brew';
        else if (name.includes('אספרסו')) internallyDetectedDescription = 'Espresso shot - intense, dark, with golden crema';
        else internallyDetectedDescription = 'Premium coffee beverage';
    } else if (isTea) {
        if (name.includes('סחלב')) internallyDetectedDescription = 'Sahlab - creamy warm Middle Eastern orchid root drink with cinnamon';
        else if (name.includes('שוקו')) internallyDetectedDescription = 'Hot Chocolate - rich, creamy chocolate drink';
        else internallyDetectedDescription = 'Hot tea with herbs or classic blend';
    } else if (isColdDrink) {
        if (name.includes('לימונדה')) internallyDetectedDescription = 'Fresh lemonade with ice, mint leaves visible';
        else if (name.includes('שייק')) internallyDetectedDescription = 'Thick creamy milkshake';
        else internallyDetectedDescription = 'Refreshing cold beverage with ice';
    } else if (isSalad) {
        internallyDetectedDescription = 'Fresh Israeli salad with vibrant vegetables, herbs, olive oil drizzle';
    } else if (isPastry) {
        internallyDetectedDescription = 'Freshly baked pastry with golden crust';
    }

    const finalPrompt = `PRODUCT PHOTOGRAPHY for Israeli boutique cafe menu.
**ESTABLISHMENT TYPE:** DAIRY & VEGETARIAN CAFE (כשר חלבי צמחוני). 
**STRICT RULES:** 
- NO MEAT! No sausages, no bacon, no pepperoni, no beef. 
- USE ONLY dairy, vegetarian, or vegan ingredients.

**CRITICAL - THE MAIN SUBJECT IS:** "${itemName}"
${description ? `**USER DESCRIPTION:** ${description}` : ''}
**PRODUCT DETAILS:** ${internallyDetectedDescription}

**CONTAINER/PRESENTATION:**
${presentation}

**PHOTOGRAPHIC GUIDELINES:**
- Background: ${background}
- Composition: THE "${itemName}" IS PERFECTLY CENTERED AND FILLS 75-80% OF THE FRAME.
- Focus: RAZOR-SHARP FOCUS on the ${itemName}. The item MUST match its name exactly.
- Lighting: Professional studio lighting, soft shadows, highlights on the drink/food.
- Aesthetic: "Desert Edge" (שפת המדבר) Israeli boutique cafe style.
- Resolution: 4K, professional food/beverage photography.
- STRICT: No text, no watermarks, no logos. The product must look EXACTLY like "${itemName}".
- AUTHENTICITY: The drink/food must be visually identifiable as "${itemName}" - not just any coffee/food.`;

    try {
        console.log(`🎨 [AI Image] Generating image for: ${itemName}...`);

        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview",
            generationConfig: { responseModalities: ["image", "text"] }
        });

        const contents = [];

        // If we have a base64 seed image, we use it for image-to-image guidance
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

            contents.push({ text: `REFERENCE PHOTO: Use this image for subject guidance. Improve the visual quality, lighting, and apply the specified container (${seedHint}) and background (${backgroundHint}). ${finalPrompt}` });
        } else {
            contents.push({ text: finalPrompt });
        }

        const result = await model.generateContent(contents);
        const response = await result.response;

        if (!response.candidates || response.candidates.length === 0) {
            console.error("❌ [AI Image] No candidates returned from model.");
            throw new Error('No image candidates returned');
        }

        const candidate = response.candidates[0];
        if (!candidate.content || !candidate.content.parts) {
            console.error("❌ [AI Image] Candidate has no content or parts.");
            throw new Error('Image generation candidate is empty');
        }

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
