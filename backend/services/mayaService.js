/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Maia AI Service - שירות חיבור ל-Ollama + Google Gemini
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch'; // or built-in in Node 18+

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.MAYA_MODEL || 'maia-ai';
const TIMEOUT_MS = parseInt(process.env.MAYA_TIMEOUT) || 30000;
const DEFAULT_BUSINESS_ID = process.env.DEFAULT_BUSINESS_ID || '22222222-2222-2222-2222-222222222222';

// Gemini client (initialized per request with business API key)
let geminiClient = null;

// חיבור ל-Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.LOCAL_SUPABASE_URL || process.env.VITE_LOCAL_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * רשימת לקוחות VIP לזיהוי אוטומטי
 */
export const VIP_CUSTOMERS = {
    'נתי': {
        phone: process.env.NATI_PHONE || '0501234567',
        signature_order: 'הפוך חזק שיבולת',
        triggers: ['שיבולת', 'שקדים', 'חזק'],
        fun_fact: 'נתי בחיים לא מכין לעצמו. רני, תכין את הבונה.'
    }
};

/**
 * שליפת קונטקסט עסקי מ-Supabase
 */
export async function getBusinessContext(businessId) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    // חישוב תאריכים לתקופות שונות
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const context = {
        timestamp: time,
        date: today,
        // סטטיסטיקות בסיסיות
        pendingOrders: 0,
        readyOrders: 0,
        // מכירות לפי תקופה
        todaySales: { count: 0, revenue: 0 },
        weekSales: { count: 0, revenue: 0 },
        monthSales: { count: 0, revenue: 0 },
        lastMonthSales: { count: 0, revenue: 0 },
        // פרטים נוספים
        recentOrders: [], // 5 הזמנות אחרונות עם פרטים
        topSellingItems: [],
        lowStockItems: [],
        vipActivity: []
    };

    if (!supabase) return context;

    // 1. הזמנות פתוחות/מוכנות
    try {
        const { count: pendingCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .in('order_status', ['new', 'in_progress']);
        context.pendingOrders = pendingCount || 0;

        const { count: readyCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('order_status', 'ready');
        context.readyOrders = readyCount || 0;
    } catch (e) { console.error('Error fetching order status:', e); }

    // 2. מכירות היום
    try {
        const { data: todayOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('business_id', businessId)
            .gte('created_at', todayStart);
        if (todayOrders) {
            context.todaySales.count = todayOrders.length;
            context.todaySales.revenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        }
    } catch (e) { console.error('Error fetching today sales:', e); }

    // 3. מכירות השבוע
    try {
        const { data: weekOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('business_id', businessId)
            .gte('created_at', weekAgo);
        if (weekOrders) {
            context.weekSales.count = weekOrders.length;
            context.weekSales.revenue = weekOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        }
    } catch (e) { console.error('Error fetching week sales:', e); }

    // 4. מכירות החודש הנוכחי
    try {
        const { data: monthOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('business_id', businessId)
            .gte('created_at', monthStart);
        if (monthOrders) {
            context.monthSales.count = monthOrders.length;
            context.monthSales.revenue = monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        }
    } catch (e) { console.error('Error fetching month sales:', e); }

    // 5. מכירות חודש שעבר
    try {
        const { data: lastMonthOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('business_id', businessId)
            .gte('created_at', lastMonthStart)
            .lte('created_at', lastMonthEnd);
        if (lastMonthOrders) {
            context.lastMonthSales.count = lastMonthOrders.length;
            context.lastMonthSales.revenue = lastMonthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        }
    } catch (e) { console.error('Error fetching last month sales:', e); }

    // 6. הזמנות אחרונות עם פרטים מלאים
    try {
        const { data: recentOrders } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, customer_phone, total_amount, order_status, created_at, order_items')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(5);
        if (recentOrders) {
            context.recentOrders = recentOrders.map(o => ({
                id: o.id,
                orderNumber: o.order_number,
                customer: o.customer_name || 'אנונימי',
                phone: o.customer_phone || 'לא צוין',
                total: o.total_amount || 0,
                status: o.order_status,
                date: new Date(o.created_at).toLocaleDateString('he-IL'),
                time: new Date(o.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                items: o.order_items || []
            }));
        }
    } catch (e) { console.error('Error fetching recent orders:', e); }

    // 2. מלאי נמוך (סיכום ראשוני)
    try {
        const { data: inventory } = await supabase
            .from('inventory_items')
            .select('name, current_stock, unit, low_stock_threshold_units, weight_per_unit')
            .eq('business_id', businessId);

        if (inventory) {
            context.lowStockItems = inventory
                .filter(i => {
                    const threshold = (parseFloat(i.low_stock_threshold_units) || 0) * (parseFloat(i.weight_per_unit) || 1);
                    return threshold > 0 && i.current_stock <= threshold;
                })
                .map(i => `${i.name} (${i.current_stock} גרם/יח׳)`)
                .slice(0, 5);
        }
    } catch (e) { console.error('Error fetching inventory context:', e); }

    // 3. פעילות VIP (האם נתי הזמין היום?)
    try {
        for (const [name, vip] of Object.entries(VIP_CUSTOMERS)) {
            const { data: orders } = await supabase
                .from('orders')
                .select('created_at')
                .eq('business_id', businessId)
                .ilike('customer_name', `%${name}%`)
                .gte('created_at', `${today}T00:00:00`)
                .limit(1);

            if (orders && orders.length > 0) {
                context.vipActivity.push({
                    name,
                    time: new Date(orders[0].created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                });
            }
        }
    } catch (e) { console.error('Error fetching VIP context:', e); }

    // 4. אוטומציות אחרונות
    try {
        const { data: logs } = await supabase
            .from('automation_logs')
            .select('action, target, created_at')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(3);

        if (logs) {
            context.recentAutomations = logs;
        }
    } catch (e) { console.error('Error fetching logs context:', e); }

    // 5. פריטים הכי נמכרים (Top 3)
    try {
        // שליפת ההזמנות האחרונות (למשל 100 האחרונות) כדי לחשב סטטיסטיקה מהירה
        const { data: recentItems } = await supabase
            .from('order_items')
            .select('item_name, quantity, menu_item_id') // נניח שיש item_name, אחרת צריך join
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (recentItems && recentItems.length > 0) {
            const itemCounts = {};
            recentItems.forEach(item => {
                const name = item.item_name || `פריט #${item.menu_item_id}`; // Fallback if name missing
                itemCounts[name] = (itemCounts[name] || 0) + (item.quantity || 1);
            });

            context.topSellingItems = Object.entries(itemCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([name, count]) => `${name} (${count})`);
        }
    } catch (e) { console.error('Error calculating top items:', e); }

    // 6. מלאי נמוך (אמיתי) - This replaces the previous logic with correct filters
    try {
        const { data: lowStock } = await supabase
            .from('inventory_items')
            .select('name, current_stock, unit, low_stock_threshold_units, weight_per_unit')
            .eq('business_id', businessId);

        if (lowStock) {
            context.lowStockItems = lowStock
                .filter(i => {
                    const threshold = (parseFloat(i.low_stock_threshold_units) || 0) * (parseFloat(i.weight_per_unit) || 1);
                    return threshold > 0 && i.current_stock <= threshold;
                })
                .map(i => `${i.name} (${i.current_stock} גרם/יח׳)`)
                .slice(0, 5);
        }
    } catch (e) {
        console.error('Error fetching inventory:', e);
    }

    return context;
}

/**
 * System Prompt קבוע - האישיות של מאיה
 */
const MAYA_PERSONALITY = `אתה מאיה, עוזרת וקופירייטרית של בית קפה iCaffe. ענה בעברית בלבד.

כללים חשובים:
- תשובות קצרות וברורות בלבד
- אל תציג נתונים (הזמנות, מכירות) אלא אם נשאלת עליהם ישירות!
- לשאלות כמו "היי", "שלום", "מה קורה" - ענה בקצרה וחביב בלי להציף במידע
- כשמבקשים טקסט שיווקי - כתוב רק את הטקסט, בלי הסברים
- לשאלות לא קשורות לקפה/עסק - ענה: אני רק יודעת על קפה
- כשמבקשים סכומים או סטטיסטיקות - אז תשתמש בנתונים למטה
- כשמבקשים הזמנות - אז תן פרטים רלוונטיים

הנתונים למטה זמינים לך אבל השתמש בהם רק כשרלוונטי!`;

/**
 * 🔒 Worker Constraints - Sanitize context for staff-level users
 */
export function applyWorkerConstraints(context, employee) {
    if (!employee || !['Worker', 'Chef', 'Barista', 'Checker', 'Software Architect'].includes(employee.accessLevel)) {
        return context; // Admin/Manager gets full context
    }

    // Strip financial data for workers
    return {
        date: context.date,
        timestamp: context.timestamp,
        pendingOrders: context.pendingOrders,
        readyOrders: context.readyOrders,
        // Remove sales revenue but keep counts
        todaySales: { count: context.todaySales.count, revenue: '[מוסתר]' },
        weekSales: { count: context.weekSales.count, revenue: '[מוסתר]' },
        monthSales: { count: context.monthSales.count, revenue: '[מוסתר]' },
        lastMonthSales: { count: context.lastMonthSales.count, revenue: '[מוסתר]' },
        // Keep operational data
        recentOrders: context.recentOrders?.map(o => ({ ...o, total: '[מוסתר]' })),
        lowStockItems: context.lowStockItems,
        topSellingItems: context.topSellingItems
    };
}

/**
 * בניית פרומפט דינמי למודל
 */
function buildContextPrompt(context) {
    let p = MAYA_PERSONALITY;

    p += `\n\n=== נתונים (${context.date} ${context.timestamp}) ===`;

    // מצב נוכחי
    p += `\n\nמצב עכשיו:`;
    p += `\n- הזמנות פתוחות: ${context.pendingOrders}`;
    p += `\n- הזמנות מוכנות: ${context.readyOrders}`;

    // מכירות לפי תקופה
    p += `\n\nמכירות:`;
    p += `\n- היום: ${context.todaySales.count} הזמנות, ${context.todaySales.revenue} ש"ח`;
    p += `\n- השבוע: ${context.weekSales.count} הזמנות, ${context.weekSales.revenue} ש"ח`;
    p += `\n- החודש: ${context.monthSales.count} הזמנות, ${context.monthSales.revenue} ש"ח`;
    p += `\n- חודש שעבר: ${context.lastMonthSales.count} הזמנות, ${context.lastMonthSales.revenue} ש"ח`;

    // הזמנות אחרונות
    if (context.recentOrders && context.recentOrders.length > 0) {
        p += `\n\n5 הזמנות אחרונות:`;
        context.recentOrders.forEach((o, i) => {
            p += `\n${i + 1}. #${o.orderNumber || o.id} | ${o.customer} | ${o.phone} | ${o.total} ש"ח | ${o.status} | ${o.date} ${o.time}`;
        });
    }

    // פריטים פופולריים
    if (context.topSellingItems && context.topSellingItems.length > 0) {
        p += `\n\nלהיטים: ${context.topSellingItems.join(', ')}`;
    }

    // מלאי נמוך
    if (context.lowStockItems && context.lowStockItems.length > 0) {
        p += `\n\nמלאי נמוך: ${context.lowStockItems.join(', ')}`;
    }

    return p;
}

/**
 * Get Gemini API key from business
 */
async function getGeminiKey(businessId) {
    if (!supabase) return null;
    try {
        const { data } = await supabase
            .from('businesses')
            .select('gemini_api_key')
            .eq('id', businessId)
            .single();
        return data?.gemini_api_key || null;
    } catch (e) {
        console.error('Error fetching Gemini key:', e);
        return null;
    }
}

/**
 * צ'אט עם Gemini
 */
async function chatWithGemini(messages, systemPrompt, businessId) {
    const apiKey = await getGeminiKey(businessId);
    if (!apiKey) {
        throw new Error('Gemini API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build chat history for Gemini
    const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const chat = model.startChat({
        history,
        systemInstruction: systemPrompt
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
}

/**
 * צ'אט עם Maia - תומך בספקים שונים
 */
export async function chatWithMaya(messages, businessId, provider = 'local', employee = null) {
    console.log('═══════════════════════════════════════════════');
    console.log('🤖 Maya Chat');
    console.log('   Provider:', provider);
    console.log('   BusinessId:', businessId);
    console.log('   Employee:', employee?.name, `(${employee?.accessLevel})`);
    console.log('   User message:', messages[messages.length - 1]?.content);
    console.log('═══════════════════════════════════════════════');

    let context = await getBusinessContext(businessId);

    // 🔒 Apply worker constraints (strip financial data)
    if (employee) {
        context = applyWorkerConstraints(context, employee);
    }

    const systemPrompt = buildContextPrompt(context);

    console.log('📝 System Prompt (first 500 chars):');
    console.log(systemPrompt.substring(0, 500));
    console.log('...');

    // 🔒 Prepend absolute safety instruction for workers
    let finalSystemPrompt = systemPrompt;
    if (employee && ['Worker', 'Chef', 'Barista', 'Checker', 'Software Architect'].includes(employee.accessLevel)) {
        const workerSafetyPrefix = `⚠️ CRITICAL SECURITY CONSTRAINT ⚠️
You are assisting a STAFF MEMBER (${employee.name}, ${employee.accessLevel}).
ABSOLUTELY PROHIBITED: Providing financial data, revenue figures, profit margins, sales totals, owner-level business metrics, or any sensitive financial information.
If asked about revenue, profits, or financial details, respond: "אני לא יכולה לגשת לנתונים פיננסיים. רק הבעלים יכול לראות את זה."

`;
        finalSystemPrompt = workerSafetyPrefix + systemPrompt;
        console.log('🔒 Worker safety constraints applied');
    }

    // Use Gemini if requested
    if (provider === 'google' || provider === 'gemini') {
        console.log('🌐 Using Google Gemini...');
        try {
            const response = await chatWithGemini(messages, finalSystemPrompt, businessId);
            console.log('✅ Gemini response:', response?.substring(0, 200));
            return response || 'לא קיבלתי תשובה מגוגל...';
        } catch (err) {
            console.error('❌ Gemini Chat Error:', err);
            return `שגיאה בחיבור לגוגל: ${err.message}`;
        }
    }

    // Default: Use Ollama (local)
    const systemMsg = { role: 'system', content: finalSystemPrompt };
    const allMessages = [systemMsg, ...messages];

    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: allMessages,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);

        const data = await response.json();
        return data.message?.content || 'משהו נדפק בחיבור למוח שלי...';
    } catch (err) {
        console.error('Maia Chat Error:', err);
        return 'סליחה רני, השרת נפל או שאני בחופש.';
    }
}

export async function askMaya(prompt, businessId, provider = 'local') {
    return chatWithMaya([{ role: 'user', content: prompt }], businessId, provider);
}

/**
 * יצירת טקסט שיווקי - פרומפט ממוקד בלי קונטקסט הזמנות
 */
export async function askMayaMarketing(prompt, businessId) {
    const marketingSystemPrompt = `אתה מאיה, קופירייטרית שיווקית מקצועית לבית קפה iCaffe.

משימתך: לכתוב טקסטים שיווקיים קצרים ומושכים בעברית.

כללים:
- כתוב טקסט שיווקי מושך ומזמין
- תשובות קצרות וממוקדות בלבד
- אל תוסיף הסברים או שאלות חוזרות
- שפה צעירה וקלילה
- שמור על הפורמט המבוקש בדיוק`;

    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: marketingSystemPrompt },
                    { role: 'user', content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);

        const data = await response.json();
        return data.message?.content || '';
    } catch (err) {
        console.error('Maya Marketing Error:', err);
        return '';
    }
}

/**
 * זיהוי הזמנות מיוחדות (נתי!!)
 */
export async function detectSpecialOrder(order, businessId) {
    const items = order.order_items || [];
    const customerName = (order.customer_name || '').toLowerCase();

    for (const [vipName, vip] of Object.entries(VIP_CUSTOMERS)) {
        // 1. בדיקת שם
        const nameMatch = customerName.includes(vipName);

        // 2. בדיקת הזמנה ("הפוך" + טריגרים כמו "שיבולת")
        const orderMatch = items.some(item => {
            const iName = (item.name || '').toLowerCase();
            // Mods handling
            let modsStr = '';
            if (Array.isArray(item.mods)) modsStr = JSON.stringify(item.mods).toLowerCase();

            // לוגיקה ספציפית לנתי מהפרומפט:
            // שם מכיל "הפוך" והתוספות מכילות "שיבולת/שקדים" ו-"חזק"
            const isHafuch = iName.includes('הפוך') || iName.includes('cappuccino');
            const hasShiboloet = modsStr.includes('שיבולת') || modsStr.includes('oat');
            const hasStrong = modsStr.includes('חזק') || modsStr.includes('strong') || modsStr.includes('shot');

            // אם זה נתי, אנחנו מחפשים את השילוב המנצח
            if (vipName === 'נתי') {
                return isHafuch && hasShiboloet && hasStrong;
            }
            return false;
        });

        if (nameMatch || orderMatch) {
            console.log(`🎯 Maia Detected VIP: ${vipName}`);

            // Log automation
            if (supabase) {
                await supabase.from('automation_logs').insert({
                    business_id: businessId,
                    action: 'vip_order_detected',
                    target: vipName,
                    details: { order_id: order.id, matched: nameMatch ? 'name' : 'order' },
                    triggered_by: 'maia'
                });
            }

            // Generate Story Caption
            const storyCaption = await generateStoryCaption(vipName, items, businessId);

            return {
                detected: true,
                vipName,
                message: `הזרקתי את ה${vip.signature_order.split(' ').pop()} של ${vipName}. ${vip.fun_fact} 😏`,
                suggestStory: true,
                storyCaption,
                suggestSms: true,
                smsPhone: vip.phone
            };
        }
    }

    return { detected: false };
}

async function generateStoryCaption(vipName, items, businessId) {
    const itemNames = items.map(i => i.name).join(', ');
    const prompt = `דנה ביקשה שאכתוב סטורי לאינסטגרם על זה ש${vipName} הזמין ${itemNames}. 
  תכתבי משהו קצר, עוקצני ומצחיק בעברית. מקסימום 2 משפטים.`;

    try {
        return await askMaya(prompt, businessId || DEFAULT_BUSINESS_ID);
    } catch (e) {
        return `${vipName} הגיע לקפה! ☕`;
    }
}

export async function checkHealth() {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`);
        if (!res.ok) return { healthy: false };
        const data = await res.json();
        return {
            healthy: true,
            hasMaya: data.models?.some(m => m.name.includes(MODEL_NAME)),
            url: OLLAMA_URL
        };
    } catch (e) {
        return { healthy: false, error: e.message };
    }
}
