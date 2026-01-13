import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, Minus, Plus, ShoppingCart, Save, History, User, AlertCircle, RotateCcw, MapPin, Settings, X } from 'lucide-react';

// Common storage locations for autocomplete
const COMMON_LOCATIONS = [
    'מקפיא - מקרר מטבח',
    'מקרר ראשי',
    'מחסן יבש',
    'מדף עליון',
    'מדף תחתון',
    'ארון אחסון',
];

const InventoryItemCard = ({ item, onStockChange = null, onOrderChange = null, onLocationChange = null, onUpdate = null, draftOrderQty = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStock, setCurrentStock] = useState(() => {
        const val = Number(item.current_stock);
        return isNaN(val) ? 0 : val;
    });
    const [orderQty, setOrderQty] = useState(draftOrderQty);
    const [hasStockChange, setHasStockChange] = useState(false);
    const [hasOrderChange, setHasOrderChange] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);

    // Location state
    const [location, setLocation] = useState(item.location || '');
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [hasLocationChange, setHasLocationChange] = useState(false);

    // Backup for restore on error
    const originalStock = useRef(Number(item.current_stock) || 0);

    // The following code snippet appears to be misplaced. It contains logic related to fetching employees
    // using 'supabase' and 'currentUser', which are not defined within this component (InventoryItemCard).
    // Inserting it here would cause a syntax error and logical issues.
    // It seems to belong in a parent component like 'InventoryScreen.jsx'.
    // Therefore, I am skipping the insertion of this specific snippet to maintain a syntactically correct file.
    /*
      // Fetch employees for name mapping - wrap in nested try/catch to prevent blocking items fetch
      const employeeMap = {};
      try {
        const { data: employeesData, error: empError } = await supabase
          .from('employees')
          .select('id, name')
          .eq('business_id', currentUser.business_id);
        
        if (!empError && employeesData) {
          employeesData.forEach(e => { employeeMap[e.id] = e.name; });
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch employees for inventory mapping:', e);
      }
    */

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

    // Smart step for stock - Always use gram-based countStep
    const handleStockChange = useCallback((delta) => {
        const step = countStep;

        // Add/Subtract the step (which is in grams)
        let newVal = currentStock + (delta * step);

        newVal = parseFloat(newVal.toFixed(4));
        newVal = Math.max(0, newVal);

        setCurrentStock(newVal);
        setHasStockChange(true);
        setError(null);
    }, [currentStock, countStep]);

    // Handle order quantity change - useCallback
    const handleOrderChange = useCallback((delta) => {
        let newVal;
        if (delta > 0) {
            newVal = orderQty === 0 ? minOrder : orderQty + orderStep;
        } else {
            newVal = orderQty - orderStep;
            if (newVal < minOrder) newVal = 0;
        }
        newVal = Math.max(0, newVal);
        setOrderQty(newVal);
        setHasOrderChange(true);
    }, [orderQty, orderStep, minOrder]);

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
            count_step: item.count_step || 1,
            weight_per_unit: item.weight_per_unit || 0,
            min_order: item.min_order || 1,
            order_step: item.order_step || 1
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
        const baseUnit = item.unit || '';

        // CASE A: We have a package weight defined (e.g. 1000g per unit)
        if (wpu > 1) {
            const units = currentStock / wpu;
            // If it's a whole number, show without decimals, otherwise 1 decimal
            return {
                displayValue: units % 1 === 0 ? units : units.toFixed(1),
                displayUnit: 'יח׳'
            };
        }

        // CASE B: Standard Grams to KG conversion
        let val = currentStock;
        let unit = baseUnit;

        if (unit === 'גרם' && currentStock >= 1000) {
            val = (currentStock / 1000).toFixed(1);
            unit = 'ק״ג';
        } else if (unit === 'מ״ל' && currentStock >= 1000) {
            val = (currentStock / 1000).toFixed(1);
            unit = 'ליטר';
        }

        return { displayValue: val, displayUnit: unit };
    }, [currentStock, item.unit, item.weight_per_unit]);

    return (
        <div className={`bg-white rounded-xl border transition-all ${isExpanded ? 'border-blue-200 shadow-md' : 'border-gray-100 shadow-sm'}`}>
            {/* Header Row */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-3 py-2.5 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${isLowStock ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                        <Package size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm truncate">{item.name}</h4>
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
                                        onClick={() => handleStockChange(-1)}
                                        className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition active:scale-95"
                                    >
                                        <Minus size={16} strokeWidth={3} />
                                    </button>

                                    <div className="w-20 text-center flex flex-col justify-center">
                                        <span className={`font-mono text-xl font-black leading-none ${hasStockChange ? 'text-blue-600' : 'text-slate-700'}`}>
                                            {displayValue}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-bold">{displayUnit}</span>
                                    </div>

                                    <button
                                        onClick={() => handleStockChange(1)}
                                        className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-500 hover:text-green-600 hover:bg-green-50 transition active:scale-95"
                                    >
                                        <Plus size={16} strokeWidth={3} />
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

                            <div className="h-px bg-gray-100"></div>

                            {/* Location Row */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-amber-500" />
                                    <span className="text-xs font-bold text-gray-500">מיקום</span>
                                </div>

                                {isEditingLocation ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={location}
                                            onChange={(e) => {
                                                setLocation(e.target.value);
                                                setHasLocationChange(true);
                                            }}
                                            placeholder="הזן מיקום..."
                                            list="location-suggestions"
                                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                                            autoFocus
                                        />
                                        <datalist id="location-suggestions">
                                            {COMMON_LOCATIONS.map(loc => (
                                                <option key={loc} value={loc} />
                                            ))}
                                        </datalist>
                                        <button
                                            onClick={async () => {
                                                if (hasLocationChange && onLocationChange) {
                                                    setSaving(true);
                                                    try {
                                                        await onLocationChange(item.id, location);
                                                        setHasLocationChange(false);
                                                    } catch (e) {
                                                        console.error('Failed to save location:', e);
                                                    } finally {
                                                        setSaving(false);
                                                    }
                                                }
                                                setIsEditingLocation(false);
                                            }}
                                            className="px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition"
                                        >
                                            שמור
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditingLocation(true)}
                                        className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition flex items-center gap-1"
                                    >
                                        {location || 'הוסף מיקום'}
                                    </button>
                                )}
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
                            className="fixed bottom-0 left-0 right-0 bg-white z-[101] rounded-t-3xl shadow-2xl p-0 min-h-[70vh] flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-6 pb-6 bg-white rounded-t-3xl border-b border-gray-50 shrink-0 relative">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                                <h3 className="text-2xl font-black text-slate-800 text-center">עריכת מאפייני פריט</h3>
                                <p className="text-sm text-blue-500 text-center font-bold mt-1">{item.name}</p>
                            </div>

                            {/* Scrollable Form Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* 1. Basic Details */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-bold text-slate-500 mb-1 block">שם הפריט</label>
                                        <input
                                            type="text"
                                            value={editData.name}
                                            onChange={e => setEditData({ ...editData, name: e.target.value })}
                                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-bold text-xl text-center"
                                        />
                                    </div>

                                    {/* Type Selector (Tabs) */}
                                    <div className="bg-gray-100 p-1.5 rounded-2xl flex">
                                        <button
                                            onClick={() => setEditData({ ...editData, unit: 'יח׳', count_step: 1, min_order: 1, order_step: 1 })}
                                            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${editData.unit === 'יח׳' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            פריט בודד (יח׳)
                                        </button>
                                        <button
                                            onClick={() => setEditData({ ...editData, unit: 'גרם', count_step: 100, min_order: 1000, order_step: 500 })}
                                            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${editData.unit === 'גרם' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            משקל (גרם)
                                        </button>
                                    </div>
                                </div>

                                {/* 2. Configuration Pickers */}
                                <div className="space-y-3">
                                    <NumberPicker
                                        label="משקל אריזה (גרם)"
                                        value={editData.weight_per_unit || 0}
                                        onChange={v => setEditData({ ...editData, weight_per_unit: v })}
                                        unit="גרם"
                                        stepSmall={10}
                                        stepLarge={100}
                                    />

                                    {editData.unit !== 'יח׳' && (
                                        <NumberPicker
                                            label="קפיצות ספירה"
                                            value={editData.count_step}
                                            onChange={v => setEditData({ ...editData, count_step: v })}
                                            unit={editData.unit}
                                            stepSmall={10}
                                            stepLarge={100}
                                        />
                                    )}

                                    <NumberPicker
                                        label="מינימום להזמנה"
                                        value={editData.min_order}
                                        onChange={v => setEditData({ ...editData, min_order: v })}
                                        unit={editData.unit}
                                        stepSmall={100}
                                        stepLarge={500}
                                    />

                                    <NumberPicker
                                        label="קפיצות הזמנה"
                                        value={editData.order_step}
                                        onChange={v => setEditData({ ...editData, order_step: v })}
                                        unit={editData.unit}
                                        stepSmall={100}
                                        stepLarge={500}
                                    />

                                    <NumberPicker
                                        label={editData.unit === 'גרם' ? 'עלות לק״ג (₪)' : `עלות ל${editData.unit} (₪)`}
                                        value={editData.unit === 'גרם' ? (editData.cost_per_unit * 1000) : editData.cost_per_unit || 0}
                                        onChange={v => {
                                            const realCost = editData.unit === 'גרם' ? (v / 1000) : v;
                                            setEditData({ ...editData, cost_per_unit: realCost });
                                        }}
                                        unit="₪"
                                        stepSmall={1}
                                        stepLarge={10}
                                        format={v => v.toFixed(2)}
                                    />
                                </div>
                                <div className="h-10"></div>
                            </div>

                            {/* Fixed Footer Action */}
                            <div className="p-4 border-t border-gray-100 bg-white shrink-0">
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
