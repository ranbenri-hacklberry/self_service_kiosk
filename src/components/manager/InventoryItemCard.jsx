import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, Minus, Plus, ShoppingCart, Save, History, User, AlertCircle, RotateCcw } from 'lucide-react';

const InventoryItemCard = ({ item, onStockChange, onOrderChange, draftOrderQty = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStock, setCurrentStock] = useState(Number(item.current_stock) || 0);
    const [orderQty, setOrderQty] = useState(draftOrderQty);
    const [hasStockChange, setHasStockChange] = useState(false);
    const [hasOrderChange, setHasOrderChange] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

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

    // Smart step for stock - useCallback for performance
    const handleStockChange = useCallback((delta) => {
        const step = countStep;
        let newVal;

        if (delta > 0) {
            const nearestAbove = Math.ceil(currentStock / step) * step;
            newVal = (Math.abs(currentStock - nearestAbove) < 0.001) ? nearestAbove + step : nearestAbove;
        } else {
            const nearestBelow = Math.floor(currentStock / step) * step;
            newVal = (Math.abs(currentStock - nearestBelow) < 0.001) ? nearestBelow - step : nearestBelow;
        }

        newVal = Math.max(0, Math.round(newVal * 100) / 100);
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
                    <div className={`px-2.5 py-1 rounded-lg text-center min-w-[3rem] ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'} ${hasStockChange ? 'ring-2 ring-blue-400' : ''}`}>
                        <span className="font-black text-lg">{currentStock}</span>
                    </div>

                    {/* Order Badge */}
                    {orderQty > 0 && (
                        <div className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 flex items-center gap-1">
                            <ShoppingCart size={12} />
                            <span className="font-bold text-sm">+{orderQty}</span>
                        </div>
                    )}

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

                                    <div className="w-14 text-center">
                                        <span className={`font-mono text-xl font-black ${hasStockChange ? 'text-blue-600' : 'text-slate-700'}`}>
                                            {currentStock}
                                        </span>
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
                        </div>
                    </motion.div>
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
    draftOrderQty: PropTypes.number,
};

InventoryItemCard.defaultProps = {
    draftOrderQty: 0,
    onStockChange: null,
    onOrderChange: null,
};

export default React.memo(InventoryItemCard);
