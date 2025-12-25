import React, { useMemo } from 'react';
import { Trash2, ShoppingBag, Edit2, CreditCard, ArrowRight, RefreshCw, Clock, UserPlus, Check, Phone, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

const formatPrice = (price = 0) => {
    // מחזיר רק את המספר ללא סימן שקל - בטוח מ-NaN
    const num = Number(price);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(num);
};

// Memoized CartItem to prevent unnecessary re-renders
const CartItem = React.memo(({ item, onRemove, onEdit, onToggleDelay, isRestrictedMode }) => {
    const cleanName = item.name ? item.name.replace(/<[^>]+>/g, '').trim() : '';

    // Parse modifiers for display - remove duplicates
    const mods = useMemo(() => {
        let rawMods = [];
        if (Array.isArray(item.selectedOptions)) {
            rawMods = item.selectedOptions;
        } else if (item.mods) {
            try {
                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                if (Array.isArray(parsed)) rawMods = parsed;
                else if (typeof parsed === 'object') rawMods = Object.values(parsed);
            } catch (e) {
                console.error('SmartCart: Failed to parse item.mods', { itemId: item.id || item.tempId, modsString: item.mods, error: e });
                rawMods = []; // fallback בטוח
            }
        }

        const modNames = rawMods
            .map(m => {
                if (typeof m === 'object') return m.valueName || m.name;
                return m;
            })
            .filter(Boolean)
            .filter(modName => {
                const lower = String(modName).toLowerCase();
                return !lower.includes('רגיל') &&
                    !lower.includes('default') &&
                    !lower.includes('standard') &&
                    lower.trim() !== '';
            });

        return [...new Set(modNames)];
    }, [item]);

    return (
        <div
            onClick={() => !isRestrictedMode && onEdit?.(item)}
            className={`group flex items-center justify-between bg-white px-[5px] py-3 border-b border-gray-100 transition-colors gap-[5px] ${item.isDelayed ? 'bg-amber-50/50' : ''} ${!isRestrictedMode ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
        >
            {/* Right Side: Quantity + Name + Mods */}
            <div className="flex-1 flex flex-col items-start min-w-0">
                <div className="flex items-center gap-[5px] w-full">
                    {item.quantity > 1 && (
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-1 rounded border border-orange-200 shrink-0">
                            x{item.quantity}
                        </span>
                    )}
                    <span className={`font-bold text-base truncate leading-tight ${item.isDelayed ? 'text-amber-800' : 'text-gray-800'}`}>
                        {cleanName}
                    </span>
                    {onEdit && !isRestrictedMode && (
                        <Edit2 size={14} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                    <span className="font-mono font-bold text-gray-900 text-base shrink-0 mr-auto">
                        {formatPrice(item.price * item.quantity)}
                    </span>
                </div>

                {/* Mods in a single line if possible */}
                {mods.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pr-0.5">
                        {mods.map((mod, i) => {
                            const shortName = getShortName(mod);
                            if (!shortName) return null; // Hide default mods
                            return (
                                <span key={i} className={`mod-label ${getModColorClass(mod, shortName)}`} title={mod}>
                                    {shortName}
                                </span>
                            );
                        })}
                    </div>
                )}

                {item.notes && (
                    <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                        <Edit2 size={10} />
                        {item.notes}
                    </p>
                )}
            </div>

            {/* Left Side: Actions */}
            <div className="flex items-center gap-2 pl-1">
                {/* Delay Toggle Button */}
                {onToggleDelay && !isRestrictedMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleDelay(item.id, item.signature); }}
                        className={`p-3 rounded-xl transition-all shrink-0 shadow-sm border active:scale-95 ${item.isDelayed
                            ? 'text-white bg-amber-500 border-amber-600 hover:bg-amber-600 shadow-amber-200'
                            : 'text-gray-400 bg-white border-gray-200 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200'
                            }`}
                        title={item.isDelayed ? "הכן עכשיו" : "הגש אחר כך (מנה שניה)"}
                    >
                        <Clock size={24} strokeWidth={2.5} className={item.isDelayed ? "fill-white/20" : ""} />
                    </button>
                )}

                {onRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(item.id, item.signature); }}
                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors shrink-0"
                    >
                        <Trash2 size={24} strokeWidth={2} />
                    </button>
                )}
            </div>
        </div>
    );
});

const SmartCart = ({
    cartItems = [],
    onRemoveItem,
    onUndoCart,
    onEditItem,
    onInitiatePayment,
    onToggleDelay,
    onAddCustomerDetails,
    className = '',
    isEditMode = false,
    editingOrderData,
    disabled = false,
    customerName,
    customerPhone, // Added
    loyaltyDiscount = 0,
    finalTotal,
    loyaltyPoints = 0,
    loyaltyFreeCoffees = 0,
    cartHistory = [],
    orderNumber,
    isRestrictedMode = false // New prop
}) => {

    // --- Calculations ---
    const currentTotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

    // Split items into active and delayed
    const activeItems = useMemo(() => cartItems.filter(i => !i.isDelayed), [cartItems]);
    const delayedItems = useMemo(() => cartItems.filter(i => i.isDelayed), [cartItems]);

    // Use passed finalTotal if available, otherwise calculate
    const effectiveTotal = finalTotal !== undefined ? finalTotal : currentTotal;

    console.log('🔍 SmartCart finalTotal check:', {
        finalTotal,
        currentTotal,
        effectiveTotal,
        loyaltyDiscount
    });

    const originalTotal = editingOrderData?.originalTotal || 0;
    const originalIsPaid = editingOrderData?.isPaid || false;

    // For edit mode, compare against the amount actually paid (after all discounts including loyalty)
    // originalTotal already contains the post-discount amount from the DB
    const originalPaidAmount = editingOrderData?.originalPaidAmount ?? originalTotal;
    const priceDifference = effectiveTotal - originalPaidAmount;

    // --- Status Logic ---
    // --- Status Logic ---
    const isRefund = isEditMode && originalIsPaid && priceDifference < 0;
    const isAdditionalCharge = isEditMode && originalIsPaid && priceDifference > 0;
    const isNoChange = isEditMode && originalIsPaid && priceDifference === 0;
    // New: Cancel Order if Unpaid + Empty
    const isCancelOrder = isEditMode && !originalIsPaid && cartItems.length === 0;

    console.log('🛒 SmartCart Debug:', {
        isEditMode,
        originalIsPaid,
        originalTotal,
        effectiveTotal,
        priceDifference,
        isRefund,
        isCancelOrder,
        cartItemsCount: cartItems.length
    });

    // האם בוצע שינוי כלשהו מאז פתיחת העריכה?
    const hasChanges = cartHistory.length > 0;

    // מצב שבו אין שינוי במחיר בעריכה
    const isNoPriceChange = isEditMode && priceDifference === 0;

    // אפשר לחיצה אם זה זיכוי, אם זה ביטול, או אם יש שינוי כלשהו (גם אם המחיר לא השתנה אבל יש היסטוריה)
    const isDisabled = disabled ||
        (cartItems.length === 0 && !isRefund && !isCancelOrder) ||
        (isEditMode && isNoPriceChange && !hasChanges);

    // DEBUG: Log status decision values
    console.log('🎯 SmartCart Status Decision:', {
        isDisabled,
        isRefund,
        isAdditionalCharge,
        isNoChange,
        isCancelOrder,
        isEditMode,
        originalIsPaid,
        priceDifference
    });

    // --- UI Config ---
    const statusConfig = useMemo(() => {
        // עגלה ריקה באמת (לא בעריכה של הזמנה קיימת)
        if (cartItems.length === 0 && !isEditMode) return {
            text: 'העגלה ריקה',
            subtext: 'הוסף פריטים כדי להמשיך',
            color: 'bg-gray-100 text-gray-400',
            buttonColor: 'bg-gray-200 text-gray-400 cursor-not-allowed',
            icon: ShoppingBag,
            amount: null
        };

        if (isCancelOrder) return {
            text: 'בטל הזמנה',
            subtext: 'העגלה ריקה - ביטול ימחק את ההזמנה',
            color: 'bg-red-50 border-red-100',
            buttonColor: 'bg-red-500 hover:bg-red-600 text-white shadow-red-200',
            amount: null,
            icon: Trash2
        };

        if (isRefund) return {
            text: 'החזר ללקוח',
            subtext: `החזר כספי על סך ${formatPrice(Math.abs(priceDifference))}`,
            color: 'bg-red-50 border-red-100',
            buttonColor: 'bg-red-500 hover:bg-red-600 text-white shadow-red-200',
            amount: Math.abs(priceDifference),
            icon: RefreshCw
        };

        if (isAdditionalCharge) return {
            text: 'חיוב נוסף',
            subtext: `תוספת לתשלום: ${formatPrice(priceDifference)}`,
            color: 'bg-blue-50 border-blue-100',
            buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
            amount: priceDifference,
            icon: CreditCard
        };

        if (isNoPriceChange && isEditMode) return {
            text: originalIsPaid ? 'שולם' : 'עדכון הזמנה',
            subtext: hasChanges ? 'לחץ לשמירת שינויים' : 'ללא שינוי במחיר',
            color: 'bg-white',
            buttonColor: hasChanges
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            amount: effectiveTotal,
            icon: originalIsPaid ? Check : Edit2
        };

        return {
            text: 'לתשלום',
            subtext: `${itemCount} פריטים`,
            color: 'bg-white',
            buttonColor: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
            amount: effectiveTotal,
            icon: ArrowRight
        };
    }, [isDisabled, isRefund, isAdditionalCharge, isNoPriceChange, isEditMode, priceDifference, effectiveTotal, itemCount, editingOrderData, originalIsPaid, originalTotal, cartItems.length, hasChanges]);

    const handleAction = () => {
        if (!isDisabled && onInitiatePayment) {
            onInitiatePayment();
        }
    };

    // Calculate dynamic loyalty count
    const points = loyaltyPoints ?? 0;
    const credits = loyaltyFreeCoffees ?? 0;

    const showCredits = credits > 0;
    const progressToNext = points % 10;

    // Helper to determine if we have a REAL customer (ignoring "Quick Order" placeholder)
    const hasRealCustomer = customerName && customerName !== 'הזמנה מהירה';

    // DEBUG: Check why button isn't showing
    console.log('🛒 SmartCart Debug:', {
        hasCustomerName: !!customerName,
        customerName,
        hasRealCustomer,
        hasAddHandler: !!onAddCustomerDetails
    });

    return (
        <div className={`flex flex-col h-full bg-white ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-white z-10 shadow-sm">
                {/* Single row header */}
                <div className="flex items-center gap-2">
                    {/* Icon */}
                    <div className="bg-orange-100 p-2 rounded-xl flex-shrink-0">
                        <ShoppingBag className="w-5 h-5 text-orange-600" />
                    </div>

                    {/* Customer name if exists */}
                    {hasRealCustomer && (
                        <h2 className="text-xl font-black text-gray-800 tracking-tight flex-shrink-0">
                            {customerName}
                        </h2>
                    )}

                    {/* Order number if no customer but has order number */}
                    {!hasRealCustomer && orderNumber && (
                        <h2 className="text-xl font-black text-gray-800 tracking-tight flex-shrink-0">
                            #{orderNumber}
                        </h2>
                    )}

                    {/* Case 1: No customer - Show two buttons */}
                    {!hasRealCustomer && onAddCustomerDetails && (
                        <>
                            <button
                                onClick={() => onAddCustomerDetails('phone-then-name')}
                                className="px-3 py-1.5 rounded-lg bg-orange-500 text-white border border-orange-600 shadow-sm hover:shadow-md hover:bg-orange-600 transition-all duration-200 active:scale-95 font-bold text-xs flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                            >
                                <Phone size={12} />
                                הוסף טלפון + שם
                            </button>
                            <button
                                onClick={() => onAddCustomerDetails('name')}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-200 transition-all duration-200 active:scale-95 font-bold text-xs flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                            >
                                <User size={12} />
                                הוסף שם בלבד
                            </button>
                        </>
                    )}

                    {/* Case 2: Has name but no phone */}
                    {hasRealCustomer && !customerPhone && onAddCustomerDetails && (
                        <button
                            onClick={() => onAddCustomerDetails('phone')}
                            className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 shadow-sm hover:shadow-md hover:bg-blue-200 transition-all duration-200 active:scale-95 font-bold text-xs flex items-center gap-1 flex-shrink-0"
                        >
                            <Phone size={12} />
                            הוסף טלפון
                        </button>
                    )}

                    {/* Case 3: Has phone + name - Show phone and edit */}
                    {hasRealCustomer && customerPhone && onAddCustomerDetails && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                                <Phone size={10} />
                                {customerPhone}
                            </span>
                            <button
                                onClick={() => onAddCustomerDetails('phone-then-name')}
                                className="text-xs text-blue-600 hover:underline font-medium"
                            >
                                ערוך
                            </button>
                        </div>
                    )}

                    {/* Order number badge if has customer */}
                    {orderNumber && hasRealCustomer && (
                        <div className="bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 flex-shrink-0 mr-auto">
                            <span className="text-sm font-black text-blue-700">#{orderNumber}</span>
                        </div>
                    )}
                </div>

                {/* Loyalty Badge - Below main row */}
                {hasRealCustomer && (() => {
                    // Calculate projected points
                    let cartCoffeeCount = cartItems.reduce((sum, item) =>
                        item.is_hot_drink ? sum + (item.quantity || 1) : sum, 0);

                    // In edit mode where original had discount, only count NEW items
                    const originalHadDiscount = isEditMode && editingOrderData?.originalRedeemedCount > 0;
                    if (originalHadDiscount) {
                        const originalCoffeeCount = editingOrderData?.originalItems
                            ?.filter(i => i.is_hot_drink)
                            ?.reduce((sum, i) => sum + i.quantity, 0) || 0;
                        // Only count items BEYOND the original
                        cartCoffeeCount = Math.max(0, cartCoffeeCount - originalCoffeeCount);
                    }

                    // Current state
                    const currentPoints = loyaltyPoints ?? 0;
                    const currentCredits = loyaltyFreeCoffees ?? 0;

                    let displayContent;
                    let badgeStyle;

                    // Special Case: User has exactly 1 credit and no points (Standard "Free Coffee Waiting" state)
                    if (currentCredits === 1 && currentPoints === 0) {
                        if (cartCoffeeCount === 0) {
                            // Has credit, cart empty -> "9/10 Next is Free"
                            displayContent = (
                                <>
                                    <span>☕</span>
                                    <span>9/10 הקפה הבא חינם!</span>
                                </>
                            );
                            badgeStyle = 'bg-orange-50 text-orange-700 border-orange-100';
                        } else {
                            // Has credit, item in cart -> "10/10 You get it free!"
                            displayContent = (
                                <>
                                    <span>🎉</span>
                                    <span>10/10 מגיע לך קפה חינם!</span>
                                </>
                            );
                            badgeStyle = 'bg-green-50 text-green-700 border-green-100 animate-pulse';
                        }
                    }
                    // Case: Multiple credits
                    else if (currentCredits > 0) {
                        displayContent = (
                            <>
                                <span>🎁</span>
                                <span>יש לך {currentCredits} קפה חינם!</span>
                            </>
                        );
                        badgeStyle = 'bg-purple-50 text-purple-700 border-purple-100';
                    }
                    // Case: No credits, accumulating points
                    else {
                        const totalPoints = currentPoints + cartCoffeeCount;

                        if (totalPoints >= 10) {
                            displayContent = (
                                <>
                                    <span>🎉</span>
                                    <span>10/10 מגיע לך קפה חינם!</span>
                                </>
                            );
                            badgeStyle = 'bg-green-50 text-green-700 border-green-100 animate-pulse';
                        } else if (totalPoints === 9) {
                            displayContent = (
                                <>
                                    <span>☕</span>
                                    <span>9/10 הקפה הבא חינם!</span>
                                </>
                            );
                            badgeStyle = 'bg-orange-50 text-orange-700 border-orange-100';
                        } else {
                            displayContent = (
                                <>
                                    <span>☕</span>
                                    <span>{totalPoints}/10 לקפה חינם</span>
                                </>
                            );
                            badgeStyle = 'bg-orange-50 text-orange-700 border-orange-100';
                        }
                    }

                    return (
                        <div className="mt-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit ${badgeStyle}`}>
                                {displayContent}
                            </span>
                        </div>
                    );
                })()}
            </div>


            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                        <ShoppingBag size={48} className="text-gray-300 mb-4" />
                        <p className="text-gray-500 font-medium">העגלה ריקה</p>
                        <p className="text-sm text-gray-400">התחל להוסיף פריטים מהתפריט</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {/* Active Items */}
                        {activeItems.map(item => {
                            const itemId = item.tempId || item.signature || uuidv4(); // fallback אחרון
                            return (
                                <CartItem
                                    key={itemId}
                                    item={item}
                                    onRemove={() => onRemoveItem(item.id, item.signature, item.tempId || itemId)}
                                    onEdit={onEditItem}
                                    onToggleDelay={() => onToggleDelay?.(item.id, item.signature, item.tempId || itemId)}
                                />
                            );
                        })}

                        {/* Divider if both lists have items */}
                        {activeItems.length > 0 && delayedItems.length > 0 && (
                            <div className="relative py-4 text-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-dashed border-amber-300"></div>
                                </div>
                                <span className="relative px-3 bg-gray-50 text-xs font-bold text-amber-600 flex items-center justify-center gap-1 mx-auto w-fit rounded-full border border-amber-200 shadow-sm">
                                    <Clock size={12} />
                                    להמשך הארוחה
                                </span>
                            </div>
                        )}

                        {/* Delayed Items */}
                        {delayedItems.map(item => {
                            const itemId = item.tempId || item.signature || uuidv4(); // fallback אחרון
                            return (
                                <CartItem
                                    key={itemId}
                                    item={item}
                                    onRemove={() => onRemoveItem(item.id, item.signature, item.tempId || itemId)}
                                    onEdit={onEditItem}
                                    onToggleDelay={() => onToggleDelay?.(item.id, item.signature, item.tempId || itemId)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer / Action Area */}
            <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">

                {/* Refund Note - only show if there are items */}
                {isRefund && cartItems.length > 0 && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-red-50 p-2 rounded-lg border border-red-100">
                        <span className="text-red-700 font-bold flex items-center gap-2 text-sm">
                            <span>↩️</span> החזר ללקוח
                        </span>
                        <span className="text-red-700 font-bold dir-ltr">
                            {formatPrice(Math.abs(priceDifference))}
                        </span>
                    </div>
                )}

                {/* Loyalty Discount Row - Don't show in edit mode if original already had discount */}
                {loyaltyDiscount > 0 && !(isEditMode && originalIsPaid && editingOrderData?.originalRedeemedCount > 0) && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-green-50 p-2 rounded-lg border border-green-100">
                        <span className="text-green-700 font-bold flex items-center gap-2 text-sm">
                            <span>🎁</span> הנחת נאמנות (קפה חינם)
                        </span>
                        <span className="text-green-700 font-bold dir-ltr">
                            -{formatPrice(loyaltyDiscount)}
                        </span>
                    </div>
                )}

                {/* Main Action Button */}
                <button
                    onClick={handleAction}
                    disabled={isDisabled}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-between px-6 ${statusConfig.buttonColor}`}
                >
                    <span>{statusConfig.text}</span>
                    {statusConfig.amount !== null && (
                        <span className="bg-white/20 px-2 py-0.5 rounded text-base">
                            {formatPrice(statusConfig.amount)}
                        </span>
                    )}
                </button>
            </div>
        </div >
    );
};

export default React.memo(SmartCart);
