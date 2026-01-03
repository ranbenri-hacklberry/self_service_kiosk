import { GoogleGenerativeAI } from "@google/generative-ai";

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

    // Try Gemini 3 Flash first, then fallback to 1.5 Flash if it fails
    const modelName = retryCount > 0 ? "gemini-1.5-flash" : "gemini-3-flash-preview";
    const model = genAI.getGenerativeModel({ model: modelName });

    const mimeMatch = base64String.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = mimeMatch ? mimeMatch[2] : base64String;

    const prompt = `נתח את המסמך המצורף (חשבונית, תעודת משלוח, או הזמנה) וחלץ את כל הפריטים למערך JSON.

**חשוב מאוד:**
1. זהה את **סוג המסמך** - האם כתוב "חשבונית", "תעודת משלוח", "משלוח", "הזמנה" או אחר
2. חלץ את **התאריך שמופיע על המסמך** (לא תאריך של היום!) - חפש תאריך ליד "תאריך:", "ת.משלוח", "תאריך הפקה" וכו'
3. זהה את **שם הספק** בדיוק כפי שמופיע על המסמך (בראש המסמך, בלוגו, או בחותמת)

שים לב לפרטים הקטנים: שמות פריטים בעברית כולל משקלים (למשל \"תות שדה קפוא 1 ק\"ג\"), כמותות ויחידות מידה.

עבור כל פריט, ספק את השדות הבאים:
- name: שם הפריט המלא בעברית (כולל משקל אם מופיע)
- category: קטגוריה מתאימה (חלבי, ירקות, קפואים, פירות, יבשים, משקאות)
- unit: יחידת מידה בדיוק כפי שמופיע (יח', ק\"ג, ליטר, קרטון, מארז)
- quantity: הכמות המספרית בלבד
- price: מחיר ליחידה אחת כמספר בלבד (ללא סמל ₪)

החזר **רק** אובייקט JSON תקין בפורמט הבא:
{
  "document_type": "חשבונית" או "תעודת משלוח" או "הזמנה",
  "supplier_name": "שם הספק בדיוק כפי שמופיע על המסמך",
  "invoice_number": "מספר המסמך",  
  "document_date": "YYYY-MM-DD (התאריך שמופיע על המסמך!)",
  "total_amount": 0,
  "items": [
    { "name": "...", "category": "...", "unit": "...", "quantity": 0, "price": 0 }
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
        const usage = response.usageMetadata; // This contains token counts

        if (!content || content.trim() === "") {
            throw new Error('Empty response from model');
        }

        // Clean up markdown
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

        // Return both results and usage metadata
        return {
            ...parsed,
            usageMetadata: usage
        };

    } catch (error) {
        console.error(`Error with model ${modelName} (attempt ${retryCount + 1}):`, error);

        // Retry logic
        if (retryCount < 1) {
            console.log(`Retrying with fallback model...`);
            return processInvoiceWithGemini(base64String, retryCount + 1);
        }

        throw error;
    }
};

export default { processInvoiceWithGemini };
