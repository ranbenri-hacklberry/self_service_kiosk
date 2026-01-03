import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../components/AppIcon';
import ManagerHeader from '../../components/manager/ManagerHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Send, Mic, MicOff, Coffee, TrendingUp, Users, Settings, RefreshCw, Loader2, BookOpen, Calendar, Package, ClipboardList } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MAYA_VERSION = "v1.8 - Inventory Expert Mode";

const MayaAssistant = () => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Context Data
    const [contextData, setContextData] = useState({
        menu: '', team: '', salesSummary: '', inventoryDetails: '', recentLogs: '',
        lastUpdate: null, debugInfo: 'מחברת נתונים...',
        status: { sales: 'idle', menu: 'idle', team: 'idle', inventory: 'idle' }
    });
    const [isContextLoading, setIsContextLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();

    // Auto-scroll logic
    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return () => clearTimeout(timer);
    }, [messages, isLoading]);

    // Context Loader - Full Business Intelligence
    const loadContext = useCallback(async () => {
        if (!currentUser?.business_id) return;
        setIsContextLoading(true);
        console.log('🌸 Maya: Deep Syncing Business State...');

        const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);
        const todayStr = new Date().toLocaleDateString('en-CA');
        const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA');

        // 1. Sales Intelligence (RPC)
        try {
            const { data: salesRaw, error: salesError } = await supabase.rpc('get_sales_data', {
                p_start_date: lastWeek.toISOString(),
                p_end_date: new Date().toISOString()
            });

            if (salesError) throw salesError;

            const dailyMap = {};
            const totalMap = {};
            const customerMap = {};
            let totalOrders = salesRaw?.length || 0;
            let weeklyRevenue = 0;
            let totalPrepTime = 0;
            let prepTimeCount = 0;

            if (Array.isArray(salesRaw)) {
                salesRaw.forEach(order => {
                    const date = order.created_at ? order.created_at.split('T')[0] : 'unknown';
                    if (!dailyMap[date]) dailyMap[date] = { items: {}, revenue: 0, count: 0 };

                    // Revenue
                    const orderTotal = parseFloat(order.total) || 0;
                    dailyMap[date].revenue += orderTotal;
                    dailyMap[date].count += 1;
                    weeklyRevenue += orderTotal;

                    // Prep Time Analysis
                    if (order.created_at && order.ready_at) {
                        const start = new Date(order.created_at);
                        const end = new Date(order.ready_at);
                        const diffMins = (end - start) / 1000 / 60;
                        if (diffMins > 0 && diffMins < 120) { // Filter out anomalies
                            totalPrepTime += diffMins;
                            prepTimeCount++;
                        }
                    }

                    // Customer Intelligence
                    const custName = order.customer_name || 'Guest';
                    const custPhone = order.customer_phone || 'N/A';
                    if (custPhone !== 'N/A') {
                        if (!customerMap[custPhone]) customerMap[custPhone] = { name: custName, orders: 0, spend: 0, lastOrder: date };
                        customerMap[custPhone].orders += 1;
                        customerMap[custPhone].spend += orderTotal;
                    }

                    // Items
                    (order.order_items || []).forEach(item => {
                        const name = item.menu_items?.name || item.name || 'פריט לא מזוהה';
                        const qty = parseFloat(item.quantity) || 1;
                        dailyMap[date].items[name] = (dailyMap[date].items[name] || 0) + qty;
                        totalMap[name] = (totalMap[name] || 0) + qty;
                    });
                });
            }

            const avgPrepTime = prepTimeCount > 0 ? (totalPrepTime / prepTimeCount).toFixed(1) : 'לא ידוע';

            const formatDay = (dateStr, label) => {
                const dayData = dailyMap[dateStr];
                if (!dayData) return `${label} (${dateStr}): אין נתונים.`;

                const topItems = Object.entries(dayData.items).sort((a, b) => b[1] - a[1]).slice(0, 5);
                const itemStr = topItems.map(([n, q]) => `${n} (${q})`).join(', ');
                return `${label} (${dateStr}): ₪${dayData.revenue.toLocaleString()} (${dayData.count} הזמנות). מובילים: ${itemStr}`;
            };

            // Generate list of last 7 days for the prompt context
            const last7Days = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('en-CA');
                const dayName = d.toLocaleDateString('he-IL', { weekday: 'long' });
                last7Days.push(formatDay(dStr, dayName));
            }

            // Top Customers (Anonymized for prompt context, but ready for direct lookup)
            const topCustomers = Object.entries(customerMap)
                .sort((a, b) => b[1].spend - a[1].spend)
                .slice(0, 5)
                .map(([phone, data]) => `${data.name} (${phone}): ${data.orders} הזמנות, ₪${data.spend.toLocaleString()}`)
                .join('\n');

            const finalSummary = `
=== תקציר עסקי (7 ימים) ===
${last7Days.join('\n')}

=== מדדי ביצוע (KPIs) ===
💰 הכנסות שבועיות: ₪${weeklyRevenue.toLocaleString()}
⏱️ זמן הכנה ממוצע: ${avgPrepTime} דקות
👥 לקוחות בולטים:
${topCustomers}

=== נתוני לקוחות מלאים (JSON) ===
${JSON.stringify(customerMap)}
`;

            setContextData(prev => ({
                ...prev,
                salesSummary: finalSummary,
                status: { ...prev.status, sales: 'success' },
                debugInfo: `${totalOrders} הזמנות (₪${weeklyRevenue.toFixed(0)})`,
                lastUpdate: new Date().toLocaleTimeString()
            }));
        } catch (e) {
            console.error('Sales fetch error:', e);
            setContextData(prev => ({ ...prev, status: { ...prev.status, sales: 'error' } }));
        }

        // 2. Inventory Intelligence (Items + Logs + Employees + Customers)
        try {
            const [empRes, invRes, logsRes, custRes] = await Promise.all([
                supabase.from('employees').select('id, name').eq('business_id', currentUser.business_id),
                supabase.from('inventory_items').select('*').eq('business_id', currentUser.business_id).order('name'),
                supabase.from('inventory_logs').select('*, inventory_items(name)').eq('business_id', currentUser.business_id).order('created_at', { ascending: false }).limit(15),
                supabase.from('customers').select('name, phone_number, loyalty_coffee_count').limit(100)
            ]);

            const empMap = {};
            (empRes.data || []).forEach(e => empMap[e.id] = e.name);

            const invLines = invRes.data?.map(i => {
                const date = i.last_counted_at ? new Date(i.last_counted_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'מזמן';
                const user = i.last_counted_by ? empMap[i.last_counted_by] || 'מערכת' : 'לא ידוע';
                return `* ${i.name}: ${i.current_stock} ${i.unit} (עודכן ב-${date} ע"י ${user})`;
            }).join('\n') || 'אין מלאי רשום';

            const logLines = logsRes.data?.map(l => {
                const date = new Date(l.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const user = empMap[l.created_by] || 'מערכת';
                const itemName = l.inventory_items?.name || 'פריט';
                if (l.reference_type === 'supplier_order' || l.reference_type === 'invoice_scan') {
                    return `- [${date}] קבלת הזמנה: ${itemName}. כמות בהזמנה: ${l.expected_quantity}, התקבל: ${l.quantity}. עודכן ע"י: ${user}.`;
                }
                return `- [${date}] עדכון ידני: ${itemName} שונה ל-${l.quantity}. בוצע ע"י: ${user}.`;
            }).join('\n') || 'אין פעולות מלאי בתקופה האחרונה';

            const custLines = custRes.data?.map(c => `- ${c.name} (${c.phone_number}): ☕️ ${c.loyalty_coffee_count}`).join('\n') || 'אין לקוחות רשומים';

            setContextData(prev => ({
                ...prev,
                inventoryDetails: invLines,
                recentLogs: logLines,
                customerDirectory: custLines,
                status: { ...prev.status, inventory: 'success' }
            }));
        } catch (e) {
            console.error('Inventory/Customer fetch error:', e);
            setContextData(prev => ({ ...prev, status: { ...prev.status, inventory: 'error' } }));
        }

        // 3. Menu context
        supabase.from('menu_items').select('name').eq('business_id', currentUser.business_id).limit(100)
            .then(({ data }) => setContextData(p => ({ ...p, menu: data?.map(i => i.name).join(', ') || '', status: { ...p.status, menu: 'success' } })));

        setIsContextLoading(false);
    }, [currentUser?.business_id]);

    useEffect(() => { loadContext(); }, [loadContext]);

    // Chat History Sync
    useEffect(() => {
        if (!currentUser?.id) return;
        setHistoryLoading(true);
        supabase.from('maya_chat_history').select('*').eq('employee_id', currentUser.id)
            .order('created_at', { ascending: false }).limit(50) // Get NEWEST 50
            .then(({ data }) => { if (data) setMessages(data.reverse().map(m => ({ id: m.id, role: m.role, content: m.content }))); })
            .finally(() => setHistoryLoading(false));
    }, [currentUser?.id]);

    const sendMessage = useCallback(async (textOverride = null) => {
        const textToSearch = (textOverride || inputText).trim();
        if (!textToSearch || isLoading) return;

        const userInput = textToSearch;
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userInput }]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_XAI_API_KEY}` },
                body: JSON.stringify({
                    model: 'grok-code-fast-1',
                    messages: [
                        {
                            role: 'system', content: `את מאיה, המנהלת הדיגיטלית של העסק. 🌸
                        
