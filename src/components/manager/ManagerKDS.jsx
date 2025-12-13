import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, getSupabase } from '../../lib/supabase';
import { Clock, CheckCircle, RotateCcw, AlertTriangle, LayoutGrid, Check, Plus, Edit, Flame } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// --- Shared Helpers ---
const isDrink = (item) => {
    const cat = (item.category || '').toLowerCase();
    return cat.includes('שתיה') || cat.includes('drink') || cat.includes('coffee') || cat.includes('קפה');
};

const isHotDrink = (item) => {
    // robust check using DB column if available
    if (item.is_hot_drink === true || item.is_hot_drink === false) return item.is_hot_drink;

    // Fallback to string matching
    const cat = (item.category || '').toLowerCase();
    return isDrink(item) && (cat.includes('חמה') || cat.includes('hot'));
};

const sortItems = (items) => {
    return [...items].sort((a, b) => {
        const aHot = isHotDrink(a);
        const bHot = isHotDrink(b);
        // ... rest of sort logic is same
        const aDrink = isDrink(a);
        const bDrink = isDrink(b);

        if (aHot && !bHot) return -1;
        if (!aHot && bHot) return 1;
        if (aDrink && !bDrink) return -1;
        if (!aDrink && bDrink) return 1;
        return 0;
    });
};



const groupItems = (items) => {
    const grouped = [];
    const map = new Map();

    items.forEach(item => {
        const modsKey = JSON.stringify(item.modifiers || []);
        const key = `${item.name}|${modsKey}|${item.status}`;

        if (map.has(key)) {
            const existing = map.get(key);
            existing.quantity += item.quantity;
        } else {
            const newItem = { ...item };
            map.set(key, newItem);
            grouped.push(newItem);
        }
    });

    return grouped;
};

const getModColor = (text) => {
    if (!text) return 'mod-color-gray';
    const t = String(text).toLowerCase().trim();

    if (t.includes('בלי קצף') || t.includes('ללא קצף')) return 'bg-gray-100 text-gray-500 line-through decoration-gray-400';
    if (t.includes('פחות קצף') || t.includes('מעט קצף')) return 'bg-blue-50 text-blue-600 border-blue-100';
    if (t.includes('הרבה קצף') || t.includes('אקסטרה קצף')) return 'bg-blue-50 text-blue-800 border-blue-200 font-bold';

    if (t.includes('בלי') || t.includes('ללא') || t.includes('הורד'))
        return 'bg-red-50 text-red-600 border-red-100 line-through decoration-red-600/50';

    if (t.includes('תוספת') || t.includes('אקסטרה') || t.includes('בצד') || t.includes('קצף'))
        return 'bg-green-50 text-green-700 border-green-100';

    if (t.includes('סויה') || t.includes('שיבולת שועל') || t.includes('שיבולת'))
        return 'bg-amber-50 text-amber-800 border-amber-100';
    if (t.includes('שקדים'))
        return 'bg-amber-50 text-amber-900 border-amber-200';
    if (t.includes('נטול') || t.includes('דקף') || t.includes('ללא לקטוז'))
        return 'bg-blue-50 text-blue-700 border-blue-100';

    if (t.includes('רותח') || t.includes('חם מאוד')) return 'bg-red-50 text-red-700 font-bold border-red-100';
    if (t.includes('חזק') || t.includes('כפול')) return 'bg-gray-800 text-white font-bold';
    if (t.includes('חלש') || t.includes('קל')) return 'bg-gray-100 text-gray-500';

    return 'bg-gray-50 text-gray-600 border-gray-200';
};

