import React, { useMemo } from 'react';
import { Trash2, ShoppingBag, Edit2, CreditCard, ArrowRight, RefreshCw, Clock, UserPlus, Check, Phone, User, Truck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

/**
 * ⚠️⚠️⚠️ WARNING - DO NOT EDIT ⚠️⚠️⚠️
 * 🚨🚨🚨 אין לערוך קובץ זה ללא אישור מפורש של המשתמש! 🚨🚨🚨
 * 🔒 LOCKED FILE - Changes require explicit user approval
 * 📆 Last approved edit: 2025-12-30
 */
const PAYMENT_LABELS = {
    cash: 'מזומן',
    credit_card: 'אשראי',
    bit: 'ביט',
    paybox: 'פייבוקס',
    gift_card: 'שובר',
    oth: 'ע״ח הבית',
};

const formatPrice = (price = 0) => {
    // מחזיר מספר עם אגורות אם יש (לדוגמה: 8.10)
    const num = Number(price);
    if (isNaN(num)) return '0';
    // If it has decimals, show 2 decimal places. Otherwise show as integer.
    const hasDecimals = num % 1 !== 0;
    return new Intl.NumberFormat('he-IL', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2
    }).format(num);
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
    onSetDelivery, // NEW: Handler for delivery address
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
    isRestrictedMode = false, // New prop
    // Soldier discount props
    soldierDiscountEnabled = false,
    onToggleSoldierDiscount,
    soldierDiscountAmount = 0
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

    // אפשר לחיצה אם זה זיכוי, אם זה ביטול, או אם יש שינוי כלשהו
    // עבור הזמנה שלא שולמה (PAYMENT PENDING), תמיד נאפשר לחיצה כדי להגיע לתשלום (אלא אם ריקה)
    const isDisabled = disabled ||
        (cartItems.length === 0 && !isRefund && !isCancelOrder) ||
        (isEditMode && originalIsPaid && isNoPriceChange && !hasChanges);

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

        // New: Unpaid Order Edit - ALWAYS allow payment
        if (isEditMode && !originalIsPaid) return {
            text: 'לתשלום',
            subtext: 'השלמת הזמנה',
            color: 'bg-white',
            buttonColor: 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200',
            amount: effectiveTotal,
            icon: CreditCard
        };

        if (isNoPriceChange && isEditMode) return {
            text: originalIsPaid ? 'שולם' : 'עדכון הזמנה',
            paymentLabel: originalIsPaid ? (PAYMENT_LABELS[editingOrderData?.paymentMethod] || editingOrderData?.paymentMethod) : null,
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

    // Helper to determine if we have a REAL customer (ignoring "Quick Order" or anonymous placeholders)
    const hasRealCustomer = useMemo(() => {
        if (!customerName) return false;
        const name = String(customerName).trim();
        if (name === 'הזמנה מהירה') return false;
        if (name === 'אורח' || name.includes('אורח אנונימי') || name === 'אורח/ת') return false;
        return true;
    }, [customerName]);

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
                <div className="flex items-center gap-1">

                    {/* Logic: If name is 'Anonymous Guest', treat as no customer */}
                    {(() => {
                        const isAnonymous = !customerName || customerName.includes('אורח אנונימי') || customerName === 'אורח';
                        const isValidPhone = customerPhone && /^[0-9+\-\s]+$/.test(customerPhone) && customerPhone.length < 15;
                        const showAddButtons = isAnonymous || !isValidPhone;

                        return (
                            <>
                                {/* Icon */}
                                {/* <div className="bg-orange-100 p-2 rounded-xl flex-shrink-0">
                                    <ShoppingBag className="w-5 h-5 text-orange-600" />
                                </div> */}
                                {/* User wanted exactly like screenshot - no icon shown there? Actually let's keep it minimal or hide if needed. 
                                   Screenshot shows buttons on the right. Let's follow the screenshot layout.
                                   Screenshot has: [Orange +Phone] [Gray +Name] ...
                                */}

                                {/* Case: No valid customer (or anonymous) - Show buttons */}
                                {showAddButtons ? (
                                    <>
                                        {/* If we have a valid name but no phone, show name - RIGHTMOST */}
                                        {!isAnonymous && (
                                            <h2 className="text-xl font-black text-gray-800 tracking-tight flex-shrink-0 ml-2">
                                                {customerName}
                                            </h2>
                                        )}

                                        {/* Phone Button */}
                                        {onAddCustomerDetails && (
                                            <button
                                                onClick={() => onAddCustomerDetails('phone')}
                                                className="px-4 py-2.5 rounded-lg bg-orange-500 text-white shadow-sm hover:bg-orange-600 transition-all font-bold text-sm flex items-center gap-1.5"
                                            >
                                                <Phone size={16} />
                                                <span>טלפון</span>
                                            </button>
                                        )}

                                        {/* Name Button - only if name is missing/anonymous */}
                                        {isAnonymous && onAddCustomerDetails && (
                                            <button
                                                onClick={() => onAddCustomerDetails('name')}
                                                className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-all font-bold text-sm flex items-center gap-1.5"
                                            >
                                                <User size={16} />
                                                <span>שם</span>
                                            </button>
                                        )}

                                        {/* Delivery Button - NEW */}
                                        {onSetDelivery && (
                                            <button
                                                onClick={() => onSetDelivery()}
                                                className="px-4 py-2.5 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-all font-bold text-sm flex items-center gap-1.5"
                                            >
                                                <Truck size={16} />
                                                <span>משלוח</span>
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    /* Case: Valid Customer with Phone */
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <h2 className="text-xl font-black text-gray-800 tracking-tight leading-none">
                                                {customerName}
                                            </h2>
                                            <div className="flex items-center gap-2 text-gray-500 text-sm font-mono mt-0.5">
                                                <Phone size={12} />
                                                <span>{customerPhone}</span>
                                            </div>
                                        </div>

                                        {onAddCustomerDetails && (
                                            <button
                                                onClick={() => onAddCustomerDetails('phone')}
                                                className="p-2 bg-gray-50 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Soldier Discount Button - Far Left in RTL */}
                                <div className="mr-auto">
                                    {onToggleSoldierDiscount && !isRestrictedMode && (
                                        <button
                                            onClick={onToggleSoldierDiscount}
                                            className={`px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all ${soldierDiscountEnabled
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                                                }`}
                                        >
                                            <span>🎖️</span>
                                            <span>{soldierDiscountEnabled ? 'חייל✓' : 'חייל'}</span>
                                        </button>
                                    )}
                                </div>

                            </>
                        );
                    })()}
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

                    // Current state - ONLY USE POINTS
                    const currentPoints = loyaltyPoints ?? 0;
                    const totalPoints = currentPoints + cartCoffeeCount;

                    let displayContent;
                    let badgeStyle;

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

                {/* Loyalty Discount Row - Only show if real customer AND has discount */}
                {loyaltyDiscount > 0 && hasRealCustomer && !(isEditMode && originalIsPaid && editingOrderData?.originalRedeemedCount > 0) && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-green-50 p-2 rounded-lg border border-green-100">
                        <span className="text-green-700 font-bold flex items-center gap-2 text-sm">
                            <span>🎁</span> הנחת נאמנות (קפה חינם)
                        </span>
                        <span className="text-green-700 font-bold dir-ltr">
                            -{formatPrice(loyaltyDiscount)}
                        </span>
                    </div>
                )}

                {/* Soldier Discount Display - only show amount if enabled */}
                {soldierDiscountEnabled && soldierDiscountAmount > 0 && (
                    <div className="flex justify-between items-center mb-3 px-1 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span className="text-blue-700 font-bold flex items-center gap-2 text-sm">
                            <span>🎖️</span> הנחת חייל (10%)
                        </span>
                        <span className="text-blue-700 font-bold dir-ltr">
                            -{formatPrice(soldierDiscountAmount)}
                        </span>
                    </div>
                )}

                {/* Main Action Button */}
                <button
                    onClick={handleAction}
                    disabled={isDisabled}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-between px-6 ${statusConfig.buttonColor}`}
                >
                    <div className="flex items-center gap-2">
                        <span>{statusConfig.text}</span>
                        {statusConfig.paymentLabel && (
                            <span className="text-xs bg-white text-orange-600 px-2 py-0.5 rounded-lg border border-orange-100 shadow-sm">
                                {statusConfig.paymentLabel}
                            </span>
                        )}
                    </div>
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
