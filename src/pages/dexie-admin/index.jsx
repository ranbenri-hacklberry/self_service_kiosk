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
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [exactMatchQuery, setExactMatchQuery] = useState(null);

    // Filter Debounce Logic: Prevents heavy re-calculation on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Data states
    const [customers, setCustomers] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [syncStatus, setSyncStatus] = useState({});
    const [syncResult, setSyncResult] = useState(null);
    const [speedTest, setSpeedTest] = useState(null);

    useEffect(() => {
        if (currentUser?.business_id) {
            loadData();
        }
    }, [currentUser?.business_id]); // Re-load when business identity is confirmed

    const loadData = async () => {
        setLoading(true);
        try {
            const businessId = currentUser?.business_id;
            if (!businessId) return;

            // 1. Load Customers (Resilient Loading - avoiding flaky indexes)
            const allLocalCustomers = await db.customers.toArray();
            const customersData = allLocalCustomers.filter(c => c.business_id === businessId || !c.business_id);
            console.log(`📊 Loaded ${customersData.length} customers from Dexie (out of ${allLocalCustomers.length} total)`);

            const allLoyaltyCards = await db.loyalty_cards.toArray();
            const loyaltyCards = allLoyaltyCards.filter(c => c.business_id === businessId || !c.business_id);

            const loyaltyMap = new Map();
            loyaltyCards.forEach(card => {
                const phone = card.customer_phone;
                if (phone) loyaltyMap.set(phone.replace(/\D/g, ''), card.points_balance || 0);
            });

            const finalCustomers = customersData.map(c => {
                const cleanPhone = (c.phone_number || c.phone || '').toString().replace(/\D/g, '');
                const card = loyaltyCards.find(lc => lc.customer_phone?.replace(/\D/g, '') === cleanPhone);
                const cardPoints = card?.points_balance;
                const cardRewards = card?.free_coffees;

                return {
                    ...c,
                    points: cardPoints !== undefined ? cardPoints : (c.loyalty_coffee_count || 0),
                    rewards: cardRewards || 0
                };
            }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

            // 1.1 Load last purchase dates for these customers
            // Fetch all orders from business to match in-memory for speed if not too many
            const allOrdersRaw = await db.orders.toArray();
            const allOrders = allOrdersRaw.filter(o => o.business_id === businessId);
            console.log(`📊 Loaded ${allOrders.length} orders for history mapping`);

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

            // 2. Load ALL Transactions (last 30 days) - resilient loading
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const txDataRaw = await db.loyalty_transactions.toArray();
            const txData = txDataRaw.filter(tx => tx.business_id === businessId);
            console.log(`📊 Loaded ${txData.length} transactions for sync check`);

            // Filter to last 30 days and sort newest first
            const allTx = txData
                .filter(tx => new Date(tx.created_at) >= thirtyDaysAgo)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const txWithNames = allTx.map(tx => {
                const card = loyaltyCards.find(c => c.id === tx.card_id);
                const cardPhone = card?.customer_phone?.replace(/\D/g, '');
                const customer = finalCustomers.find(cust => {
                    const cp = (cust.phone_number || cust.phone || '').toString().replace(/\D/g, '');
                    return cp === cardPhone;
                });
                return {
                    ...tx,
                    customerName: customer?.name || (cardPhone ? `${cardPhone}` : 'לקוח אנונימי'),
                    customerPhone: card?.customer_phone || customer?.phone_number || customer?.phone,
                    currentBalance: card?.points_balance ?? 0,
                    customer_id: customer?.id || tx.customer_id,
                    // Add date string for grouping
                    dateGroup: new Date(tx.created_at).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
                };
            });
            setTransactions(txWithNames);

            // 3. Load ALL Orders (last 14 days) - resilient loading
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const allOrdersDataRaw = await db.orders.toArray();
            const allOrdersData = allOrdersDataRaw.filter(o => o.business_id === businessId);
            console.log(`📊 Loaded ${allOrdersData.length} total orders for this business`);

            const recentOrders = allOrdersData
                .filter(o => new Date(o.created_at) >= fourteenDaysAgo)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Fetch Order Items for these orders
            const orderIds = recentOrders.map(o => o.id);
            const orderItems = await db.order_items.where('order_id').anyOf(orderIds).toArray();

            // Fetch Menu Items to get names
            const allMenuItems = await db.menu_items.where('business_id').equals(businessId).toArray();
            const menuMap = new Map(allMenuItems.map(m => [m.id, m.name]));

            // Attach items to orders
            const ordersWithItems = recentOrders.map(order => {
                const items = orderItems.filter(i => i.order_id === order.id).map(i => ({
                    ...i,
                    menu_item_name: menuMap.get(i.menu_item_id) || 'פריט לא ידוע'
                }));
                return {
                    ...order,
                    items,
                    // Add date string for grouping
                    dateGroup: new Date(order.created_at).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
                };
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
                        // Count ONLY items belonging to orders of this business
                        const businessOrderIds = (await db.orders.where('business_id').equals(businessId).toArray()).map(o => o.id);
                        local = await db.order_items.where('order_id').anyOf(businessOrderIds).count();
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
                        // Use 30 days to match the new aggressive sync window
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

                            // CRITICAL FIX: To show truthful status, local count MUST match the same 30-day window
                            const localOrdersInWindow = await db.orders
                                .where('business_id').equals(businessId)
                                .filter(o => new Date(o.created_at) >= fromDate)
                                .toArray();
                            local = localOrdersInWindow.length;

                            // Calculate items count from the fetched orders
                            if (data) {
                                calculatedCloudOrderItems = data.reduce((sum, order) => {
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
                    // Relaxed needsSync check
                    needsSync: local !== cloud && cloud > 0
                };
            }
            setSyncStatus(status);

        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * ADVANCED DATA GROUPING ENGINE
     * Optimized for scalability: uses single-pass reduction for O(n) performance
     * and debouncing to prevent UI lag.
     */
    const filteredContent = useMemo(() => {
        const query = (exactMatchQuery || debouncedQuery || '').toLowerCase().trim();
        const isExact = !!exactMatchQuery;

        if (!query) {
            // Fast Path: Full data grouping without filtering
            return {
                customers: groupData(customers, c => (c.name || '').trim().charAt(0)),
                menu: menuItems,
                orders: groupData(orders, o => o.dateGroup),
                transactions: groupData(transactions, t => t.dateGroup)
            };
        }

        // 1. Optimized Customer Filtering
        const filteredCustomers = customers.filter(c => {
            const name = (c.name || '').toLowerCase();
            const phone = (c.phone_number || c.phone || '').toString().replace(/\D/g, '');

            // Search match logic
            const isMatch = isExact
                ? (name === query || phone === query)
                : (name.includes(query) || phone.includes(query));

            return isMatch;
        });

        // 2. Optimized Transaction Filtering
        const filteredTransactions = transactions.filter(t => {
            const name = (t.customerName || '').toLowerCase();
            const phone = (t.customerPhone || '').toLowerCase();
            return isExact ? (name === query || phone === query) : (name.includes(query) || phone.includes(query));
        });

        // 3. Optimized Order Filtering
        const filteredOrders = orders.filter(o => {
            const orderNum = o.order_number?.toString() || '';
            const name = (o.customer_name || '').toLowerCase();
            const phone = (o.customer_phone || '').toLowerCase();
            return isExact ? (name === query || phone === query || orderNum === query) :
                (name.includes(query) || phone.includes(query) || orderNum.includes(query));
        });

        return {
            customers: groupData(filteredCustomers, c => (c.name || '').trim().charAt(0)),
            menu: menuItems.filter(m => {
                const name = (m.name || '').toLowerCase();
                return isExact ? name === query : name.includes(query);
            }),
            orders: groupData(filteredOrders, o => o.dateGroup),
            transactions: groupData(filteredTransactions, t => t.dateGroup)
        };
    }, [customers, menuItems, orders, transactions, debouncedQuery, exactMatchQuery]);

    // Helper: High-performance grouping utility (O(n) complexity)
    function groupData(items, labelSelector) {
        if (!items || items.length === 0) return [];
        return items.reduce((acc, item) => {
            const label = labelSelector(item) || '#';
            const lastGroup = acc[acc.length - 1];
            if (lastGroup && lastGroup.label === label) {
                lastGroup.items.push(item);
            } else {
                acc.push({ label, items: [item] });
            }
            return acc;
        }, []);
    }

    // Helper: Deterministic size generator (Moved to scope for cleaner code)
    const getShoeSize = (id) => {
        if (!id) return 42;
        const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return Math.floor(Math.abs(Math.sin(hash)) * (45 - 36 + 1)) + 36;
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

                    <div className="relative w-80 group">
                        <div className={`
                            flex items-center gap-2 w-full bg-slate-50 border transition-all duration-200 rounded-xl px-3 py-1.5
                            ${exactMatchQuery ? 'border-orange-200 ring-2 ring-orange-500/5' : 'border-slate-200 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10'}
                        `}>
                            <Icon name="Search" size={16} className={`${exactMatchQuery ? 'text-orange-400' : 'text-slate-400'}`} />

                            {exactMatchQuery && (
                                <div className="flex items-center gap-2 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg border border-orange-200 animate-in zoom-in-95 duration-200 shrink-0">
                                    <button
                                        onClick={() => setExactMatchQuery(null)}
                                        className="p-0.5 hover:bg-orange-200 rounded-md transition-colors"
                                    >
                                        <Icon name="X" size={10} />
                                    </button>
                                    <span className="text-xs font-black tracking-tight">{exactMatchQuery}</span>
                                </div>
                            )}

                            <input
                                type="text"
                                placeholder={exactMatchQuery ? "" : "חיפוש..."}
                                className="flex-1 bg-transparent border-none p-0 py-1 text-sm font-bold outline-none placeholder:text-slate-400"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && searchQuery.trim()) {
                                        setExactMatchQuery(searchQuery.trim());
                                        setSearchQuery('');
                                    }
                                }}
                            />
                        </div>
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
                            <div className="space-y-4">
                                {filteredContent.customers.length === 0 ? (
                                    <div className="py-20 text-center font-bold text-slate-300 bg-white rounded-3xl border border-dashed border-slate-200">לא נמצאו לקוחות</div>
                                ) : filteredContent.customers.map((group, gIdx) => (
                                    <div key={`customer-group-${group.label}-${gIdx}`} className="space-y-4">
                                        <div className="flex items-center gap-3 py-6 sticky top-20 z-20 bg-[#F8FAFC]">
                                            <div className="px-4 py-1.5 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">
                                                {group.label}
                                            </div>
                                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                                        </div>

                                        <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-xl">
                                            <table className="w-full text-right border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">לקוח</th>
                                                        <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">טלפון</th>
                                                        <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">נקודות</th>
                                                        <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">צ'ופרים 🎁</th>
                                                        <th className="px-6 py-5 text-sm font-black text-slate-500 uppercase">קנייה אחרונה</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.items.map(cust => {
                                                        const shoeSize = getShoeSize(cust.id);
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
                                                                    <div className={`w-fit px-4 py-1.5 rounded-xl font-black text-sm flex items-center gap-2 ${cust.points >= 9 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                        <Icon name="Coffee" size={14} />
                                                                        {cust.points}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 text-slate-500 font-bold">
                                                                    {cust.last_purchase ? new Date(cust.last_purchase).toLocaleDateString('he-IL') : 'מעולם לא'}
                                                                </td>
                                                                <td className="px-6 py-5">
                                                                    {cust.rewards > 0 ? (
                                                                        <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-xl font-black text-sm animate-pulse border border-green-200">
                                                                            <Icon name="Gift" size={14} />
                                                                            {cust.rewards} קפה חינם
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-300 font-bold">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'transactions' && (
                            <div className="space-y-4">
                                {filteredContent.transactions.length === 0 ? (
                                    <div className="py-20 text-center font-bold text-slate-300 bg-white rounded-3xl border border-dashed border-slate-200">אין פעולות בתאריך זה</div>
                                ) : filteredContent.transactions.map((group, gIdx) => (
                                    <div key={`tx-group-${group.label}-${gIdx}`} className="space-y-4">
                                        <div className="flex items-center gap-3 py-6 sticky top-20 z-20 bg-[#F8FAFC]">
                                            <div className="px-4 py-1.5 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">
                                                {group.label}
                                            </div>
                                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                                        </div>

                                        <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                                            <table className="w-full text-right border-collapse">
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
                                                    {group.items.map(tx => (
                                                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-500">{new Date(tx.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                                                            <td className="px-6 py-4 font-black text-slate-800">{tx.customerName}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-500 font-mono" dir="ltr">{tx.customerPhone || '---'}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${(tx.transaction_type === 'purchase' && (tx.change_amount || 0) >= 0) ? 'bg-blue-50 text-blue-600' :
                                                                    (tx.transaction_type === 'refund' || tx.transaction_type === 'cancellation' || (tx.transaction_type === 'purchase' && tx.change_amount < 0)) ? 'bg-red-50 text-red-600' :
                                                                        tx.transaction_type === 'redemption' ? 'bg-green-50 text-green-600' :
                                                                            'bg-purple-50 text-purple-600'}`}>
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
                                                                    <span>{tx.currentBalance}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div className="space-y-4">
                                {filteredContent.orders.length === 0 ? (
                                    <div className="py-20 text-center font-bold text-slate-300 bg-white rounded-3xl border border-dashed border-slate-200">אין הזמנות בתאריך זה</div>
                                ) : filteredContent.orders.map((group, gIdx) => (
                                    <div key={`order-group-${group.label}-${gIdx}`} className="space-y-3">
                                        <div className="flex items-center gap-3 py-6 sticky top-20 z-20 bg-[#F8FAFC]">
                                            <div className="px-4 py-1.5 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">
                                                {group.label}
                                            </div>
                                            <div className="h-[1px] flex-1 bg-slate-200"></div>
                                        </div>

                                        {group.items.map(order => {
                                            const prepTime = order.updated_at && order.created_at ? Math.round((new Date(order.updated_at) - new Date(order.created_at)) / 60000) : 0;
                                            const paymentMethod = order.payment_method === 'cash' ? 'מזומן' : order.payment_method === 'credit_card' ? 'אשראי' : order.payment_method === 'bis' ? 'תן ביס' : order.payment_method === 'cibus' ? 'סיבוס' : order.payment_method || '?';
                                            const relatedCustomer = customers.find(c => c.name === order.customer_name || c.id === order.customer_id);
                                            const displayPhone = order.customer_phone || relatedCustomer?.phone || relatedCustomer?.phone_number;

                                            return (
                                                <div key={order.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group w-full text-slate-800 h-[72px]">
                                                    <div className="flex flex-col justify-center w-[180px] shrink-0 border-l border-slate-50 pl-4">
                                                        <div className="font-black text-lg leading-tight text-slate-800 truncate text-right" title={order.customer_name}>
                                                            {order.customer_name || `#${order.order_number}`}
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2 mt-0.5 h-4">
                                                            {order.customer_name && <span>#{order.order_number}</span>}
                                                            {displayPhone && displayPhone !== '0500000000' && (
                                                                <>
                                                                    {order.customer_name && <span className="text-slate-300">|</span>}
                                                                    <span className="truncate" dir="ltr">{displayPhone}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="w-[60px] text-center shrink-0">
                                                        <div className="text-sm font-bold text-slate-400 font-mono">
                                                            {new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 flex items-center overflow-hidden h-full px-4 border-r border-slate-100 bg-slate-50/50 rounded-lg mx-2">
                                                        <div className="flex items-center gap-1 text-sm truncate w-full">
                                                            {order.items?.map((item, idx) => (
                                                                <span key={idx} className="flex items-center whitespace-nowrap text-slate-700">
                                                                    {item.quantity > 1 && <span className="font-black text-black ml-1.5">{item.quantity}</span>}
                                                                    <span className="font-bold">{item.menu_item_name}</span>
                                                                    {idx < order.items.length - 1 && <span className="mx-2 text-slate-300">|</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 w-[140px] justify-between shrink-0 pl-2">
                                                        <span className="block font-black text-xl">₪{order.total_amount}</span>
                                                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{paymentMethod !== '?' ? paymentMethod : 'שולם'}</span>
                                                    </div>
                                                    <div className="w-[70px] flex justify-center shrink-0">
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-100 text-slate-400 bg-white">
                                                            <Icon name="Clock" size={12} />
                                                            <span className="text-xs font-bold font-mono">{prepTime > 0 ? `${prepTime}'` : '--'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-[90px] flex justify-end shrink-0">
                                                        <div className={`w-full py-1.5 rounded-xl text-xs font-black text-center shadow-sm ${order.order_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {order.order_status === 'completed' ? 'הושלם' : 'בתהליך'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
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
                                                                const pruned = res.results.orders?.prunedCount || 0;
                                                                setSyncResult(`סנכרון הושלם בהצלחה (${res.duration}s). ${changes ? 'עודכנו: ' + changes : 'הכל מעודכן.'} ${pruned > 0 ? `🧹 נוקו ${pruned} הזמנות עודפות.` : ''}`);
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

                                                        // 1. Immediate UI Feedback - set local counts to 1 (visual cue that it changed) or 0
                                                        setSyncStatus(prev => {
                                                            const cleared = { ...prev, syncing: true };
                                                            Object.keys(cleared).forEach(k => {
                                                                if (k !== 'syncing') cleared[k] = { ...cleared[k], count: 0 };
                                                            });
                                                            return cleared;
                                                        });
                                                        setSyncResult('מנקה נתונים מקומיים...');

                                                        try {
                                                            // 2. Clear Database
                                                            const { clearAllData, db } = await import('../../db/database');
                                                            await clearAllData();

                                                            // 3. Force re-load metadata to UI (should show zeros)
                                                            await loadData();
                                                            setSyncResult('מסד הנתונים נוקה. מתחיל סנכרון רענן...');

                                                            // 4. Fresh Sync
                                                            const res = await syncService.initialLoad(currentUser.business_id);

                                                            // 5. Final UI Refresh
                                                            await loadData();

                                                            if (res?.success) {
                                                                const changes = Object.entries(res.results).filter(([_, r]) => r.count > 0).map(([t, r]) => `${t}: ${r.count}`).join(', ');
                                                                setSyncResult(`🔄 אתחול הושלם בהצלחה! הכל נקי ומסונכרן. (${res.duration}s)`);
                                                            } else {
                                                                setSyncResult('⚠️ אתחול חלקי - אנא בדוק חיבור');
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
