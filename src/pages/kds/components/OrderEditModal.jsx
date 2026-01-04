import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Phone, User, Edit3 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import CustomerInfoModal from '../../../components/CustomerInfoModal';

/**
 * OrderEditModal - Simple modal for viewing order items and marking early delivery
 * Uses is_early_delivered field for display only - doesn't affect other status logic
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

    const currentCustomerData = React.useMemo(() => {
        const phone = orderData?.customer_phone || '';
        const phoneStr = phone.toString();
        const sanitizedPhone = (phoneStr.includes('GUEST') || phoneStr.includes('_') || phoneStr.length > 15) ? '' : phoneStr;

        const name = orderData?.customer_name || '';
        const nameStr = typeof name === 'string' ? name : '';
        const sanitizedName = (nameStr.includes('GUEST') || ['אורח', 'אורח אנונימי'].includes(nameStr)) ? '' : nameStr;

        return {
            phone: sanitizedPhone,
            name: sanitizedName,
            id: orderData?.customer_id
        };
    }, [orderData?.customer_phone, orderData?.customer_name, orderData?.customer_id]);

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
            is_paid: order.isPaid,
            payment_method: order.paymentMethod || order.payment_method
        });

        const flattened = [];
        const seenIds = new Set();

        order.items.forEach(item => {
            const itemIds = item.ids && item.ids.length > 0 ? item.ids : [item.id];
            itemIds.forEach(id => {
                if (id && seenIds.has(id)) return;
                if (id) seenIds.add(id);

                flattened.push({
                    id: id,
                    name: item.name,
                    quantity: 1,
                    price: item.price || 0,
                    status: item.status,
                    is_early_delivered: item.is_early_delivered || false
                });
            });
        });

        setItems(flattened.filter(i => i.status !== 'cancelled'));
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen && order) {
            loadItemsFromOrder();
        }
    }, [isOpen, order]);

    if (!isOpen || !order) return null;

    const handleToggleEarlyDelivered = async (item) => {
        if (processingItemId || isHistoryMode) return;
        setProcessingItemId(item.id);
        const newValue = !item.is_early_delivered;

        try {
            // Optimistic update
            setItems(prevItems =>
                prevItems.map(i => i.id === item.id ? { ...i, is_early_delivered: newValue } : i)
            );

            const { error } = await supabase.rpc('toggle_early_delivered', {
                p_item_id: item.id,
                p_value: newValue
            });

            if (error) {
                // Revert locally on error
                setItems(prevItems =>
                    prevItems.map(i => i.id === item.id ? { ...i, is_early_delivered: !newValue } : i)
                );
                throw error;
            }
            // Note: We avoid onRefresh() here to prevent the card from "jumping" due to server re-ordering
            // during fetchOrders. The optimistic update is enough for the modal.
        } catch (err) {
            console.error('Error in toggle:', err);
        } finally {
            setProcessingItemId(null);
        }
    };

    const formatPrice = (price) => {
        const num = Number(price);
        return `₪${num.toFixed(0)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
                <div className="bg-white p-4 flex items-center justify-between border-b">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight">פרטי הזמנה #{orderData?.order_number}</h2>
                        {!isHistoryMode && (
                            <button
                                onClick={() => navigate(`/?editOrderId=${orderData.id}&from=kds`, { replace: true })}
                                className="text-blue-600 font-bold text-xs flex items-center gap-1 mt-0.5 hover:text-blue-700 transition-colors"
                            >
                                <Edit3 size={12} />
                                <span>עריכה מלאה (שינוי פריטים)</span>
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition shrink-0"><X size={24} /></button>
                </div>

                <div className="px-4 py-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 font-medium">אין פריטים להצגה</div>
                    ) : items.map((item) => (
                        <div key={item.id} onClick={() => handleToggleEarlyDelivered(item)} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.99]">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 me-3 ${item.is_early_delivered ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                <Check size={20} strokeWidth={3} />
                            </div>
                            <div className="flex-1 flex items-center justify-between gap-3">
                                <span className={`text-lg font-bold ${item.is_early_delivered ? 'text-gray-400 line-through' : 'text-slate-800'}`}>{item.name}</span>
                                <div className={`text-base font-bold ${item.is_early_delivered ? 'text-gray-400' : 'text-gray-600'}`}>{formatPrice(item.price)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {!isLoading && orderData && (
                    <div className="px-4 pb-4 flex items-center justify-center gap-3">
                        <button onClick={() => { setCustomerInfoModalMode('phone-then-name'); setShowCustomerInfoModal(true); }} className={`flex-1 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${currentCustomerData.phone ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                            <Phone size={16} />
                            {currentCustomerData.phone ? (
                                <>
                                    <span className="font-mono" dir="ltr">{currentCustomerData.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </>
                            ) : (
                                <span>הוסף טלפון</span>
                            )}
                        </button>
                        <button onClick={() => { setCustomerInfoModalMode('name'); setShowCustomerInfoModal(true); }} className={`flex-1 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${currentCustomerData.name ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                            <User size={16} />
                            {currentCustomerData.name ? (
                                <>
                                    <span className="truncate max-w-[100px]">{currentCustomerData.name}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </>
                            ) : (
                                <span>הוסף שם</span>
                            )}
                        </button>
                    </div>
                )}

                <div className="p-4 border-t"><button onClick={onClose} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-2xl shadow-lg active:scale-[0.98] transition-all">סגור</button></div>
            </div>

            <CustomerInfoModal
                isOpen={showCustomerInfoModal}
                onClose={() => setShowCustomerInfoModal(false)}
                mode={customerInfoModalMode}
                currentCustomer={currentCustomerData}
                onCustomerUpdate={async (updatedCustomer) => {
                    setOrderData({ ...orderData, customer_id: updatedCustomer.id, customer_phone: updatedCustomer.phone, customer_name: updatedCustomer.name });
                    setShowCustomerInfoModal(false);
                    setTimeout(() => { onRefresh?.(); onClose(); }, 1000);
                }}
                orderId={orderData?.id}
            />
        </div>
    );
};

export default OrderEditModal;
