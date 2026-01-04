import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Box, Truck, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function OrderPackingSidebar({
    order,
    onClose,
    onMarkItemReady,
    onFinishPacking,
    businessId
}) {
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [drivers, setDrivers] = useState([]);
    const [showDriverSelect, setShowDriverSelect] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial load: drivers
    useEffect(() => {
        const fetchDrivers = async () => {
            if (!businessId) return;

            try {
                const { data, error } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('business_id', businessId)
                    .eq('active', true);

                if (data) {
                    // Try to filter for drivers if 'role' or 'is_driver' exists
                    // Based on user request, check 'role' column specifically or look for indication
                    const likelyDrivers = data.filter(e =>
                        (e.role === 'driver' || e.role === 'courier' || e.is_driver === true || (e.job_title && e.job_title.includes('שליח')))
                    );

                    setDrivers(likelyDrivers.length > 0 ? likelyDrivers : data);
                }
            } catch (err) {
                console.error("Error fetching drivers:", err);
            }
        };

        fetchDrivers();
    }, [businessId]);

    // Sync packed state from order items
    useEffect(() => {
        if (!order) return;
        const packed = new Set();
        order.items?.forEach(item => {
            if (item.item_status === 'ready' || item.item_status === 'shipped') {
                packed.add(item.id);
            }
        });
        setSelectedItems(packed);
    }, [order]);

    const handleToggleItem = async (itemId) => {
        const item = order.items.find(i => i.id === itemId);
        if (!item) return;

        const newSelected = new Set(selectedItems);
        const isReady = newSelected.has(itemId);

        if (!isReady) {
            newSelected.add(itemId);
            setSelectedItems(newSelected);

            if (onMarkItemReady) {
                await onMarkItemReady(order.id, [itemId]);
            }
        }
    };

    const allPacked = useMemo(() => {
        if (!order?.items?.length) return false;
        return order.items.every(i => selectedItems.has(i.id));
    }, [order, selectedItems]);

    const handleComplete = () => {
        setShowDriverSelect(true);
    };

    const confirmDriver = async (driver) => {
        if (!driver) return;
        setIsSubmitting(true);
        try {
            await onFinishPacking(order.id, driver);
            onClose();
        } catch (err) {
            console.error("Error finishing packing:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {order && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40"
                    />

                    {/* Sidebar Pane (Left side as requested) */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 left-0 bottom-0 w-[400px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col font-heebo"
                        dir="rtl"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <Box size={24} className="text-blue-600" />
                                    אריזת הזמנה #{order.orderNumber}
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">{order.customerName}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Content */}
                        {!showDriverSelect ? (
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="space-y-3">
                                    {order.items?.map(item => {
                                        const isPacked = selectedItems.has(item.id);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => !isPacked && handleToggleItem(item.id)}
                                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isPacked
                                                        ? 'bg-green-50 border-green-200 shadow-sm'
                                                        : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md'
                                                    }`}
                                            >
                                                {/* Checkbox - Square style */}
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${isPacked ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-white'
                                                    }`}>
                                                    {isPacked && <Check size={20} className="text-white" strokeWidth={3} />}
                                                </div>

                                                <div className="flex-1">
                                                    <div className={`font-bold text-lg ${isPacked ? 'text-green-800' : 'text-slate-800'}`}>
                                                        {item.name}
                                                    </div>
                                                    {item.modifiers?.length > 0 && (
                                                        <div className={`text-sm mt-1 ${isPacked ? 'text-green-600' : 'text-slate-500'}`}>
                                                            {item.modifiers.map(m => m.text).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`font-mono font-bold text-lg ${isPacked ? 'text-green-600' : 'text-slate-400'}`}>
                                                    x{item.quantity}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Truck size={20} />
                                    בחר שליח לאיסוף
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {drivers.length > 0 ? (
                                        drivers.map(driver => (
                                            <button
                                                key={driver.id}
                                                onClick={() => confirmDriver(driver)}
                                                className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all text-right group"
                                            >
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                    <User size={20} className="text-slate-400 group-hover:text-blue-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{driver.name || 'ללא שם'}</div>
                                                    <div className="text-xs text-slate-400">{driver.phone || 'ללא טלפון'}</div>
                                                    {driver.role === 'driver' && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">שליח</span>}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                                            <User size={32} className="text-slate-300 mb-2" />
                                            <div className="text-slate-500 font-bold">לא נמצאו שליחים</div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                הוסף עובדים עם תפקיד "driver" בטבלת העובדים, או וודא שמותקנת העמודה המתאימה.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-6 bg-white border-t border-slate-100">
                            {!showDriverSelect ? (
                                <button
                                    onClick={handleComplete}
                                    disabled={!allPacked}
                                    className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all ${allPacked
                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl active:scale-95'
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <span>המשך לבחירת שליח</span>
                                    <Truck size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowDriverSelect(false)}
                                    className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    חזרה לרשימת הפריטים
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
