/**
 * מיפוי שמות קצרים למודיפיירים - לתצוגה בקדס ובעגלה
 * השמות המלאים נשמרים בבסיס הנתונים, כאן רק קיצורים לתצוגה
 * 
 * 🎨 צבעים מותאמים לזיהוי מהיר:
 *   - חלב חלופי: שיבולת=חום, סויה=ירוק, שקדים=צהוב
 *   - קצף: הרבה=סגול↑, מעט=כחול↓, בלי=אדום✕
 *   - נטול קפאין: סגול
 *   - טמפרטורה: רותח=אדום, פושר=כחול
 */

// מודים שלא צריך להציג (ברירת מחדל)
export const HIDDEN_MODS = [
    'רגיל',
    'חלב רגיל',
    'ללא חלב',
    'רותח (ברירת מחדל)',
];

// מיפוי שם מלא -> שם קצר (קצר אבל ברור!)
export const SHORT_NAMES = {
    // סוג חלב
    'חלב שיבולת שועל': 'שיבולת',
    'שיבולת שועל': 'שיבולת',
    'חלב סויה': 'סויה',
    'חלב שקדים': 'שקדים',

    // בסיס משקה
    'חצי חלב חצי מים': 'חצי-חצי',
    'על בסיס מים': 'בסיס מים',

    // קצף (עם סימנים ויזואליים)
    'בלי קצף': '✕קצף',
    'הרבה קצף': '↑קצף',
    'מעט קצף': '↓קצף',

    // טמפרטורה
    'רותח (ברירת מחדל)': 'רותח',

    // אפשרויות מיוחדות
    'נטול קפאין': 'נטול',
    'מפורק (הפוך)': 'מפורק',
    'מפורק ': 'מפורק', // יש רווח בסוף בDB

    // חלב בצד
    'חלב חם בצד': 'חם בצד',
    'חלב קר בצד': 'קר בצד',
    'חלב סויה בצד': 'סויה בצד',
    'חלב שיבולת בצד': 'שיבולת בצד',

    // תוספות מזון - שמות מלאים
    'מיץ תפוזים': 'מיץ',
};

// צבעים לפי סוג מוד - יפים וצבעוניים!
export const MOD_COLORS = {
    // קצף
    'הרבה קצף': 'bg-purple-100 text-purple-700 border-purple-300',
    'מעט קצף': 'bg-blue-100 text-blue-600 border-blue-300',
    'בלי קצף': 'bg-red-100 text-red-600 border-red-300',

    // חלב חלופי - צבעים ייחודיים לכל סוג
    'סויה': 'bg-green-100 text-green-700 border-green-300',
    'חלב סויה': 'bg-green-100 text-green-700 border-green-300',
    'שיבולת שועל': 'bg-amber-100 text-amber-800 border-amber-300',
    'חלב שיבולת שועל': 'bg-amber-100 text-amber-800 border-amber-300',
    'שקדים': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'חלב שקדים': 'bg-yellow-100 text-yellow-800 border-yellow-300',

    // חלב בצד
    'חלב סויה בצד': 'bg-green-100 text-green-700 border-green-300',
    'חלב שיבולת בצד': 'bg-amber-100 text-amber-800 border-amber-300',
    'חלב חם בצד': 'bg-orange-100 text-orange-700 border-orange-300',
    'חלב קר בצד': 'bg-blue-100 text-blue-600 border-blue-300',

    // נטול - סגול בולט
    'נטול קפאין': 'bg-purple-100 text-purple-700 border-purple-300',

    // חוזק
    'חזק': 'bg-orange-100 text-orange-700 border-orange-300',
    'חלש': 'bg-green-100 text-green-700 border-green-300',

    // טמפרטורה
    'רותח': 'bg-red-100 text-red-600 border-red-300',
    'פושר': 'bg-blue-100 text-blue-600 border-blue-300',

    // בסיס
    'חצי חלב חצי מים': 'bg-slate-100 text-slate-700 border-slate-300',
    'על בסיס מים': 'bg-blue-100 text-blue-600 border-blue-300',

    // תוספות מזון
    'עגבניה': 'bg-red-100 text-red-600 border-red-300',
    'בצל': 'bg-purple-100 text-purple-700 border-purple-300',
    'זיתים': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'בולגרית': 'bg-white text-slate-700 border-slate-300',
    'מיץ תפוזים': 'bg-orange-100 text-orange-700 border-orange-300',
};

/**
 * קבלת שם קצר למוד
 * @param {string} fullName - השם המלא מהDB
 * @returns {string|null} - השם הקצר, או null אם צריך להסתיר
 */
export const getShortName = (nameInput) => {
    if (!nameInput) return null;

    // Robustness: Handle objects if they leak through
    const fullName = (typeof nameInput === 'object')
        ? (nameInput.he || nameInput.name || nameInput.text || JSON.stringify(nameInput))
        : String(nameInput);

    const trimmed = fullName.trim();

    // בדיקה אם צריך להסתיר
    if (HIDDEN_MODS.includes(trimmed)) return null;

    // החזרת שם קצר אם קיים, אחרת השם המקורי
    return SHORT_NAMES[fullName] || SHORT_NAMES[trimmed] || trimmed;
};

/**
 * קבלת צבע למוד
 * @param {string} fullName - השם המלא מה-DB (כדי לדעת איזה חץ לשים)
 * @param {string} displayName - השם שמוצג (לגיבוי)
 * @returns {string} - class name לצבע
 */
export const getModColorClass = (fullName, displayName) => {
    if (!fullName) return 'bg-slate-100 text-slate-700 border-slate-200';
    const trimmed = fullName.trim();

    // נסה להתאים לפי שם מלא, אז לפי trimmed, אז לפי displayName
    // ואז נסה התאמה חלקית לפי מילות מפתח
    if (MOD_COLORS[fullName]) return MOD_COLORS[fullName];
    if (MOD_COLORS[trimmed]) return MOD_COLORS[trimmed];
    if (MOD_COLORS[displayName]) return MOD_COLORS[displayName];

    // התאמה חלקית לפי מילות מפתח
    const lower = trimmed.toLowerCase();
    if (lower.includes('שיבולת')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (lower.includes('סויה')) return 'bg-green-100 text-green-700 border-green-300';
    if (lower.includes('שקדים')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (lower.includes('נטול')) return 'bg-purple-100 text-purple-700 border-purple-300';
    if (lower.includes('קצף')) {
        if (lower.includes('בלי') || lower.includes('ללא')) return 'bg-red-100 text-red-600 border-red-300';
        if (lower.includes('הרבה')) return 'bg-purple-100 text-purple-700 border-purple-300';
        if (lower.includes('מעט')) return 'bg-blue-100 text-blue-600 border-blue-300';
    }
    if (lower.includes('רותח') || lower.includes('חם מאוד')) return 'bg-red-100 text-red-600 border-red-300';
    if (lower.includes('פושר') || lower.includes('קר')) return 'bg-blue-100 text-blue-600 border-blue-300';
    if (lower.includes('חזק') || lower.includes('כפול')) return 'bg-orange-100 text-orange-700 border-orange-300';

    // ברירת מחדל - אפור נעים
    return 'bg-slate-100 text-slate-700 border-slate-200';
};
