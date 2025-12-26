import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Edit, Phone, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import CustomerInfoModal from '../../../components/CustomerInfoModal';

/**
 * OrderEditModal - Simple modal for viewing order items and marking early delivery
 * Uses is_early_delivered field for display only - doesn't affect other status logic
 * 
 * ⚠️ DESIGN NOTE: Do NOT change the styling/design of this component without explicit user approval.
 */

const OrderEditModal = ({
    isOpen,
    order,
    onClose,
    onRefresh,
    isHistoryMode = false
}) => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [orderData, setOrderData] = useState(null);
    const [processingItemId, setProcessingItemId] = useState(null);
    const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
    const [customerInfoModalMode, setCustomerInfoModalMode] = useState('phone');

    // memoize customer data to prevent unnecessary re-renders of the sub-modal
    const currentCustomerData = React.useMemo(() => ({
        phone: orderData?.customer_phone,
        name: orderData?.customer_name,
        id: orderData?.customer_id
    }), [orderData?.customer_phone, orderData?.customer_name, orderData?.customer_id]);

    const loadItemsFromOrder = () => {
        if (!order || !order.items) return;

        const realOrderId = (order.originalOrderId || order.id || '')
            .toString()
            .replace(/-stage-\d+/, '')
            .replace('-ready', '');

        setOrderData({
            id: realOrderId,
            customer_name: order.customerName,
            customer_phone: order.customerPhone,
            customer_id: order.customerId,
            order_number: order.orderNumber,
            is_paid: order.isPaid
        });

        // 1. Flatten items: Each ID in 'ids' becomes an individual row
        const flattened = [];
        const seenIds = new Set();

        order.items.forEach(item => {
            const itemIds = item.ids && item.ids.length > 0 ? item.ids : [item.id];

            itemIds.forEach(id => {
                if (id && seenIds.has(id)) return;
                if (id) seenIds.add(id);

                flattened.push({
                    id: id,
                    menu_item_id: item.menu_item_id || item.menuItemId,
                    name: item.name,
                    quantity: 1,
                    price: item.price || 0,
                    status: item.status,
                    course_stage: item.course_stage || 1,
                    is_early_delivered: item.is_early_delivered || false,
                    modifiers: item.modifiers,
                    notes: item.notes
                });
            });
        });

        const activeItems = flattened
            .filter(i => i.status !== 'cancelled')
            .sort((a, b) => a.name.localeCompare(b.name));

        setItems(activeItems);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen && order) {
            setIsLoading(true);
            loadItemsFromOrder();
        }
    }, [isOpen, order?.id]);

    if (!isOpen || !order) return null;

    const handleToggleEarlyDelivered = async (item) => {
        if (processingItemId) return;

        setProcessingItemId(item.id);
        const newValue = !item.is_early_delivered;

        try {
            const { error } = await supabase.rpc('toggle_early_delivered', {
                p_item_id: item.id,
                p_value: newValue
            });

            if (error) {
                console.error('Failed to update is_early_delivered:', error.message);
            } else {
                setItems(prevItems =>
                    prevItems.map(i =>
                        i.id === item.id ? { ...i, is_early_delivered: newValue } : i
                    )
                );
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            console.error('Error in toggle:', err);
        } finally {
            setProcessingItemId(null);
        }
    };

    const handleOpenFullEditor = () => {
        if (!orderData || !items.length) return;

        try {
            const itemsToUse = items && items.length > 0
                ? items.map(item => ({
                    id: item.id,
                    menu_item_id: item.menu_item_id || item.menuItemId,
                    menuItemId: item.menu_item_id || item.menuItemId,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    mods: item.modifiers,
                    notes: item.notes,
                    selectedOptions: [],
                    course_stage: item.course_stage || 1
                }))
                : items;

            const calculatedTotal = itemsToUse.reduce((sum, item) =>
                sum + (item.price || 0) * (item.quantity || 1), 0
            );

            const totalToUse = order.totalAmount || calculatedTotal;

            const editData = {
                id: orderData.id,
                orderNumber: orderData.order_number,
                customerName: orderData.customer_name,
                customerId: order.customerId,
                customerPhone: order.customerPhone,
                isPaid: orderData.is_paid || order.isPaid,
                totalAmount: totalToUse,
                originalTotal: totalToUse,
                originalPaidAmount: order.paidAmount || totalToUse,
                items: itemsToUse,
                originalItems: itemsToUse,
                restrictedMode: isHistoryMode,
                // CRITICAL: Pass original order status so menu-ordering-interface knows to reset it to 'in_progress'
                originalOrderStatus: order.orderStatus || order.order_status || 'completed'
            };

            sessionStorage.setItem('editOrderData', JSON.stringify(editData));
            navigate(`/menu-ordering-interface?editOrderId=${orderData.id}`);
        } catch (err) {
            console.error('Error opening full editor:', err);
        }
    };

    const formatPrice = (price) => {
        if (!price) return '';
        return `₪${Number(price).toFixed(0)}`;
    };

    // Check if customer is a guest
    const rawName = orderData?.customer_name || '';
    const customerName = typeof rawName === 'string' ? rawName.trim() : '';
    const isGuest = !customerName || ['אורח', 'אורח/ת', 'הזמנה מהירה', 'אורח כללי', 'אורח אנונימי'].includes(customerName) || customerName.startsWith('#');
    const hasPhone = !!orderData?.customer_phone;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header - White with order number and edit button */}
                <div className="bg-white p-4 flex items-center justify-between">
                    {/* Order number - Right side (in RTL) */}
                    <h2 className="text-xl font-bold text-slate-800">
                        #{orderData?.order_number}
                    </h2>

                    {/* Edit button - Left side (in RTL) */}
                    <button
                        onClick={handleOpenFullEditor}
                        className="px-4 py-2 rounded-xl bg-orange-100 text-orange-500 font-bold text-sm flex items-center gap-2 hover:bg-orange-200 transition"
                    >
                        <Edit size={18} />
                        <span>עריכה מלאה</span>
                    </button>
                </div>

                {/* Items List */}
                <div className="px-4 pb-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                        </div>
                    ) : (
                        items.map((item) => {
                            const isMarked = item.is_early_delivered;
                            return (
                                <div
                                    key={`${item.id}-${isMarked}`}
                                    onClick={() => handleToggleEarlyDelivered(item)}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.99]"
                                >
                                    {/* Right side: Checkbox + Name */}
                                    <div className="flex items-center gap-3 flex-1">
                                        {/* Checkbox */}
                                        <div className={`
                                            w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0
                                            ${isMarked
                                                ? 'bg-green-500 text-white'
                                                : 'bg-gray-200 text-gray-400'}
                                        `}>
                                            <Check size={20} strokeWidth={3} />
                                        </div>

                                        {/* Item name */}
                                        <span className={`text-lg font-bold ${isMarked ? 'text-gray-400 line-through' : 'text-slate-800'}`}>
                                            {item.name}
                                        </span>
                                    </div>

                                    {/* Left side: Price */}
                                    <div className={`text-base font-bold ${isMarked ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {formatPrice(item.price * (item.quantity || 1))}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {items.length === 0 && !isLoading && (
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-lg font-bold">אין פריטים בהזמנה</p>
                        </div>
                    )}
                </div>

                {/* Customer Info Buttons */}
                {!isLoading && orderData && (
                    <div className="px-4 pb-4 flex items-center justify-center gap-3">
                        {/* Orange button - Add Phone + Name */}
                        <button
                            onClick={() => { setCustomerInfoModalMode('phone-then-name'); setShowCustomerInfoModal(true); }}
                            className="px-5 py-3 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center gap-2 hover:bg-orange-600 transition-all active:scale-95"
                        >
                            <Phone size={18} />
                            <span>הוסף טלפון+שם</span>
                        </button>

                        {/* White/Gray button - Add Name Only */}
                        <button
                            onClick={() => { setCustomerInfoModalMode('name'); setShowCustomerInfoModal(true); }}
                            className="px-5 py-3 rounded-full bg-white text-gray-700 border border-gray-300 font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition-all active:scale-95"
                        >
                            <User size={18} />
                            <span>הוסף שם</span>
                        </button>
                    </div>
                )}

                {/* Footer - Dark Close Button */}
                <div className="p-4">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-2xl hover:bg-slate-800 transition active:scale-[0.98]"
                    >
                        סגור
                    </button>
                </div>
            </div>

            {/* Customer Info Modal */}
            <CustomerInfoModal
                isOpen={showCustomerInfoModal}
                onClose={() => setShowCustomerInfoModal(false)}
                mode={customerInfoModalMode}
                currentCustomer={currentCustomerData}
                onCustomerUpdate={async (updatedCustomer) => {
                    setOrderData({
                        ...orderData,
                        customer_id: updatedCustomer.id,
                        customer_phone: updatedCustomer.phone,
                        customer_name: updatedCustomer.name
                    });
                    setShowCustomerInfoModal(false);
                    setTimeout(() => {
                        onRefresh?.();
                        onClose();
                    }, 300);
                }}
                orderId={orderData?.id}
            />
        </div>
    );
};

export default OrderEditModal;
