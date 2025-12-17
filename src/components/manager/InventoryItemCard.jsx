import React, { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, ChevronUp, History, CheckCircle2, Minus, Plus, ShoppingCart, Edit2, Save, X } from 'lucide-react';

const InventoryItemCard = ({ item, onStockChange, onOrderChange, onItemUpdate, draftOrderQty = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    console.log('🎯 InventoryItemCard render:', { itemId: item.id, isExpanded });
    // Reduce height by 20% -> Use tighter vertical padding in main container
    const [currentStock, setCurrentStock] = useState(Number(item.current_stock) || 0);
    const [orderQty, setOrderQty] = useState(draftOrderQty);
    const [updating, setUpdating] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: item.name || '',
        unit: item.unit || "יח׳",
        cost_per_unit: item.cost_per_unit || 0,
        count_step: item.count_step || 1,
        unit_weight_grams: item.unit_weight_grams || 0,
        min_order: item.min_order || 1,
        order_step: item.order_step || 1
    });

    const timeoutRef = useRef(null);

    // Cleanup timeout on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // --- LOGIC FOR UNITS & STEPS ---
    const unitLower = (item.unit || '').trim().toLowerCase();

    // 1. Check if strict Unit item (Integer only)
    const isUnitItem = ['unit', "יח׳", 'יחידה', 'item', 'piece'].some(u => unitLower === u || unitLower.startsWith(u)); // Flexible match

    // 2. Count Step
    // Unit items -> Integer only (Step 1)
    // Non-Unit (Kg, Liter, etc.) -> Allow fractions (Step 0.25)
    const countStep = isUnitItem ? 1 : 0.25;

    // 3. Order Step
    const caseQty = item.case_quantity && item.case_quantity > 0 ? item.case_quantity : 0;

    // Order Step Logic:
    // If Case Quantity defined -> Step is Case Quantity.
    // Otherwise -> Step is ALWAYS 1 (Integers only for orders, per user request).
    const orderStep = caseQty > 0 ? caseQty : 1;

    // Status Logic
    // Status Logic
    // const lastCountDate = item.last_counted_at ? new Date(item.last_counted_at) : null; 
    // ^-- Removed to use state instead

    const [lastCountDate, setLastCountDate] = useState(item.last_counted_at ? new Date(item.last_counted_at) : null);

    const isCountedToday = lastCountDate && (
        lastCountDate.getDate() === new Date().getDate() &&
        lastCountDate.getMonth() === new Date().getMonth() &&
        lastCountDate.getFullYear() === new Date().getFullYear()
    );

    const handleStockUpdate = (newValue) => {
        let val = Math.max(0, newValue);

        // Count Logic:
        // If Unit Item -> Force Integer.
        // If Bulk/Other -> Allow Decimals (don't round to integer).
        if (isUnitItem) val = Math.round(val);

        // Round to safe decimals for JS float math
        val = Math.round(val * 100) / 100;

        setCurrentStock(val);
        setUpdating(true);
        setLastCountDate(new Date()); // Optimistic update of "Last Counted"

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(async () => {
            try {
                if (onStockChange) await onStockChange(item.id, val);
            } finally {
                setUpdating(false);
            }
        }, 800);
    };

    const handleOrderUpdate = (newValue) => {
        let val = newValue;
        if (val < 0) val = 0;

        // Min Order Rule: If > 0, must be at least 1 (or case min)
        const minOrder = caseQty > 0 ? caseQty : 1;

        if (val > 0 && val < minOrder) {
            val = minOrder;
        }

        // Case Multiple Rule
        if (caseQty > 0 && val > 0) {
            // Snap to nearest multiple
            const remainder = val % caseQty;
            if (remainder !== 0) {
                // Simple snap: round to nearest multiple
                val = Math.round(val / caseQty) * caseQty;
                if (val === 0 && newValue > 0) val = caseQty;
            }
        }
        else {
            // General Rule: Orders are always Integers (multiples of 1)
            val = Math.round(val);
        }

        val = Math.round(val * 100) / 100;

        setOrderQty(val);
        if (onOrderChange) onOrderChange(item.id, val);
    };

    // Increment/Decrement handlers for ORDER
    const incrementOrder = () => {
        let next = orderQty + orderStep;

        // Initial Jump: 0 -> Min (1 or Case)
        const minOrder = caseQty > 0 ? caseQty : 1;
        if (orderQty === 0) next = minOrder;

        handleOrderUpdate(next);
    }

    const decrementOrder = () => {
        let next = orderQty - orderStep;

        // Drop Rule: If going below min, drop to 0
        const minOrder = caseQty > 0 ? caseQty : 1;
        if (next < minOrder) next = 0;

        handleOrderUpdate(next);
    }

    return (
        <div className={`bg-white rounded-2xl border transition-all duration-200 ${isExpanded ? 'border-blue-300 shadow-md ring-1 ring-blue-100' : 'border-gray-200 shadow-sm'} overflow-hidden`}>
            {/* Header - Always Visible */}
            {/* Header - Always Visible - Reduced Padding */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-3 flex items-center justify-between cursor-pointer select-none transition-colors ${isExpanded ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
            >
                {/* Right: Item Info - Compact padding */}
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-colors ${item.current_stock <= (item.low_stock_alert || 5) ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'} `}>
                        <Package size={20} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col min-w-0 justify-center">
                        <h3 className="font-black text-gray-800 text-lg truncate leading-tight">{item.name}</h3>
                        <span className="text-[11px] font-bold text-gray-400">{item.unit || "יח׳"}</span>
                    </div>
                </div>

                {/* Left: Alerts & Chevron */}
                <div className="flex items-center gap-3 pl-1">
                    {/* Current Stock Prominent Badge (Collapsed Only) */}
                    {!isExpanded && (
                        <div className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] transition-colors ${currentStock <= (item.low_stock_alert || 5)
                            ? 'bg-red-50 border-red-100 text-red-600'
                            : 'bg-gray-50 border-gray-100 text-gray-700'
                            }`}>
                            <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5 uppercase tracking-wide">מלאי</span>
                            <span className="font-black text-lg leading-none">{currentStock}</span>
                        </div>
                    )}

                    {/* Draft Indicator */}
                    {orderQty > 0 && !isExpanded && (
                        <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl border border-blue-100 min-w-[3.5rem]">
                            <ShoppingCart size={12} className="mb-0.5" />
                            <span className="font-black text-sm leading-none">+{orderQty}</span>
                        </div>
                    )}

                    <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-gray-100' : ''}`}>
                        <ChevronDown size={20} />
                    </div>
                </div>
            </div>

            {/* Expanded Content - Controls */}
            {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-white space-y-5 animate-in slide-in-from-top-4 duration-300">

                    {/* 1. Stock Update Section */}
                    <div>
                        <div className="flex flex-col mb-3">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
                                <History size={14} className="text-blue-500" />
                                {lastCountDate
                                    ? `ספירה אחרונה ב-${lastCountDate.toLocaleDateString('he-IL')}`
                                    : 'טרם בוצעה ספירה'
                                }
                            </span>
                            {lastCountDate && (
                                <span className="text-[10px] text-gray-400 mt-0.5 mr-6">
                                    ומתאריך {lastCountDate.toLocaleDateString('he-IL')} הערכה לפי נתונים
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleStockUpdate(currentStock - countStep)} className="h-12 flex-1 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-red-500 hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all">
                                <Minus size={20} strokeWidth={3} />
                            </button>
                            <div className="w-20 text-center">
                                <span className="block font-black text-2xl text-gray-800">{currentStock}</span>
                                <span className="text-[10px] text-gray-400 font-bold -mt-1 block">{item.unit}</span>
                            </div>
                            <button onClick={() => handleStockUpdate(currentStock + countStep)} className="h-12 flex-1 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-green-600 hover:bg-green-50 hover:border-green-200 active:scale-95 transition-all">
                                <Plus size={20} strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-50 w-full"></div>

                    {/* 2. Order Update Section */}
                    <div className={`p-4 rounded-2xl transition-colors ${orderQty > 0 ? 'bg-blue-50/50 border border-blue-100' : 'bg-gray-50/50 border border-transparent'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-blue-900 flex items-center gap-1.5">
                                    <ShoppingCart size={16} className="text-blue-500" />
                                    הוספה להזמנה
                                </span>
                                {item.case_quantity > 0 && <span className="text-[11px] font-bold text-blue-400 mt-0.5">מארז: {item.case_quantity} {item.unit}</span>}
                            </div>
                            {orderQty > 0 && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">בעגלה</span>}
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={decrementOrder} className="h-12 w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-200 shadow-sm active:scale-95 transition-all">
                                <Minus size={20} strokeWidth={3} />
                            </button>
                            <div className="flex-1 text-center">
                                <span className={`block font-black text-2xl ${orderQty > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{orderQty > 0 ? orderQty : '-'}</span>
                            </div>
                            <button onClick={incrementOrder} className="h-12 w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm active:scale-95 transition-all">
                                <Plus size={20} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Button - Only when expanded */}
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                        onClick={() => {
                            console.log('🎯 Edit button clicked for item:', item.id);
                            setIsEditing(true);
                        }}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg font-bold text-sm transition-all flex items-center gap-2 border border-blue-100 hover:border-blue-200"
                        title="עריכת פרטי פריט"
                    >
                        <Edit2 size={14} strokeWidth={2} />
                        עריכת פרטים
                    </button>
                </div>
            )}
        </div>
    );

    // Edit Modal (Same as Add Item Modal)
    if (isEditing) {
        return (
            <div>
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setIsEditing(false)} />

                {/* Bottom Modal */}
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-2xl p-0 min-h-[70vh] flex flex-col max-h-[90vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="p-6 pb-6 bg-white rounded-t-3xl border-b border-gray-50 shrink-0 relative">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                        <h3 className="text-2xl font-black text-slate-800 text-center">עריכת פריט מלאי</h3>
                        <p className="text-sm text-gray-400 text-center font-bold mt-1">{item.name}</p>
                    </div>

                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* 1. Basic Details */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-500 mb-1 block">שם הפריט</label>
                                <input
                                    type="text"
                                    value={editData.name}
                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-bold text-xl text-center"
                                    placeholder="שם הפריט..."
                                />
                            </div>

                            {/* Type Selector (Tabs) */}
                            <div className="bg-gray-100 p-1.5 rounded-2xl flex">
                                <button
                                    onClick={() => setEditData({ ...editData, unit: "יח׳", count_step: 1, min_order: 1, order_step: 1 })}
                                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${editData.unit === "יח׳" ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    פריט בודד (יח׳)
                                </button>
                                <button
                                    onClick={() => setEditData({ ...editData, unit: "ק״ג", count_step: 0.01, min_order: 0.01, order_step: 0.01 })}
                                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${editData.unit === "ק״ג" ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    משקל (ק״ג)
                                </button>
                            </div>
                        </div>

                        {/* 2. Configuration Pickers */}
                        <div className="space-y-3">

                            {/* Unit Weight (Only if Units) - e.g. "Pack of Cookies (200g)" */}
                            {editData.unit === "יח׳" && (
                                <NumberPicker
                                    label="משקל יחידה (גרם)"
                                    value={editData.unit_weight_grams || 0}
                                    onChange={v => setEditData({ ...editData, unit_weight_grams: v })}
                                    unit="גרם"
                                    stepSmall={10}
                                    stepLarge={100}
                                />
                            )}

                            {/* Count Step - Hidden for single units (always 1) */}
                            {editData.unit !== "יח׳" && (
                                <NumberPicker
                                    label="קפיצות ספירה"
                                    value={editData.count_step}
                                    onChange={v => setEditData({ ...editData, count_step: v })}
                                    unit={editData.unit === "ק״ג" ? "גרם" : editData.unit}
                                    stepSmall={editData.unit === "ק״ג" ? 0.01 : 1}
                                    stepLarge={editData.unit === "ק״ג" ? 0.1 : 10}
                                    format={v => editData.unit === "ק״ג" ? (v * 1000).toFixed(0) : v}
                                />
                            )}

                            {/* Cost per Unit */}
                            <NumberPicker
                                label="מחיר ליחידה"
                                value={editData.cost_per_unit}
                                onChange={v => setEditData({ ...editData, cost_per_unit: v })}
                                unit="₪"
                                stepSmall={0.1}
                                stepLarge={1}
                            />

                            {/* Min Order */}
                            <NumberPicker
                                label="מינימום הזמנה"
                                value={editData.min_order}
                                onChange={v => setEditData({ ...editData, min_order: v })}
                                unit={editData.unit}
                                                                stepSmall={editData.unit === "ק״ג" ? 0.01 : 1}
                                stepLarge={editData.unit === "ק״ג" ? 0.1 : 10}
                            />

                            {/* Order Step */}
                            <NumberPicker
                                label="צעד הזמנה"
                                value={editData.order_step}
                                onChange={v => setEditData({ ...editData, order_step: v })}
                                unit={editData.unit}
                                                                stepSmall={editData.unit === "ק״ג" ? 0.01 : 1}
                                stepLarge={editData.unit === "ק״ג" ? 0.1 : 10}
                            />
                        </div>
                    </div>

                    <div className="h-10"></div> {/* Bottom Spacer */}

                    {/* Fixed Footer Action */}
                    <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                        <button
                            onClick={async () => {
                                if (onItemUpdate) {
                                    await onItemUpdate(item.id, editData);
                                }
                                setIsEditing(false);
                            }}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-all"
                        >
                            שמור שינויים
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">{item.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{item.unit}</span>
                        {item.cost_per_unit > 0 && (
                            <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                                ₪{item.cost_per_unit}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
            </div>

            {/* Current Stock */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">מלאי נוכחי:</span>
                <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${currentStock <= (item.low_stock_alert || 5) ? 'text-red-600' : 'text-gray-900'}`}>
                        {currentStock}
                    </span>
                    <span className="text-sm text-gray-500">{item.unit}</span>
                </div>
            </div>

            {/* Stock Controls */}
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => handleStockUpdate(currentStock - (isUnitItem ? 1 : 0.25))}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold transition-colors"
                >
                    -
                </button>
                <button
                    onClick={() => handleStockUpdate(currentStock + (isUnitItem ? 1 : 0.25))}
                    className="flex-1 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg font-bold transition-colors"
                >
                    +
                </button>
            </div>

            {/* Order Section */}
            {isExpanded && (
                <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600">הזמנה מספק:</span>
                        <span className="font-bold text-blue-600">{orderQty} {item.unit}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={decrementOrder} className="h-12 w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-200 shadow-sm active:scale-95 transition-all">
                            <Minus size={20} strokeWidth={3} />
                        </button>
                        <div className="flex-1 text-center">
                            <span className={`block font-black text-2xl ${orderQty > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{orderQty > 0 ? orderQty : '-'}</span>
                        </div>
                        <button onClick={incrementOrder} className="h-12 w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm active:scale-95 transition-all">
                            <Plus size={20} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Button */}
            <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                    <Edit2 size={16} />
                    עריכת פרטי פריט
                </button>
            </div>
        </div>
    );
};

// NumberPicker Component (Same as in InventoryScreen)
const NumberPicker = ({ value, onChange, label, unit = '', stepSmall = 1, stepLarge = 10, format = (v) => v, min = 0 }) => {
    const handleChange = (delta) => {
        const next = Math.max(min, value + delta);
        // Fix float precision issues
        onChange(Number(next.toFixed(3)));
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm flex items-center justify-between gap-2 h-16">
            {/* Label */}
            <label className="text-xs font-black text-gray-500 shrink-0 w-20 leading-3 whitespace-normal text-right pl-1 flex items-center h-full">
                {label}
            </label>

            <div className="flex items-center gap-2 flex-1 justify-end h-full">
                {/* Decrease (Horizontal Row) */}
                <div className="flex gap-1 h-full items-center">
                    <button onClick={() => handleChange(-stepLarge)} className="w-10 h-10 bg-red-50 text-red-600 rounded-lg font-bold text-xs flex items-center justify-center hover:bg-red-100 transition-colors active:scale-95 leading-none">-{stepLarge < 1 && unit === "גרם" ? stepLarge * 1000 : stepLarge}</button>
                    <button onClick={() => handleChange(-stepSmall)} className="w-10 h-10 bg-gray-50 text-gray-600 rounded-lg font-bold text-sm flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-95 leading-none">-{stepSmall < 1 && unit === "גרם" ? stepSmall * 1000 : stepSmall}</button>
                </div>

                {/* Value */}
                <div className="min-w-[4rem] text-center flex flex-col justify-center">
                    <div className="text-xl font-black text-slate-800 tracking-tight leading-none">{format(value)}</div>
                    {unit && <div className="text-[10px] font-bold text-gray-400 mt-0.5">{unit}</div>}
                </div>

                {/* Increase (Horizontal Row) */}
                <div className="flex gap-1 h-full items-center">
                    <button onClick={() => handleChange(stepSmall)} className="w-10 h-10 bg-gray-50 text-gray-600 rounded-lg font-bold text-sm flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-95 leading-none">+{stepSmall < 1 && unit === "גרם" ? stepSmall * 1000 : stepSmall}</button>
                    <button onClick={() => handleChange(stepLarge)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs flex items-center justify-center hover:bg-blue-100 transition-colors active:scale-95 leading-none mb-0">+{stepLarge < 1 && unit === "גרם" ? stepLarge * 1000 : stepLarge}</button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(InventoryItemCard);
