/**
 * ⚠️ CRITICAL FILE - DO NOT MODIFY DESIGN! ⚠️
 * 
 * This OrderCard component is used in KDS (Kitchen Display System).
 * The design has been carefully tuned and approved.
 * 
 * DO NOT change styling, colors, layout, or card dimensions
 * without explicit approval!
 * 
 * Source: main branch @ GitHub
 * Last synced: 2026-01-02
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Clock, Edit, RotateCcw, Flame, Truck, Phone, MapPin, Box, Check } from 'lucide-react';
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

const OrderCard = memo(({
  order,
  isReady = false,
  isHistory = false,
  isKanban = false, // 🆕 Kanban specific prop
  glowClass = '',
  onOrderStatusUpdate,
  onPaymentCollected,
  onFireItems,
  onReadyItems,
  onToggleEarlyDelivered,
  onEditOrder,
  onCancelOrder,
  onRefresh
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // Memoize status styles to avoid recalculating classes
  const statusStyles = useMemo(() => {
    const statusLower = (order.orderStatus || '').toLowerCase();
    const isUnpaid = order.isPaid === false;
    const isDelayedCard = order.type === 'delayed';
    const isUnpaidDelivered = order.type === 'unpaid_delivered';

    // 1. Highest Priority: Unpaid orders logic
    if (isUnpaid && !isHistory) {
      // Bold red border always for unpaid, but ONLY pulse if it's already Ready
      if (statusLower === 'ready') return 'border-t-[6px] border-red-600 shadow-md ring-2 ring-red-100 animate-pulse';
      return 'border-t-[6px] border-red-500 shadow-sm';
    }
    if (isHistory && isUnpaid) return 'border-t-[6px] border-amber-500 shadow-sm';

    // 2. Special Card Types
    if (isDelayedCard) return 'border-t-[6px] border-slate-400 shadow-inner bg-slate-100 opacity-90 grayscale-[0.3]';
    if (isUnpaidDelivered) return 'border-t-[6px] border-blue-500 shadow-md animate-strong-pulse bg-blue-50/30';

    // 3. Status Based Colors
    if (statusLower === 'pending') return 'border-t-[6px] border-amber-500 shadow-md animate-pulse bg-amber-50/30';
    if (statusLower === 'new') return 'border-t-[6px] border-green-500 shadow-md';
    if (statusLower === 'in_progress' || statusLower === 'in_prep') return 'border-t-[6px] border-yellow-500 shadow-lg ring-1 ring-yellow-100';

    return 'border-gray-200 shadow-sm';
  }, [order.type, order.orderStatus, isHistory, order.isPaid]);

  // Memoize unified items and split logic
  const { isLargeOrder, rightColItems, leftColItems, unifiedItems } = useMemo(() => {
    const items = sortItems(order.items || []);

    const getItemRows = (item) => {
      if (!item.modifiers) return 1;
      const visibleModsCount = item.modifiers.filter(m => getShortName(m.text || m.valueName || m) !== null).length;
      return visibleModsCount <= 1 ? 1 : 2;
    };

    const totalRows = items.reduce((acc, item) => acc + getItemRows(item), 0);
    // 🆕 In Kanban, we prefer single column unless it's REALLY huge
    const splitNeeded = !isKanban && !isHistory && totalRows > 5;

    const rCol = [];
    const lCol = [];

    if (splitNeeded) {
      let currentRows = 0;
      items.forEach(item => {
        const rows = getItemRows(item);
        if (currentRows + rows <= 5) {
          rCol.push(item);
          currentRows += rows;
        } else {
          lCol.push(item);
        }
      });
    }

    return {
      unifiedItems: items,
      isLargeOrder: splitNeeded,
      rightColItems: rCol,
      leftColItems: lCol
    };
  }, [order.items, isHistory, isKanban]);

  // Calculate packing progress for Kanban
  const packedCount = useMemo(() => {
    if (!order.items) return 0;
    return order.items.filter(i => i.item_status === 'ready' || i.item_status === 'shipped').length;
  }, [order.items]);
  const totalItems = order.items?.length || 0;
  const isPartiallyPacked = !isHistory && !isReady && totalItems > 0 && packedCount > 0;

  const orderStatusLower = (order.orderStatus || '').toLowerCase();

  // Pending orders get special "ראיתי" button, others get normal flow
  const isPending = orderStatusLower === 'pending';
  const nextStatusLabel = isPending
    ? 'ראיתי'
    : (orderStatusLower === 'new'
      ? 'התחל הכנה'
      : (orderStatusLower === 'in_progress' ? 'מוכן להגשה' : (isReady ? 'נמסר' : 'מוכן להגשה')));

  const actionBtnColor = isReady
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : (isPending
      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200'
      : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200');

  const cardWidthClass = isHistory
    ? (isLargeOrder ? 'w-[294px]' : 'w-[200px]')
    : (isKanban ? 'w-full' : (isLargeOrder ? 'w-[420px]' : 'w-[280px]'));

  const renderItemRow = useCallback((item, idx, isLarge) => {
    const isEarlyDelivered = !isReady && !isHistory && (item.is_early_delivered || item.item_status === 'ready' || item.item_status === 'shipped');
    const nameSizeClass = isHistory ? 'text-sm' : 'text-base';
    const badgeSizeClass = isHistory ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-base';
    const modSizeClass = isHistory ? 'text-[10px]' : 'text-xs';

    // 🆕 Check if specific item is packed (for Kanban view)
    const isPackedItem = isKanban && (item.item_status === 'ready' || item.item_status === 'shipped');

    return (
      <div key={`${item.menuItemId}-${item.modsKey || item.id || idx}`} className={`flex flex-col ${isLarge ? 'border-b border-gray-50 pb-0.5' : 'border-b border-dashed border-gray-100 pb-0.5 last:border-0'} ${isEarlyDelivered && !isKanban ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-[5px] relative">
          {/* Packing Strike-through (only for KDS early delivery, NOT Kanban layout) */}
          {isEarlyDelivered && !isKanban && (
            <div className="absolute top-[13px] right-7 left-1 flex items-center pointer-events-none z-10">
              <div className="w-full h-[3px] bg-slate-500/60 rounded-full" />
            </div>
          )}

          <div className="flex items-start gap-[5px] flex-1 min-w-0">
            {/* Quantity Badge - Green if packed */}
            <span className={`flex items-center justify-center rounded-lg font-black shadow-sm shrink-0 mt-0 ${badgeSizeClass} ${isPackedItem
                ? 'bg-green-600 text-white ring-2 ring-green-200'
                : (item.quantity > 1 ? 'bg-orange-600 text-white ring-2 ring-orange-200' : (order.type === 'delayed' ? 'bg-gray-300 text-gray-600' : 'bg-slate-900 text-white'))
              }`}>
              {item.quantity}
            </span>

            <div className="flex-1 pt-0 min-w-0 pr-0">
              {(() => {
                if (!item.modifiers || item.modifiers.length === 0) {
                  return (
                    <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                      <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'} ${nameSizeClass}`}>
                        {item.name}
                      </span>
                      {isPackedItem && <Check size={14} className="text-green-600 stroke-[3]" />}
                    </div>
                  );
                }

                const visibleMods = item.modifiers
                  .map(mod => ({ ...mod, shortName: getShortName(mod.text || mod.valueName || mod) }))
                  .filter(mod => mod.shortName !== null);

                if (visibleMods.length === 0) {
                  return (
                    <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                      <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'} ${nameSizeClass}`}>
                        {item.name}
                      </span>
                      {isPackedItem && <Check size={14} className="text-green-600 stroke-[3]" />}
                    </div>
                  );
                }

                const renderModLabel = (mod, i) => (
                  <span key={i} className={`mod-label ${getModColorClass(mod.text || mod.valueName || mod, mod.shortName)} ${modSizeClass}`}>
                    {mod.shortName}
                  </span>
                );

                const row1Mods = visibleMods.slice(0, 2);
                const remainingMods = visibleMods.slice(2);

                return (
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                      <span className={`font-bold ${item.quantity > 1 ? 'text-orange-700' : 'text-gray-900'} ${nameSizeClass}`}>
                        {item.name}
                      </span>
                      {/* Check icon next to name */}
                      {isPackedItem && <Check size={14} className="text-green-600 stroke-[3]" />}

                      {row1Mods.map((mod, i) => renderModLabel(mod, i))}
                    </div>
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
      </div >
    );
  }, [isHistory, order.type, onReadyItems, order.id, order.originalOrderId, isReady, isKanban]);

  return (
    <div className={`kds-card ${cardWidthClass} flex-shrink-0 rounded-2xl px-[5px] pt-1.5 pb-2.5 ${isHistory ? 'mx-[2px]' : 'mx-2'} flex flex-col h-full font-heebo ${order.type === 'delayed' ? 'bg-gray-50' : 'bg-white'} ${statusStyles} border-x border-b border-gray-100 ${glowClass}`}>
      <div className="flex justify-between items-start mb-0.5 border-b border-gray-50 pb-0.5">
        <div className="flex flex-col overflow-hidden flex-1">
          <div className="flex flex-col w-full">
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

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {order.isSecondCourse && (
                <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-purple-200">
                  מנה שניה
                </span>
              )}
              {order.orderType === 'delivery' && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1">
                  <Truck size={10} />
                  משלוח
                </span>
              )}
              {order.hasPendingItems && order.type !== 'delayed' && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                  <Clock size={10} />
                  +המשך
                </span>
              )}
              {order.type === 'delayed' && (
                <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-slate-300 flex items-center gap-1">
                  <Clock size={10} />
                  ממתין ל-'אש'
                </span>
              )}
            </div>


          </div>
        </div>


        <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1.5">
          <div className="flex items-center gap-2">
            {!isHistory && !isKanban && ( // 🆕 Hide edit button in Kanban
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditOrder) onEditOrder(order);
                }}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg font-bold text-xs transition-all flex items-center gap-1 border border-blue-100 hover:border-blue-200 h-6"
              >
                <Edit size={12} strokeWidth={2.5} />
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

      <div className={`flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar pr-1 mr-1 mb-2`}>
        {isLargeOrder ? (
          <div className="flex h-full gap-2">
            <div className="flex-1 flex flex-col space-y-1 border-l border-gray-100 pl-2">
              {rightColItems.map((item, idx) => renderItemRow(item, idx, true))}
            </div>
            <div className="flex-1 flex flex-col space-y-1">
              {leftColItems.map((item, idx) => renderItemRow(item, idx, true))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-1">
            {unifiedItems.map((item, idx) => renderItemRow(item, idx, false))}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 relative">
        {order.type === 'delayed' ? (
          <button
            disabled={isUpdating}
            onClick={async (e) => {
              e.stopPropagation();
              setIsUpdating(true);
              try {
                const flatIds = order.items.flatMap(i => i.ids || [i.id]);
                const itemsPayload = flatIds.map(id => ({ id }));
                if (onFireItems) await onFireItems(order.id || order.originalOrderId, itemsPayload);
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
          <>
            {isHistory && (
              <div className="mt-1 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-2 overflow-hidden">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                    <Clock size={16} />
                    <span className="text-xs">משך הכנה:</span>
                  </div>
                  <PrepTimer order={order} isHistory={true} isReady={true} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className={`flex items-center gap-2 p-1 border rounded-xl transition-colors ${order.isPaid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div className={`flex-1 flex items-center justify-center py-1 px-1.5 rounded-lg border shadow-sm ${order.isPaid ? (PAYMENT_STYLES[order.payment_method] || 'bg-white border-green-200 text-green-700') : 'bg-white border-red-200 text-red-600 animate-pulse'}`}>
                      <span className="text-[11px] font-black truncate">
                        {order.isPaid ? `שולם ב-${PAYMENT_LABELS[order.payment_method] || order.payment_method}` : 'טרם שולם'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 px-1">
                      <span className="text-sm font-black text-slate-800 tracking-tight">
                        ₪{(order.totalOriginalAmount || order.fullTotalAmount || order.totalAmount)?.toLocaleString()}
                      </span>
                    </div>
                  </div>

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

            {!isHistory && (
              <div className="flex items-stretch gap-2 mt-auto h-11 w-full text-sm relative">
                {/* Packing Check Badge (Left side in RTL) */}
                {isKanban && isPartiallyPacked && (
                  <div className="absolute left-0 bottom-0 top-0 flex items-center justify-center bg-green-100 text-green-800 text-xs font-bold px-3 rounded-xl border border-green-200 shadow-sm z-10 transition-all">
                    <Box size={14} className="ml-1 text-green-600" />
                    <span>{packedCount}/{totalItems} ארוז</span>
                  </div>
                )}

                {isReady && !isKanban && ( // 🆕 Hide undo in Kanban (can just drag back)
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation(); setIsUpdating(true);
                      try { await onOrderStatusUpdate(order.id, 'undo_ready'); }
                      finally { setIsUpdating(false); }
                    }}
                    className="w-11 h-11 bg-gray-200 border-2 border-gray-300 rounded-xl shadow-sm flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-gray-300 shrink-0 active:scale-95 transition-all outline-none"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}

                {/* 🆕 ONLY SHOW ACTION BUTTON IF IT IS PENDING OR NOT KANBAN */}
                {(isPending || !isKanban) && (
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      console.log('🔘 [OrderCard] Action button clicked!', { id: order.id, status: order.orderStatus, label: nextStatusLabel });
                      e.stopPropagation();
                      setIsUpdating(true);
                      try { await onOrderStatusUpdate(order.id, order.orderStatus); }
                      catch (err) { console.error('❌ [OrderCard] Update error:', err); }
                      finally { setIsUpdating(false); }
                    }}
                    className={`flex-1 rounded-xl font-black text-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''} outline-none`}
                  >
                    {isUpdating ? 'מעדכן...' : nextStatusLabel}
                  </button>
                )}

                {!order.isPaid && !isKanban && ( // 🆕 Hide payment button in Kanban
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation();
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
    </div >
  );
}, (prevProps, nextProps) => {
  // CUSTOM COMPARISON: Only re-render if essential order properties changed
  // This is the BIGgest performance boost for low-end tablets
  return (
    prevProps.isReady === nextProps.isReady &&
    prevProps.isHistory === nextProps.isHistory &&
    prevProps.order.orderStatus === nextProps.order.orderStatus &&
    prevProps.order.isPaid === nextProps.order.isPaid &&
    prevProps.order.customerName === nextProps.order.customerName &&
    prevProps.order.customerPhone === nextProps.order.customerPhone &&
    prevProps.order.updated_at === nextProps.order.updated_at &&
    prevProps.order.type === nextProps.order.type &&
    prevProps.order.items?.length === nextProps.order.items?.length &&
    // Check item statuses and early delivery flags to detect changes
    prevProps.order.items?.every((item, idx) => {
      const nextItem = nextProps.order.items[idx];
      return item.id === nextItem?.id &&
        item.item_status === nextItem?.item_status &&
        item.is_early_delivered === nextItem?.is_early_delivered;
    })
  );
});

OrderCard.displayName = 'OrderCard';

export default OrderCard;