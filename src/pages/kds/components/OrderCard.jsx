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
import { Clock, Edit, RotateCcw, Flame, Truck, Phone, MapPin, Package, Check, CheckCircle, Box } from 'lucide-react';
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
      const startStr = order.created_at;
      const endStr = order.ready_at;
      const start = new Date(startStr).getTime();
      let end;

      if (endStr) {
        end = new Date(endStr).getTime();
      } else if (isReady || isHistory) {
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
  isDriverView = false,
  isKanban = false,
  glowClass = '',
  onOrderStatusUpdate,
  onPaymentCollected,
  onFireItems,
  onReadyItems,
  onEditOrder,
  onRefresh
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // Memoize status styles to avoid recalculating classes
  const statusStyles = useMemo(() => {
    const statusLower = (order.orderStatus || '').toLowerCase();
    const isUnpaid = order.isPaid === false;
    const isDelayedCard = order.type === 'delayed';
    const isUnpaidDelivered = order.type === 'unpaid_delivered';

    if (isUnpaid && !isHistory) {
      if (statusLower === 'ready') return 'border-t-[6px] border-red-600 shadow-md ring-2 ring-red-100 animate-pulse';
      return 'border-t-[6px] border-red-500 shadow-sm';
    }
    if (isHistory && isUnpaid) return 'border-t-[6px] border-amber-500 shadow-sm';

    if (isDelayedCard) return 'border-t-[6px] border-slate-400 shadow-inner bg-slate-100 opacity-90 grayscale-[0.3]';
    if (isUnpaidDelivered) return 'border-t-[6px] border-blue-500 shadow-md animate-strong-pulse bg-blue-50/30';

    if (statusLower === 'pending') return 'border-t-[6px] border-amber-500 shadow-md animate-pulse bg-amber-50/30';
    if (statusLower === 'new') return 'border-t-[6px] border-green-500 shadow-md';
    if (statusLower === 'in_progress' || statusLower === 'in_prep') return 'border-t-[6px] border-yellow-500 shadow-lg ring-1 ring-yellow-100';

    return 'border-gray-200 shadow-sm';
  }, [order.type, order.orderStatus, isHistory, order.isPaid]);

  const { isLargeOrder, rightColItems, leftColItems, unifiedItems } = useMemo(() => {
    // ⚠️ CRITICAL: NO sortItems here!
    // Items arrive pre-sorted and must NOT be re-sorted on render
    // This prevents items from jumping when marked as ready
    const items = order.items || [];

    const getItemRows = (item) => {
      if (!item.modifiers) return 1;
      const visibleModsCount = item.modifiers.filter(m => getShortName(m.text || m.valueName || m) !== null).length;
      return visibleModsCount <= 1 ? 1 : 2;
    };

    const totalRows = items.reduce((acc, item) => acc + getItemRows(item), 0);
    const splitNeeded = totalRows > 5 && !isHistory;

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
  }, [order.items, isHistory]);

  // Calculate packing progress for Kanban
  const packedCount = useMemo(() => {
    if (!order.items) return 0;
    // For Kanban, we count items that ARE 'ready' (packed) or 'shipped' as packed.
    return order.items.filter(i => i.item_status === 'ready' || i.item_status === 'shipped').length;
  }, [order.items]);

  const totalItems = order.items?.length || 0;
  const isPartiallyPacked = !isHistory && !isReady && totalItems > 0 && packedCount > 0;

  const orderStatusLower = (order.orderStatus || '').toLowerCase();
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
    : (isDriverView ? 'w-full' : (isLargeOrder ? 'w-[420px]' : 'w-[280px]'));

  const deliveryInfo = useMemo(() => {
    if (!order.delivery_info) return {};
    return typeof order.delivery_info === 'string' ? JSON.parse(order.delivery_info) : order.delivery_info;
  }, [order.delivery_info]);

  const renderItemRow = useCallback((item, idx, isLarge) => {
    // KDS: Early Delivery (Visual Strikethrough/Dimming)
    const isEarlyDelivered = !isReady && !isHistory && (item.is_early_delivered === true);

    // Kanban: Packed Status (Green Badge/Checkmark)
    // Only applied if isKanban is TRUE.
    const isPackedItem = isKanban && (item.item_status === 'ready' || item.item_status === 'shipped');

    const nameSizeClass = isHistory ? 'text-sm' : 'text-base';
    const badgeSizeClass = isHistory ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-base';
    const modSizeClass = isHistory ? 'text-[10px]' : 'text-xs';

    return (
      <div key={`${item.menuItemId}-${item.modsKey || item.id || idx}`} className={`flex flex-col transition-colors duration-300 ${isLarge ? 'border-b border-gray-50 pb-0.5' : 'border-b border-dashed border-gray-100 pb-0.5 last:border-0'} ${isEarlyDelivered ? '-mx-1 px-1 rounded-md mb-1 bg-gray-50/50' : ''} ${isEarlyDelivered && !isKanban ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-[5px] relative">

          {/* KDS: Early Delivery Indicator Line */}
          {isEarlyDelivered && !isKanban && (
            <div className="absolute top-[13px] right-7 left-1 flex items-center pointer-events-none z-10">
              <div className="w-full h-[3px] bg-green-600/30 rounded-full" />
            </div>
          )}

          <div
            className={`flex items-start gap-[5px] flex-1 min-w-0 tracking-tight cursor-pointer active:scale-[0.98] transition-all p-1 -m-1 rounded-lg hover:bg-black/5`}
            onClick={(e) => {
              e.stopPropagation();
              // Only allow toggling if NOT history and NOT ready
              // Behavior differs by view:
              // Kanban: Toggles packed/ready status
              // KDS: Toggles early_delivered (if implemented upstream)
              if (onReadyItems && !isReady && !isHistory) {
                onReadyItems(order.id, [item]);
              }
            }}
          >
            {/* Quantity Badge */}
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
                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                        <span className={`font-bold ${isEarlyDelivered ? 'text-gray-500' : (item.quantity > 1 ? 'text-orange-700' : 'text-gray-900')} ${nameSizeClass}`}>
                          {item.name}
                        </span>
                        {isPackedItem && <Check size={14} className="text-green-600 stroke-[3]" />}
                      </div>
                    </div>
                  );
                }

                const visibleMods = item.modifiers
                  .map(mod => ({ ...mod, shortName: getShortName(mod.text || mod.valueName || mod) }))
                  .filter(mod => mod.shortName !== null);

                // If no shortnames found, standard render
                if (visibleMods.length === 0) {
                  return (
                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                        <span className={`font-bold ${isEarlyDelivered ? 'text-gray-500' : (item.quantity > 1 ? 'text-orange-700' : 'text-gray-900')} ${nameSizeClass}`}>
                          {item.name}
                        </span>
                        {isPackedItem && <Check size={14} className="text-green-600 stroke-[3]" />}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                      <span className={`font-bold ${isEarlyDelivered ? 'text-gray-500' : (item.quantity > 1 ? 'text-orange-700' : 'text-gray-900')} ${nameSizeClass}`}>
                        {item.name}
                      </span>
                      {isPackedItem && <Check size={14} className="text-green-600 stroke-[3]" />}

                      {visibleMods.map((mod, i) => (
                        <span key={i} className={`mod-label ${getModColorClass(mod.text || mod.valueName || mod, mod.shortName)} ${modSizeClass}`}>
                          {mod.shortName}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }, [isHistory, isReady, order.type, onReadyItems, order.id, isKanban]);

  // Detect item addition (merge) for flash effect
  const prevItemsLength = React.useRef(order.items?.length || 0);
  const [shouldFlash, setShouldFlash] = useState(false);

  useEffect(() => {
    if (order.items?.length > prevItemsLength.current) {
      // Items added -> Merge detected
      setShouldFlash(true);
      const timer = setTimeout(() => setShouldFlash(false), 1500); // Flash for 1.5s
      return () => clearTimeout(timer);
    }
    prevItemsLength.current = order.items?.length;
  }, [order.items?.length]);

  return (
    <div className={`kds-card ${cardWidthClass} flex-shrink-0 rounded-2xl px-[5px] pt-1.5 pb-2.5 ${isHistory ? 'mx-[2px]' : 'mx-2'} flex flex-col h-full font-heebo ${(order.type === 'delayed' || orderStatusLower === 'new') ? 'bg-gray-100' : 'bg-white'} ${statusStyles} border-x border-b border-gray-100 ${glowClass} ${shouldFlash ? 'animate-pulse ring-4 ring-orange-400 z-20' : ''} relative overflow-hidden`}>

      {/* Header */}
      <div className="z-0 flex justify-between items-start mb-0.5 border-b border-gray-50 pb-0.5">
        <div className="flex flex-col overflow-hidden flex-1">
          <div className="flex flex-col w-full">
            <div className="flex items-center gap-2 w-full">
              <div className={`${isHistory ? 'text-lg' : 'text-2xl'} font-black text-slate-900 leading-none tracking-tight truncate`}>
                {order.customerName && !['אורח', 'אורח אנונימי'].includes(order.customerName) ? order.customerName : `#${order.orderNumber}`}
              </div>
            </div>

            {isDriverView && (
              <div className="flex flex-col gap-1 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={14} className="text-slate-400" />
                    <span className="font-mono font-bold text-sm" dir="ltr">{order.customerPhone}</span>
                  </div>
                )}
                {(order.deliveryAddress || deliveryInfo.address) && (
                  <div className="flex items-start gap-2 text-slate-800">
                    <MapPin size={14} className="mt-1 shrink-0 text-purple-500" />
                    <span className="font-bold text-sm leading-tight">{order.deliveryAddress || deliveryInfo.address}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-left flex flex-col items-end shrink-0 ml-2 gap-1.5">
          <div className="flex items-center gap-2">
            {!isHistory && onEditOrder && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-bold text-xs transition-all flex items-center gap-1 border border-blue-100 h-6"
              >
                <Edit size={12} strokeWidth={2.5} />
                <span className="font-mono">#{order.orderNumber}</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-bold h-6 transition-colors bg-gray-50 border-gray-200 text-gray-500">
              <Clock size={12} />
              <span className="font-mono dir-ltr text-[10px]">{order.timestamp}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Area */}
      <div className="z-0 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar pr-1 mr-1 mb-2">
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

      <div className={`mt-auto flex flex-col gap-2 relative ${orderStatusLower === 'new' ? 'z-[10]' : 'z-0'}`}>
        {order.type === 'delayed' ? (
          <button
            disabled={isUpdating}
            onClick={async (e) => {
              e.stopPropagation(); setIsUpdating(true);
              try {
                const flatIds = order.items.flatMap(i => i.ids || [i.id]);
                const itemsPayload = flatIds.map(id => ({ id }));
                if (onFireItems) await onFireItems(order.id || order.originalOrderId, itemsPayload);
              } finally { setIsUpdating(false); }
            }}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-lg shadow-lg active:translate-y-1 transition-all flex items-center justify-center gap-2"
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
              </div>
            )}

            {isHistory && (
              <div className="mt-auto pt-2 border-t border-gray-100/50">
                <div className="flex flex-col gap-1.5">
                  <div className={`flex items-center gap-2 p-1 border rounded-xl transition-colors ${order.isPaid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div className={`flex-1 flex items-center justify-between text-xs ${order.isPaid ? 'text-gray-500 bg-gray-50/80 border-gray-100' : 'text-amber-700 bg-amber-50 border-amber-200 shadow-sm -translate-y-0.5 cursor-pointer hover:bg-amber-100 transition-colors'} p-1.5 rounded-lg border`}>

                      {!order.isPaid ? (
                        <div
                          className="flex items-center justify-between w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onPaymentCollected) onPaymentCollected(order);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-amber-100">
                              <img
                                src="https://gxzsxvbercpkgxraiaex.supabase.co/storage/v1/object/public/Photos/cashregister.jpg"
                                alt="קופה"
                                className="w-3.5 h-3.5 object-contain"
                              />
                            </div>
                            <span className="font-bold">לתשלום</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 px-1">
                            <span className="text-sm font-black text-amber-800 tracking-tight">
                              ₪{(order.totalOriginalAmount || order.fullTotalAmount || order.totalAmount)?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CheckCircle size={14} className="text-green-500 shrink-0" />
                            <div className="flex flex-col">
                              <span className="truncate font-bold">
                                {PAYMENT_LABELS[order.payment_method] || order.payment_method || 'שולם'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 px-1">
                            <span className="text-sm font-black text-slate-800 tracking-tight">
                              ₪{(order.totalOriginalAmount || order.fullTotalAmount || order.totalAmount)?.toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {onEditOrder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditOrder(order);
                      }}
                      className="w-full py-1.5 bg-slate-100/80 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                    >
                      <Edit size={12} />
                      עריכת הזמנה
                    </button>
                  )}
                </div>
              </div>
            )}


            {!isHistory && (
              <div className="flex items-stretch gap-2 mt-auto h-11 w-full text-sm relative">

                {/* Kanban Packing Status */}
                {isKanban && isPartiallyPacked && (
                  <div className="absolute left-0 bottom-0 top-0 flex items-center justify-center bg-green-100 text-green-800 text-xs font-bold px-3 rounded-xl border border-green-200 shadow-sm z-10 transition-all">
                    <Box size={14} className="ml-1 text-green-600" />
                    <span>{packedCount}/{totalItems} ארוז</span>
                  </div>
                )}

                {isReady && !isKanban && (
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation(); setIsUpdating(true);
                      try { await onOrderStatusUpdate(order.id, 'undo_ready'); }
                      finally { setIsUpdating(false); }
                    }}
                    className="w-11 h-11 bg-gray-200 border-2 border-gray-300 rounded-xl shadow-sm flex items-center justify-center text-gray-700 shrink-0 active:scale-95 transition-all outline-none"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}

                <button
                  disabled={isUpdating}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsUpdating(true);
                    try { await onOrderStatusUpdate(order.id, order.orderStatus); }
                    finally { setIsUpdating(false); }
                  }}
                  className={`flex-1 rounded-xl font-black text-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center ${actionBtnColor} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''} outline-none`}
                >
                  {isUpdating ? 'מעדכן...' : nextStatusLabel}
                </button>

                {!order.isPaid && (
                  <button
                    disabled={isUpdating}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (onPaymentCollected) {
                        setIsUpdating(true); await onPaymentCollected(order); setIsUpdating(false);
                      }
                    }}
                    className="w-11 h-11 bg-white border-2 border-amber-400 rounded-xl shadow-sm flex items-center justify-center hover:bg-amber-50 shrink-0 relative active:scale-95 transition-all outline-none"
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
}, (prevProps, nextProps) => {
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