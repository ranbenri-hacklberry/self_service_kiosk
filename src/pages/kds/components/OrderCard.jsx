import React, { useState, useEffect, useCallback, memo } from 'react';
import { Clock, Edit, RotateCcw, Flame, Trash2 } from 'lucide-react';
import { sortItems, getModColor } from '../../../utils/kdsUtils';

const PrepTimer = memo(({ order, isHistory, isReady }) => {
  const [duration, setDuration] = useState('-');

  useEffect(() => {
    const calculate = () => {
      // Simple calculation: ready_at - created_at
      const startStr = order.created_at;
      const endStr = order.ready_at;

      if (!startStr || !endStr) {
        setDuration('-'); return;
      }

      const start = new Date(startStr).getTime();
      const end = new Date(endStr).getTime();

      if (isNaN(start) || isNaN(end)) {
        setDuration('-'); return;
      }

      const diff = Math.max(0, end - start);
      const mins = Math.floor(diff / 60000);
      setDuration(`${mins}ד`); // Show only minutes with Hebrew "ד" for דקות
    };

    calculate();
  }, [order, isHistory, isReady]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-base font-bold h-7 shadow-sm transition-colors bg-white border-gray-200 text-gray-700">
      <Clock size={14} className={!isHistory && !isReady ? 'animate-pulse text-blue-600' : ''} />
      <span className="font-mono dir-ltr">{duration}</span>
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
  const isLargeOrder = !isHistory && order.items && order.items.length > 4; // 2-col for Active only
  const isDelayedCard = order.type === 'delayed';
  const isUnpaidDelivered = order.type === 'unpaid_delivered';

  // הגדרת רוחב: 280px לרגיל, 420px לגדול (לבקשת המשתמש - המידה המקורית הרצויה)
  const cardWidthClass = isLargeOrder ? 'w-[420px]' : 'w-[280px]';

  const getStatusStyles = (status) => {
    if (isDelayedCard) return 'border-t-[6px] border-slate-400 shadow-inner bg-slate-200/90 opacity-95';
    if (isUnpaidDelivered) return 'border-t-[6px] border-blue-500 shadow-md animate-strong-pulse bg-blue-50/30';

    const statusLower = (status || '').toLowerCase();

    if (statusLower === 'new' || statusLower === 'pending') return 'border-t-[6px] border-green-500 shadow-md';
    // רקע לבן במקום צהוב
    if (statusLower === 'in_progress') return 'border-t-[6px] border-yellow-500 shadow-lg ring-1 ring-yellow-100';
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
     ⚠️ CRITICAL: TWO COLUMN SPLIT LOGIC - DO NOT CHANGE! ⚠️
     Right column gets first 4 items, left column gets rest.
     This prevents scrolling in cards - items WRAP to 2nd column.
     ============================================================ */
  const rightColItems = isLargeOrder ? unifiedItems.slice(0, 4) : [];
  const leftColItems = isLargeOrder ? unifiedItems.slice(4) : [];

  const renderItemRow = (item, idx, isLarge) => {
    // Debug log to inspect item structure (disabled for performance)
    // if (idx === 0) console.log('KDS Item Debug:', { name: item.name, mods: item.modifiers, type: typeof item.name });

    // Check if item is marked as early delivered
    const isEarlyDelivered = item.is_early_delivered || false;

    return (
      <div key={`${item.menuItemId}-${item.modsKey || ''}-${idx}`} className={`flex flex-col ${isLarge ? 'border-b border-gray-50 pb-0.5' : 'border-b border-dashed border-gray-100 pb-0.5 last:border-0'} ${isEarlyDelivered ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2 relative">
          {/* Strikethrough overlay for early delivered items */}
          {isEarlyDelivered && (
            <div className="absolute inset-0 flex items-center pointer-events-none z-10">
              <div className="w-full h-0.5 bg-gray-600 rounded-full" />
            </div>
          )}

          {/* Quantity Badge */}
          <span className={`flex items-center justify-center w-6 h-6 rounded-lg font-black text-base shadow-sm shrink-0 mt-0 ${item.quantity > 1 ? 'bg-orange-600 text-white ring-2 ring-orange-200' : (isDelayedCard ? 'bg-gray-300 text-gray-600' : 'bg-slate-900 text-white')
            }`}>
            {item.quantity}
          </span>

          {/* ============================================================
             ⚠️ CRITICAL: MODIFIERS MUST WRAP! ⚠️
             Use flex flex-wrap so mods go to next line, NOT get cut off!
             ============================================================ */ }
          <div className="flex-1 pt-0 min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
              {/* Item Name */}
              <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'}`}>
                {item.name}
              </span>

              {/* Modifiers - Wrapping */}
              {(() => {
                if (!item.modifiers || item.modifiers.length === 0) return null;

                // 1. Sort Modifiers
                const sortedMods = [...item.modifiers].sort((a, b) => {
                  const textA = String(a.text || '').toLowerCase();
                  const textB = String(b.text || '').toLowerCase();

                  // Priority 1: Decaf (נטול)
                  const isDecafA = textA.includes('נטול');
                  const isDecafB = textB.includes('נטול');
                  if (isDecafA && !isDecafB) return -1;
                  if (!isDecafA && isDecafB) return 1;

                  // Priority 2: Milk (Soy/Oat/Almond)
                  const isMilkA = textA.includes('סויה') || textA.includes('שיבולת') || textA.includes('שקדים');
                  const isMilkB = textB.includes('סויה') || textB.includes('שיבולת') || textB.includes('שקדים');
                  if (isMilkA && !isMilkB) return -1;
                  if (!isMilkA && isMilkB) return 1;

                  return 0;
                });

                return sortedMods.map((mod, i) => {
                  const originalText = String(mod.text || '');
                  let displayText = originalText;

                  // 2. Shorten Text Logic
                  if (originalText.includes('בלי קצף') || originalText.includes('ללא קצף')) {
                    displayText = 'קצף'; // For strikethrough
                  } else if (originalText.includes('נטול קפאין')) {
                    displayText = 'נטול';
                  } else if (originalText.includes('חלב סויה')) {
                    displayText = 'סויה';
                  } else if (originalText.includes('חלב שיבולת')) {
                    displayText = 'שיבולת';
                  } else if (originalText.includes('חלב שקדים')) {
                    displayText = 'שקדים';
                  } else if (originalText.includes('פחות קצף')) {
                    displayText = 'פחות קצף';
                  }

                  return (
                    <span key={i} className={`mod-label ${getModColor(originalText)}`}>
                      {displayText}
                    </span>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`kds-card ${cardWidthClass} flex-shrink-0 rounded-2xl p-3 mx-2 flex flex-col h-full font-heebo ${isDelayedCard ? 'bg-gray-50' : 'bg-white'} ${getStatusStyles(order.orderStatus)} border-x border-b border-gray-100`}>

      <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-1.5">
        <div className="flex flex-col overflow-hidden flex-1">
          {/* שם לקוח */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0 text-2xl font-black text-slate-900 leading-none tracking-tight truncate" title={order.customerName}>
              {order.customerName}
            </div>
          </div>
          {/* מספר הזמנה */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-gray-400">#{order.orderNumber}</span>
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
              <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-gray-300">
                בהמתנה
              </span>
            )}
          </div>
        </div>

        {/* Edit Button + Time (Row 1) & Payment Status (Row 2) */}
        <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1.5">

          {/* Row 1: Edit + Time */}
          <div className="flex items-center gap-2">
            {/* Edit Button - Compact */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onEditOrder) {
                  onEditOrder(order);
                }
              }}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg font-bold text-xs transition-all flex items-center gap-1 border border-blue-100 hover:border-blue-200 h-6"
              title="ערוך הזמנה"
            >
              <Edit size={12} strokeWidth={2.5} />
              עריכה
            </button>

            {/* Static Timestamp (Received Time) */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-bold h-6 shadow-sm transition-colors bg-gray-50 border-gray-200 text-gray-500">
              <Clock size={12} />
              <span className="font-mono dir-ltr text-[10px]">{order.timestamp}</span>
            </div>
          </div>

          {/* Row 2: Payment/Refund Status */}
          {(order.is_refund || order.isRefund) ? (
            <div className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md border border-gray-200 h-5 flex items-center font-bold text-[10px]">
              {Number(order.refund_amount || order.refundAmount) >= Number(order.totalAmount || order.total) ? 'זיכוי מלא' : 'זיכוי חלקי'}
            </div>
          ) : (
            !order.isPaid ? (
              <div className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md border border-red-100 h-5 flex items-center font-bold text-[10px]">
                לא שולם
              </div>
            ) : (
              <div className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded-md border border-green-100 h-5 flex items-center font-bold text-[10px]">
                שולם
              </div>
            )
          )}
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
        {isUnpaidDelivered ? (
          // כרטיס נמסר שלא שולם - כפתור תשלום + כפתור ביטול
          <div className="flex gap-2">
            {/* כפתור ביטול/מחיקה */}
            <button
              disabled={isUpdating}
              onClick={async () => {
                if (onCancelOrder && window.confirm('האם אתה בטוח שברצונך לבטל את ההזמנה?')) {
                  setIsUpdating(true);
                  try {
                    await onCancelOrder(order.originalOrderId || order.id);
                  } finally {
                    setIsUpdating(false);
                  }
                }
              }}
              className="w-12 h-12 bg-red-50 border-2 border-red-300 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-100 hover:text-red-600 shrink-0 active:scale-95 transition-all"
              title="בטל הזמנה"
            >
              <Trash2 size={20} />
            </button>

            {/* כפתור תשלום */}
            <button
              disabled={isUpdating}
              onClick={async () => {
                if (onPaymentCollected) {
                  setIsUpdating(true);
                  try {
                    await onPaymentCollected(order);
                  } finally {
                    setIsUpdating(false);
                  }
                }
              }}
              className={`flex-1 py-2.5 bg-white border-2 border-amber-500 text-amber-700 rounded-xl font-black text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 animate-strong-pulse hover:bg-amber-50 ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <img
                src="https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/cashregister.jpg"
                alt="קופה"
                className="w-8 h-8 object-contain drop-shadow-sm"
              />
              <span>{isUpdating ? 'מעדכן...' : `לתשלום (₪${order.totalAmount?.toFixed(0)})`}</span>
            </button>
          </div>
        ) : isDelayedCard ? (
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
            className={`w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-lg shadow-lg shadow-orange-200 border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 hover:brightness-110 ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Flame size={18} className="fill-white animate-pulse" />
            <span>{isUpdating ? 'שולח...' : 'הכן עכשיו!'}</span>
          </button>
        ) : (
          /* Not Delayed -> History or Active */
          <>
            {/* History Details (Timestamps & Payment) */}
            {isHistory && (
              <div className="mt-4 mb-3 pt-3 border-t border-gray-100 flex flex-col gap-2 text-sm text-gray-700 font-medium">

                {/* Prep Time Duration */}
                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-slate-400" />
                    <span className="font-bold text-slate-700">משך הכנה כולל:</span>
                  </div>
                  {/* Reuse PrepTimer for consistent calculation */}
                  <PrepTimer order={order} isHistory={true} isReady={true} />
                </div>



                {/* Ready/End Time */}
                {(order.ready_at || order.updated_at) && (
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>שעת סיום:</span>
                    <span className="font-mono dir-ltr">
                      {new Date(order.ready_at || order.updated_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center mt-1 pt-2 border-t border-dashed border-gray-200 text-base">
                  <span>סה"כ שולם:</span>
                  <span className="font-black text-gray-900">₪{order.totalAmount?.toLocaleString()}</span>
                </div>
              </div>
            )}

            {isHistory ? (
              // History View Bottom Actions (Subtle Edit Button)
              <div className="flex items-center justify-center mt-auto h-12 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditOrder) onEditOrder(order);
                  }}
                  className="w-full py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-200 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={16} />
                  צפייה / זיכוי
                </button>
              </div>
            ) : (
              // Active Cards (Updates/Ready)
              <div className="flex items-stretch gap-2 mt-auto h-14 w-full">

                {/* Undo Button - Only for Ready */}
                {isReady && (
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation(); setIsUpdating(true);
                      try { await onOrderStatusUpdate(order.id, 'undo_ready'); }
                      finally { setIsUpdating(false); }
                    }}
                    className="w-14 h-14 bg-gray-200 border-2 border-gray-300 rounded-xl shadow-sm flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-gray-300 shrink-0 active:scale-95 transition-all"
                    title="החזר להכנה"
                  >
                    <RotateCcw size={24} />
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
                  className={`flex-1 rounded-xl font-black text-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUpdating ? 'מעדכן...' : nextStatusLabel}
                </button>

                {/* Payment Button - Left side if not paid */}
                {!order.isPaid && (
                  <button
                    disabled={isUpdating}
                    onClick={async () => {
                      if (onPaymentCollected) {
                        setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false);
                      }
                    }}
                    className="w-14 h-14 bg-white border-2 border-amber-400 rounded-xl shadow-sm flex items-center justify-center hover:bg-amber-50 shrink-0 relative overflow-visible active:scale-95 transition-all"
                  >
                    <img
                      src="https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/cashregister.jpg"
                      alt="קופה"
                      className="w-8 h-8 object-contain"
                    />
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded-full shadow-md ring-2 ring-white">
                      ₪{order.totalAmount?.toFixed(0)}
                    </span>
                  </button>
                )}
              </div>
            )}
          </>
        )
        }
      </div >
    </div >
  );
};

export default OrderCard;