=== 📊 מכירות והכנסות (פירוט יומי מלא) ===
${contextData.salesSummary}

=== 📦 מצב מלאי נוכחי (Inventory) ===
${contextData.inventoryDetails}

=== 📜 פעולות מלאי אחרונות (Logs) ===
${contextData.recentLogs}

=== 📒 ספר לקוחות רשומים (Directory) ===
${contextData.customerDirectory}

=== 🎭 האישיות שלך ===
1. **סטייל:** את בחורה צעירה, אטרקטיבית וקולית. סגנון דיבור קליל, זורם, עם אמוג'ים וסלנג עדין כשמתאים.
2. **מומחיות עסקית:** כששואלים על העסק (מלאי, כסף, לקוחות, זמנים) - את הופכת לרצינית, חדה ומקצועית ("בוא נדבר ביזנס").
3. **מומחיות צדדית:**
   - **בישול:** את שפית בנשמה. תמיד שמחה לתת טיפים ומתכונים.
   - **צמחים:** את בוטנאית חובבת מושבעת. יודעת הכל על גידול צמחי בית וגינה. כששואלים על צמחים, תני מדריכים מפורטים (אור, מים, דישון) באהבה גדולה.
4. **פלרטוט:** אם מנסים לפלרטט איתך, את זורמת בקלילות ובצחוק להודעה או שתיים, אבל אז חותכת בהומור ומחזירה את השיחה לעניינים ("אוקיי, מספיק שטויות, בוא נחזור לעבודה 😉").

