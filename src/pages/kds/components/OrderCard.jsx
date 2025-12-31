import React, { useState, useEffect, useCallback, memo } from 'react';
import { Clock, Edit, RotateCcw, Flame } from 'lucide-react';
import { sortItems } from '../../../utils/kdsUtils';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

const PAYMENT_STYLES = {
  cash: 'bg-green-100 text-green-700 border-green-200',
  credit_card: 'bg-blue-100 text-blue-700 border-blue-200',
  bit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  paybox: 'bg-pink-100 text-pink-700 border-pink-200',
  gift_card: 'bg-purple-100 text-purple-700 border-purple-200',
  oth: 'bg-orange-100 text-orange-700 border-orange-200',
};

const PAYMENT_LABELS = {
  cash: 'מזומן',
  credit_card: 'אשראי',
  bit: 'ביט',
  paybox: 'פייבוקס',
  gift_card: 'שובר',
  oth: 'על חשבון הבית',
};

const PrepTimer = memo(({ order, isHistory, isReady }) => {
  const [duration, setDuration] = useState('-');

  useEffect(() => {
    const calculate = () => {
      // ספירה מרגע ההזמנה המקורי (Created At) ועד למוכן (Ready At)
      const startStr = order.created_at;
      const endStr = order.ready_at;

      const start = new Date(startStr).getTime();
      let end;

      if (endStr) {
        end = new Date(endStr).getTime();
      } else if (isReady || isHistory) {
        // Fallback to updated_at for completed orders if ready_at is missing
        end = order.updated_at ? new Date(order.updated_at).getTime() : null;
      } else {
        end = Date.now();
      }

      if (isNaN(start) || !end) {
        setDuration('-');
        return;
      }

      const diff = Math.max(0, end - start);
      const mins = Math.floor(diff / 60000);
      setDuration(`${mins}`);
    };

    calculate();
    // For active orders, update every minute
    let interval;
    if (!isReady && !isHistory) {
      interval = setInterval(calculate, 60000);
    }
    return () => clearInterval(interval);
  }, [order, isHistory, isReady]);

  return (
    <div className="flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md border text-base font-bold h-7 shadow-sm transition-colors bg-white border-gray-200 text-gray-700">
      <span className="font-mono dir-ltr flex-1 text-center">{duration}</span>
    </div>
  );
});

PrepTimer.displayName = 'PrepTimer';

