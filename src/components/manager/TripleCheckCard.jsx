import React, { useState, useMemo } from 'react';
import SmartStepper from '../ui/SmartStepper';
import { Package, AlertTriangle, Sparkles, Minus, Plus, ChevronDown, Check, Search } from 'lucide-react';

/**
 * TripleCheckCard - 3-column verification card for goods receiving
 * 
 * Columns:
 * 1. Ordered (read-only from supplier_order)
 * 2. Invoiced (read-only from OCR)
 * 3. Actual (SmartStepper for input)
 */
const TripleCheckCard = ({
    item,
    orderedQty = null,
    invoicedQty,
    actualQty,
    onActualChange,
    unitPrice,
    catalogPrice = 0,
    catalogItemName = null,
    catalogItemId = null,
    isNew = false, // New item not in catalog
    countStep = 1,
    catalogItems = [], // List of all catalog items for suggestions
    onCatalogItemSelect = null, // Callback when user selects a catalog item
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const hasOrderedVariance = orderedQty !== null && Math.abs((parseFloat(invoicedQty) || 0) - (parseFloat(orderedQty) || 0)) > 0.01;
    const hasActualVariance = Math.abs((parseFloat(actualQty) || 0) - (parseFloat(invoicedQty) || 0)) > 0.01;
    const hasPriceVariance = catalogPrice > 0 && Math.abs((parseFloat(unitPrice) || 0) - catalogPrice) > 0.1;

    // Helper to format numbers (remove .00 for integers) - with NaN check
    const formatValue = (val) => {
        if (val === null || val === undefined) return '-';
        const num = parseFloat(val);
        if (isNaN(num)) return '-';
        return num % 1 === 0 ? num.toString() : num.toFixed(2);
    };

    // Helper to format quantities with units (1000g -> 1kg) - with safe parsing
    const formatQtyWithUnit = (qty, unitStr) => {
        if (qty === null || qty === undefined) return '-';
        const num = parseFloat(qty);
        if (isNaN(num)) return '-';

        const lowerUnit = (unitStr || '').toLowerCase().trim();

        // 1000g -> 1kg
        if ((lowerUnit === 'גרם' || lowerUnit === 'g' || lowerUnit === 'gram') && num >= 1000) {
            const kg = num / 1000;
            return `${formatValue(kg)} ק״ג`;
        }

        // Hide units for "יח׳" or similar generic units and trailing apostrophes
        const isGeneric = ['יח׳', 'יחידה', 'יח', 'units', 'unit', 'pcs', 'pc'].some(u => lowerUnit.includes(u)) ||
            !unitStr ||
            ['\'', '׳'].includes(lowerUnit);
        if (isGeneric) {
            return formatValue(num);
        }

        return `${formatValue(num)} ${unitStr}`;
    };

    const totalValue = formatValue(actualQty * (unitPrice || 0));

    // Check if name is long (>4 words) for multi-line display
    const nameParts = item.name.split(' ');
    const isLongName = nameParts.length > 4;

    // Get top 10 closest matching items from catalog
    const suggestedItems = useMemo(() => {
        if (!catalogItems.length) return [];

        const invoiceName = item.name.toLowerCase().trim();
        const query = searchQuery.toLowerCase().trim();

        // Score each catalog item
        const scored = catalogItems.map(catItem => {
            const catName = catItem.name.toLowerCase();
            let score = 0;

            // If there's a search query, prioritize that
            if (query) {
                if (catName.includes(query)) {
                    score = 100 + (query.length / catName.length * 50);
                } else if (query.includes(catName)) {
                    score = 80;
                }
            } else {
                // Score based on invoice name match
                if (catName === invoiceName) {
                    score = 100;
                } else if (invoiceName.includes(catName)) {
                    score = 80 + (catName.length / invoiceName.length * 20);
                } else if (catName.includes(invoiceName)) {
                    score = 60;
                } else {
                    // Token matching
                    const invoiceTokens = invoiceName.split(/[\s,.-]+/).filter(w => w.length > 1);
                    const catTokens = catName.split(/[\s,.-]+/).filter(w => w.length > 1);
                    let matches = 0;
                    catTokens.forEach(ct => {
                        if (invoiceTokens.some(it => it.includes(ct) || ct.includes(it))) {
                            matches++;
                        }
                    });
                    if (catTokens.length > 0) {
                        score = (matches / catTokens.length) * 50;
                    }
                }
            }

            return { ...catItem, score };
        });

        // Filter out items with 0 score if searching, sort by score, take top 10
        return scored
            .filter(item => query ? item.score > 0 : true)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }, [catalogItems, item.name, searchQuery]);

    const handleSelectCatalogItem = (selectedItem) => {
        if (onCatalogItemSelect) {
            onCatalogItemSelect(item.id, selectedItem);
        }
        setShowSuggestions(false);
        setSearchQuery('');
    };

    return (
        <div
            className={`
        p-3 rounded-xl transition-all duration-200 border
        ${isNew
                    ? 'bg-purple-50 border-purple-300'
                    : (hasActualVariance || hasPriceVariance)
                        ? 'bg-orange-50 border-orange-300'
                        : 'bg-white border-slate-200'
                }
      `}
            dir="rtl"
        >
            {/* Grid Layout with Headers */}
            <div className="grid grid-cols-[3fr_80px_80px_130px_1fr] gap-3 items-center">

                {/* Column 1: Item Name - Two lines: Invoice name, then system name */}
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-slate-400 mb-1">פריט</span>
                    <div className="flex items-start gap-2">
                        <Package size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col min-w-0 flex-1">
                            {/* Line 1: Invoice name */}
                            <span className={`font-bold text-sm text-slate-800 ${isLongName ? 'line-clamp-2' : 'truncate'}`}>
                                {item.name}
                            </span>

                            {/* Line 2: System/Catalog name OR Dropdown trigger */}
                            {catalogItemName && catalogItemName !== item.name ? (
                                <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-green-700 font-medium truncate">
                                        במערכת: {catalogItemName}
                                    </span>
                                    {onCatalogItemSelect && (
                                        <button
                                            onClick={() => setShowSuggestions(!showSuggestions)}
                                            className="text-[10px] text-purple-600 hover:underline"
                                        >
                                            שנה
                                        </button>
                                    )}
                                </div>
                            ) : isNew && onCatalogItemSelect ? (
                                <button
                                    onClick={() => setShowSuggestions(!showSuggestions)}
                                    className="flex items-center gap-1 text-[11px] text-purple-600 font-medium hover:text-purple-700"
                                >
                                    <Search size={10} />
                                    בחר פריט מהמערכת
                                    <ChevronDown size={10} className={`transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                                </button>
                            ) : null}
                        </div>
                        {isNew && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded-full font-bold shrink-0">
                                <Sparkles size={10} />
                                חדש
                            </span>
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && onCatalogItemSelect && (
                        <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden max-h-[200px]">
                            {/* Search input */}
                            <div className="p-2 border-b border-gray-100">
                                <input
                                    type="text"
                                    placeholder="חפש פריט..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-purple-400"
                                    autoFocus
                                />
                            </div>
                            {/* Suggestions list */}
                            <div className="overflow-y-auto max-h-[140px]">
                                {suggestedItems.length > 0 ? (
                                    suggestedItems.map((sugItem) => (
                                        <button
                                            key={sugItem.id}
                                            onClick={() => handleSelectCatalogItem(sugItem)}
                                            className={`w-full px-3 py-2 text-right text-sm hover:bg-purple-50 transition-colors flex items-center justify-between ${catalogItemId === sugItem.id ? 'bg-purple-100' : ''
                                                }`}
                                        >
                                            <div className="flex flex-col items-start min-w-0">
                                                <span className="truncate font-medium">{sugItem.name}</span>
                                                <span className="text-[10px] text-gray-500">
                                                    {formatQtyWithUnit(sugItem.inventory_count_step || 1, sugItem.unit)}
                                                    {sugItem.category && ` • ${sugItem.category}`}
                                                </span>
                                            </div>
                                            {catalogItemId === sugItem.id && (
                                                <Check size={14} className="text-purple-600 shrink-0" />
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-sm text-gray-400 text-center">
                                        לא נמצאו תוצאות
                                    </div>
                                )}
                            </div>
                            {/* Create new option */}
                            <div className="p-2 border-t border-gray-100 bg-gray-50">
                                <button
                                    onClick={() => {
                                        handleSelectCatalogItem(null); // null = keep as new
                                    }}
                                    className="w-full px-2 py-1 text-sm text-purple-600 font-medium hover:bg-purple-100 rounded transition-colors"
                                >
                                    השאר כפריט חדש
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Column 2: Ordered */}
                {orderedQty !== null ? (
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-400 mb-1">הוזמן</span>
                        <span className="font-bold text-sm text-slate-600">{formatQtyWithUnit(orderedQty, item.unit)}</span>
                    </div>
                ) : (
                    <div className="w-[80px]"></div>
                )}

                {/* Column 3: Invoiced (or placeholder if no invoice) */}
                {invoicedQty !== null ? (
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-blue-500 mb-1">חשבונית</span>
                        <span className="font-bold text-sm text-blue-700">{formatQtyWithUnit(invoicedQty, item.unit)}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-orange-400 mb-1">ללא חשבונית</span>
                        <span className="font-bold text-sm text-orange-400">—</span>
                    </div>
                )}

                {/* Column 4: Actual with mini stepper */}
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-green-600 mb-1">בפועל</span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={actualQty <= 0}
                            onClick={() => {
                                // Smart step down: snap to nearest step below
                                const step = countStep || 1;
                                const nearestBelow = Math.floor(actualQty / step) * step;
                                // If already aligned, subtract step. If not aligned, snap down.
                                const newVal = (Math.abs(actualQty - nearestBelow) < 0.001)
                                    ? nearestBelow - step
                                    : nearestBelow;
                                onActualChange(Math.max(0, newVal));
                            }}
                            className={`
                                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                                ${actualQty <= 0
                                    ? 'bg-slate-200 text-slate-400'
                                    : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                                }
                            `}
                        >
                            <Minus size={16} strokeWidth={3} />
                        </button>

                        <span className="font-black text-sm text-slate-800 min-w-[35px] text-center">
                            {formatQtyWithUnit(actualQty, item.unit)}
                        </span>

                        <button
                            type="button"
                            onClick={() => {
                                // Smart step up: snap to nearest step above
                                const step = countStep || 1;
                                const nearestAbove = Math.ceil(actualQty / step) * step;
                                // If already aligned, add step. If not aligned, snap up.
                                const newVal = (Math.abs(actualQty - nearestAbove) < 0.001)
                                    ? nearestAbove + step
                                    : nearestAbove;
                                onActualChange(newVal);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all"
                        >
                            <Plus size={16} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* Column 5: Unit Price + Line Total */}
                <div className="flex flex-col items-end min-w-0">
                    {unitPrice > 0 && (
                        <>
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-[10px] text-slate-400 mb-0.5">מחיר</span>
                                <span className="text-[11px] text-slate-500 font-medium">₪{formatValue(unitPrice)}</span>
                                <span className="font-bold text-sm text-slate-800 whitespace-nowrap mt-0.5">₪{totalValue}</span>
                            </div>
                            {hasPriceVariance && (
                                <span className="text-[8px] text-orange-600 font-bold" title={`מחיר קטלוגי: ₪${catalogPrice}`}>
                                    (קטלוג: ₪{formatValue(catalogPrice)})
                                </span>
                            )}
                        </>
                    )}
                    {(hasActualVariance || hasPriceVariance) && (
                        <AlertTriangle size={12} className="text-orange-500 mt-1" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default TripleCheckCard;
