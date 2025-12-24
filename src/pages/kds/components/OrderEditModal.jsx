import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Edit, Phone, User } from 'lucide-react';
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
    isHistoryMode = false // New prop
}) => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [orderData, setOrderData] = useState(null);
    const [processingItemId, setProcessingItemId] = useState(null);
    const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
    const [customerInfoModalMode, setCustomerInfoModalMode] = useState('phone');

    const loadItemsFromOrder = () => {
        if (!order || !order.items) return;

        const realOrderId = (order.originalOrderId || order.id || '')
            .toString()
            .replace(/-stage-\d+/, '')
            .replace('-ready', '');

        setOrderData({
            id: realOrderId,
            customer_name: order.customerName,
            order_number: order.orderNumber,
            is_paid: order.isPaid
        });

        // 1. Flatten items: Each ID in 'ids' becomes an individual row
        const flattened = [];
        const seenIds = new Set();

        order.items.forEach(item => {
            const itemIds = item.ids && item.ids.length > 0 ? item.ids : [item.id];

            itemIds.forEach(id => {
                // De-duplication check: Skip if we already added this specific item ID
                if (id && seenIds.has(id)) return;
                if (id) seenIds.add(id);

                flattened.push({
                    id: id,
                    menu_item_id: item.menu_item_id || item.menuItemId,
                    name: item.name,
                    quantity: 1, // Individual toggle mode
                    price: item.price || 0,
                    status: item.status,
                    course_stage: item.course_stage || 1,
                    is_early_delivered: item.is_early_delivered || false,
                    modifiers: item.modifiers,
                    notes: item.notes
                });
            });
        });

        // 2. Filter out cancelled and sort by name
        const activeItems = flattened
            .filter(i => i.status !== 'cancelled')
            .sort((a, b) => a.name.localeCompare(b.name));

        setItems(activeItems);
        setIsLoading(false);
    };

    // Load items when order changes
    useEffect(() => {
        if (isOpen && order) {
            setIsLoading(true);
            loadItemsFromOrder();
        }
    }, [isOpen, order?.id]);

    if (!isOpen || !order) return null;

    // Toggle is_early_delivered for an item
    const handleToggleEarlyDelivered = async (item) => {
        if (processingItemId) return;

        setProcessingItemId(item.id);
        const newValue = !item.is_early_delivered;

        try {
            // console.log('🔄 Toggling early delivery:', item.id, '->', newValue);

            // Use RPC to bypass RLS
            const { error } = await supabase.rpc('toggle_early_delivered', {
                p_item_id: item.id,
                p_value: newValue
            });

            if (error) {
                console.error('Failed to update is_early_delivered:', error.message);
                // Revert UI change or show toast
            } else {
                // Update local state to reflect change immediately
                setItems(prevItems =>
                    prevItems.map(i =>
                        i.id === item.id ? { ...i, is_early_delivered: newValue } : i
                    )
                );

                // Notify parent to refresh if needed (optional, might be heavy)
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            console.error('Error in toggle:', err);
        } finally {
            setProcessingItemId(null);
        }
    };

    // Navigate to full order editing interface
    const handleOpenFullEditor = () => {
        if (!orderData || !items.length) return;

        try {
            // Fetch ALL items from the order (not just what's on this card)
            // The instruction snippet implies using the current `items` state directly,
            // rather than re-fetching from DB. Adjusting to match instruction.
            const itemsToUse = items && items.length > 0
                ? items.map(item => ({
                    id: item.id,
                    menu_item_id: item.menu_item_id || item.menuItemId, // Support both standard formats
                    menuItemId: item.menu_item_id || item.menuItemId,    // Ensure camelCase also exists
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    mods: item.modifiers, // Assuming modifiers structure is compatible
                    notes: item.notes,
                    selectedOptions: [],
                    course_stage: item.course_stage || 1
                }))
                : items; // Fallback to current items if mapping fails or items is empty

            // Calculate total from ALL items
            const calculatedTotal = itemsToUse.reduce((sum, item) =>
                sum + (item.price || 0) * (item.quantity || 1), 0
            );

            const totalToUse = order.totalAmount || calculatedTotal;

            // Prepare edit data for the menu-ordering-interface
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
                restrictedMode: isHistoryMode // Pass restriction flag
            };

            console.log('📝 Opening full editor with data:', {
                isPaid: editData.isPaid,
                totalAmount: editData.totalAmount,
                originalPaidAmount: editData.originalPaidAmount,
                itemsCount: editData.items.length,
                calculatedTotal,
                restrictedMode: isHistoryMode
            });

            // Store in sessionStorage for the menu-ordering-interface to pick up
            sessionStorage.setItem('editOrderData', JSON.stringify(editData));

            // Navigate to menu-ordering-interface with edit parameter
            // Changed from window.location.href to navigate for SPA speed
            navigate(`/menu-ordering-interface?editOrderId=${orderData.id}`);
        } catch (err) {
            console.error('Error opening full editor:', err);
        }
    };

    const formatPrice = (price) => {
        if (!price) return '';
        return `₪${Number(price).toFixed(0)}`;
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[#FAFAFA] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-xl text-slate-800 p-4 flex items-center justify-between border-b border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4 flex-1">
                        <button
                            onClick={handleOpenFullEditor}
                            disabled={isLoading || !orderData}
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner transition active:scale-95 ${isLoading || !orderData ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gradient-to-br from-orange-100 to-orange-50 text-orange-500 hover:from-orange-200 hover:to-orange-100'}`}
                            title="עריכת הזמנה מלאה"
                        >
                            <Edit size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{orderData?.customer_name || order.customerName}</h2>
                            <p className="text-sm text-slate-400">הזמנה #{orderData?.order_number || order.orderNumber}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Loading */}
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>טוען פריטים...</p>
                    </div>
                ) : (
                    /* Items List */
                    <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                        {items.map((item, idx) => {
                            const isMarked = item.is_early_delivered;
                            const isThisProcessing = processingItemId === item.id;

                            return (
                                <div
                                    key={item.id || idx}
                                    className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isMarked
                                        ? 'bg-gray-100 border-gray-300'
                                        : 'bg-white border-gray-200'
                                        } ${isThisProcessing ? 'opacity-50' : ''}`}
                                >
                                    {/* Mark as Delivered Button - Right Side (RTL) */}
                                    <button
                                        onClick={() => handleToggleEarlyDelivered(item)}
                                        disabled={isThisProcessing}
                                        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0 ${isMarked
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-500'
                                            }`}
                                        title={isMarked ? 'בטל סימון' : 'סמן כיצא'}
                                    >
                                        <Check size={20} strokeWidth={3} />
                                    </button>

                                    {/* Strikethrough Overlay when marked */}
                                    {isMarked && (
                                        <div className="absolute inset-0 flex items-center pointer-events-none">
                                            <div className="w-full h-0.5 bg-gray-500/60 mx-3 rounded-full" />
                                        </div>
                                    )}

                                    {/* Item Content */}
                                    <div className={`flex-1 min-w-0 ${isMarked ? 'opacity-60' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            {item.quantity > 1 && (
                                                <span className="bg-slate-900 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                                    x{item.quantity}
                                                </span>
                                            )}
                                            <span className={`font-bold ${isMarked ? 'text-gray-500' : 'text-gray-900'}`}>
                                                {item.name}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className={`text-sm font-bold shrink-0 ${isMarked ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {formatPrice(item.price * (item.quantity || 1))}
                                    </div>
                                </div>
                            );
                        })}

                        {items.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-gray-400">
                                <p className="text-lg font-bold">אין פריטים בהזמנה</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Customer Info Section */}
                {!isLoading && orderData && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">פרטי לקוח</h3>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Case 1: No customer info - Show two buttons */}
                            {!orderData.customer_phone && !orderData.customer_name && (
                                <>
                                    <button
                                        onClick={() => {
                                            setCustomerInfoModalMode('phone-then-name');
                                            setShowCustomerInfoModal(true);
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-orange-500 text-white border border-orange-600 shadow-sm hover:shadow-md hover:bg-orange-600 transition-all duration-200 active:scale-95 font-bold text-xs flex items-center gap-1"
                                    >
                                        <Phone size={12} />
                                        הוסף טלפון + שם
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCustomerInfoModalMode('name');
                                            setShowCustomerInfoModal(true);
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-200 transition-all duration-200 active:scale-95 font-bold text-xs flex items-center gap-1"
                                    >
                                        <User size={12} />
                                        הוסף שם בלבד
                                    </button>
                                </>
                            )}

                            {/* Case 2: Has name but no phone */}
                            {orderData.customer_name && !orderData.customer_phone && (
                                <>
                                    <span className="text-sm text-gray-700 flex items-center gap-1">
                                        <User size={14} />
                                        {orderData.customer_name}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setCustomerInfoModalMode('phone');
                                            setShowCustomerInfoModal(true);
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 shadow-sm hover:shadow-md hover:bg-blue-200 transition-all duration-200 active:scale-95 font-bold text-xs flex items-center gap-1"
                                    >
                                        <Phone size={12} />
                                        הוסף טלפון
                                    </button>
                                </>
                            )}

                            {/* Case 3: Has phone + name */}
                            {orderData.customer_phone && orderData.customer_name && (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-700 flex items-center gap-1">
                                        <Phone size={14} />
                                        {orderData.customer_phone}
                                    </span>
                                    <span className="text-sm text-gray-700 flex items-center gap-1">
                                        <User size={14} />
                                        {orderData.customer_name}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setCustomerInfoModalMode('phone');
                                            setShowCustomerInfoModal(true);
                                        }}
                                        className="text-xs text-blue-600 hover:underline font-medium"
                                    >
                                        ערוך
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="bg-white border-t border-gray-200 p-4">
                    <button
                        onClick={onClose}
                        className="w-full py-3 px-6 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition active:scale-[0.98]"
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
                currentCustomer={{
                    phone: orderData?.customer_phone,
                    name: orderData?.customer_name,
                    id: orderData?.customer_id
                }}
                onCustomerUpdate={async (updatedCustomer) => {
                    try {
                        // Update order in database
                        const { error } = await supabase
                            .from('orders')
                            .update({
                                customer_id: updatedCustomer.id,
                                customer_phone: updatedCustomer.phone,
                                customer_name: updatedCustomer.name
                            })
                            .eq('id', orderData.id);

                        if (error) throw error;

                        // Update local state
                        setOrderData({
                            ...orderData,
                            customer_id: updatedCustomer.id,
                            customer_phone: updatedCustomer.phone,
                            customer_name: updatedCustomer.name
                        });

                        setShowCustomerInfoModal(false);
                        onRefresh?.(); // Refresh KDS
                    } catch (err) {
                        console.error('Failed to update customer info:', err);
                        alert('שגיאה בעדכון פרטי לקוח');
                    }
                }}
                orderId={orderData?.id}
            />
        </div>
    );
};

export default OrderEditModal;
