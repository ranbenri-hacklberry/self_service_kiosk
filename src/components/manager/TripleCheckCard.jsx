import React, { useState, useMemo, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
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
    invoicedQty = 0,
    actualQty = 0,
    onActualChange,
    unitPrice = 0,
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
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // Debounce search query (300ms for iPad M1 performance)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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
    const formatQtyWithUnit = (qty, unitStr, showUnit = true) => {
        if (qty === null || qty === undefined) return '-';
        const num = parseFloat(qty);
        if (isNaN(num)) return '-';

        const lowerUnit = (unitStr || '').toLowerCase().trim();
        const isGram = lowerUnit === 'גרם' || lowerUnit === 'g' || lowerUnit === 'gram';

        if (isGram) {
            const kg = num / 1000;
            // Always divide by 1000 for weight-based items to show KG
            return showUnit ? `${formatValue(kg)} ק״ג` : formatValue(kg);
        }

        // Hide units for "יח׳" or similar generic units and trailing apostrophes
        const isGeneric = ['יח׳', 'יחידה', 'יח', 'units', 'unit', 'pcs', 'pc'].some(u => lowerUnit.includes(u)) ||
            !unitStr ||
            ['\'', '׳'].includes(lowerUnit);
        if (isGeneric || !showUnit) {
            return formatValue(num);
        }

        return `${formatValue(num)} ${unitStr}`;
    };

    const totalValue = formatValue(actualQty * (unitPrice || 0));

    // Check if name is long (>4 words) for multi-line display
    const nameParts = item.name.split(' ');
    const isLongName = nameParts.length > 4;

    const hasOrderValue = orderedQty !== null;
    const gridCols = hasOrderValue
        ? "grid-cols-[3fr_80px_80px_130px_1fr]"
        : "grid-cols-[3fr_80px_130px_1fr]";

    // Get top 10 closest matching items from catalog (uses debounced query for performance)
    const suggestedItems = useMemo(() => {
        if (!catalogItems.length) return [];

        const invoiceName = item.name.toLowerCase().trim();
        const query = debouncedQuery.toLowerCase().trim();

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

        // Filter out items with 0 score, sort by score, take top 20
        // FIX: Lower threshold for search queries to show more results
        return scored
            .filter(item => item.score > (query ? 0 : 40)) // Show anything matching query, but only good matches for auto-suggest
            .sort((a, b) => b.score - a.score)
            .slice(0, 20); // Increased from 10 to 20
    }, [catalogItems, item.name, debouncedQuery]);

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
            {/* Responsive Layout: Vertical on mobile, Grid on desktop */}
            <div className={`flex flex-col md:grid md:${gridCols} gap-3 md:gap-4 items-stretch md:items-center`}>

                {/* Column 1: Item Name */}
                <div className="flex flex-col min-w-0 mb-2 md:mb-0">
                    <span className="text-[10px] text-slate-400 mb-1">פריט</span>
                    <div className="flex items-start gap-2">
                        <Package size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col min-w-0 flex-1">
                            {/* Line 1: Invoice name */}
                            <span className={`font-bold text-base md:text-sm text-slate-800 ${isLongName ? '' : 'truncate'}`}>
                                {item.name}
                            </span>

                            {/* Line 2: System/Catalog name */}
                            {catalogItemName && catalogItemName !== item.name ? (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-xs md:text-[11px] text-green-700 font-medium truncate">
                                        במערכת: {catalogItemName}
                                    </span>
                                    {onCatalogItemSelect && (
                                        <button
                                            onClick={() => setShowSuggestions(!showSuggestions)}
                                            className="text-xs md:text-[10px] text-purple-600 font-bold hover:underline"
                                        >
                                            שנה
                                        </button>
                                    )}
                                </div>
                            ) : isNew && onCatalogItemSelect ? (
                                <button
                                    onClick={() => setShowSuggestions(!showSuggestions)}
                                    className="flex items-center gap-1 mt-0.5 text-xs md:text-[11px] text-purple-600 font-medium hover:text-purple-700"
                                >
                                    <Search size={12} />
                                    בחר פריט מהמערכת
                                    <ChevronDown size={12} className={`transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
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

                    {/* Suggestions Dropdown (Floating on mobile) */}
                    {showSuggestions && onCatalogItemSelect && (
                        <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden max-h-[300px] z-50">
                            <div className="p-2 border-b border-gray-100">
                                <input
                                    type="text"
                                    placeholder="חפש פריט..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400"
                                    autoFocus
                                />
                            </div>
                            <div className="overflow-y-auto max-h-[200px]">
                                {suggestedItems.length > 0 ? (
                                    <>
                                        {/* Option: Create New Item (Don't Map) */}
                                        <button
                                            onClick={() => handleSelectCatalogItem(null)}
                                            className="w-full px-4 py-3 text-right text-sm hover:bg-purple-50 transition-colors flex items-center gap-2 border-b border-gray-100 text-purple-600 font-bold bg-purple-50/50"
                                        >
                                            <Sparkles size={16} />
                                            <span>צור כפריט חדש</span>
                                        </button>

                                        {suggestedItems.map((sugItem) => (
                                            <button
                                                key={sugItem.id}
                                                onClick={() => handleSelectCatalogItem(sugItem)}
                                                className={`w-full px-4 py-3 text-right text-sm hover:bg-purple-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-0 ${catalogItemId === sugItem.id ? 'bg-purple-100' : ''}`}
                                            >
                                                <div className="flex flex-col items-start min-w-0">
                                                    <span className="truncate font-bold">{sugItem.name}</span>
                                                    <span className="text-[11px] text-gray-500">
                                                        {formatQtyWithUnit(sugItem.inventory_count_step || 1, sugItem.unit)}
                                                        {sugItem.category && ` • ${sugItem.category}`}
                                                    </span>
                                                </div>
                                                {catalogItemId === sugItem.id && (
                                                    <Check size={16} className="text-purple-600 shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                        לא נמצאו תוצאות
                                        <button
                                            onClick={() => handleSelectCatalogItem(null)}
                                            className="block w-full mt-2 text-purple-600 font-bold hover:underline"
                                        >
                                            צור כפריט חדש
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="p-2 border-t border-gray-100 bg-gray-50">
                                <button
                                    onClick={() => handleSelectCatalogItem(null)}
                                    className="w-full px-2 py-2 text-sm text-purple-600 font-bold hover:bg-purple-100 rounded-lg transition-colors"
                                >
                                    השאר כפריט חדש
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Row: Info Group (Ordered/Invoiced/Total) */}
                <div className="flex items-center justify-between md:contents mb-3 md:mb-0 bg-slate-50 md:bg-transparent p-2 md:p-0 rounded-lg">
                    {/* Ordered */}
                    {hasOrderValue && (
                        <div className="flex flex-col items-center flex-1">
                            <span className="text-[10px] text-slate-400 md:mb-1">הוזמן</span>
                            <span className="font-bold text-sm text-slate-600">{formatQtyWithUnit(orderedQty, item.unit)}</span>
                        </div>
                    )}

                    {/* Invoiced */}
                    <div className="flex flex-col items-center flex-1 border-x border-gray-200 md:border-0">
                        <span className="text-[10px] text-blue-500 md:mb-1">חשבונית</span>
                        <span className="font-bold text-sm text-blue-700">
                            {invoicedQty !== null ? formatQtyWithUnit(invoicedQty, item.unit) : '—'}
                        </span>
                    </div>

                    {/* Price/Total - desktop only column 5 logic moved here for mobile */}
                    <div className="flex flex-col items-end flex-1 md:hidden">
                        <span className="text-[10px] text-slate-400">סה״כ</span>
                        <span className="font-black text-sm text-slate-800">₪{totalValue}</span>
                    </div>
                </div>

                {/* Actual Column (Always prominent) */}
                <div className="flex flex-col items-center bg-green-50/50 md:bg-transparent p-2 md:p-0 rounded-xl border border-green-100 md:border-0">
                    <span className="text-[10px] text-green-600 mb-2 md:mb-1 font-bold md:font-normal">דיווח בפועל</span>
                    <div className="flex items-center gap-3 md:gap-1">
                        <button
                            type="button"
                            disabled={actualQty <= 0}
                            onClick={() => {
                                const step = countStep || 1;
                                const nearestBelow = Math.floor(actualQty / step) * step;
                                const newVal = (Math.abs(actualQty - nearestBelow) < 0.001) ? nearestBelow - step : nearestBelow;
                                onActualChange(Math.max(0, newVal));
                            }}
                            className={`w-10 h-10 md:w-8 md:h-8 rounded-xl md:rounded-lg flex items-center justify-center transition-all ${actualQty <= 0 ? 'bg-slate-200 text-slate-400' : 'bg-red-500 text-white shadow-sm'}`}
                        >
                            <Minus className="w-5 h-5 md:w-4 md:h-4" strokeWidth={3} />
                        </button>

                        <div className="w-20 md:w-12 text-center">
                            <span className="font-mono text-xl md:text-sm font-black text-slate-800">
                                {formatQtyWithUnit(actualQty, item.unit, false)}
                            </span>
                            <div className="text-[9px] text-slate-400 font-bold md:hidden mt-0.5">{item.unit || 'יח׳'}</div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const step = countStep || 1;
                                const nearestAbove = Math.ceil(actualQty / step) * step;
                                const newVal = (Math.abs(actualQty - nearestAbove) < 0.001) ? nearestAbove + step : nearestAbove;
                                onActualChange(newVal);
                            }}
                            className="w-10 h-10 md:w-8 md:h-8 rounded-xl md:rounded-lg flex items-center justify-center bg-green-500 text-white shadow-sm active:scale-95 transition-all"
                        >
                            <Plus className="w-5 h-5 md:w-4 md:h-4" strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* Desktop-only Final Column */}
                <div className="hidden md:flex flex-col items-end min-w-0">
                    <div className="flex flex-col items-end shrink-0">
                        <span className="text-[10px] text-slate-400 mb-0.5">סה״כ</span>
                        <span className="font-bold text-sm text-slate-800 whitespace-nowrap">₪{totalValue}</span>
                    </div>
                    {hasPriceVariance && (
                        <span className="text-[8px] text-orange-600 font-bold" title={`מחיר קטלוגי: ₪${catalogPrice}`}>
                            (₪{formatValue((item.unit || '').toLowerCase().includes('גרם') ? catalogPrice * 1000 : catalogPrice)} קודם)
                        </span>
                    )}
                    {(hasActualVariance || hasPriceVariance) && (
                        <AlertTriangle size={12} className="text-orange-500 mt-1" />
                    )}
                </div>
            </div>
        </div>
    );
};

// PropTypes for type safety
TripleCheckCard.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string.isRequired,
        unit: PropTypes.string,
    }).isRequired,
    orderedQty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    invoicedQty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    actualQty: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onActualChange: PropTypes.func,
    unitPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    catalogPrice: PropTypes.number,
    catalogItemName: PropTypes.string,
    catalogItemId: PropTypes.string,
    isNew: PropTypes.bool,
    countStep: PropTypes.number,
    catalogItems: PropTypes.array,
    onCatalogItemSelect: PropTypes.func,
};


export default React.memo(TripleCheckCard);
