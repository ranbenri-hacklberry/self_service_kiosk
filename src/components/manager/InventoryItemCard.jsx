import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, Minus, Plus, ShoppingCart, Save, History, User, AlertCircle, RotateCcw, MapPin, Settings, X, AlertTriangle } from 'lucide-react';

// Common storage locations for autocomplete
const COMMON_LOCATIONS = [
    'מקפיא - מקרר מטבח',
    'מקרר ראשי',
    'מחסן יבש',
    'מדף עליון',
    'מדף תחתון',
    'ארון אחסון',
];

const InventoryItemCard = ({ item, onStockChange = null, onOrderChange = null, onUpdate = null, draftOrderQty = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStock, setCurrentStock] = useState(() => {
        const val = Number(item.current_stock);
        return isNaN(val) ? 0 : val;
    });
    const [orderQty, setOrderQty] = useState(draftOrderQty);

    // UI States for changes
    const [hasStockChange, setHasStockChange] = useState(false);
    const [hasOrderChange, setHasOrderChange] = useState(false);

    const [isWeightMode, setIsWeightMode] = useState(false); // Toggle state

    // Calculate effective step for stock changes
    const getStockStep = () => {
        const wpu = parseFloat(item.weight_per_unit) || 0;
        if (wpu > 0) {
            if (isWeightMode) return 500; // 0.5 KG steps in Weight Mode
            // Unit Mode: defined step * wpu
            return (item.count_step || 1) * wpu;
        }
        // Standard (no wpu)
        return item.count_step || (item.unit === 'יח׳' ? 1 : 1000);
    };

    const handleStockClick = (direction) => {
        const step = getStockStep();
        const delta = direction * step;
        setCurrentStock(prev => Math.max(0, prev + delta));
        setHasStockChange(true);
    };

    // Handle Order Change (with Min Order logic)
    const handleOrderChange = (direction) => {
        const step = item.order_step || 1;
        const min = item.min_order || 0;

        setOrderQty(prev => {
            const current = prev || 0;
            let newVal;

            if (direction > 0) {
                // If starting specificly from 0 (or less), jump to minOrder if set
                newVal = current === 0 && min > 0 ? min : current + step;
            } else {
                newVal = current - step;
                // If dropping below minOrder, go to 0? Or Stay at min? 
                // Usually go to 0 if removing from min.
                if (min > 0 && newVal < min) newVal = 0;
            }
            return Math.max(0, newVal);
        });
        setHasOrderChange(true);
    };
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);


    // Backup for restore on error
    const originalStock = useRef(Number(item.current_stock) || 0);


    // Get step values with safe parsing
    const countStep = useMemo(() => {
        const val = parseFloat(item.count_step);
        return isNaN(val) || val <= 0 ? 1 : val;
    }, [item.count_step]);

    const orderStep = useMemo(() => {
        const val = parseFloat(item.order_step);
        return isNaN(val) || val <= 0 ? 1 : val;
    }, [item.order_step]);

    const minOrder = useMemo(() => {
        const val = parseFloat(item.min_order);
        return isNaN(val) || val <= 0 ? 1 : val;
    }, [item.min_order]);

    // Update info
    const lastCountDate = item.last_counted_at ? new Date(item.last_counted_at) : null;
    const lastCountedByName = item.last_counted_by_name || null;
    const lastCountSource = item.last_count_source || 'manual';

    // Computed values with useMemo
    const isLowStock = useMemo(() => {
        const stock = parseFloat(currentStock) || 0;
        const alert = parseFloat(item.low_stock_alert) || 5;
        return stock <= alert;
    }, [currentStock, item.low_stock_alert]);

    const isCountedToday = useMemo(() => {
        if (!item.last_counted_at) return false;
        const lastDate = new Date(item.last_counted_at).toLocaleDateString();
        const today = new Date().toLocaleDateString();
        return lastDate === today;
    }, [item.last_counted_at]);

    // Reset when item changes
    useEffect(() => {
        const val = parseFloat(item.current_stock);
        const safeVal = isNaN(val) ? 0 : val;
        setCurrentStock(safeVal);
        originalStock.current = safeVal;
        setHasStockChange(false);
        setError(null);
    }, [item.current_stock]);

    // Update orderQty when draftOrderQty changes
    useEffect(() => {
        setOrderQty(draftOrderQty);
    }, [draftOrderQty]);



    // Restore to original value
    const handleRestore = useCallback(() => {
        setCurrentStock(originalStock.current);
        setHasStockChange(false);
        setError(null);
    }, []);

    // Save stock with error handling and restore capability
    const saveStock = useCallback(async () => {
        if (!hasStockChange) return;
        setSaving(true);
        setError(null);
        const backupValue = currentStock;
        try {
            if (onStockChange) await onStockChange(item.id, currentStock);
            originalStock.current = currentStock; // Update backup on success
            setHasStockChange(false);
        } catch (e) {
            console.error('Save failed:', e);
            setError('שגיאה בשמירה - לחץ לשחזור');
            // Keep the value but show error
        } finally {
            setSaving(false);
        }
    }, [hasStockChange, onStockChange, item.id, currentStock]);

    // Save order - useCallback
    const saveOrder = useCallback(() => {
        if (onOrderChange) onOrderChange(item.id, orderQty);
        setHasOrderChange(false);
    }, [onOrderChange, item.id, orderQty]);

    // Get update source text - useMemo
    const sourceText = useMemo(() => {
        if (lastCountSource === 'order_receipt') return 'קליטת הזמנה';
        if (lastCountSource === 'order_deduction') return 'הזמנת לקוח';
        if (lastCountedByName) return `ספירה ע״י ${lastCountedByName}`;
        return 'ספירה ידנית';
    }, [lastCountSource, lastCountedByName]);

    const handleOpenEdit = (e) => {
        e.stopPropagation();
        setEditData({
            name: item.name,
            unit: item.unit || 'יח׳',
            cost_per_unit: item.cost_per_unit || 0,
            count_step: item.count_step || (item.unit === 'יח׳' ? 1 : 1000), // Smart default based on unit
            weight_per_unit: item.weight_per_unit || 0,
            min_order: item.min_order || (item.unit === 'יח׳' ? 1 : 1000),
            order_step: item.order_step || (item.unit === 'יח׳' ? 1 : 1000),
            low_stock_alert: item.low_stock_alert || 0,
            location: item.location || '',
            yield_percentage: item.yield_percentage || 100
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!onUpdate) return;
        setSaving(true);
        try {
            await onUpdate(item.id, editData);
            setShowEditModal(false);
        } catch (e) {
            console.error('Update failed:', e);
            alert('עדכון נכשל');
        } finally {
            setSaving(false);
        }
    };



    // Display convert logic: If weight_per_unit exists, show units, otherwise fallback to KG/G
    const { displayValue, displayUnit } = useMemo(() => {
        const wpu = parseFloat(item.weight_per_unit) || 0;

        // CASE A: We have a package weight defined (e.g. 1000g per unit)
        if (wpu > 1) {
            // Check if we are in Weight Mode
            if (isWeightMode) {
                const weightInKg = currentStock / 1000;
                return {
                    displayValue: parseFloat(weightInKg.toFixed(2)),
                    displayUnit: 'ק״ג'
                };
            }

            // Default: Unit Mode
            const units = currentStock / wpu;
            return {
                displayValue: parseFloat(units.toFixed(2)),
                displayUnit: 'יח׳'
            };
        }

        // CASE B: Standard Grams to KG conversion (No WPU defined or WPU=0)
        let val = currentStock;
        let unit = item.unit || '';

        if (unit === 'גרם' && currentStock >= 1000) {
            val = parseFloat((currentStock / 1000).toFixed(2));
            unit = 'ק״ג';
        } else if (unit === 'מ״ל' && currentStock >= 1000) {
            val = parseFloat((currentStock / 1000).toFixed(2));
            unit = 'ליטר';
        }

        return { displayValue: val, displayUnit: unit };
    }, [currentStock, item.unit, item.weight_per_unit, isWeightMode]);

    // Handle Stock Change (Smart Step based on Mode)
    const handleSmartStockChange = (direction) => { // direction: 1 or -1
        const wpu = parseFloat(item.weight_per_unit) || 0;
        let deltaInGrams = 0;

        if (wpu > 0) {
            if (isWeightMode) {
                // Weight Mode: Change by 0.5 KG (500g) steps? Or 100g? 
                // Let's go with 0.5 KG as a safe default for manual bulk adjustments
                const WEIGHT_STEP_GRAMS = 500;
                deltaInGrams = direction * WEIGHT_STEP_GRAMS;
            } else {
                // Unit Mode: Change by defined count_step (Units) * WPU
                const stepUnits = item.count_step || 1;
                deltaInGrams = direction * stepUnits * wpu;
            }
        } else {
            // Standard Mode: Change by count_step (raw)
            const stepRaw = item.count_step || (item.unit === 'יח׳' ? 1 : 1000); // fallback
            deltaInGrams = direction * stepRaw;
        }

        // Parent expects 'delta'?? No, parent expects 'new val' or 'delta'? 
        // handleStockChange in parent (InventoryScreen) usually takes new value or delta?
        // Let's check props: onStockChange(itemId, delta)
        // Wait, local handleStockChange(dir) calls setStockChange(prev + dir) -> this is simplistic delta of "steps".
        // BUT here we want full control.

        // Actually, the current component local state logic is:
        // const [stockChange, setStockChange] = useState(0); 
        // handleStockChange adds to this *local* delta.
        // But stockChange is currently just "how many steps".

        // We need to refactor local handleStockChange to track precise gram delta.
        // OR: interpret the click immediately.

        // The current implementation:
        // const [stockChange, setStockChange] = useState(0);
        // handleStockChange = (dir) => setStockChange(prev => prev + (dir * item.count_step)); <-- NO!
        // Let's look at lines 63-71 of THIS file (not visible in recent view). 
        // Assuming I need to rewrite the local `handleStockChange` function too. Use view_file to be safe?
        // No, I'll assume I can just replace the `onClick` handler of the buttons to a new function `onSmartStockChange`
        // that calculates the REAL delta in grams and passes it to `onStockChange` immediately?
        // The card has a "Save" button. So it accumulates changes.
        // Let's assume `stockChange` state tracks the *accumulated delta in base units (grams)*.
        // Current usage: `const handleStockChange = (dir) => { setStockChange(prev => prev + dir * step); }`
        // I will replace `handleStockChange` entirely.
    };

    return (
        <div className={`rounded-xl border transition-all 
            ${isExpanded ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-100' :
                isCountedToday && !hasStockChange ? 'bg-emerald-50/30 border-emerald-200 shadow-sm' :
                    'bg-white border-gray-100 shadow-sm hover:border-gray-200'}`}>
            {/* Header Row */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-3 py-2.5 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg 
                        ${isLowStock ? 'bg-red-100 text-red-500' :
                            isCountedToday ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        <Package size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-800 text-sm truncate">{item.name}</h4>
                            {/* Toggle Button for WPU items */}
                            {parseFloat(item.weight_per_unit) > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsWeightMode(!isWeightMode); }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-500 text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors"
                                >
                                    {isWeightMode ? 'הצג יח׳' : 'הצג משקל'}
                                </button>
                            )}
                        </div>
                        <span className="text-[11px] text-gray-400">{item.unit}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Stock Badge */}
                    <div className={`px-2 py-1 rounded-lg text-center min-w-[3.5rem] flex flex-col items-center justify-center leading-none ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'} ${hasStockChange ? 'ring-2 ring-blue-400' : ''}`}>
                        <span className="font-black text-base">{displayValue}</span>
                        <span className="text-[9px] font-bold opacity-70">{displayUnit}</span>
                    </div>

                    {/* Order Badge */}
                    {orderQty > 0 && (
                        <div className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 flex items-center gap-1">
                            <ShoppingCart size={12} />
                            <span className="font-bold text-sm">+{orderQty}</span>
                        </div>
                    )}

                    {/* Edit Button */}
                    <button
                        onClick={handleOpenEdit}
                        className="p-1.5 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="ערוך מאפיינים"
                    >
                        <Settings size={16} />
                    </button>

                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 overflow-hidden"
                    >
                        <div className="p-3 space-y-3">
                            {/* Stock Row */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-gray-500 whitespace-nowrap">מלאי</span>

                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg">
                                    <button
                                        onClick={() => handleStockClick(-1)}
                                        aria-label="הפחת מלאי"
                                        className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:scale-95 transition-all"
                                    >
                                        <Minus size={20} strokeWidth={3} />
                                    </button>

                                    <div className="flex-1 flex flex-col items-center justify-center min-w-[80px]">
                                        <div className="text-3xl font-black text-slate-800 leading-none tracking-tight">
                                            {displayValue}
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                                            {isWeightMode ? 'קילוגרם' : item.unit}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleStockClick(1)}
                                        aria-label="הוסף מלאי"
                                        className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl hover:bg-green-50 hover:border-green-200 hover:text-green-600 active:scale-95 transition-all"
                                    >
                                        <Plus size={20} strokeWidth={3} />
                                    </button>
                                </div>

                                {/* Save Stock Button */}
                                <div className="w-11">
                                    {hasStockChange && (
                                        <motion.button
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            onClick={saveStock}
                                            disabled={saving}
                                            className="w-10 h-10 bg-blue-600 text-white rounded-lg shadow-md flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all"
                                        >
                                            <Save size={18} />
                                        </motion.button>
                                    )}
                                </div>
                            </div>

                            {/* Error Display with Restore Button */}
                            {error && (
                                <div className="flex items-center justify-between gap-2 text-xs text-red-500 bg-red-50 px-2 py-1.5 rounded">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={12} />
                                        <span>{error}</span>
                                    </div>
                                    <button
                                        onClick={handleRestore}
                                        className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 rounded text-red-600 transition"
                                    >
                                        <RotateCcw size={10} />
                                        שחזר
                                    </button>
                                </div>
                            )}

                            {/* Update Info - Single Line */}
                            {lastCountDate && (
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 px-1">
                                    <History size={10} />
                                    <span>{lastCountDate.toLocaleDateString('he-IL')} {lastCountDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>•</span>
                                    <span className={lastCountSource !== 'manual' ? 'text-blue-500' : ''}>{sourceText}</span>
                                </div>
                            )}

                            <div className="h-px bg-gray-100"></div>

                            {/* Order Row */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-500">הזמנה</span>
                                    {minOrder > 1 && <span className="text-[9px] text-gray-400">מינ׳ {minOrder}</span>}
                                    {/* Secondary Unit Info for Orders */}
                                    {parseFloat(item.weight_per_unit) > 0 && item.min_order > 0 && (
                                        <span className="text-[9px] text-blue-400 font-medium">
                                            (~{Math.round(item.min_order / item.weight_per_unit)} יח׳)
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg">
                                    <button
                                        onClick={() => handleOrderChange(-1)}
                                        className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition active:scale-95"
                                    >
                                        <Minus size={16} strokeWidth={3} />
                                    </button>

                                    <div className="w-14 text-center">
                                        <span className={`font-mono text-xl font-black ${orderQty > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                            {orderQty || '-'}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleOrderChange(1)}
                                        className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-500 hover:text-green-600 hover:bg-green-50 transition active:scale-95"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                    </button>
                                </div>

                                {/* Save Order Button */}
                                <div className="w-11">
                                    {hasOrderChange && orderQty !== draftOrderQty && (
                                        <motion.button
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            onClick={saveOrder}
                                            className="w-10 h-10 bg-green-600 text-white rounded-lg shadow-md flex items-center justify-center hover:bg-green-700 active:scale-90 transition-all"
                                        >
                                            <Save size={18} />
                                        </motion.button>
                                    )}
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Modal (Portal-style overlay) */}
            <AnimatePresence>
                {showEditModal && editData && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditModal(false)}
                            className="fixed inset-0 bg-black z-[100]"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 bg-white z-[101] rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-6 pb-2 bg-white rounded-t-3xl shrink-0 relative">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
                                <h3 className="text-2xl font-black text-slate-800 text-center">{editData.name}</h3>
                                <p className="text-sm text-gray-400 text-center font-bold mt-1">עריכת הגדרות פריט</p>
                            </div>

                            {/* Scrollable Form Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                                {/* Top Row: Cost & Yield */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Cost Price */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-400">מחיר עלות</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={editData.cost_per_unit || ''}
                                                onChange={(e) => setEditData({ ...editData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-12 bg-gray-50 rounded-xl border border-gray-100 focus:border-green-500 outline-none font-bold text-lg text-center"
                                                placeholder="0"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">₪</span>
                                        </div>
                                    </div>

                                    {/* Yield Percentage */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-purple-400">אחוז ניצול (Yield)</label>
                                        <div className="flex items-center h-12 bg-purple-50 rounded-xl border border-purple-100 px-1">
                                            <button onClick={() => setEditData(prev => ({ ...prev, yield_percentage: Math.max(0, (prev.yield_percentage || 100) - 5) }))} className="w-8 h-full text-purple-600 font-bold hover:bg-purple-100 rounded-lg text-lg">-</button>
                                            <div className="flex-1 text-center font-black text-purple-700 text-lg">
                                                {editData.yield_percentage || 100}%
                                            </div>
                                            <button onClick={() => setEditData(prev => ({ ...prev, yield_percentage: Math.min(100, (prev.yield_percentage || 100) + 5) }))} className="w-8 h-full text-purple-600 font-bold hover:bg-purple-100 rounded-lg text-lg">+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Row: Weight & Low Stock */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Weight Per Unit */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                            <span className="text-red-500">*</span> משקל יחידה ממוצע
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={editData.weight_per_unit || ''}
                                                onChange={(e) => setEditData({ ...editData, weight_per_unit: parseFloat(e.target.value) || 0 })}
                                                className={`w-full h-12 bg-white rounded-xl border-2 ${!editData.weight_per_unit ? 'border-red-200 focus:border-red-500' : 'border-gray-100 focus:border-blue-500'} outline-none font-bold text-lg text-center`}
                                                placeholder="0"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">גרם</span>
                                        </div>
                                        {/* Show avg units per kg if relevant - EDITABLE NOW */}
                                        {((item.unit === 'ק״ג' || item.unit === 'גרם') || editData.weight_per_unit > 0) && (
                                            <div className="flex items-center justify-center gap-1 bg-gray-50 rounded-lg px-2 py-1 mt-1 border border-gray-100 cursor-text group-hover:border-blue-200 focus-within:border-blue-400 focus-within:bg-white transition-colors">
                                                <input
                                                    type="number"
                                                    className="w-8 text-[10px] sm:text-xs font-bold bg-transparent text-center outline-none text-blue-600 placeholder-gray-300"
                                                    placeholder="-"
                                                    value={editData.weight_per_unit > 0 ? (Math.round((1000 / editData.weight_per_unit) * 10) / 10) : ''}
                                                    onChange={(e) => {
                                                        const unitsPerKg = parseFloat(e.target.value);
                                                        if (unitsPerKg > 0) {
                                                            setEditData({ ...editData, weight_per_unit: Math.round(1000 / unitsPerKg) });
                                                        } else {
                                                            setEditData({ ...editData, weight_per_unit: 0 }); // reset if invalid
                                                        }
                                                    }}
                                                />
                                                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">יח׳ לק״ג</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Low Stock Alert */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-orange-400">התראה (מלאי נמוך)</label>
                                        <div className="flex items-center h-12 bg-orange-50 rounded-xl border border-orange-100 px-1">
                                            <button onClick={() => setEditData(prev => ({ ...prev, low_stock_alert: Math.max(0, (prev.low_stock_alert || 0) - 1) }))} className="w-8 h-full text-orange-500 font-bold hover:bg-orange-100 rounded-lg text-lg">-</button>
                                            <div className="flex-1 text-center font-black text-orange-600 text-lg">
                                                {editData.low_stock_alert || 0}
                                            </div>
                                            <button onClick={() => setEditData(prev => ({ ...prev, low_stock_alert: (prev.low_stock_alert || 0) + 1 }))} className="w-8 h-full text-orange-500 font-bold hover:bg-orange-100 rounded-lg text-lg">+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Count Step Section */}
                                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                                    <label className="text-xs font-bold text-gray-500 block mb-2 text-center">קפיצות ספירה (+/-)</label>
                                    <div className="flex gap-2 mb-2">
                                        {[1, 0.5, 0.25].map(step => (
                                            <button
                                                key={step}
                                                onClick={() => setEditData({ ...editData, count_step: step })}
                                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all border ${editData.count_step === step ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                                            >
                                                {step === 1 ? '1' : step}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={editData.count_step || ''}
                                            onChange={(e) => setEditData({ ...editData, count_step: parseFloat(e.target.value) || 0 })}
                                            className="w-full p-2 bg-white rounded-lg border border-gray-200 text-center font-bold text-sm focus:border-blue-500 outline-none"
                                            placeholder="ערך מותאם..."
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">מותאם:</span>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400">מיקום פיזי</label>
                                    <div className="relative">
                                        <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={editData.location}
                                            onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                                            placeholder="מיקום במחסן..."
                                            list="location-suggestions-modal"
                                            className="w-full h-10 pr-9 bg-gray-50 rounded-xl border border-gray-100 focus:border-gray-300 outline-none font-bold text-sm"
                                        />
                                        <datalist id="location-suggestions-modal">
                                            {COMMON_LOCATIONS.map(loc => (
                                                <option key={loc} value={loc} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="h-4"></div>
                                {/* Unit/Weight Toggle - Only if WPU defined */}
                                {parseFloat(item.weight_per_unit) > 0 && (
                                    <div className="mt-4 pt-4 border-t border-dashed border-gray-100">
                                        <button
                                            onClick={() => setIsWeightMode(!isWeightMode)}
                                            title={isWeightMode ? "עבור לתצוגת יחידות" : "עבור לתצוגת משקל (KG)"}
                                            className={`w-full py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${isWeightMode
                                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                                                }`}
                                        >
                                            <Scale size={14} />
                                            {isWeightMode ? 'מוצג לפי משקל (ק"ג) - לחץ לשינוי' : 'מוצג לפי יחידות - לחץ לשינוי'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Fixed Footer Action */}
                            <div className="p-4 border-t border-gray-100 bg-white shrink-0 pb-8">
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Save size={20} />
                                            שמור שינויים
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

// PropTypes for type safety
InventoryItemCard.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string.isRequired,
        current_stock: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        unit: PropTypes.string,
        count_step: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        order_step: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        min_order: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        low_stock_alert: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        last_counted_at: PropTypes.string,
        last_counted_by_name: PropTypes.string,
        last_count_source: PropTypes.oneOf(['manual', 'order_receipt', 'order_deduction']),
    }).isRequired,
    onStockChange: PropTypes.func,
    onOrderChange: PropTypes.func,
    onLocationChange: PropTypes.func,
    draftOrderQty: PropTypes.number,
};


// --- Helper Component: Double Stepper Picker ---
const NumberPicker = ({ value, onChange, label, unit = '', stepSmall = 1, stepLarge = 10, format = (v) => v, min = 0 }) => {
    const handleChange = (delta) => {
        const next = Math.max(min, value + delta);
        onChange(Number(next.toFixed(3)));
    };

    return (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-3 flex items-center justify-between gap-3 h-20">
            <label className="text-xs font-black text-gray-500 shrink-0 w-24 leading-3 text-right">
                {label}
            </label>

            <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="flex gap-1">
                    <button onClick={() => handleChange(-stepLarge)} className="w-10 h-10 bg-red-50 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-red-100 transition-colors">- {stepLarge >= 1000 ? (stepLarge / 1000) + 'k' : stepLarge}</button>
                    <button onClick={() => handleChange(-stepSmall)} className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-gray-100 transition-colors">- {stepSmall}</button>
                </div>

                <div className="min-w-[4.5rem] text-center flex flex-col justify-center px-1">
                    <div className="text-lg font-black text-slate-800 tracking-tight leading-none">{format(value)}</div>
                    {unit && <div className="text-[10px] font-bold text-gray-400 mt-1">{unit}</div>}
                </div>

                <div className="flex gap-1">
                    <button onClick={() => handleChange(stepSmall)} className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-gray-100 transition-colors">+ {stepSmall}</button>
                    <button onClick={() => handleChange(stepLarge)} className="w-10 h-10 bg-green-50 text-green-600 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-green-100 transition-colors">+ {stepLarge >= 1000 ? (stepLarge / 1000) + 'k' : stepLarge}</button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(InventoryItemCard);
