import React, { useState } from 'react';
import { Clock, Edit, RotateCcw, Flame, Trash2 } from 'lucide-react';
import { sortItems, getModColor } from '../../../utils/kdsUtils';

const OrderCard = ({ order, isReady = false, onOrderStatusUpdate, onPaymentCollected, onFireItems, onEditOrder, onCancelOrder }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  /* ============================================================
     ⚠️ CRITICAL: DO NOT CHANGE THIS THRESHOLD! ⚠️
     When more than 4 items, split into 2 columns (not scroll!)
     This has been reset multiple times - DO NOT REVERT!
     ============================================================ */
  const isLargeOrder = order.items?.length > 4;
  const isDelayedCard = order.type === 'delayed';
  const isUnpaidDelivered = order.type === 'unpaid_delivered';

  // הגדרת רוחב: 280px לרגיל, 450px לגדול (לשני טורים)
  const cardWidthClass = isLargeOrder ? 'w-[450px]' : 'w-[280px]';

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
      ? 'bg-slate-800 text-white hover:bg-slate-700'
      : 'bg-green-600 text-white hover:bg-green-700');

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
    // Debug log to inspect item structure
    if (idx === 0) console.log('KDS Item Debug:', { name: item.name, mods: item.modifiers, type: typeof item.name });

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

        {/* Edit Button + Time + Payment Status */}
        <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1">
          {/* Edit Button - Compact */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onEditOrder) {
                onEditOrder(order);
              }
            }}
            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg font-bold text-xs transition-all flex items-center gap-1 border border-blue-100 hover:border-blue-200"
            title="ערוך הזמנה"
          >
            <Edit size={12} strokeWidth={2.5} />
            עריכה
          </button>

          <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
            <Clock size={12} />
            <span className="text-xs font-mono font-bold">{order.timestamp}</span>
          </div>
          {!order.isPaid ? (
            <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded">לא שולם</span>
          ) : (
            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">שולם</span>
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
          // כרטיסים פעילים (הכנה / מוכן) - שורה אחת בלבד!
          <div className="flex items-stretch gap-2 mt-auto h-14 w-full">

            {/* כפתור חזרה - רק במוכן */}
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

            {/* כפתור ראשי */}
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

            {/* כפתור תשלום - בצד שמאל (אם לא שולם) */}
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
                {/* Badge בפינה ימנית עליונה - בולט החוצה */}
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded-full shadow-md ring-2 ring-white">
                  ₪{order.totalAmount?.toFixed(0)}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;