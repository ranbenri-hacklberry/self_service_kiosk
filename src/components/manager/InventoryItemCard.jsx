import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, Minus, Plus, ShoppingCart, Save, History, User, AlertCircle, RotateCcw, MapPin, Settings, X, AlertTriangle, Scale, Trash2 } from 'lucide-react';
import ManagerAuthModal from '../ManagerAuthModal';

/**
 * InventoryItemCard - Compact version for Manager Inventory Screen
 * Simplified for fast counting and ordering without expansion.
 */
const InventoryItemCard = ({ item, onStockChange = null, onOrderChange = null, onUpdate = null, onDelete = null, draftOrderQty = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStock, setCurrentStock] = useState(() => {
        const val = Number(item.current_stock);
        return isNaN(val) ? 0 : val;
    });

    const [orderQty, setOrderQty] = useState(draftOrderQty || 0);
    const [hasStockChange, setHasStockChange] = useState(false);
    const [hasOrderChange, setHasOrderChange] = useState(false);

    const [isWeightMode, setIsWeightMode] = useState(false); // Toggle state
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);

    // Sync state with props
    useEffect(() => {
        if (!hasStockChange) setCurrentStock(Number(item.current_stock) || 0);
    }, [item.current_stock, hasStockChange]);

    useEffect(() => {
        if (!hasOrderChange) setOrderQty(draftOrderQty || 0);
    }, [draftOrderQty, hasOrderChange]);

    // Metadata helpers
    const lastCountedByName = item.last_counted_by_name || null;
    const lastCountSource = item.last_count_source || 'manual';
    const lastCountDate = item.last_counted_at ? new Date(item.last_counted_at) : null;

    const sourceText = useMemo(() => {
        let type = 'ספירה ידנית';
        if (lastCountSource === 'order_receipt') type = 'קליטת סחורה';
        else if (lastCountSource === 'order_deduction') type = 'הזמנת לקוח (אוטומטי)';
        else if (lastCountSource === 'local_script_override') type = 'עדכון מערכת';

        if (lastCountedByName) return `${type} (${lastCountedByName})`;
        return type;
    }, [lastCountSource, lastCountedByName]);

    const isCountedToday = useMemo(() => {
        if (!lastCountDate) return false;
        return lastCountDate.toDateString() === new Date().toDateString();
    }, [lastCountDate]);

    // Step calculations
    const wpu = parseFloat(item.weight_per_unit) || 0;
    const countStep = useMemo(() => {
        const val = parseFloat(item.count_step);
        return isNaN(val) || val <= 0 ? 1 : val;
    }, [item.count_step]);

    const orderStep = useMemo(() => {
        let val = parseFloat(item.order_step);
        if (isNaN(val) || val <= 0) return 1;
        if (wpu > 1 && val >= wpu) return val / wpu;
        return val;
    }, [item.order_step, wpu]);

    const minOrder = useMemo(() => {
        let val = parseFloat(item.min_order);
        if (isNaN(val) || val <= 0) return 0;
        if (wpu > 1 && val >= wpu) return val / wpu;
        return val;
    }, [item.min_order, wpu]);

    const isLowStock = item.low_stock_alert > 0 && currentStock <= item.low_stock_alert;

    // Actions
    const handleStockClick = (direction) => {
        // Multiplier based on unit vs weight mode
        let delta;
        if (wpu > 0) {
            if (isWeightMode) {
                delta = direction * 500; // 0.5kg steps
            } else {
                delta = direction * countStep * wpu;
            }
        } else {
            delta = direction * countStep;
        }

        setCurrentStock(prev => Math.max(0, prev + delta));
        setHasStockChange(true);
    };

    const handleOrderClick = (direction) => {
        setOrderQty(prev => {
            const current = prev || 0;
            let newVal;
            if (direction > 0) {
                newVal = current === 0 && minOrder > 0 ? minOrder : current + orderStep;
            } else {
                newVal = current - orderStep;
                if (minOrder > 0 && newVal < minOrder) newVal = 0;
            }
            return Math.max(0, newVal);
        });
        setHasOrderChange(true);
    };

    const saveStock = useCallback(async (e) => {
        e?.stopPropagation();
        if (onStockChange) onStockChange(item.id, currentStock);
        setHasStockChange(false);
    }, [currentStock, item.id, onStockChange]);

    const saveOrder = useCallback(async (e) => {
        e?.stopPropagation();
        if (onOrderChange) onOrderChange(item.id, orderQty);
        setHasOrderChange(false);
    }, [orderQty, item.id, onOrderChange]);

    // Formatting Display
    const { displayValue, displayUnit } = useMemo(() => {
        if (wpu > 1) {
            if (isWeightMode) {
                return { displayValue: (currentStock / 1000).toFixed(1), displayUnit: 'ק״ג' };
            }
            return { displayValue: (currentStock / wpu).toFixed(1), displayUnit: 'יח׳' };
        }
        if (item.unit === 'g' || item.unit === 'gram' || item.unit === 'גרם') {
            return { displayValue: (currentStock / 1000).toFixed(1), displayUnit: 'ק״ג' };
        }
        return { displayValue: currentStock.toString(), displayUnit: item.unit || 'יח׳' };
    }, [currentStock, wpu, isWeightMode, item.unit]);

    const handleOpenEdit = (e) => {
        e.stopPropagation();
        setEditData({
            name: item.name,
            catalog_item_name: item.catalog_item_name || '',
            unit: item.unit || 'יח׳',
            cost_per_unit: item.cost_per_unit || 0,
            count_step: item.count_step || (item.unit === 'יח׳' ? 1 : 1000),
            weight_per_unit: wpu,
            min_order: minOrder,
            order_step: orderStep,
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
        } catch (e) { console.error(e); alert('עדכון נכשל'); }
        finally { setSaving(false); }
    };

    const [showDeleteAuth, setShowDeleteAuth] = useState(false);

    // Compact Stepper Component
    const CompactStepper = ({ value, onChange, colorClass, label, unit, subLabel }) => (
        <div className="flex flex-col items-center gap-0.5 min-w-[85px]">
            <span className={`text-[9px] font-bold uppercase ${colorClass}`}>{label}</span>
            <div className={`flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(-1); }}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all font-bold"
                >
                    <Minus size={14} strokeWidth={3} />
                </button>
                <div className="flex flex-col items-center justify-center min-w-[32px] leading-none">
                    <span className={`font-mono text-sm font-black ${colorClass}`}>{value}</span>
                    <span className="text-[7px] font-bold opacity-50 uppercase">{unit}</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onChange(1); }}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-all font-bold"
                >
                    <Plus size={14} strokeWidth={3} />
                </button>
            </div>
            {subLabel && <span className="text-[8px] text-gray-400 font-medium truncate max-w-[80px]">{subLabel}</span>}
        </div>
    );

    // NumberStepper for Modal
    const NumberStepper = ({ label, value, onChange, step = 1, min = 0 }) => (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-bold text-slate-500 block truncate">{label}</label>
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 h-10">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, (parseFloat(value) || 0) - step))}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-red-500 transition-colors active:scale-90"
                >
                    <Minus size={16} strokeWidth={3} />
                </button>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="flex-1 min-w-0 bg-transparent border-none text-center font-black text-slate-700 focus:outline-none focus:ring-0 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                    type="button"
                    onClick={() => onChange((parseFloat(value) || 0) + step)}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 hover:text-emerald-500 transition-colors active:scale-90"
                >
                    <Plus size={16} strokeWidth={3} />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <div className={`p-2 rounded-2xl border transition-all ${hasStockChange || hasOrderChange ? 'bg-blue-50 border-blue-200' : isCountedToday ? 'bg-emerald-50/20 border-emerald-100' : 'bg-white border-slate-100 shadow-sm'}`} dir="rtl">
                <div className="flex items-center gap-3">

                    <div className="flex-1 min-w-0 pr-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <h4 className="font-black text-[14px] text-slate-800 leading-tight">{item.name}</h4>
                            {item.catalog_item_name && item.catalog_item_name !== item.name && (
                                <span className="text-[10px] text-slate-400 font-medium italic">({item.catalog_item_name})</span>
                            )}
                            {item.location && <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded font-bold">📍 {item.location}</span>}
                        </div>

                        <div className="flex flex-col text-[10px] text-slate-400 font-medium leading-tight">
                            <div className="flex items-center gap-1.5">
                                {isCountedToday ? (
                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">היום</span>
                                ) : lastCountDate ? (
                                    <span>
                                        {String(lastCountDate.getDate()).padStart(2, '0')}/
                                        {String(lastCountDate.getMonth() + 1).padStart(2, '0')}/
                                        {lastCountDate.getFullYear()} {lastCountDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                ) : (
                                    <span>טרם נספר</span>
                                )}
                                {isLowStock && <AlertTriangle size={10} className="text-red-500 animate-pulse" />}
                            </div>

                            {item.last_counted_by_name && (
                                <div className="flex items-center gap-0.5 font-bold text-slate-400 mt-1">
                                    👤 {item.last_counted_by_name}
                                </div>
                            )}

                            {/* Only show weight toggle for Vegetables (ירקות) */}
                            {wpu > 0 && item.category === 'ירקות' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsWeightMode(!isWeightMode); }}
                                    className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold hover:bg-slate-200 transition-colors self-start mt-1.5"
                                >
                                    {isWeightMode ? 'הצג יח׳' : 'הצג משקל'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 2. Steppers Row */}
                    <div className="flex items-center gap-4 shrink-0">
                        {/* Stock Stepper Container */}
                        <div className="flex items-center gap-2">
                            <CompactStepper
                                label="מלאי"
                                value={displayValue}
                                unit={displayUnit}
                                onChange={handleStockClick}
                                colorClass={isLowStock ? "text-red-500" : hasStockChange ? "text-blue-600" : "text-slate-700"}
                            />
                            <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                                {hasStockChange && (
                                    <button onClick={saveStock} className="w-9 h-9 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition-all">
                                        <Save size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Order Stepper Container */}
                        <div className="flex items-center gap-2">
                            <CompactStepper
                                label="הזמנה"
                                value={orderQty}
                                unit="יח׳"
                                onChange={handleOrderClick}
                                colorClass={orderQty > 0 ? "text-indigo-600" : "text-slate-400"}
                            />
                            <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                                {hasOrderChange && (
                                    <button onClick={saveOrder} className="w-9 h-9 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all">
                                        <ShoppingCart size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Quick Settings Action */}
                        <button
                            onClick={handleOpenEdit}
                            className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100 active:scale-90"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>



            {/* Modals persistence */}
            {
                showEditModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-black text-slate-800">ערוך פריט: {item.name}</h3>
                                    <button onClick={() => setShowEditModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500 block mb-1">שם הפריט במערכת</label>
                                        <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-slate-500 block mb-1">שם פריט אצל הספק (קטלוג)</label>
                                        <input type="text" value={editData.catalog_item_name} onChange={e => setEditData({ ...editData, catalog_item_name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">יחידת מידה</label>
                                        <select value={editData.unit} onChange={e => setEditData({ ...editData, unit: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                            <option value="יח׳">יח׳</option>
                                            <option value="ק״ג">ק״ג</option>
                                            <option value="גרם">גרם</option>
                                            <option value="ליטר">ליטר</option>
                                            <option value="מ״ל">מ״ל</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 block mb-1">מיקום</label>
                                        <input type="text" value={editData.location} onChange={e => setEditData({ ...editData, location: e.target.value })} placeholder="למשל: מחסן, מדף 1" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 block">עלות ליחידה (₪)</label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={editData.cost_per_unit}
                                            onChange={e => setEditData({ ...editData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                                            className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:outline-none focus:border-blue-400 text-sm [appearance:textfield]"
                                        />
                                    </div>
                                    <NumberStepper
                                        label="התראת מלאי נמוך"
                                        value={editData.low_stock_alert}
                                        onChange={val => setEditData({ ...editData, low_stock_alert: val })}
                                    />
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-xs font-bold text-slate-500 block">קפיצות ספירה</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[0.1, 0.25, 0.5, 1, 10].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setEditData({ ...editData, count_step: val })}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${editData.count_step === val ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400'}`}
                                                >
                                                    {val}
                                                </button>
                                            ))}
                                            <div className="flex-1 min-w-[60px]">
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={editData.count_step}
                                                    onChange={e => setEditData({ ...editData, count_step: parseFloat(e.target.value) || 1 })}
                                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="אחר"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <NumberStepper
                                        label="קפיצות הזמנה"
                                        value={editData.order_step}
                                        onChange={val => setEditData({ ...editData, order_step: val, min_order: val })}
                                        min={1}
                                    />
                                    <NumberStepper
                                        label="מינימום הזמנה"
                                        value={editData.min_order}
                                        onChange={val => setEditData({ ...editData, min_order: val })}
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-slate-500 block">משקל ליחידה (גרם)</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={editData.weight_per_unit}
                                            onChange={e => setEditData({ ...editData, weight_per_unit: parseFloat(e.target.value) || 0 })}
                                            className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 focus:outline-none focus:border-blue-400 text-sm [appearance:textfield]"
                                        />
                                    </div>
                                    <NumberStepper
                                        label="אחוז ניצול (%)"
                                        value={editData.yield_percentage}
                                        onChange={val => setEditData({ ...editData, yield_percentage: val })}
                                        step={5}
                                        min={1}
                                    />
                                </div>

                                <button onClick={handleSaveEdit} disabled={saving} className="w-full mt-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
                                    {saving ? 'שומר...' : 'שמור שינויים'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {
                showDeleteAuth && (
                    <ManagerAuthModal
                        isOpen={true}
                        onClose={() => setShowDeleteAuth(false)}
                        onSuccess={() => { setShowDeleteAuth(false); onDelete && onDelete(item.id); }}
                        title="אישור מנהל למחיקת פריט"
                    />
                )
            }
        </>
    );
};

InventoryItemCard.propTypes = {
    item: PropTypes.object.isRequired,
    onStockChange: PropTypes.func,
    onOrderChange: PropTypes.func,
    onUpdate: PropTypes.func,
    onDelete: PropTypes.func,
    draftOrderQty: PropTypes.number
};

export default React.memo(InventoryItemCard);
