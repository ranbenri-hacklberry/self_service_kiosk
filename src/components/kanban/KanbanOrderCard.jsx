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
  onSmsClick,
  isDriverView, // 🆕
  dragAttributes, // 🆕
  dragListeners   // 🆕
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // Normalize Data (Handle snake_case vs camelCase)
  const status = order.order_status || order.orderStatus || '';
  const statusLower = status.toLowerCase();
  // isPaid: if is_paid is explicitly false, use it. If undefined, check isPaid.
  const isPaid = order.is_paid !== undefined ? order.is_paid : order.isPaid;
  const customerName = order.customer_name || order.customerName || '';
  const customerPhone = order.customer_phone || order.customerPhone || '';
  const deliveryAddress = order.delivery_address || order.deliveryAddress;
  const orderType = order.order_type || order.orderType;

  // Status Styles - Specialized for Kanban
  const statusStyles = useMemo(() => {
    const isUnpaid = isPaid === false;
    const isDelayedCard = order.type === 'delayed';

    if (isUnpaid) return 'border-t-[6px] border-red-500 shadow-sm';
    if (isDelayedCard) return 'border-t-[6px] border-slate-400 shadow-inner bg-slate-100 opacity-90';
    if (statusLower === 'pending') return 'border-t-[6px] border-amber-500 shadow-md animate-pulse bg-amber-50/30';
    if (statusLower === 'new') return 'border-t-[6px] border-green-500 shadow-md';
    if (statusLower === 'in_progress' || statusLower === 'in_prep') return 'border-t-[6px] border-yellow-500 shadow-lg ring-1 ring-yellow-100';
    if (statusLower === 'ready') return 'border-t-[6px] border-purple-500 shadow-md';
    if (statusLower === 'shipped') return 'border-t-[6px] border-blue-500 shadow-md';

    return 'border-gray-200 shadow-sm';
  }, [order.type, statusLower, isPaid]);

  const unifiedItems = useMemo(() => sortItems(order.items || []), [order.items]);

  const deliveryInfo = useMemo(() => {
    if (!order.delivery_info) return {};
    return typeof order.delivery_info === 'string'
      ? JSON.parse(order.delivery_info)
      : order.delivery_info;
  }, [order.delivery_info]);

  const renderItemRow = useCallback((item, idx) => {
    // 🆕 Updated logic: Ready = Packed
    const isPacked = item.item_status === 'ready' || item.is_packed === true;

    return (
      <div key={`${item.menuItemId}-${item.modsKey || item.id || idx}`}
        className={`flex flex-col border-b border-dashed border-gray-100 pb-0.5 last:border-0 ${isPacked ? 'bg-green-50/50' : ''}`}>
        <div className="flex items-start gap-[5px] relative">
          {isPacked && (
            <div className="absolute top-[13px] right-7 left-1 flex items-center pointer-events-none z-10">
              <div className="w-full h-[2px] bg-green-600/20" />
            </div>
          )}

          <div className="flex items-start gap-[5px] flex-1 min-w-0 tracking-tight p-1 -m-1 rounded-lg">
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
      {/* Header - DRAG HANDLE */}
      <div
        className="flex justify-between items-start mb-2 border-b border-gray-50 pb-1 cursor-grab active:cursor-grabbing hover:bg-gray-50/50 rounded-t-lg transition-colors p-1 -m-1"
        {...dragAttributes}
        {...dragListeners}
      >
        <div className="flex flex-col overflow-hidden flex-1 pointer-events-none">
          <div className="flex items-center gap-2 w-full">
            <div className="text-xl font-black text-slate-900 leading-none truncate">
              {customerName && !['אורח', 'אורח אנונימי'].includes(customerName) ? customerName : `#${order.orderNumber}`}
            </div>
          </div>

          {/* Kanban Info Badges */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${order.items?.every(i => i.item_status === 'ready' || i.is_packed)
              ? 'bg-green-100 text-green-700 border-green-200'
              : (order.items?.some(i => i.item_status === 'ready' || i.is_packed) ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200')
              }`}>
              <Package size={10} />
              {order.items?.filter(i => i.item_status === 'ready' || i.is_packed).length}/{order.items?.length} ארוז
            </span>
            {orderType === 'delivery' && (
              <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1">
                <Truck size={10} /> משלוח
              </span>
            )}
            {!isPaid && (
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
            <span dir="ltr">{order.timestamp || order.created_at?.slice(11, 16)}</span>
          </div>
          {onEditOrder && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditOrder?.(order); }}
              onPointerDown={(e) => e.stopPropagation()} // 🛑 Prevent drag
              className="p-1 text-slate-400 hover:text-blue-500 transition-colors pointer-events-auto"
            >
              <Edit size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Delivery Details */}
      {(deliveryAddress || deliveryInfo.address) && (
        <div className="mb-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-sm">
          <div className="flex items-start gap-2 text-slate-800 font-bold">
            <MapPin size={14} className="mt-0.5 shrink-0 text-purple-500" />
            <span>{deliveryAddress || deliveryInfo.address}</span>
          </div>
          {customerPhone && (
            <div className="flex items-center gap-2 mt-1 text-slate-500 font-mono text-xs">
              <Phone size={12} />
              <span dir="ltr">{customerPhone}</span>
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
        {statusLower === 'ready' && (
          <button
            onClick={(e) => { e.stopPropagation(); onOrderStatusUpdate?.(order.id, 'shipped'); }}
            onPointerDown={(e) => e.stopPropagation()} // 🛑 Prevent drag
            className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all"
          >
            <Truck size={16} />
            <span>מסור לשליח</span>
          </button>
        )}
        {onPaymentCollected && !isPaid && (
          <button
            onClick={(e) => { e.stopPropagation(); onPaymentCollected(order); }}
            onPointerDown={(e) => e.stopPropagation()} // 🛑 Prevent drag
            className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md hover:bg-amber-600 active:scale-95 transition-all"
          >
            ₪{order.totalAmount?.toFixed(0) || order.total_amount?.toFixed(0)} לתשלום
          </button>
        )}
        {statusLower === 'shipped' && (
          <button
            onClick={(e) => { e.stopPropagation(); onOrderStatusUpdate?.(order.id, 'delivered'); }}
            onPointerDown={(e) => e.stopPropagation()} // 🛑 Prevent drag
            className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-green-700 active:scale-95 transition-all"
          >
            סמן כנמסר
          </button>
        )}
      </div>
    </div>
  );
});

KanbanOrderCard.displayName = 'KanbanOrderCard';
export default KanbanOrderCard;