// --- ManagerOrderCard Component ---
const ManagerOrderCard = ({ order, isReady = false, onOrderStatusUpdate, onPaymentCollected, onEditOrder }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    // Status Styles
    const isDelayedCard = order.type === 'delayed';
    const isUnpaidDelivered = order.type === 'unpaid_delivered';

    const getStatusStyles = (status) => {
        if (isDelayedCard) return 'bg-gray-50 border border-gray-200 opacity-95';
        if (isUnpaidDelivered) return 'border-2 border-blue-500 shadow-md bg-blue-50/30';
        return 'bg-white border border-gray-200 shadow-sm hover:border-gray-300';
    };

    const orderStatusLower = (order.orderStatus || '').toLowerCase();
    const nextStatusLabel =
        orderStatusLower === 'new' || orderStatusLower === 'pending'
            ? 'התחל הכנה'
            : (orderStatusLower === 'in_progress'
                ? 'מוכן להגשה'
                : (isReady ? 'נמסר' : 'מוכן להגשה'));

    const actionBtnColor = isReady
        ? 'bg-slate-900 text-white hover:bg-slate-800'
        : (orderStatusLower === 'new' || orderStatusLower === 'pending'
            ? 'bg-slate-800 text-white hover:bg-slate-700'
            : 'bg-green-600 text-white hover:bg-green-700');

    // Split Logic: Right = Drinks, Left = Food
    const items = order.items || [];
    const drinkItems = sortItems(items.filter(item => isDrink(item)));
    const foodItems = sortItems(items.filter(item => !isDrink(item)));

    const hasDrinks = drinkItems.length > 0;
    const hasFood = foodItems.length > 0;

    const renderItemRow = (item, idx) => (
        <div key={idx} className="flex items-start gap-2 py-0.5 border-b border-dashed border-gray-100 last:border-0 w-full">
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg font-black text-sm shrink-0 mt-0 ${item.quantity > 1 ? 'bg-orange-600 text-white ring-2 ring-orange-200' : (isDelayedCard ? 'bg-gray-300 text-gray-600' : 'bg-slate-900 text-white')}`}>
                {item.quantity}
            </span>
            <div className="flex-1 min-w-0 pr-1">
                <div className="text-right leading-snug break-words">
                    <span className={`font-bold ml-2 text-sm ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'}`}>
                        {item.name}
                    </span>
                    {item.modifiers && item.modifiers.length > 0 && (
                        <span className="inline-flex flex-wrap gap-1 mr-1">
                            {item.modifiers.map((mod, i) => {
                                const modText = typeof mod === 'object' ? mod.text : String(mod);
                                const isNote = typeof mod === 'object' && mod.isNote;
                                return (
                                    <span key={i} className={`text-[11px] px-1.5 rounded border leading-tight ${isNote ? 'bg-purple-50 text-purple-700 border-purple-100 italic' : getModColor(modText)}`}>
                                        {modText}
                                    </span>
                                );
                            })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );

    const handleStatusClick = async (e) => {
        e.stopPropagation(); // Stop propagation just in case
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await onOrderStatusUpdate(order.id, order.orderStatus);
        } catch (error) {
            console.error('Status update failed', error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className={`flex-shrink-0 rounded-2xl p-3 flex flex-col h-full font-heebo ${isDelayedCard ? 'bg-gray-50' : 'bg-white'} ${getStatusStyles(order.orderStatus)} border-x border-b border-gray-100`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-1.5">
                <div className="flex flex-col overflow-hidden w-full">
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 min-w-0 text-xl font-black text-slate-900 leading-none tracking-tight truncate">
                            {order.customerName}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-gray-400">#{order.orderNumber}</span>
                        {isDelayedCard && (
                            <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-gray-300">
                                בהמתנה
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1">
                    <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                        <Clock size={12} />
                        <span className="text-xs font-mono font-bold">{order.timestamp}</span>
                    </div>
                    {!order.isPaid ? (
                        <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded">לא שולם</span>
                    ) : (
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">שולם</span>
                    )}
                </div>
            </div>

            {/* Content - Strict 2 Columns: Right=Drinks, Left=Food */}
            <div className="flex-1 overflow-y-auto mb-2 pr-1">
                <div className="grid grid-cols-2 gap-3 items-start w-full relative">
                    {/* Right Column: Drinks */}
                    <div className="flex flex-col w-full min-h-[20px]">
                        {drinkItems.length > 0 ? (
                            drinkItems.map((item, idx) => renderItemRow(item, idx))
                        ) : (
                            <div className="text-xs text-gray-300 text-center italic py-2">-- אין שתיה --</div>
                        )}
                    </div>

                    {/* Left Column: Food */}
                    <div className="flex flex-col w-full min-h-[20px] border-r border-gray-100 pr-2">
                        {foodItems.length > 0 ? (
                            foodItems.map((item, idx) => renderItemRow(item, idx))
                        ) : (
                            <div className="text-xs text-gray-300 text-center italic py-2">-- אין אוכל --</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-auto pt-2">
                {isUnpaidDelivered ? (
                    <button
                        disabled={isUpdating}
                        onClick={async () => {
                            if (onPaymentCollected) { setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false); }
                        }}
                        className={`w-full py-2.5 bg-white border-2 border-amber-500 text-amber-700 rounded-xl font-black text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 hover:bg-amber-50 ${isUpdating ? 'opacity-50' : ''}`}
                    >
                        <span>{isUpdating ? '...' : `לתשלום (₪${order.totalAmount?.toFixed(0)})`}</span>
                    </button>
                ) : (
                    <div className="flex items-stretch gap-2 h-12 w-full">
                        {!order.isPaid && (
                            <button
                                onClick={async () => { if (onPaymentCollected) { setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false); } }}
                                className="w-12 bg-white border-2 border-amber-400 rounded-xl shadow-sm flex flex-col items-center justify-center hover:bg-amber-50 shrink-0 relative overflow-hidden"
                            >
                                <span className="text-amber-600 font-bold text-xs absolute top-1">₪</span>
                                <span className="text-[10px] font-bold text-red-600 absolute bottom-1">
                                    {order.totalAmount?.toFixed(0)}
                                </span>
                            </button>
                        )}

                        {isReady && (
                            <button
                                disabled={isUpdating}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    setIsUpdating(true);
                                    await onOrderStatusUpdate(order.id, 'undo_ready');
                                    setIsUpdating(false);
                                }}
                                className="w-12 bg-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-300 shrink-0 border border-gray-300"
                            >
                                <RotateCcw size={20} />
                            </button>
                        )}

                        <button
                            disabled={isUpdating}
                            onClick={handleStatusClick}
                            className={`flex-1 rounded-xl font-black text-lg shadow active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50' : ''}`}
                        >
                            {isUpdating ? '...' : nextStatusLabel}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main ManagerKDS Component ---
const ManagerKDS = () => {
    const { currentUser } = useAuth();
    const [orders, setOrders] = useState([]);
    const [statusTab, setStatusTab] = useState('prep');
    const [loading, setLoading] = useState(false);

    // Reuse RPC update logic from original KDS for consistency
    const handleStatusUpdate = async (orderId, currentStatus) => {
        let nextStatus = 'in_progress';

        // Logic for next status
        if (currentStatus === 'undo_ready') {
            nextStatus = 'in_progress';
        } else if (currentStatus === 'in_progress' || currentStatus === 'new' || currentStatus === 'pending') {
            nextStatus = 'ready';
        } else if (currentStatus === 'ready') {
            nextStatus = 'completed';
        }

        // Direct RPC call as requested
        const { error } = await supabase.rpc('update_order_status', {
            p_order_id: orderId,
            p_status: nextStatus
        });

        if (error) {
            console.error("Error updating status via RPC:", error);
            alert("שגיאה בעדכון סטטוס: " + error.message);
        } else {
            fetchKDS(); // Refresh immediately
        }
    };

    const fetchKDS = async () => {
        setLoading(true);
        try {
            // Calculate 24 hours ago to show relevant active orders, even if they crossed midnight
            const yesterday = new Date();
            yesterday.setHours(yesterday.getHours() - 24);

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (
                            id, name, price, category
                        )
                    )
                `)
                .gte('created_at', yesterday.toISOString())
                .neq('order_status', 'cancelled')
                .order('created_at', { ascending: true });

            if (error) throw error;

            const processed = (data || []).map(order => {
                // filter out cancelled items or items without menu data
                const rawItems = (order.order_items || []).filter(item =>
                    item.item_status !== 'cancelled' && item.menu_items
                );

                if (rawItems.length === 0) return null;

                // 2. Determine Group Status
                const allReady = rawItems.every(i => i.item_status === 'ready' || i.item_status === 'completed');
                const isCompleted = order.order_status === 'completed';

                let groupStatus = 'prep';
                if (allReady && !isCompleted) groupStatus = 'ready';

                // Special Case: Unpaid Completed Orders (should appear in "Ready/Delivered" tab to collect payment)
                if (isCompleted && !order.is_paid) {
                    groupStatus = 'ready'; // Show in "Ready" tab so we can see it needs payment
                } else if (isCompleted && order.is_paid) {
                    return null; // Fully done, hide from KDS
                }

                // Format items
                const formattedItems = groupItems(rawItems.map(formatItem));

                // 3. Construct Order Object
                return formatOrder(
                    order,
                    formattedItems,
                    groupStatus,
                    order.is_paid,
                    (isCompleted && !order.is_paid) ? 'unpaid_delivered' : 'normal'
                );
            }).filter(Boolean);

            setOrders(processed);

        } catch (err) {
            console.error('Manager KDS Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatItem = (item) => {
        let modsArray = [];
        if (item.mods) {
            try {
                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                if (Array.isArray(parsed)) modsArray = parsed.map(m => typeof m === 'object' ? m.value_name : m);
            } catch (e) { }
        }
        if (item.notes) modsArray.push({ text: item.notes, isNote: true });

        return {
            category: item.menu_items?.category,
            name: item.menu_items?.name,
            quantity: item.quantity,
            modifiers: modsArray.map(m => typeof m === 'object' ? m : { text: String(m) }),
            status: item.item_status,
            is_hot_drink: item.menu_items?.is_hot_drink
        };
    };

    const formatOrder = (order, items, statusGroup, isPaid, type = 'normal') => {
        const totalAmount = (order.order_items || []).reduce((sum, i) => sum + (i.menu_items?.price || 0) * (i.quantity || 1), 0);
        return {
            id: order.id,
            orderNumber: order.order_number || order.id.slice(0, 4),
            customerName: order.customer_name || 'אורח',
            timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            items: items,
            statusGroup: statusGroup,
            orderStatus: order.order_status,
            isPaid: isPaid,
            type: type,
            totalAmount
        };
    };

    const handlePayment = async (order) => {
        const { error } = await supabase.from('orders').update({ is_paid: true }).eq('id', order.id);
        if (error) console.error("Error paying:", error);
        else fetchKDS();
    };

    useEffect(() => {
        fetchKDS();
        const interval = setInterval(fetchKDS, 5000);
        return () => clearInterval(interval);
    }, []);

    const displayedOrders = orders.filter(o => {
        if (statusTab === 'prep') return o.statusGroup === 'prep';
        if (statusTab === 'ready') return o.statusGroup === 'ready' || (o.orderStatus === 'completed' && !o.isPaid);
        return false;
    });

    return (
        <div className="h-full flex flex-col bg-gray-100">
            {/* Tab Switcher */}
            <div className="p-3 bg-white shadow-sm z-10 sticky top-0">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setStatusTab('prep')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${statusTab === 'prep' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <LayoutGrid size={16} />
                        בהכנה ({orders.filter(o => o.statusGroup === 'prep').length})
                    </button>
                    <button
                        onClick={() => setStatusTab('ready')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${statusTab === 'ready' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <CheckCircle size={16} />
                        מוכנים ({orders.filter(o => o.statusGroup === 'ready' || (o.orderStatus === 'completed' && !o.isPaid)).length})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loading && orders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">טוען...</div>
                ) : displayedOrders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
                        <Check size={40} className="opacity-20" />
                        <span>אין הזמנות בסטטוס זה</span>
                    </div>
                ) : (
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-20 items-stretch">
                        <AnimatePresence mode="popLayout">
                            {displayedOrders.map(order => (
                                <motion.div
                                    layout
                                    key={order.id}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                >
                                    <ManagerOrderCard
                                        order={order}
                                        isReady={statusTab === 'ready'}
                                        onOrderStatusUpdate={handleStatusUpdate}
                                        onPaymentCollected={handlePayment}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>

            {/* Refresh Button */}
            <button
                onClick={fetchKDS}
                className="fixed bottom-6 left-6 p-4 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-90 transition-all z-20"
            >
                <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
    );
};

export default ManagerKDS;