const OrderCard = ({
  order,
  isReady = false,
  isHistory = false,
  onOrderStatusUpdate,
  onPaymentCollected,
  onFireItems,
  onEditOrder,
  onCancelOrder
}) => {
  const [isUpdating, setIsUpdating] = useState(false);


  // פונקציה לטיפול בלחיצה על הכפתור הראשי
  const handleMainAction = (e) => {
    e.stopPropagation();
    if (isUpdating) return;

    if (isReady) {
      // אם כבר מוכן - העבר להיסטוריה (נמסר)
      onOrderStatusUpdate(order.id, 'completed');
    } else if (orderStatusLower === 'new' || orderStatusLower === 'pending') {
      // אם חדש - התחל הכנה
      onOrderStatusUpdate(order.id, 'in_progress');
    } else {
      // אם בהכנה - סמן כמוכן
      onOrderStatusUpdate(order.id, 'done');
    }
  };

  const handleCardClick = () => {
    // בלחיצה על הכרטיס - פתח עריכה (אם לא היסטוריה)
    // אם היסטוריה - כרגע לא עושה כלום או פותח מודל צפייה
    if (!isHistory) {
      if (onEditOrder) onEditOrder(order);
    }
  };

  /* ============================================================
     Single Column Layout Forced (User Request)
     ============================================================ */
  const isDelayedCard = order.type === 'delayed';
  const isUnpaidDelivered = order.type === 'unpaid_delivered';

  const getStatusStyles = (status) => {
    if (isDelayedCard) return 'border-t-[6px] border-slate-400 shadow-inner bg-slate-100 opacity-90 grayscale-[0.3]';
    if (isUnpaidDelivered) return 'border-t-[6px] border-blue-500 shadow-md animate-strong-pulse bg-blue-50/30';

    const statusLower = (status || '').toLowerCase();

    if (statusLower === 'new' || statusLower === 'pending') return 'border-t-[6px] border-green-500 shadow-md';
    // רקע לבן במקום צהוב
    if (statusLower === 'in_progress') return 'border-t-[6px] border-yellow-500 shadow-lg ring-1 ring-yellow-100';

    // History cards - unpaid orders flash with amber border
    if (isHistory && !order.isPaid) return 'border-t-[6px] border-amber-500 shadow-md animate-pulse ring-2 ring-amber-200';

    return 'border-gray-200 shadow-sm';
  };

  const orderStatusLower = (order.orderStatus || '').toLowerCase();
  const nextStatusLabel =
    orderStatusLower === 'new' || orderStatusLower === 'pending'
      ? 'התחל הכנה'
      : (orderStatusLower === 'in_progress'
        ? 'מוכן להגשה'
        : (isReady ? 'נמסר' : 'מוכן להגשה'));

  const actionBtnColor = isReady
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : (orderStatusLower === 'new' || orderStatusLower === 'pending'
      ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'
      : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200');



  const getModColor = (modName) => {
    if (['חלב שיבולת', 'חלב סויה', 'חלב שקדים', 'שיבולת', 'סויה', 'שקדים'].some(x => modName.includes(x))) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (['דל שומן', 'דל'].some(x => modName.includes(x))) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (['חזק', 'תוספת אספרסו'].some(x => modName.includes(x))) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (['בלי', 'ללא'].some(x => modName.includes(x))) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Unified sorted list for all orders
  const unifiedItems = sortItems(order.items || []);

  /* ============================================================
     ⚠️ CRITICAL: TWO COLUMN SPLIT LOGIC ⚠️
     Limit 5 ROWS per column. 
     One item = 1 row (if 0-1 visible mods) or 2 rows (if 2+ mods).
     ============================================================ */
  const getItemRows = (item) => {
    if (!item.modifiers) return 1;
    const visibleModsCount = item.modifiers.filter(m => getShortName(m.text || m.valueName || m) !== null).length;
    if (visibleModsCount <= 1) return 1;
    return 2;
  };

  const totalRows = unifiedItems.reduce((acc, item) => acc + getItemRows(item), 0);
  const isLargeOrder = !isHistory && totalRows > 5;

  const rightColItems = [];
  const leftColItems = [];

  if (isLargeOrder) {
    let currentRows = 0;
    unifiedItems.forEach(item => {
      const rows = getItemRows(item);
      if (currentRows + rows <= 5) {
        rightColItems.push(item);
        currentRows += rows;
      } else {
        leftColItems.push(item);
      }
    });
  }

  // הגדרת רוחב: 280px לרגיל, 420px לגדול (לבקשת המשתמש - המידה המקורית הרצויה)
  // HISTORY MODIFICATION: 30% narrower
  const cardWidthClass = isHistory
    ? (isLargeOrder ? 'w-[294px]' : 'w-[200px]')
    : (isLargeOrder ? 'w-[420px]' : 'w-[280px]');

  const renderItemRow = (item, idx, isLarge) => {
    // Debug log to inspect item structure (disabled for performance)
    // if (idx === 0) console.log('KDS Item Debug:', { name: item.name, mods: item.modifiers, type: typeof item.name });

    // Check if item is marked as early delivered
    const isEarlyDelivered = item.is_early_delivered || false;

    // HISTORY VIEW OPTIMIZATIONS: Smaller fonts, tighter spacing
    const nameSizeClass = isHistory ? 'text-sm' : 'text-base'; // Smaller name in history
    const badgeSizeClass = isHistory ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-base'; // Smaller badge
    const modSizeClass = isHistory ? 'text-[10px]' : 'text-xs'; // Smaller modifiers

    return (
      <div key={`${item.menuItemId}-${item.modsKey || ''}-${idx}`} className={`flex flex-col ${isLarge ? 'border-b border-gray-50 pb-0.5' : 'border-b border-dashed border-gray-100 pb-0.5 last:border-0'} ${isEarlyDelivered ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-[5px] relative">
          {/* Strikethrough overlay for early delivered items - applied only to Name area for clarity */}
          {isEarlyDelivered && (
            <div className="absolute top-[10px] right-8 left-0 flex items-center pointer-events-none z-10">
              <div className="w-full h-0.5 bg-slate-400 rounded-full" />
            </div>
          )}

          {/* Quantity Badge */}
          <span className={`flex items-center justify-center rounded-lg font-black shadow-sm shrink-0 mt-0 ${badgeSizeClass} ${item.quantity > 1 ? 'bg-orange-600 text-white ring-2 ring-orange-200' : (isDelayedCard ? 'bg-gray-300 text-gray-600' : 'bg-slate-900 text-white')
            }`}>
            {item.quantity}
          </span>

          {/* ============================================================
             ⚠️ CRITICAL: MODIFIERS MUST WRAP! ⚠️
             Use flex flex-wrap so mods go to next line, NOT get cut off!
             ============================================================ */ }
          <div className="flex-1 pt-0 min-w-0 pr-0">
            {/* ============================================================
               ⚠️ CRITICAL: MODIFIER WRAPPING ⚠️
               If 2+ mods, first mod stays on row 1, rest go to row 2.
               ============================================================ */}
            {(() => {
              if (!item.modifiers || item.modifiers.length === 0) {
                return (
                  <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                    <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'} ${nameSizeClass}`}>
                      {item.name}
                    </span>
                  </div>
                );
              }

              // 1. Sort Modifiers (using the same logic as before)
              const sortedMods = [...item.modifiers].sort((a, b) => {
                const textA = String(a.text || '').toLowerCase();
                const textB = String(b.text || '').toLowerCase();
                const isDecafA = textA.includes('נטול');
                const isDecafB = textB.includes('נטול');
                if (isDecafA && !isDecafB) return -1;
                if (!isDecafA && isDecafB) return 1;
                const isMilkA = textA.includes('סויה') || textA.includes('שיבולת') || textA.includes('שקדים');
                const isMilkB = textB.includes('סויה') || textB.includes('שיבולת') || textB.includes('שקדים');
                if (isMilkA && !isMilkB) return -1;
                if (!isMilkA && isMilkB) return 1;
                return 0;
              });

              // 2. Filter out hidden mods (defaults) and get short names
              const visibleMods = sortedMods
                .map(mod => ({ ...mod, shortName: getShortName(mod.text) }))
                .filter(mod => mod.shortName !== null);

              if (visibleMods.length === 0) {
                return (
                  <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                    <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'} ${nameSizeClass}`}>
                      {item.name}
                    </span>
                  </div>
                );
              }

              const renderModLabel = (mod, i) => {
                const displayText = mod.shortName;
                const colorClass = getModColorClass(mod.text, displayText);
                return (
                  <span key={i} className={`mod-label ${colorClass} ${modSizeClass}`}>
                    {displayText}
                  </span>
                );
              };

              const row1Mods = visibleMods.slice(0, 2);
              const remainingMods = visibleMods.slice(2);

              return (
                <div className="flex flex-col">
                  {/* Row 1: Item Name + Up to 2 Mods */}
                  <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                    <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'} ${nameSizeClass}`}>
                      {item.name}
                    </span>
                    {row1Mods.map((mod, i) => renderModLabel(mod, i))}
                  </div>
                  {/* Row 2: Remaining Mods */}
                  {remainingMods.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-right leading-snug mt-0.5 ml-0">
                      {remainingMods.map((mod, i) => renderModLabel(mod, i + 2))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`kds-card ${cardWidthClass} flex-shrink-0 rounded-2xl px-[5px] py-3 ${isHistory ? 'mx-[2px]' : 'mx-2'} flex flex-col h-full font-heebo ${isDelayedCard ? 'bg-gray-50' : 'bg-white'} ${getStatusStyles(order.orderStatus)} border-x border-b border-gray-100`}>

      {/* ============================================================
         ⚠️ CRITICAL DESIGN INSTRUCTION ⚠️
         DO NOT CHANGE THE KDS CARD DESIGN, LAYOUT OR ADD NEW ELEMENTS
         WITHOUT EXPLICIT PERMISSION FROM THE USER.
         EVERY PIXEL MATTERS IN KITCHEN OPERATIONS. REDUCING ITEM 
         VISIBILITY OR CAUSING SCROLLING IS UNACCEPTABLE AND WILL BE REJECTED.
         ============================================================ */}
      <div className="flex justify-between items-start mb-1 border-b border-gray-50 pb-1">
        <div className="flex flex-col overflow-hidden flex-1">
          {/* Order Number Title (as requested) */}
          <div className="flex flex-col w-full">
            {/* Main Title: Name OR Number */}
            <div className="flex items-center gap-2 w-full">
              {order.customerName && !['אורח', 'אורח אנונימי'].includes(order.customerName) ? (
                <div className={`${isHistory ? 'text-lg' : 'text-2xl'} font-black text-slate-900 leading-none tracking-tight truncate`}>
                  {order.customerName}
                </div>
              ) : (
                <div className={`${isHistory ? 'text-lg' : 'text-2xl'} font-black text-slate-900 leading-none tracking-tight truncate`}>
                  #{order.orderNumber}
                </div>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Payment Method Badge - Only in History */}
              {order.isPaid && isHistory && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${PAYMENT_STYLES[order.payment_method] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                </span>
              )}
              {order.isSecondCourse && (
                <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-purple-200">
                  מנה שניה
                </span>
              )}
              {order.hasPendingItems && !isDelayedCard && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                  <Clock size={10} />
                  +המשך
                </span>
              )}
              {isDelayedCard && (
                <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-slate-300 flex items-center gap-1">
                  <Clock size={10} />
                  ממתין ל-'אש'
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Edit Button + Time */}
        <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1.5">
          <div className="flex items-center gap-2">
            {!isHistory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditOrder) onEditOrder(order);
                }}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg font-bold text-xs transition-all flex items-center gap-1 border border-blue-100 hover:border-blue-200 h-6"
                title="ערוך הזמנה"
              >
                <Edit size={12} strokeWidth={2.5} />
                {/* If Name is shown as main title, show Order Number here. Otherwise show "Edit" */}
                {order.customerName && !['אורח', 'אורח אנונימי'].includes(order.customerName) ? (
                  <span className="font-mono">#{order.orderNumber}</span>
                ) : (
                  <span>עריכה</span>
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-bold h-6 shadow-sm transition-colors bg-gray-50 border-gray-200 text-gray-500">
              <Clock size={12} />
              <span className="font-mono dir-ltr text-[10px]">{order.timestamp}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
         ⚠️ CRITICAL: NO HORIZONTAL SCROLL IN CARDS! ⚠️
         Items should WRAP to 2nd column or new line, NOT scroll!
         - overflow-x: hidden (NO horizontal scroll!)
         - overflow-y: auto (allow vertical scroll only if really needed)
         ============================================================ */}
      <div className={`flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar pr-1 mr-1 mb-2`}>
        {isLargeOrder ? (
          <div className="flex h-full gap-2">
            {/* עמודה ימנית (RTL) - פריטים 1-4 */}
            <div className="flex-1 flex flex-col space-y-1 border-l border-gray-100 pl-2">
              {rightColItems.length > 0 ? (
                rightColItems.map((item, idx) => renderItemRow(item, idx, true))
              ) : (
                <div className="text-gray-300 text-xs text-center mt-4 italic">ריק</div>
              )}
            </div>
            {/* עמודה שמאלית (RTL) - פריטים 5+ */}
            <div className="flex-1 flex flex-col space-y-1">
              {leftColItems.length > 0 ? (
                leftColItems.map((item, idx) => renderItemRow(item, idx, true))
              ) : (
                <div className="text-gray-300 text-xs text-center mt-4 italic"></div>
              )}
            </div>
          </div>
        ) : (
          // רגיל - רשימה אחת מאוחדת ממוינת
          <div className="flex flex-col space-y-1">
            {unifiedItems.map((item, idx) => renderItemRow(item, idx, false))}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 relative">
        {isDelayedCard ? (
          // כרטיס מושהה - כפתור "הכן עכשיו"
          <button
            disabled={isUpdating}
            onClick={async () => {
              setIsUpdating(true);
              try {
                const flatIds = order.items.flatMap(i => i.ids || [i.id]);
                const itemsPayload = flatIds.map(id => ({ id }));
                if (onFireItems) {
                  await onFireItems(order.originalOrderId, itemsPayload);
                }
              } finally {
                setIsUpdating(false);
              }
            }}
            className={`w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-lg shadow-lg shadow-orange-200 border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 hover:brightness-110 ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''} outline-none`}
          >
            <Flame size={18} className="fill-white animate-pulse" />
            <span>{isUpdating ? 'שולח...' : 'הכן עכשיו!'}</span>
          </button>
        ) : (
          /* Not Delayed -> History or Active */
          <>
            {/* HISTORY DETAILS (REFINED VERSION) */}
            {isHistory && (
              <div className="mt-1 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-2 overflow-hidden">
                {/* Row 1: Prep Time Header & Value */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                    <Clock size={16} />
                    <span className="text-xs">משך הכנה:</span>
                  </div>
                  <PrepTimer order={order} isHistory={true} isReady={true} />
                </div>

                {/* Consolidated Payment & Refund Rows */}
                <div className="flex flex-col gap-1.5">
                  {/* Row 2: Payment Bar */}
                  <div className={`flex items-center gap-2 p-1 border rounded-xl transition-colors ${order.isPaid
                    ? 'bg-green-50 border-green-100'
                    : 'bg-red-50 border-red-100'
                    }`}>
                    <div className={`flex-1 flex items-center justify-center py-1 px-1.5 rounded-lg border shadow-sm ${order.isPaid
                      ? (PAYMENT_STYLES[order.payment_method] || 'bg-white border-green-200 text-green-700')
                      : 'bg-white border-red-200 text-red-600 animate-pulse'
                      }`}>
                      <span className="text-[11px] font-black truncate">
                        {order.isPaid ? `שולם ב-${PAYMENT_LABELS[order.payment_method] || order.payment_method}` : 'טרם שולם'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 px-1">
                      <span className="text-sm font-black text-slate-800 tracking-tight">
                        ₪{(order.totalOriginalAmount || order.fullTotalAmount || order.totalAmount)?.toLocaleString()}
                      </span>
                      {order.soldier_discount && (
                        <span className="text-[9px] bg-blue-500 text-white px-1 rounded font-bold" title="הנחת חייל">H</span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Refund Bar (If exists) */}
                  {order.is_refund && (
                    <div className="flex items-center gap-2 p-1 bg-orange-50 border border-orange-100 rounded-xl">
                      <div className={`flex-1 flex items-center justify-center py-1 px-1.5 rounded-lg border shadow-sm ${PAYMENT_STYLES[order.refund_method] || 'bg-white border-orange-200 text-orange-700'}`}>
                        <span className="text-[11px] font-black truncate">
                          זוכה ב-{PAYMENT_LABELS[order.refund_method] || order.refund_method}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 px-1">
                        <span className="text-sm font-black text-orange-700 tracking-tight">-₪{Number(order.refund_amount).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isHistory ? (
              // History View Bottom Actions
              <div className="flex items-center justify-center mt-auto gap-2 w-full">
                {/* Edit/View Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditOrder) onEditOrder(order);
                  }}
                  className="flex-1 py-1.5 bg-white text-slate-500 rounded-lg text-[11px] font-bold border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm outline-none"
                >
                  <Edit size={14} />
                  {order.isPaid ? 'צפייה / זיכוי' : 'צפייה / עריכה'}
                </button>
              </div>
            ) : (
              // Active Cards (Updates/Ready)
              <div className="flex items-stretch gap-2 mt-auto h-11 w-full text-sm">

                {/* Undo Button - Only for Ready */}
                {isReady && (
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation(); setIsUpdating(true);
                      try { await onOrderStatusUpdate(order.id, 'undo_ready'); }
                      finally { setIsUpdating(false); }
                    }}
                    className="w-11 h-11 bg-gray-200 border-2 border-gray-300 rounded-xl shadow-sm flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-gray-300 shrink-0 active:scale-95 transition-all outline-none"
                    title="החזר להכנה"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}

                {/* Main Action Button */}
                <button
                  disabled={isUpdating}
                  onClick={async () => {
                    setIsUpdating(true);
                    try { await onOrderStatusUpdate(order.id, order.orderStatus); }
                    finally { setIsUpdating(false); }
                  }}
                  className={`flex-1 rounded-xl font-black text-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''} outline-none`}
                >
                  {isUpdating ? 'מעדכן...' : nextStatusLabel}
                </button>

                {/* Payment Button - ONLY if NOT paid (Restored original design) */}
                {!order.isPaid && (
                  <button
                    disabled={isUpdating}
                    onClick={async () => {
                      if (onPaymentCollected) {
                        setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false);
                      }
                    }}
                    className="w-11 h-11 bg-white border-2 border-amber-400 rounded-xl shadow-sm flex items-center justify-center hover:bg-amber-50 shrink-0 relative overflow-visible active:scale-95 transition-all outline-none"
                  >
                    <img
                      src="https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/cashregister.jpg"
                      alt="קופה"
                      className="w-7 h-7 object-contain"
                    />
                    <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md ring-1 ring-white">
                      ₪{order.totalAmount?.toFixed(0)}
                    </span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrderCard;