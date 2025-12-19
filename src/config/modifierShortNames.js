/**
 * מיפוי שמות קצרים למודיפיירים - לתצוגה בקדס ובעגלה
 * השמות המלאים נשמרים בבסיס הנתונים, כאן רק קיצורים לתצוגה
 */

// מודים שלא צריך להציג (ברירת מחדל)
export const HIDDEN_MODS = [
    'רגיל',
    'חלב רגיל',
    'ללא חלב',
];

// מיפוי שם מלא -> שם קצר
export const SHORT_NAMES = {
    // בסיס משקה
    'חצי חלב חצי מים': 'חצי-חצי',
    'על בסיס מים': 'בסיס מים',

    // הגשה
    'מפורק ': 'מפורק',  // יש רווח בסוף בDB

    // סוג חלב
    'שיבולת שועל': 'שיבולת',

    // קפאין
    'נטול קפאין': 'נטול',

    // קצף
    'בלי קצף': '✕קצף',
    'הרבה קצף': 'קצף',
    'מעט קצף': 'קצף',

    // חלב בצד
    'חלב חם בצד': 'חם בצד',
    'חלב סויה בצד': 'סויה בצד',
    'חלב קר בצד': 'קר בצד',
    'חלב שיבולת בצד': 'שיבולת בצד',
    'ללא חלב': 'ללא חלב',
};

// צבעים וחיצים לפי סוג מוד (מפתח = שם מלא מה-DB)
export const MOD_COLORS = {
    // קצף (החץ מתווסף דרך CSS לפי הקלאס)
    'הרבה קצף': 'mod-color-foam-up',
    'מעט קצף': 'mod-color-foam-down',
    'בלי קצף': 'mod-color-foam-none',

    // חלב חלופי
    'סויה': 'bg-amber-100 text-amber-800 border-amber-200',
    'שיבולת שועל': 'bg-amber-100 text-amber-800 border-amber-200',

    // נטול
    'נטול קפאין': 'bg-purple-100 text-purple-700 border-purple-200',

    // חזק/חלש
    'חזק': 'bg-orange-100 text-orange-700 border-orange-200',
    'חלש': 'bg-green-100 text-green-700 border-green-200',

    // טמפרטורה
    'רותח': 'bg-red-100 text-red-600 border-red-200',
    'פושר': 'bg-blue-100 text-blue-600 border-blue-200',
};

/**
 * קבלת שם קצר למוד
 * @param {string} fullName - השם המלא מהDB
 * @returns {string|null} - השם הקצר, או null אם צריך להסתיר
 */
export const getShortName = (fullName) => {
    if (!fullName) return null;
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
    return MOD_COLORS[fullName] || MOD_COLORS[trimmed] || MOD_COLORS[displayName] || 'bg-slate-100 text-slate-700 border-slate-200';
};
