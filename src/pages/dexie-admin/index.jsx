import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import syncService from '@/services/syncService';
import Icon from '@/components/AppIcon';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';

/**
 * Advanced Data Dashboard (Refined)
 * Premium look following the project's design system.
 * Features: Aleph-Bet filtering, Date navigation for points/orders.
 */
const DexieAdminPanel = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('customers');
    const [loading, setLoading] = useState(true);

    // Filter states
    const [selectedLetter, setSelectedLetter] = useState('הכל');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');

    // Data states
    const [customers, setCustomers] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [syncStatus, setSyncStatus] = useState({});
    const [syncResult, setSyncResult] = useState(null);
    const [speedTest, setSpeedTest] = useState(null);

    useEffect(() => {
        loadData();
    }, [selectedDate]); // Reload data when date changes

    const loadData = async () => {
        setLoading(true);
        try {
            const businessId = currentUser?.business_id;
            if (!businessId) return;

            // 1. Load Customers
            const customersData = await db.customers.where('business_id').equals(businessId).toArray();
            const loyaltyCards = await db.loyalty_cards.where('business_id').equals(businessId).toArray();
            const loyaltyMap = new Map();
            loyaltyCards.forEach(card => {
                const phone = card.customer_phone;
                if (phone) loyaltyMap.set(phone.replace(/\D/g, ''), card.points_balance || 0);
            });

            const finalCustomers = customersData.map(c => {
                const cleanPhone = (c.phone_number || c.phone || '').toString().replace(/\D/g, '');
                const cardPoints = loyaltyMap.get(cleanPhone);
                return {
                    ...c,
                    points: cardPoints !== undefined ? cardPoints : (c.loyalty_coffee_count || 0)
                };
            }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

            // 1.1 Load last purchase dates for these customers
            // Fetch all orders from business to match in-memory for speed if not too many
            const allOrders = await db.orders.where('business_id').equals(businessId).toArray();
            const lastPurchaseMap = new Map();
            allOrders.forEach(order => {
                if (!order.customer_id) return;
                const existing = lastPurchaseMap.get(order.customer_id);
                if (!existing || new Date(order.created_at) > new Date(existing)) {
                    lastPurchaseMap.set(order.customer_id, order.created_at);
                }
            });

            const customersWithHistory = finalCustomers.map(c => ({
                ...c,
                last_purchase: lastPurchaseMap.get(c.id) || null
            }));
            setCustomers(customersWithHistory);

            // 2. Load Hierarchy Data (Points & Orders) for selected date
            const dateStr = selectedDate.toISOString().split('T')[0];
            const startOfDay = new Date(dateStr);
            const endOfDay = new Date(dateStr);
            endOfDay.setHours(23, 59, 59, 999);

            // Fetch Transactions for date
            const txData = await db.loyalty_transactions
                .where('business_id')
                .equals(businessId)
                .toArray();

            const filteredTx = txData.filter(tx => {
                const txDate = new Date(tx.created_at);
                return txDate >= startOfDay && txDate <= endOfDay;
            }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const txWithNames = filteredTx.map(tx => {
                const card = loyaltyCards.find(c => c.id === tx.card_id);
                const customer = finalCustomers.find(cust => {
                    const cp = (cust.phone_number || cust.phone || '').toString().replace(/\D/g, '');
                    const ccp = (card?.customer_phone || '').replace(/\D/g, '');
                    return cp === ccp;
                });
                return {
                    ...tx,
                    customerName: customer?.name || 'לקוח אנונימי',
                    customer_id: customer?.id || tx.customer_id
                };
            });
            setTransactions(txWithNames);

            // Fetch Orders for date
            const ordersData = await db.orders
                .where('[business_id+created_at]')
                .between([businessId, startOfDay.toISOString()], [businessId, endOfDay.toISOString()])
                .reverse()
                .toArray();

            // Fetch Order Items for these orders
            const orderIds = ordersData.map(o => o.id);
            const orderItems = await db.order_items.where('order_id').anyOf(orderIds).toArray();

            // Fetch Menu Items to get names (if not already loaded)
            const allMenuItems = await db.menu_items.where('business_id').equals(businessId).toArray();
            const menuMap = new Map(allMenuItems.map(m => [m.id, m.name]));

            // Attach items to orders
            const ordersWithItems = ordersData.map(order => {
                const items = orderItems.filter(i => i.order_id === order.id).map(i => ({
                    ...i,
                    menu_item_name: menuMap.get(i.menu_item_id) || 'פריט לא ידוע'
                }));
                return { ...order, items };
            });

            setOrders(ordersWithItems);

            // 3. Load Menu
            const menu = await db.menu_items.where('business_id').equals(businessId).toArray();
            setMenuItems(menu);

            // 4. Sync Status
            const tables = ['customers', 'menu_items', 'orders', 'order_items', 'loyalty_cards', 'loyalty_transactions'];
            // Tables that have 'business_id' indexed in Dexie
            const tablesWithBusinessId = ['customers', 'menu_items', 'orders', 'loyalty_cards', 'loyalty_transactions'];

            const status = { syncing: false };
            let calculatedCloudOrderItems = 0; // Validated from fetched orders
            for (const table of tables) {
                let local = 0;
                let localError = null;
                try {
                    // FORCE JS Filter for ALL tables with business_id as indexes seem flaky
                    // This is less efficient but guarantees accuracy for small-medium datasets
                    if (tablesWithBusinessId.includes(table)) {
                        const allRecords = await db[table].toArray();
                        local = allRecords.filter(r => r.business_id === businessId).length;
                    }
                    // Try to use index for others
                    else if (tablesWithBusinessId.includes(table) && db[table]?.where) {
                        try {
                            local = await db[table].where('business_id').equals(businessId).count();
                        } catch (indexError) {
                            console.warn(`Index lookup failed for ${table}, falling back to filter`, indexError);
                            // Fallback to JS filter if index is missing/broken
                            const allRecords = await db[table].toArray();
                            local = allRecords.filter(r => r.business_id === businessId).length;
                        }
                    } else if (table === 'order_items') {
                        // Count all order items (assuming cleanup works)
                        local = await db[table]?.count() || 0;
                    } else {
                        local = await db[table]?.count() || 0;
                    }
                } catch (e) {
                    console.warn(`Local count error for ${table}:`, e);
                    localError = e.message;
                }

                let cloud = 0;
                let cloudError = null;
                try {
                    // 1. Determine Fetch Strategy
                    if (table === 'orders') {
                        // Strategy: RPC for Orders History (Bypasses RLS logic for count)
                        const fromDate = new Date();
                        fromDate.setDate(fromDate.getDate() - 30);
                        const { data, error } = await supabase.rpc('get_orders_history', {
                            p_business_id: businessId,
                            p_from_date: fromDate.toISOString(),
                            p_to_date: new Date().toISOString()
                        });

                        if (error) {
                            cloudError = error.message;
                        } else {
                            cloud = data?.length || 0;
                            // Calculate items count from the fetched orders for the next iteration
                            if (data) {
                                calculatedCloudOrderItems = data.reduce((sum, order) => {
                                    // items might be in order_items or items_detail depending on RPC version
                                    const items = order.order_items || order.items_detail || [];
                                    return sum + items.length;
                                }, 0);
                            }
                        }
                    } else if (table === 'loyalty_cards') {
                        // Strategy: RPC for Loyalty Cards
                        const { data, error } = await supabase.rpc('get_loyalty_cards_for_sync', { p_business_id: businessId });
                        if (error) {
                            cloudError = error.message;
                        } else {
                            cloud = data?.length || 0;
                        }
                    } else if (table === 'loyalty_transactions') {
                        // Strategy: RPC for Loyalty Transactions
                        const { data, error } = await supabase.rpc('get_loyalty_transactions_for_sync', { p_business_id: businessId });
                        if (error) {
                            cloudError = error.message;
                        } else {
                            cloud = data?.length || 0;
                        }
                    } else if (table === 'order_items') {
                        // Strategy: Use pre-calculated count if available, otherwise skip
                        cloud = calculatedCloudOrderItems > 0 ? calculatedCloudOrderItems : -1;
                    } else {
                        // Strategy: Standard Query
                        let query = supabase.from(table).select('*', { count: 'exact', head: true });
                        if (tablesWithBusinessId.includes(table)) {
                            query = query.eq('business_id', businessId);
                        }
                        const { count, error } = await query;
                        if (error) {
                            cloudError = error.message;
                            console.warn(`Cloud count error for ${table}:`, error);
                        } else {
                            cloud = count || 0;
                        }
                    }
                } catch (e) {
                    cloudError = e.message;
                }
                status[table] = {
                    count: local,
                    cloudCount: cloud, // Keep raw value (-1) for logic checks
                    localError,
                    cloudError,
                    // Relaxed needsSync check due to timing diffs
                    needsSync: local === 0 && cloud > 0
                };
            }
            setSyncStatus(status);

        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Alphabet Logic
    const letters = useMemo(() => {
        const available = new Set(customers.map(c => (c.name || '').trim().charAt(0)).filter(l => l));
        const alephBet = "אבגדהוזחטיכלמנסעפצקרשת".split('');
        return ['הכל', ...alephBet.filter(l => available.has(l))];
    }, [customers]);

    const filteredContent = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return {
            customers: customers.filter(c => {
                // Filter out anonymous customers (including those with no name)
                if (!c.name || c.name === 'לקוח אנונימי' || c.name.startsWith('לקוח אנונימי')) return false;

                const matchSearch = !query || c.name?.toLowerCase().includes(query) || (c.phone_number || '').includes(query);
                const matchLetter = selectedLetter === 'הכל' || (c.name || '').trim().startsWith(selectedLetter);
                return matchSearch && matchLetter;
            }),
            menu: menuItems.filter(m => !query || m.name?.toLowerCase().includes(query)),
            orders: orders.filter(o => !query || o.order_number?.toString().includes(query)),
            transactions: transactions.filter(t => !query || t.customerName?.toLowerCase().includes(query))
        };
    }, [customers, menuItems, orders, transactions, searchQuery, selectedLetter]);

    const changeDate = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const tabs = [
        { id: 'customers', label: 'לקוחות', icon: 'Users' },
        { id: 'transactions', label: 'נקודות', icon: 'Coffee' },
        { id: 'menu', label: 'תפריט', icon: 'Coffee' },
        { id: 'orders', label: 'הזמנות', icon: 'ShoppingCart' },
        { id: 'sync', label: 'סנכרון', icon: 'Database' },
    ];



    return (
        <div className="min-h-screen bg-[#F8FAFC] font-heebo" dir="rtl">
            {/* Header Redesign: Tabs Moved to Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8">
                    {/* Right Side: Back Button + Title */}
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/mode-selection')} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all text-slate-600 flex items-center gap-2">
                            <Icon name="ArrowRight" size={20} />
                            <span className="text-sm font-bold hidden sm:inline">חזרה</span>
                        </button>
                        <button
                            onClick={loadData}
                            className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl transition-all"
                            title="רענן נתונים"
                        >
                            <Icon name="RefreshCw" size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <div className="px-4 py-2 bg-orange-50 rounded-xl">
                            <p className="text-xs font-black text-orange-500 uppercase tracking-widest leading-none mb-1">צפייה בבסיס נתונים</p>
                            <p className="text-sm font-bold text-slate-800 leading-none">{currentUser?.business_name}</p>
                        </div>
                    </div>

                    {/* Navigation Bar in Header */}
                    <nav className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === tab.id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                <Icon name={tab.icon} size={16} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="relative w-64">
                        <Icon name="Search" size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="חיפוש..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-11 pl-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/10 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Second Level: Context Bar (Letter Filter or Date Picker) */}
                <div className="bg-slate-50 border-t border-slate-100 px-6 py-2">
                    <div className="max-w-7xl mx-auto flex items-center justify-center">
                        {activeTab === 'customers' ? (
                            <div className="flex flex-wrap items-center justify-center gap-1">
                                {letters.map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setSelectedLetter(l)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-black text-sm transition-all ${selectedLetter === l ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                            }`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        ) : (activeTab === 'orders' || activeTab === 'transactions') ? (
                            <div className="flex items-center gap-6">
                                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><Icon name="ChevronRight" size={20} /></button>
                                <div className="flex items-center gap-3 bg-white px-6 py-2 rounded-xl shadow-sm border border-slate-100">
                                    <Icon name="Calendar" size={18} className="text-orange-500" />
                                    <span className="font-black text-slate-700">
                                        {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </span>
                                </div>
                                <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><Icon name="ChevronLeft" size={20} /></button>
                                <button onClick={() => setSelectedDate(new Date())} className="text-xs font-black text-orange-500 hover:underline">היום</button>
                            </div>
                        ) : (
                            <div className="h-9 flex items-center text-xs font-bold text-slate-300 uppercase tracking-widest">
                                {activeTab} details visualization
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 opacity-30">
                        <div className="w-12 h-12 border-4 border-slate-300 border-t-orange-500 rounded-full animate-spin mb-4" />
                        <p className="font-black text-slate-500 tracking-tighter">מאחזר נתונים מהענן...</p>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {activeTab === 'customers' && (
                            <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-xl">
                                <table className="w-full text-right border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">לקוח</th>
                                            <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">טלפון</th>
                                            <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">נקודות</th>
                                            <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">קנייה אחרונה</th>
                                            <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">מידת נעליים 🤫</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredContent.customers.length === 0 ? (
                                            <tr><td colSpan="5" className="py-20 text-center font-bold text-slate-300">לא נמצאו לקוחות</td></tr>
                                        ) : filteredContent.customers.map(cust => {
                                            // Local random shoe size generator (fun request)
                                            const shoeSize = Math.floor(Math.abs(Math.sin(cust.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0))) * (45 - 36 + 1)) + 36;

                                            return (
                                                <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                                                                {(cust.name || '?').charAt(0)}
                                                            </div>
                                                            <div className="font-black text-slate-800 text-lg uppercase">{cust.name || 'לקוח אנונימי'}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 font-bold text-slate-400">{cust.phone_number || cust.phone || '---'}</td>
                                                    <td className="px-6 py-5">
                                                        <div className={`w-fit px-4 py-1.5 rounded-xl font-black text-sm flex items-center gap-2 ${cust.points >= 9 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                            <Icon name="Coffee" size={14} />
                                                            {cust.points}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-slate-500 font-bold">
                                                        {cust.last_purchase ? new Date(cust.last_purchase).toLocaleDateString('he-IL') : 'מעולם לא'}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="text-sm font-black text-slate-300 group-hover:text-slate-600 transition-colors">
                                                            EU {shoeSize}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'transactions' && (
                            <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                                <table className="w-full text-right">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">זמן</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">לקוח</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">טלפון</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">פעולה</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">שינוי</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">יתרה נוכחית</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredContent.transactions.length === 0 ? (
                                            <tr><td colSpan="6" className="py-20 text-center font-bold text-slate-300">אין פעולות בתאריך זה</td></tr>
                                        ) : filteredContent.transactions.map(tx => {
                                            const relatedCustomer = customers.find(c => c.id === tx.customer_id) || {};
                                            return (
                                                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-500">{new Date(tx.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                                                    <td className="px-6 py-4 font-black text-slate-800">{tx.customerName}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500 font-mono" dir="ltr">{relatedCustomer.phone || relatedCustomer.phone_number || '---'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${(tx.transaction_type === 'purchase' && (tx.change_amount || 0) >= 0) ? 'bg-blue-50 text-blue-600' :
                                                            (tx.transaction_type === 'refund' || tx.transaction_type === 'cancellation' || (tx.transaction_type === 'purchase' && tx.change_amount < 0)) ? 'bg-red-50 text-red-600' :
                                                                tx.transaction_type === 'redemption' ? 'bg-green-50 text-green-600' :
                                                                    'bg-purple-50 text-purple-600'
                                                            }`}>
                                                            {(tx.transaction_type === 'purchase' && (tx.change_amount || 0) >= 0) ? 'רכישה' :
                                                                (tx.transaction_type === 'refund' || tx.transaction_type === 'cancellation' || (tx.transaction_type === 'purchase' && tx.change_amount < 0)) ? 'ביטול/החזר' :
                                                                    tx.transaction_type === 'redemption' ? 'מימוש' :
                                                                        'תיקון ידני'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-6 py-4 font-black ${tx.change_amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {tx.change_amount > 0 ? `+${tx.change_amount}` : tx.change_amount}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-slate-700">
                                                        <div className="flex items-center gap-1 bg-slate-100 w-fit px-2 py-1 rounded-lg">
                                                            <Icon name="Coffee" size={14} className="text-slate-400" />
                                                            <span>{relatedCustomer.points ?? '?'}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div className="space-y-3">
                                {filteredContent.orders.length === 0 ? (
                                    <div className="py-20 text-center font-bold text-slate-300 bg-white rounded-3xl border border-dashed border-slate-200">אין הזמנות בתאריך זה</div>
                                ) : filteredContent.orders.map(order => {
                                    // Calculate stats
                                    const prepTime = order.updated_at && order.created_at ?
                                        Math.round((new Date(order.updated_at) - new Date(order.created_at)) / 60000) : 0;

                                    // Parse payment method
                                    const paymentMethod = order.payment_method === 'cash' ? 'מזומן' :
                                        order.payment_method === 'credit_card' ? 'אשראי' :
                                            order.payment_method === 'bis' ? 'תן ביס' :
                                                order.payment_method === 'cibus' ? 'סיבוס' : order.payment_method || '?';

                                    // Find Phone
                                    const relatedCustomer = customers.find(c => c.name === order.customer_name || c.id === order.customer_id);
                                    const displayPhone = order.customer_phone || relatedCustomer?.phone || relatedCustomer?.phone_number;

                                    return (
                                        <div key={order.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group w-full text-slate-800 h-[72px]">

                                            {/* 1. Name & Number (Fixed Width for alignment) */}
                                            <div className="flex flex-col justify-center w-[180px] shrink-0 border-l border-slate-50 pl-4">
                                                <div className="font-black text-lg leading-tight text-slate-800 truncate text-right" title={order.customer_name}>
                                                    {order.customer_name || `#${order.order_number}`}
                                                </div>
                                                <div className="text-xs font-bold text-slate-400 flex items-center gap-2 mt-0.5 h-4">
                                                    {order.customer_name && <span>#{order.order_number}</span>}
                                                    {displayPhone && displayPhone !== '0500000000' && displayPhone !== 'null' && displayPhone !== 'undefined' && (
                                                        <>
                                                            {order.customer_name && <span className="text-slate-300">|</span>}
                                                            <span className="truncate" dir="ltr">{displayPhone}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Time (Fixed Width) */}
                                            <div className="w-[60px] text-center shrink-0">
                                                <div className="text-sm font-bold text-slate-400 font-mono">
                                                    {new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>

                                            {/* 3. Items (Flexible Middle) */}
                                            <div className="flex-1 flex items-center overflow-hidden h-full px-4 border-r border-slate-100 bg-slate-50/50 rounded-lg mx-2">
                                                <div className="flex items-center gap-1 text-sm truncate w-full">
                                                    {order.items?.length > 0 ? (
                                                        order.items.map((item, idx) => (
                                                            <span key={idx} className="flex items-center whitespace-nowrap text-slate-700">
                                                                {item.quantity > 1 && <span className="font-black text-black ml-1.5">{item.quantity}</span>}
                                                                <span className="font-bold">{item.menu_item_name}</span>
                                                                {item.notes && <span className="text-slate-400 text-xs mx-1 font-normal">({item.notes})</span>}
                                                                {idx < order.items.length - 1 && <span className="mx-2 text-slate-300">|</span>}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">טוען...</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 4. Payment & Amount */}
                                            <div className="flex items-center gap-4 w-[140px] justify-between shrink-0 pl-2">
                                                <div className="text-right">
                                                    <span className="block font-black text-xl">₪{order.total_amount}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    {order.is_paid ? (
                                                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap min-w-[50px] text-center">
                                                            {paymentMethod !== '?' ? paymentMethod : 'שולם'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md whitespace-nowrap">לא שולם</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 5. Duration */}
                                            <div className="w-[70px] flex justify-center shrink-0">
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-100 text-slate-400 bg-white">
                                                    <Icon name="Clock" size={12} />
                                                    <span className="text-xs font-bold font-mono">{prepTime > 0 ? `${prepTime}'` : '--'}</span>
                                                </div>
                                            </div>

                                            {/* 6. Status */}
                                            <div className="w-[90px] flex justify-end shrink-0">
                                                <div className={`w-full py-1.5 rounded-xl text-xs font-black text-center shadow-sm ${order.order_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {order.order_status === 'completed' ? 'הושלם' : 'בתהליך'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'menu' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {filteredContent.menu.map(item => (
                                    <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                                        {!item.is_active && <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[1px] flex items-center justify-center font-black text-[10px] text-slate-400 uppercase rotate-12">לא פעיל</div>}
                                        <p className="text-[10px] font-black text-orange-500 uppercase mb-1">{item.category}</p>
                                        <h5 className="font-black text-slate-700 text-sm leading-tight mb-2">{item.name}</h5>
                                        <p className="font-black text-slate-900 text-xs">₪{item.price}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'sync' && (
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-slate-900 rounded-[32px] p-8 text-white mb-8 shadow-2xl relative overflow-hidden">
                                    <div className="relative z-10 flex flex-col items-start gap-4 w-full">
                                        <div className="flex justify-between items-center w-full">
                                            <div>
                                                <h2 className="text-2xl font-black mb-1">מסוף סנכרון</h2>
                                                <p className="text-slate-400 text-sm font-bold flex items-center gap-2">
                                                    השוואת מסד הנתונים המקומי מול שרתי הענן
                                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-500 font-mono">BID: {currentUser?.business_id?.substring(0, 8)}...</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    disabled={syncStatus.syncing || speedTest?.loading}
                                                    onClick={async () => {
                                                        setSpeedTest({ loading: true, result: null });
                                                        try {
                                                            const start = Date.now();
                                                            // Fetch a random image to test speed/latency
                                                            await fetch('https://source.unsplash.com/random/800x600', { cache: 'no-cache' }).catch(() => { });
                                                            // Fallback or just measure latency
                                                            await supabase.from('businesses').select('count', { count: 'exact', head: true });
                                                            const duration = Date.now() - start;
                                                            const speed = duration < 100 ? 'מעולה 🚀' : duration < 500 ? 'טוב ✅' : 'איטי ⚠️';
                                                            setSpeedTest({ loading: false, result: `${speed} (${duration}ms)` });
                                                        } catch (e) {
                                                            setSpeedTest({ loading: false, result: 'שגיאה ❌' });
                                                        }
                                                    }}
                                                    className="px-6 py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold transition-all disabled:opacity-50 text-white border border-slate-600"
                                                >
                                                    {speedTest?.loading ? 'בודק...' : 'בדיקת מהירות'}
                                                </button>
                                                <button
                                                    disabled={syncStatus.syncing || speedTest?.loading}
                                                    onClick={async () => {
                                                        setSyncStatus(prev => ({ ...prev, syncing: true }));
                                                        setSyncResult(null);
                                                        try {
                                                            const res = await syncService.initialLoad(currentUser.business_id);
                                                            await loadData();
                                                            if (res?.success) {
                                                                // Format nice report
                                                                const changes = Object.entries(res.results).filter(([_, r]) => r.count > 0).map(([t, r]) => `${t}: ${r.count}`).join(', ');
                                                                setSyncResult(`סנכרון הושלם בהצלחה (${res.duration}s). ${changes ? 'עודכנו: ' + changes : 'הכל מעודכן.'}`);
                                                            } else {
                                                                setSyncResult('סנכרון נכשל or אוף-ליין');
                                                            }
                                                        } finally {
                                                            setSyncStatus(prev => ({ ...prev, syncing: false }));
                                                        }
                                                    }}
                                                    className="px-8 py-4 bg-orange-600 hover:bg-orange-500 rounded-2xl font-black transition-all shadow-xl shadow-orange-600/20 disabled:opacity-50"
                                                >
                                                    {syncStatus.syncing ? 'מסנכרן...' : 'הפעל סנכרון מלא'}
                                                </button>

                                                {/* Clear & Reset Button */}
                                                <button
                                                    disabled={syncStatus.syncing}
                                                    onClick={async () => {
                                                        if (!window.confirm('האם אתה בטוח? פעולה זו תמחק את כל הנתונים המקומיים ותסנכרן מחדש מהענן.')) return;
                                                        setSyncStatus(prev => ({ ...prev, syncing: true }));
                                                        setSyncResult(null);
                                                        try {
                                                            // Import clearAllData from database
                                                            const { clearAllData, db } = await import('../../db/database');
                                                            await clearAllData();
                                                            // FORCE clear order_items explicitly just in case
                                                            await db.order_items.clear();

                                                            setSyncResult('נתונים מקומיים נמחקו. מתחיל סנכרון...');

                                                            // Now sync fresh
                                                            const res = await syncService.initialLoad(currentUser.business_id);

                                                            // Force reload of data to UI
                                                            await loadData();

                                                            // DIAGNOSTIC: Check loyalty cards
                                                            const cards = await db.loyalty_cards.toArray();
                                                            if (cards.length > 0) {
                                                                console.log('🔍 [Diagnostic] Loyalty Card sample:', cards[0]);
                                                                console.log('🔍 [Diagnostic] Current Business ID:', currentUser.business_id);
                                                                console.log('🔍 [Diagnostic] Match?', cards[0].business_id === currentUser.business_id);
                                                            }

                                                            if (res?.success) {
                                                                const changes = Object.entries(res.results).filter(([_, r]) => r.count > 0).map(([t, r]) => `${t}: ${r.count}`).join(', ');
                                                                setSyncResult(`🔄 אתחול הושלם! (${res.duration}s). ${changes ? 'נטענו: ' + changes : 'הכל מעודכן.'}`);
                                                            } else {
                                                                setSyncResult('⚠️ אתחול חלקי - יש לבדוק חיבור');
                                                            }
                                                        } catch (err) {
                                                            setSyncResult('❌ שגיאה: ' + err.message);
                                                        } finally {
                                                            setSyncStatus(prev => ({ ...prev, syncing: false }));
                                                        }
                                                    }}
                                                    className="px-6 py-4 bg-red-600/80 hover:bg-red-500 rounded-2xl font-black transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 border border-red-400/30"
                                                >
                                                    🗑️ ניקוי ואתחול
                                                </button>
                                            </div>
                                        </div>

                                        {/* Results Display Area */}
                                        {(syncResult || speedTest?.result) && (
                                            <div className="w-full bg-slate-800/50 rounded-xl p-4 mt-2 border border-slate-700/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                                                {speedTest?.result && (
                                                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                                                        <Icon name="Activity" size={16} />
                                                        <span>מהירות רשת: {speedTest.result}</span>
                                                    </div>
                                                )}
                                                {syncResult && (
                                                    <div className="flex items-center gap-2 text-blue-300 font-medium text-sm">
                                                        <Icon name="CheckCircle" size={16} />
                                                        <span>{syncResult}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <Icon name="Database" size={160} className="absolute -left-10 -bottom-10 text-white/5" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(syncStatus).filter(([k]) => k !== 'syncing').map(([table, data]) => {
                                        return (
                                            <div key={table} className="bg-white rounded-2xl p-6 border border-slate-100 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{table}</p>
                                                    <div className="flex flex-col text-sm font-bold gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                            <span>מקומי: {data.count}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                                                            <span>ענן: {data.cloudCount === -1 ? '?' : data.cloudCount}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {(data.count === data.cloudCount || data.cloudCount === -1) ? <Icon name="CheckCircle" className="text-green-500" /> : <Icon name="AlertCircle" className="text-red-500" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <ConnectionStatusBar />
        </div>
    );
};

export default DexieAdminPanel;
