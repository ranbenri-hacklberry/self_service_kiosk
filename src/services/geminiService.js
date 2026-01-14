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

export default { processInvoiceWithGemini };
