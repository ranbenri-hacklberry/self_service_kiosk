import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Truck, Plus, X, ArrowRight, Package, Save, Check, RefreshCw, ChevronLeft, Trash2, Edit2, AlertTriangle, ChevronDown, ChevronUp, Clock, House } from 'lucide-react';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import ConnectionStatusBar from '../../../components/ConnectionStatusBar';
import MiniMusicPlayer from '../../../components/music/MiniMusicPlayer';

/**
 * KDS Inventory Screen - Redesigned Layout
 * 3-Column Layout:
 * - Right (1/3): Suppliers List
 * - Left (2/3): Items Grid (2 columns)
 */

const KDSInventoryScreen = ({ onExit }) => {
    const { currentUser } = useAuth();
    // Tabs: 'counts' | 'incoming'
    const [activeTab, setActiveTab] = useState('counts');

    const [selectedSupplierId, setSelectedSupplierId] = useState(null);
    const [items, setItems] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Incoming Orders State
    const [incomingOrders, setIncomingOrders] = useState([]);

    // Stock Updates State: { [itemId]: newQuantity }
    const [stockUpdates, setStockUpdates] = useState({});
    const [saving, setSaving] = useState(false);

    // Incoming Order Logic State
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [receiptDrafts, setReceiptDrafts] = useState({}); // { [orderId]: { [itemId]: { qty: number, status: 'received'|'missing'|'backorder' } } }
    const [expandedItems, setExpandedItems] = useState({}); // { [itemId]: boolean }

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'info',
        confirmText: 'אישור',
        cancelText: 'ביטול'
    });

    // Helper to init draft when selecting an order
    useEffect(() => {
        if (selectedOrderId) {
            const order = incomingOrders.find(o => o.id === selectedOrderId);
            if (order && !receiptDrafts[order.id]) {
                const draft = {};
                order.items.forEach(item => {
                    // Default: Received = Ordered Qty
                    draft[item.inventory_item_id || item.name] = {
                        qty: item.qty,
                        status: 'received',
                        originalQty: item.qty,
                        name: item.name,
                        unit: item.unit,
                        itemId: item.inventory_item_id
                    };
                });
                setReceiptDrafts(prev => ({ ...prev, [order.id]: draft }));
            }
        }
    }, [selectedOrderId, incomingOrders]);

    const handleReceiptChange = (orderId, itemId, field, value) => {
        setReceiptDrafts(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                [itemId]: { ...prev[orderId][itemId], [field]: value }
            }
        }));
    };

    const promptProcessReceipt = (orderId, actionType) => {
        const isSplit = actionType === 'split';
        setConfirmModal({
            isOpen: true,
            title: isSplit ? 'אישור קבלה חלקית' : 'אישור קבלת סחורה',
            message: isSplit
                ? 'האם אתה בטוח שברצונך לאשר את הפריטים שהתקבלו וליצור הזמנה חדשה (Backorder) עבור הפריטים החסרים?'
                : 'האם אתה בטוח שברצונך לאשר את קבלת הסחורה ולסגור את ההזמנה?',
            variant: isSplit ? 'warning' : 'success',
            confirmText: isSplit ? 'אשר וצור הזמנה' : 'אשר קבלה',
            onConfirm: () => executeProcessReceipt(orderId, actionType)
        });
    };

    const executeProcessReceipt = async (orderId, actionType = 'complete') => {
        // actionType: 'complete' (finish all), 'split' (create backorder for missing)
        const draft = receiptDrafts[orderId];
        if (!draft) return;

        setSaving(true);
        try {
            // 1. Update Inventory for Received Items
            const updates = [];
            const timestamp = new Date();

            Object.values(draft).forEach(itemData => {
                if (itemData.status === 'received' && itemData.qty > 0 && itemData.itemId) {
                    updates.push(supabase.rpc('increment_stock', { p_item_id: itemData.itemId, p_delta: itemData.qty }));
                }
            });

            await Promise.all(updates);

            // 2. Handle Order Logic
            if (actionType === 'split') {
                // Determine missing items
                const missingItems = [];
                Object.values(draft).forEach(item => {
                    const remaining = item.originalQty - (item.status === 'received' ? item.qty : 0);
                    if (remaining > 0) {
                        missingItems.push({
                            inventory_item_id: item.itemId,
                            quantity: remaining
                        });
                    }
                });

                if (missingItems.length > 0) {
                    // Create Backorder
                    // We need supplier_id. Try to find it from the items cache
                    const sampleItemId = missingItems[0]?.inventory_item_id;
                    const foundItem = items.find(i => i.id === sampleItemId);
                    const supplierId = foundItem?.supplier_id || null;

                    const { data: newOrder, error: boError } = await supabase
                        .rpc('create_supplier_order', {
                            p_business_id: currentUser.business_id,
                            p_supplier_id: supplierId,
                            p_items: missingItems.map(m => ({ itemId: m.inventory_item_id, qty: m.quantity }))
                        });

                    if (boError) console.error('Backorder creation failed', boError);
                }
            }

            // 3. Close Original Order
            const { error: closeError } = await supabase.rpc('close_supplier_order', { p_order_id: orderId });

            if (closeError) throw closeError;

            // 4. Cleanup
            setReceiptDrafts(prev => { const n = { ...prev }; delete n[orderId]; return n; });
            fetchIncomingOrders(); // Refresh list
            setSelectedOrderId(null);

        } catch (err) {
            console.error('Receipt processing failed:', err);
            alert('שגיאה בעיבוד הקבלה');
        } finally {
            setSaving(false);
        }
    };

    const promptDeleteOrder = (orderId) => {
        setConfirmModal({
            isOpen: true,
            title: 'מחיקת הזמנה',
            message: 'האם אתה בטוח שברצונך למחוק את ההזמנה לצמיתות? פעולה זו אינה הפיכה.',
            variant: 'danger',
            confirmText: 'מחק הזמנה',
            onConfirm: () => executeDeleteOrder(orderId)
        });
    };

    const executeDeleteOrder = async (orderId) => {
        try {
            const { error } = await supabase.rpc('delete_supplier_order', { p_order_id: orderId });
            if (error) throw error;

            setIncomingOrders(prev => prev.filter(o => o.id !== orderId));
            if (selectedOrderId === orderId) setSelectedOrderId(null);
        } catch (e) {
            console.error(e);
            alert("שגיאה במחיקת ההזמנה");
        }
    };

    const fetchData = useCallback(async () => {
        if (!currentUser?.business_id) return;
        setLoading(true);
        try {
            const { data: suppliersData, error: supError } = await supabase
                .from('suppliers')
                .select('*')
                .order('name');

            if (supError) throw supError;
            setSuppliers(suppliersData || []);

            const { data: itemsData, error: itemError } = await supabase
                .from('inventory_items')
                .select(`*, supplier:suppliers(*)`)
                .eq('business_id', currentUser.business_id)
                .order('name')
                .range(0, 2000);

            if (itemError) throw itemError;
            setItems(itemsData || []);
        } catch (err) {
            console.error('Error fetching inventory:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.business_id]);

    const fetchIncomingOrders = useCallback(async () => {
        if (!currentUser?.business_id) return;
        try {
            const { data, error } = await supabase
                .rpc('get_my_supplier_orders', { p_business_id: currentUser.business_id });

            if (error) throw error;

            const formatted = (data || []).map(order => ({
                id: order.id,
                created_at: order.created_at,
                supplier_name: order.supplier_name || 'ספק כללי',
                items: order.items || []
            }));
            setIncomingOrders(formatted);
        } catch (e) {
            console.error('Error fetching incoming orders (KDS):', e);
        }
    }, [currentUser?.business_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (items.length > 0) {
            fetchIncomingOrders();
        }
    }, [items, fetchIncomingOrders]);

    const isDeliveryToday = (supplier) => {
        if (!supplier || !supplier.delivery_days) return false;
        const todayIndex = new Date().getDay();
        const days = String(supplier.delivery_days).split(',').map(d => parseInt(d.trim()));
        return days.includes(todayIndex);
    };

    const supplierGroups = useMemo(() => {
        const groups = {};
        suppliers.forEach(s => {
            groups[s.id] = {
                id: s.id,
                name: s.name,
                supplier: s,
                count: 0,
                isToday: isDeliveryToday(s)
            };
        });
        groups['uncategorized'] = { id: 'uncategorized', name: 'כללי / ללא ספק', supplier: { id: 'uncategorized', name: 'כללי / ללא ספק' }, count: 0, isToday: false };

        items.forEach(item => {
            const supId = item.supplier_id || 'uncategorized';
            if (groups[supId]) groups[supId].count++;
            else if (groups['uncategorized']) groups['uncategorized'].count++;
        });

        return Object.values(groups)
            .filter(g => g.count > 0)
            .sort((a, b) => {
                if (a.isToday && !b.isToday) return -1;
                if (!a.isToday && b.isToday) return 1;
                return a.name.localeCompare(b.name);
            });
    }, [items, suppliers]);

    const filteredItems = useMemo(() => {
        if (!selectedSupplierId) return [];
        return items.filter(i => (i.supplier_id || 'uncategorized') === selectedSupplierId)
            .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
    }, [items, selectedSupplierId, search]);


    // Handle Local Stock Change
    const handleStockChange = (itemId, change) => {
        setStockUpdates(prev => {
            const currentVal = prev[itemId] !== undefined
                ? prev[itemId]
                : (items.find(i => i.id === itemId)?.current_stock || 0);

            const newVal = Math.max(0, currentVal + change);
            return { ...prev, [itemId]: newVal };
        });
    };

    // Save Stock Update
    const saveStockUpdate = async (itemId) => {
        const newValue = stockUpdates[itemId];
        if (newValue === undefined) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('inventory_items')
                .update({ current_stock: newValue, last_updated: new Date() })
                .eq('id', itemId);

            if (error) throw error;

            setItems(prev => prev.map(i => i.id === itemId ? { ...i, current_stock: newValue } : i));
            setStockUpdates(prev => { const next = { ...prev }; delete next[itemId]; return next; });

        } catch (err) {
            console.error('Error saving stock:', err);
            // alert('שגיאה בעדכון המלאי'); // Silent failure is better in KDS context, maybe show toast
        } finally {
            setSaving(false);
        }
    };



    // Render Suppliers List (Right Column)
    const renderSuppliersList = () => (
        <div className="flex flex-col gap-3 overflow-y-auto p-2 pb-20">
            {supplierGroups.map(group => {
                const isActive = selectedSupplierId === group.id;
                return (
                    <motion.div
                        key={group.id}
                        onClick={() => setSelectedSupplierId(group.id)}
                        whileTap={{ scale: 0.98 }}
                        className={`relative p-4 rounded-xl cursor-pointer border transition-all duration-200 overflow-hidden ${isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 border-blue-500 scale-[1.02]'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-100 shadow-sm'
                            }`}
                    >
                        <div className="flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                                <Truck size={20} className={isActive ? 'text-blue-200' : (group.isToday ? 'text-green-500' : 'text-gray-400')} />
                                <div>
                                    <h3 className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-700'}`}>{group.name}</h3>
                                    {group.isToday && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                                            אספקה היום!
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Count Badge */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm ${isActive ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                {group.count}
                            </div>
                        </div>

                        {/* Active Indicator Background Effect */}
                        {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />}
                    </motion.div>
                );
            })}
        </div>
    );

    // Render Items Grid (Left/Center Column)
    const renderItemsGrid = () => (
        <div className="h-full min-h-0 overflow-y-auto p-2 pb-20">
            {!selectedSupplierId ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <ArrowRight size={64} className="mb-6 animate-pulse" />
                    <h3 className="text-2xl font-bold">בחר ספק מהרשימה</h3>
                    <p>כדי לצפות ולעדכן פריטי מלאי</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 auto-rows-max">
                    {/* Search Bar inside Grid area if needed, or stick to top */}
                    {filteredItems.map(item => {
                        const currentStock = stockUpdates[item.id] !== undefined ? stockUpdates[item.id] : item.current_stock;
                        const isChanged = stockUpdates[item.id] !== undefined && stockUpdates[item.id] !== item.current_stock;
                        const price = item.cost_per_unit > 0 ? `₪${item.cost_per_unit}` : null;

                        return (
                            <div key={item.id} className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-300 transition-colors group">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex flex-col">
                                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span>{item.unit}</span>
                                            {price && <span className="text-green-600 bg-green-50 px-1.5 rounded font-bold">{price}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                        <button
                                            onClick={() => handleStockChange(item.id, -1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition active:scale-95"
                                        >
                                            <span className="text-xl font-bold leading-none mb-1">-</span>
                                        </button>

                                        <div className="w-12 text-center">
                                            <span className={`font-mono text-xl font-black ${isChanged ? 'text-blue-600' : 'text-slate-700'}`}>
                                                {currentStock}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleStockChange(item.id, 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-500 hover:text-green-600 hover:bg-green-50 transition active:scale-95"
                                        >
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    </div>

                                    <div className="w-10 flex justify-center">
                                        {isChanged && (
                                            <motion.button
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                onClick={() => saveStockUpdate(item.id)}
                                                disabled={saving}
                                                className="w-10 h-10 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-200 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all"
                                            >
                                                <Save size={18} />
                                            </motion.button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div className="col-span-2 text-center py-20 text-gray-400">
                            <p>לא נמצאו פריטים</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 font-heebo" dir="rtl">
            {/* Header & Tabs - Single Line Layout */}
            <div className="bg-white shadow-sm z-20 shrink-0 px-6 py-3 flex items-center justify-between border-b border-gray-200 gap-6">

                {/* Right Side: Home | Search */}
                <div className="flex items-center gap-3">
                    {/* Home button - rightmost in RTL */}
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="p-2 -mr-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="יציאה למסך הראשי"
                        >
                            <House size={22} />
                        </button>
                    )}

                    {/* Search Bar - Compact */}
                    <div className="relative w-64">
                        <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="חיפוש..."
                            className="w-full pl-4 pr-10 py-2 rounded-xl bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Center: Connection Status */}
                <div className="flex items-center gap-3 bg-slate-50 p-1 px-2 rounded-2xl border border-slate-200">
                    <MiniMusicPlayer />
                    <ConnectionStatusBar isIntegrated={true} />
                </div>

                {/* Left Side: Tabs / Actions */}
                <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                    <button onClick={() => setActiveTab('counts')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'counts' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Package size={18} /> ספירה ודיווח
                    </button>
                    <button onClick={() => setActiveTab('incoming')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'incoming' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Truck size={18} /> משלוחים בדרך
                        {incomingOrders.length > 0 && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">{incomingOrders.length}</span>}
                    </button>
                    <button onClick={fetchData} className="px-3 text-gray-400 hover:text-blue-500 transition ml-1" title="רענן נתונים">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'counts' && (
                        <motion.div
                            key="counts"
                            className="h-full flex"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Right Column: Suppliers (1/3) */}
                            <div className="w-1/3 border-l border-gray-200 bg-white h-full min-h-0 flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                                <div className="p-4 bg-gray-50/50 border-b border-gray-100 shrink-0">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">ספקים ({supplierGroups.length})</h3>
                                </div>
                                <div className="flex-1 min-h-0">
                                    {renderSuppliersList()}
                                </div>
                            </div>

                            {/* Left/Center Column: Items (2/3) */}
                            <div className="w-2/3 h-full min-h-0 bg-slate-50/50 p-4">
                                {renderItemsGrid()}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'incoming' && (
                        <motion.div
                            key="incoming"
                            className="h-full flex"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Right Column: Orders List */}
                            <div className="w-1/3 border-l border-gray-200 bg-white h-full flex flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                                <div className="p-4 bg-green-50/50 border-b border-green-100">
                                    <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider flex items-center gap-2">
                                        <Truck size={14} /> משלוחים בדרך ({incomingOrders.length})
                                    </h3>
                                </div>
                                <div className="h-full overflow-y-auto p-2 space-y-2">
                                    {incomingOrders.length === 0 ? (
                                        <div className="text-center py-10 opacity-50"><p>אין משלוחים</p></div>
                                    ) : incomingOrders.map(order => (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrderId(order.id)}
                                            className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedOrderId === order.id ? 'bg-green-600 text-white shadow-lg shadow-green-200 border-green-500' : 'bg-white hover:bg-gray-50 border-gray-100'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-lg">{order.supplier_name}</h4>
                                                    <div className={`text-xs mt-1 flex items-center gap-1 ${selectedOrderId === order.id ? 'text-green-100' : 'text-gray-400'}`}>
                                                        <Clock size={10} />
                                                        {new Date(order.created_at).toLocaleDateString('he-IL')}
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${selectedOrderId === order.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                                    #{order.id.toString().slice(-4)}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded-md font-bold ${selectedOrderId === order.id ? 'bg-green-700 text-white' : 'bg-green-50 text-green-700'}`}>
                                                    {order.items.length} פריטים
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Center Column: Order Details */}
                            <div className="w-2/3 h-full bg-slate-50/50 p-4 overflow-hidden flex flex-col">
                                {!selectedOrderId ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                        <Truck size={64} className="mb-6 animate-pulse" />
                                        <h3 className="text-2xl font-bold">בחר משלוח לטיפול</h3>
                                    </div>
                                ) : (
                                    (() => {
                                        const order = incomingOrders.find(o => o.id === selectedOrderId);
                                        const draft = receiptDrafts[selectedOrderId] || {};
                                        const hasChanges = Object.values(draft).some(i => i.qty !== i.originalQty || i.status !== 'received');
                                        const hasMissing = Object.values(draft).some(i => i.qty < i.originalQty);

                                        return (
                                            <>
                                                {/* Header Actions */}
                                                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                    <div>
                                                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                            {order.supplier_name}
                                                            <span className="text-sm font-normal text-gray-400">#{order.id}</span>
                                                        </h2>
                                                        <p className="text-sm text-gray-500">נא לאשר או לעדכן כמויות שהתקבלו בפועל</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => promptDeleteOrder(order.id)}
                                                            className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                            title="מחק הזמנה"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                        {hasMissing ? (
                                                            <div className="flex gap-2">
                                                                <button onClick={() => promptProcessReceipt(order.id, 'complete')} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 text-sm">
                                                                    סגור (מחק יתרה)
                                                                </button>
                                                                <button onClick={() => promptProcessReceipt(order.id, 'split')} className="px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 text-sm flex items-center gap-2">
                                                                    <RefreshCw size={16} /> אשר וצור השלמה
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => promptProcessReceipt(order.id, 'complete')} className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2">
                                                                <Check size={20} /> אשר קבלה מלאה
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Items Grid */}
                                                <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-20">
                                                    {order.items.map((item) => {
                                                        const itemId = item.inventory_item_id || item.name;
                                                        const itemDraft = draft[itemId] || { qty: item.qty, status: 'received' };
                                                        const isExpanded = expandedItems[itemId];
                                                        const isMissing = itemDraft.qty < item.qty;

                                                        return (
                                                            <div key={itemId} className={`bg-white border rounded-xl overflow-hidden transition-all ${isMissing ? 'border-amber-200 shadow-amber-50' : 'border-gray-100 hover:border-blue-200'}`}>
                                                                {/* Summary View */}
                                                                <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))} >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-lg ${isMissing ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                            <Package size={20} />
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                                                                            <div className="flex items-center gap-2 text-xs">
                                                                                <span className="text-gray-500">הוזמן: {item.qty} {item.unit}</span>
                                                                                {isMissing && <span className="text-amber-600 font-bold bg-amber-50 px-1 rounded">חסר: {item.qty - itemDraft.qty}</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="font-mono font-black text-lg text-slate-700">
                                                                            {itemDraft.qty} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                                                                        </div>
                                                                        <span className="text-[10px] text-blue-500 flex items-center justify-end gap-1">ערוך <ChevronDown size={10} className={`transform transition ${isExpanded ? 'rotate-180' : ''}`} /></span>
                                                                    </div>
                                                                </div>

                                                                {/* Expanded Edit View */}
                                                                <AnimatePresence>
                                                                    {isExpanded && (
                                                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-50 border-t border-gray-100">
                                                                            <div className="p-4 space-y-4">
                                                                                <div className="flex items-center justify-between">
                                                                                    <label className="text-xs font-bold text-gray-500">כמות שהתקבלה:</label>
                                                                                    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
                                                                                        <button onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', Math.max(0, itemDraft.qty - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-slate-600 font-bold">-</button>
                                                                                        <span className="w-12 text-center font-mono font-bold text-lg">{itemDraft.qty}</span>
                                                                                        <button onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', itemDraft.qty + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-slate-600 font-bold">+</button>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex gap-2">
                                                                                    <button
                                                                                        onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', 0)}
                                                                                        className="flex-1 py-2 bg-white border border-red-100 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50"
                                                                                    >
                                                                                        לא הגיע כלל
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleReceiptChange(selectedOrderId, itemId, 'qty', item.qty)}
                                                                                        className="flex-1 py-2 bg-white border border-green-100 text-green-600 text-xs font-bold rounded-lg hover:bg-green-50"
                                                                                    >
                                                                                        הגיע מלא ({item.qty})
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        );
                                    })()
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
            />
        </div>
    );
};

export default KDSInventoryScreen;