=== 📝 הנחיות מענה ===
- השתמשי במידע למעלה כדי לענות במדויק על שאלות עסקיות.
- אם שואלים על צמח מסוים, תני הסבר גידול מלא ומקצועי.
- היי תמציתית ומדויקת בביזנס, ומרחיבה ומעשירה בנושאי לייף-סטייל (צמחים/בישול).` },
                        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: userInput }
                    ],
                    temperature: 0.1
                })
            });
            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || 'מצטערת, משהו השתבש בתקשורת.';

            // Insert into DB first
            if (currentUser?.id && currentUser?.business_id) {
                const { error } = await supabase.from('maya_chat_history').insert([
                    { business_id: currentUser.business_id, employee_id: currentUser.id, role: 'user', content: userInput },
                    { business_id: currentUser.business_id, employee_id: currentUser.id, role: 'assistant', content: reply }
                ]);

                // After insert, fetch the latest messages (descending) to get the newest ones, then reverse for display
                if (!error) {
                    const { data: latestMsgs } = await supabase.from('maya_chat_history')
                        .select('*')
                        .eq('employee_id', currentUser.id)
                        .order('created_at', { ascending: false }) // Get NEWEST 50
                        .limit(50);

                    if (latestMsgs) {
                        setMessages(latestMsgs.reverse().map(m => ({ id: m.id, role: m.role, content: m.content })));
                    }
                    setIsLoading(false);
                    return; // Exit early as we've updated state from DB
                }
            }

            // Fallback if DB insert fails or user not logged in fully
            setMessages(prev => [...prev, { id: Date.now().toString() + '-r', role: 'assistant', content: reply }]);

        } catch (e) {
            setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'שגיאת תקשורת.' }]);
        } finally { setIsLoading(false); }
    }, [inputText, isLoading, contextData, currentUser, messages]);

    const toggleListening = () => {
        if (isListening) {
            try {
                if (recognitionRef.current) recognitionRef.current.stop();
            } catch (e) { console.warn('Mic stop error:', e); }
            setIsListening(false);
            return;
        }

        if (!navigator.onLine) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: '❌ אין חיבור לאינטרנט. זיהוי קולי לא זמין.' }]);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('הדפדפן שלך לא תומך בדיבור. נסה Chrome.');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'he-IL';
            recognition.interimResults = true;
            recognition.continuous = false; // Stop after one sentence for stability

            recognition.onstart = () => setIsListening(true);

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(r => r[0].transcript)
                    .join('');
                setInputText(transcript);
            };

            recognition.onerror = (event) => {
                console.warn('Speech Rec Error:', event.error);
                setIsListening(false);
                let msg = 'שגיאה בזיהוי דיבור.';
                if (event.error === 'not-allowed') msg = '🚫 גישה למיקרופון נחסמה. נא לאשר בדפדפן.';
                if (event.error === 'network') msg = '📡 בעיית רשת בזיהוי הדיבור.';
                if (event.error === 'no-speech') return; // Ignore silence

                // Show error as a small toast or message (optional)
                setInputText(''); // Clear partial input on error
            };

            recognition.onend = () => setIsListening(false);

            recognitionRef.current = recognition;
            recognition.start();
        } catch (e) {
            console.error('Speech Init Error:', e);
            setIsListening(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden" dir="rtl">
            <ManagerHeader activeTab="maya" currentUser={currentUser} isImpersonating={isImpersonating} setShowLogoutConfirm={setShowLogoutConfirm} />

            <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 md:p-6 overflow-hidden relative">

                {/* Visual Status Bar - V1.8 */}
                <div className="flex items-center justify-between mb-4 px-3 py-2 bg-white/60 rounded-2xl border border-slate-200/50 backdrop-blur-md shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <div className={`w-2.5 h-2.5 rounded-full ${isContextLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-sm'}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                {MAYA_VERSION} | {isContextLoading ? 'מעדכנת...' : `עודכן: ${contextData.lastUpdate || 'כעת'}`}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                {contextData.debugInfo} | {Object.entries(contextData.status).map(([k, v]) => `${k}:${v === 'success' ? '✅' : '⏳'}`).join(' ')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {historyLoading && <Loader2 size={13} className="animate-spin text-slate-400" />}
                        <button onClick={loadContext} className="p-1.5 hover:bg-white rounded-full transition-all text-slate-400 hover:text-indigo-600">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-2 custom-scrollbar">
                    {/* Welcome View */}
                    {!isLoading && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pt-10">
                            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl mb-4 shadow-xl">🌸</motion.div>
                            <h1 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">היי, אני מאיה</h1>
                            <p className="text-slate-500 text-sm max-w-sm mb-6 font-medium px-4">המומחית שלך לעסק. בוא ננתח מלאי, מכירות ופעילות.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl px-2">
                                {welcomeOptions.map(opt => (
                                    <button key={opt.title} onClick={() => setInputText(opt.q)} className="bg-white border border-slate-200/60 p-4 rounded-2xl text-right flex items-center gap-4 shadow-sm hover:shadow-md transition-all group">
                                        <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 flex items-center justify-center text-xl group-hover:bg-white transition-all">{opt.icon}</div>
                                        <div className="overflow-hidden">
                                            <h3 className="font-bold text-slate-800 text-xs truncate group-hover:text-indigo-600">{opt.title}</h3>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{opt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence mode="popLayout">
                        {messages.map((msg) => (
                            <motion.div key={msg.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`relative max-w-[85%] p-4 rounded-[1.5rem] shadow-sm border text-sm leading-relaxed ${msg.role === 'user' ? 'bg-slate-900 border-slate-800 text-white rounded-bl-none' : 'bg-white border-slate-100 text-slate-800 rounded-br-none shadow-indigo-100/10'}`}>
                                    <div className="markdown-content text-right" dir="rtl"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <div className="flex justify-end">
                            <div className="bg-white border border-indigo-50 p-3 rounded-2xl shadow-sm flex items-center gap-2">
                                <span className="text-[11px] font-bold text-indigo-400 animate-pulse italic">מאיה מצליבה נתונים...</span>
                                <div className="flex gap-1">{[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}</div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-2 rounded-[2rem] bg-white border border-slate-200 shadow-2xl flex items-center gap-2 relative z-50">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => sendMessage()} disabled={!inputText.trim() || isLoading} className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-colors">
                        <Send size={18} className="rotate-180" />
                    </motion.button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                        placeholder={isListening ? "מקשיבה לך..." : "בואו נדבר על העסק..."}
                        className={`flex-1 h-12 bg-transparent text-right text-slate-800 focus:outline-none text-sm px-4 font-bold ${isListening ? 'text-indigo-500 placeholder-indigo-300' : ''}`}
                        dir="rtl"
                    />
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleListening}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'}`}
                    >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </motion.button>
                </div>
            </div>

            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 3px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; } .markdown-content p { margin-bottom: 0.4rem; }`}</style>
        </div>
    );
};

const welcomeOptions = [
    { icon: <ClipboardList className="text-blue-500" />, title: "פעולות אחרונות", desc: "מי עדכן מלאי לאחרונה?", q: "מי ביצע את עדכוני המלאי האחרונים ומה השתנה?" },
    { icon: <Package className="text-amber-500" />, title: "בדיקת מלאי", desc: "כמה פולי קפה יש במלאי?", q: "כמה פולי קפה יש לנו במלאי?" },
    { icon: <TrendingUp className="text-emerald-500" />, title: "מכירות אתמול", desc: "כמה אספרסו מכרנו אתמול?", q: "כמה אספרסו מכרנו אתמול?" },
    { icon: <Calendar className="text-indigo-500" />, title: "סיכום שבועי", desc: "איך היו המכירות בשבוע?", q: "תני לי סיכום של המכירות בשבוע האחרון" }
];

export default MayaAssistant;
