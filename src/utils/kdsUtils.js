export const isDrink = (item) => {
    const cat = (item.category || '').toLowerCase();
    return cat.includes('שתיה') || cat.includes('drink') || cat.includes('coffee') || cat.includes('קפה');
};

export const isHotDrink = (item) => {
    const cat = (item.category || '').toLowerCase();
    return isDrink(item) && (cat.includes('חמה') || cat.includes('hot'));
};

export const sortItems = (items) => {
    return [...items].sort((a, b) => {
        const aHot = isHotDrink(a);
        const bHot = isHotDrink(b);
        const aDrink = isDrink(a);
        const bDrink = isDrink(b);

        // 1. Hot drinks first
        if (aHot && !bHot) return -1;
        if (!aHot && bHot) return 1;

        // 2. Cold drinks second (if not both hot)
        if (aDrink && !bDrink) return -1;
        if (!aDrink && bDrink) return 1;

        // 3. Food last (preserve original order for food)
        return 0;
    });
};

export const getModColor = (text) => {
    if (!text) return 'mod-color-gray';
    const t = String(text).toLowerCase().trim();

    // Foam Specifics (Priority)
    if (t.includes('בלי קצף') || t.includes('ללא קצף')) return 'mod-color-foam-none';
    if (t.includes('פחות קצף') || t.includes('מעט קצף')) return 'mod-color-foam-down';
    if (t.includes('הרבה קצף') || t.includes('אקסטרה קצף')) return 'mod-color-foam-up';

    // הסרות / בלי
    if (t.includes('בלי') || t.includes('ללא') || t.includes('הורד'))
        return 'mod-color-red';

    // תוספות / אקסטרה / בצד
    if (t.includes('תוספת') || t.includes('אקסטרה') || t.includes('בצד') || t.includes('קצף'))
        return 'mod-color-lightgreen';

    // סוגי חלב
    if (t.includes('סויה') || t.includes('שיבולת שועל') || t.includes('שיבולת'))
        return 'mod-color-soy-oat';
    if (t.includes('שקדים'))
        return 'mod-color-almond';
    if (t.includes('נטול') || t.includes('דקף') || t.includes('ללא לקטוז'))
        return 'mod-color-lactose-free';

    // טמפרטורה וחוזק
    if (t.includes('רותח') || t.includes('חם מאוד'))
        return 'mod-color-extra-hot';
    if (t.includes('חזק') || t.includes('כפול'))
        return 'mod-color-strong';
    if (t.includes('חלש') || t.includes('קל'))
        return 'mod-color-light';

    return 'mod-color-gray';
};

export const shortenKdsMod = (name) => {
    if (!name) return '';
    const s = String(name);
    if (s.includes('חצי חלב חצי מים')) return 'חצי-חצי';
    if (s.includes('נטול קפאין')) return 'נטול';
    if (s.includes('דל שומן')) return 'דל';
    if (s.includes('שיבולת שועל')) return 'שיבולת';
    if (s.includes('חלב שקדים')) return 'שקדים';
    if (s.includes('חלב סויה')) return 'סויה';
    return s;
};

export const groupOrderItems = (items) => {
    if (!items || items.length === 0) return [];

    const grouped = [];
    const map = new Map();

    items.forEach(item => {
        // מפתח ייחודי: ID המנה + מחרוזת המודים הממוינת + סטטוס
        // משתמשים ב-modsKey במקום name כדי לאחד פריטים זהים עם אותם מודים
        const key = `${item.menuItemId}| ${item.modsKey || ''}| ${item.status} `;

        if (map.has(key)) {
            const existing = map.get(key);
            existing.quantity += item.quantity;
            existing.ids.push(item.id); // שומרים את כל ה-IDs המקוריים
            existing.totalPrice += item.price * item.quantity;
        } else {
            const newItem = {
                ...item,
                ids: [item.id], // אתחול מערך IDs
                totalPrice: item.price * item.quantity
            };
            map.set(key, newItem);
            grouped.push(newItem);
        }
    });

    return grouped;
};
