import React, { useState, useCallback, memo, useMemo } from 'react';
import { Clock, Edit, MapPin, Package, Phone, Truck } from 'lucide-react';
import { sortItems } from '../../utils/kdsUtils';
import { getShortName, getModColorClass } from '@/config/modifierShortNames';

const KanbanOrderCard = memo(({
  order,
  isReady = false,
  glowClass = '',
  onOrderStatusUpdate,
  onPaymentCollected,
  onReadyItems, // For packing toggle
  onEditOrder,
  onSmsClick
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // Status Styles - Specialized for Kanban
  const statusStyles = useMemo(() => {
    const statusLower = (order.orderStatus || '').toLowerCase();
    const isUnpaid = order.isPaid === false;
    const isDelayedCard = order.type === 'delayed';

    if (isUnpaid) return 'border-t-[6px] border-red-500 shadow-sm';
    if (isDelayedCard) return 'border-t-[6px] border-slate-400 shadow-inner bg-slate-100 opacity-90';
    if (statusLower === 'pending') return 'border-t-[6px] border-amber-500 shadow-md animate-pulse bg-amber-50/30';
    if (statusLower === 'new') return 'border-t-[6px] border-green-500 shadow-md';
    if (statusLower === 'in_progress') return 'border-t-[6px] border-yellow-500 shadow-lg ring-1 ring-yellow-100';
    if (statusLower === 'ready') return 'border-t-[6px] border-purple-500 shadow-md';

    return 'border-gray-200 shadow-sm';
  }, [order.type, order.orderStatus, order.isPaid]);

  const unifiedItems = useMemo(() => sortItems(order.items || []), [order.items]);

  const deliveryInfo = useMemo(() => {
    if (!order.delivery_info) return {};
    return typeof order.delivery_info === 'string'
      ? JSON.parse(order.delivery_info)
      : order.delivery_info;
  }, [order.delivery_info]);

  const renderItemRow = useCallback((item, idx) => {
    const isPacked = item.is_packed === true;

    return (
      <div key={`${item.menuItemId}-${item.modsKey || item.id || idx}`}
        className={`flex flex-col border-b border-dashed border-gray-100 pb-0.5 last:border-0 ${isPacked ? 'bg-green-50/50' : ''}`}>
        <div className="flex items-start gap-[5px] relative">
          {isPacked && (
            <div className="absolute top-[13px] right-7 left-1 flex items-center pointer-events-none z-10">
              <div className="w-full h-[2px] bg-green-600/20" />
            </div>
          )}

          <div
            className="flex items-start gap-[5px] flex-1 min-w-0 tracking-tight cursor-pointer active:scale-[0.98] transition-all p-1 -m-1 rounded-lg hover:bg-black/5"
            onClick={(e) => {
              e.stopPropagation();
              if (onReadyItems) onReadyItems(order.id, [item]);
            }}
          >
            <span className={`flex items-center justify-center rounded-lg font-black shadow-sm shrink-0 w-6 h-6 text-base ${item.quantity > 1 ? 'bg-orange-600 text-white' : (isPacked ? 'bg-green-500 text-white' : 'bg-slate-900 text-white')
              }`}>
              {item.quantity}
            </span>

            <div className="flex-1 pt-0 min-w-0 pr-0">
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-1 text-right leading-snug">
                  <span className={`font-bold text-base ${item.quantity > 1 ? 'text-orange-700' : (isPacked ? 'text-green-700' : 'text-gray-900')}`}>
                    {item.name}
                  </span>
                  {item.modifiers?.map((mod, i) => {
                    const shortName = getShortName(mod.text || mod.valueName || mod);
                    if (shortName === null) return null;
                    return (
                      <span key={i} className={`mod-label ${getModColorClass(mod.text || mod.valueName || mod, shortName)} text-xs px-1 rounded-sm`}>
                        {shortName}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [onReadyItems, order.id]);

  return (
    <div className={`kds-card w-full flex-shrink-0 rounded-2xl px-[10px] pt-2 pb-3 flex flex-col h-full font-heebo ${order.type === 'delayed' ? 'bg-gray-50' : 'bg-white'} ${statusStyles} border-x border-b border-gray-100 ${glowClass}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-1">
        <div className="flex flex-col overflow-hidden flex-1">
          <div className="flex items-center gap-2 w-full">
            <div className="text-xl font-black text-slate-900 leading-none truncate">
              {order.customerName && !['אורח', 'אורח אנונימי'].includes(order.customerName) ? order.customerName : `#${order.orderNumber}`}
            </div>
          </div>

          {/* Kanban Info Badges */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${order.items?.every(i => i.is_packed)
              ? 'bg-green-100 text-green-700 border-green-200'
              : (order.items?.some(i => i.is_packed) ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200')
              }`}>
              <Package size={10} />
              {order.items?.filter(i => i.is_packed).length}/{order.items?.length} ארוז
            </span>
            {order.orderType === 'delivery' && (
              <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1">
                <Truck size={10} /> משלוח
              </span>
            )}
            {!order.isPaid && (
              <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200">לא שולם</span>
            )}
            {order.isSecondCourse && (
              <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-purple-200">מנה שניה</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-500 text-[10px] font-mono">
            <Clock size={10} />
            <span dir="ltr">{order.timestamp}</span>
          </div>
          {onEditOrder && (
            <button onClick={() => onEditOrder?.(order)} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
              <Edit size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Delivery Details */}
      {(order.deliveryAddress || deliveryInfo.address) && (
        <div className="mb-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-sm">
          <div className="flex items-start gap-2 text-slate-800 font-bold">
            <MapPin size={14} className="mt-0.5 shrink-0 text-purple-500" />
            <span>{order.deliveryAddress || deliveryInfo.address}</span>
          </div>
          {order.customerPhone && (
            <div className="flex items-center gap-2 mt-1 text-slate-500 font-mono text-xs">
              <Phone size={12} />
              <span dir="ltr">{order.customerPhone}</span>
            </div>
          )}
        </div>
      )}

      {/* Items Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar mb-2">
        <div className="flex flex-col space-y-1">
          {unifiedItems.map((item, idx) => renderItemRow(item, idx))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-2 border-t border-gray-50 flex gap-2">
        {order.orderStatus === 'ready' && (
          <button
            onClick={(e) => { e.stopPropagation(); onOrderStatusUpdate?.(order.id, 'shipped'); }}
            className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
          >
            <Truck size={16} />
            <span>מסור לשליח</span>
          </button>
        )}
        {onPaymentCollected && !order.isPaid && (
          <button
            onClick={(e) => { e.stopPropagation(); onPaymentCollected(order); }}
            className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md"
          >
            ₪{order.totalAmount?.toFixed(0)} לתשלום
          </button>
        )}
        {order.orderStatus === 'shipped' && (
          <button
            onClick={(e) => { e.stopPropagation(); onOrderStatusUpdate?.(order.id, 'delivered'); }}
            className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-sm shadow-md"
          >
            סמן כנמסר
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isReady === nextProps.isReady &&
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
        item.is_packed === nextItem?.is_packed;
    })
  );
});

KanbanOrderCard.displayName = 'KanbanOrderCard';
export default KanbanOrderCard;