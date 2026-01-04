/**
 * DraggableOrderCard
 * Wrapper around OrderCard to make it draggable with @dnd-kit
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import OrderCard from '../../pages/kds/components/OrderCard';
import { Coffee, Sprout, Globe, GripVertical } from 'lucide-react';

// Map business types to icons (can be used for additional badges if needed)
const BUSINESS_ICONS = {
    cafe: { icon: Coffee, color: 'text-amber-700', bg: 'bg-amber-100' },
    nursery: { icon: Sprout, color: 'text-green-700', bg: 'bg-green-100' },
    default: { icon: Coffee, color: 'text-gray-700', bg: 'bg-gray-100' }
};

export function DraggableOrderCard({
    order,
    businessType = 'cafe',
    onOrderStatusUpdate,
    onPaymentCollected,
    onEditOrder,
    onMarkSeen,
    onReadyItems, // 🆕 For packing toggle
    onSmsClick
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: order.id });

    // 🛑 GROK FIX: Wrapper to handle transitions explicitly
    // Since we removed auto-transitions from useOrders.js, 
    // we must tell the hook exactly WHICH status to move to.
    const handleStatusUpdate = async (id, currentStatus) => {
        let targetStatus = currentStatus;

        // Transition logic specifically for Kanban flow
        // Transition logic specifically for Kanban flow - Unified names
        if (currentStatus === 'pending') targetStatus = 'new';
        else if (currentStatus === 'new') targetStatus = 'in_progress';
        else if (currentStatus === 'in_progress' || currentStatus === 'in_prep') targetStatus = 'ready';
        else if (currentStatus === 'ready') targetStatus = 'delivered';

        console.log('🔄 [DraggableOrderCard] Triggering manual transition:', { from: currentStatus, to: targetStatus });

        if (onOrderStatusUpdate) {
            await onOrderStatusUpdate(id, targetStatus);
        }

        // Also ensure it's marked as seen (though useOrders also does this)
        if (currentStatus === 'pending' && onMarkSeen) {
            onMarkSeen(id);
        }
    };

    const style = {
        transform: CSS.Translate.toString(transform),
        transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        zIndex: isDragging ? 200 : 'auto',
        opacity: isDragging ? 0.3 : 1, // Dim instead of hiding completely for better UX
        touchAction: 'none' // 🛑 Prevent scrolling while dragging on touch devices
    };

    const isOnlineOrder = order.order_origin === 'online';
    const isUnseen = isOnlineOrder && !order.seen_at;

    const handleClick = (e) => {
        // Ignore if click originated from a button or any of its children
        if (e.target.closest('button')) {
            console.log('🚫 [DraggableOrderCard] Ignoring click on button/sub-button');
            return;
        }

        console.log('🖱️ [DraggableOrderCard] Card background clicked', { id: order.id, status: order.order_status });
        if (isUnseen && onMarkSeen) {
            onMarkSeen(order.id);
        }

        if (onEditOrder) {
            onEditOrder(order);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            className={`group relative w-full ${isUnseen ? 'ring-2 ring-blue-400 animate-pulse rounded-2xl' : ''}`}
        >
            {/* Drag Handle Indicator (Visual Only) */}
            <div className="absolute top-2 right-2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical size={16} className="text-slate-400" />
            </div>

            <OrderCard
                order={order}
                isReady={order.order_status === 'ready'}
                isHistory={order.order_status === 'delivered'}
                isKanban={true} // 🆕 Enable specialized Kanban/Packing UI
                onOrderStatusUpdate={handleStatusUpdate}
                onPaymentCollected={onPaymentCollected}
                onEditOrder={onEditOrder}
                onReadyItems={onReadyItems} // 🆕 Enable packing toggle
                onSmsClick={onSmsClick}
            />
        </div>
    );
}

export default DraggableOrderCard;
