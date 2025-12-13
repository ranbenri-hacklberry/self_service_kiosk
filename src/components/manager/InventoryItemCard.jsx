import React, { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, ChevronUp, History, CheckCircle2, Minus, Plus, ShoppingCart } from 'lucide-react';

const InventoryItemCard = ({ item, onStockChange, onOrderChange, draftOrderQty = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStock, setCurrentStock] = useState(Number(item.current_stock) || 0);
    const [orderQty, setOrderQty] = useState(draftOrderQty);
    const [updating, setUpdating] = useState(false);

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
    const isUnitItem = ['unit', 'יח׳', 'יחידה', 'item', 'piece'].some(u => unitLower === u || unitLower.startsWith(u)); // Flexible match

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
    const lastCountDate = item.last_counted_at ? new Date(item.last_counted_at) : null;
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
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${isExpanded ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
            >
                {/* Right: Item Info */}
                <div className="flex items-center gap-4 overflow-hidden flex-1">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 transition-colors ${item.current_stock <= (item.low_stock_alert || 5) ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'} `}>
                        <Package size={24} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="font-black text-gray-800 text-base truncate leading-tight">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{item.unit || 'יח׳'}</span>
                            {item.supplier && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{item.supplier.name}</span>}
                        </div>
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
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-400 flex items-center gap-2">
                                <History size={12} />
                                עדכון ספירה (מלאי נוכחי)
                            </span>
                            {updating && <span className="text-[10px] text-blue-500 font-bold animate-pulse">שומר...</span>}
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
        </div>
    );
};

export default React.memo(InventoryItemCard);
