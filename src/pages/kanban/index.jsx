/**
 * Kanban Page - Staff View
 * Displays all order columns with Drag & Drop
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../hooks/useOrders';
import { useOrderAlerts } from '../../hooks/useOrderAlerts';
import { KanbanBoard } from '../../components/kanban';
import SMSModal from '../../components/kanban/SMSModal';
import KDSPaymentModal from '../../pages/kds/components/KDSPaymentModal';
import OrderPackingSidebar from '../../components/kanban/OrderPackingSidebar';
import { sendSms } from '../../services/smsService';
import { supabase } from '../../lib/supabase'; // 🆕 Required for direct updates
import {
    RefreshCw, ArrowRight, Bell, BellOff,
    LayoutGrid, Truck
} from 'lucide-react';

// Columns to show
const STAFF_COLUMNS = ['new', 'in_prep', 'ready', 'shipped', 'delivered'];

export default function KanbanPage() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [alertsEnabled, setAlertsEnabled] = useState(true);
    const [paymentModal, setPaymentModal] = useState({ show: false, order: null });
    const [smsModal, setSmsModal] = useState({ show: false, order: null });
    const [packingOrder, setPackingOrder] = useState(null);
    const user = currentUser;

    // Get orders
    const {
        ordersByStatus,
        pendingAlertOrders,
        isLoading,
        updateStatus,
        markOrderSeen,
        markItemsReady,
        refresh
    } = useOrders({
        businessId: user?.business_id
    });

    // Setup alerts for pending online orders
    useOrderAlerts({
        pendingOrders: pendingAlertOrders,
        enabled: alertsEnabled
    });

    // Determine business type
    const businessType = user?.business_type || 'cafe';

    const handleStatusUpdate = async (orderId, newStatus) => {
        await updateStatus(orderId, newStatus);
    };

    const handlePaymentCollected = (order) => {
        if (order.is_paid || order.isPaid) return;
        setPaymentModal({ show: true, order });
    };

    const handlePaymentConfirmed = async (orderId, paymentMethod) => {
        setPaymentModal({ show: false, order: null });
        refresh();
    };

    const handleCardClick = (order) => {
        // Only open packing sidebar for 'new' or 'in_progress' or 'pending'
        if (['new', 'in_progress', 'pending'].includes(order.order_status)) {
            setPackingOrder(order);
        }
    };

    const handleMarkItemReady = async (orderId, itemIds) => {
        // 1. Mark items as ready
        await markItemsReady(orderId, itemIds);

        // 2. If order is 'new'/'pending', move to 'in_progress'
        const order = ordersByStatus.new?.find(o => o.id === orderId) ||
            ordersByStatus.pending?.find(o => o.id === orderId);

        if (order && (order.order_status === 'new' || order.order_status === 'pending')) {
            await updateStatus(orderId, 'in_progress');
        }
    };

    const handleFinishPacking = async (orderId, driver) => {
        console.log(`📦 [KanbanPage] Finished packing ${orderId} assigned to driver ${driver.name}`);

        // Find full order details for SMS
        let order = null;
        for (const status of Object.keys(ordersByStatus)) {
            const found = ordersByStatus[status]?.find(o => o.id === orderId);
            if (found) {
                order = found;
                break;
            }
        }

        try {
            // 1. Assign Driver in Database immediately
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    courier_id: driver.id
                })
                .eq('id', orderId);

            if (updateError) {
                console.error("Failed to assign driver:", updateError);
            }

            // 2. Update status to 'ready'
            await updateStatus(orderId, 'ready');

            // 3. Send SMS to driver
            if (driver && driver.phone && order) {
                const message = `היי ${driver.name}, חבילה חדשה מוכנה לאיסוף! 📦\nלקוח: ${order.customerName}\nהזמנה: #${order.orderNumber}\nכתובת: ${order.deliveryAddress || 'איסוף עצמי'}\nבהצלחה!`;

                try {
                    await sendSms(driver.phone, message);
                    console.log('✅ SMS sent to driver');
                } catch (err) {
                    console.error('❌ Failed to send SMS to driver:', err);
                }
            }

        } catch (err) {
            console.error("❌ Error in finish packing flow:", err);
        }

        // Close sidebar
        setPackingOrder(null);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 font-heebo relative overflow-hidden" dir="rtl">
            {/* Professional Background Pattern */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-white via-transparent to-slate-100/50"></div>

            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex items-center justify-between shrink-0 z-20 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm hover:shadow active:scale-95"
                    >
                        <ArrowRight size={22} className="text-slate-600" />
                    </button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">קנבן הזמנות</h1>
                            <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-lg shadow-sm shadow-blue-200">PRO V2.2</span>
                        </div>
                        <p className="text-xs text-slate-400 font-bold mt-1">ניהול זרימת עבודה חכם</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* 🆕 New Order Button (Kanban Only) */}
                    <button
                        onClick={() => navigate('/manager')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl font-black shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 border border-slate-700"
                    >
                        <LayoutGrid size={18} />
                        <span>הזמנה חדשה</span>
                    </button>

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    {/* Pending Online Orders Indicator */}
                    {pendingAlertOrders.length > 0 && (
                        <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-2xl text-sm font-black shadow-lg shadow-blue-200 animate-pulse border border-blue-500">
                            <Bell size={16} className="fill-white" />
                            <span>{pendingAlertOrders.length} אונליין חדשות</span>
                        </div>
                    )}

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setAlertsEnabled(!alertsEnabled)}
                            className={`p-2.5 rounded-xl transition-all border shadow-sm ${alertsEnabled ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                            title={alertsEnabled ? 'כבה התראות' : 'הפעל התראות'}
                        >
                            {alertsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                        </button>

                        <button
                            onClick={refresh}
                            disabled={isLoading}
                            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Kanban Board */}
            <main className="flex-1 overflow-hidden z-10 relative">
                {isLoading && Object.keys(ordersByStatus).length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                            <RefreshCw size={40} className="animate-spin text-blue-500" />
                            <span className="font-black text-lg">טוען נתונים...</span>
                        </div>
                    </div>
                ) : (
                    <KanbanBoard
                        ordersByStatus={ordersByStatus}
                        columns={STAFF_COLUMNS}
                        businessType={businessType}
                        onOrderStatusUpdate={handleStatusUpdate}
                        onPaymentCollected={handlePaymentCollected}
                        onMarkSeen={markOrderSeen}
                        onReadyItems={markItemsReady}
                        onSmsClick={(order) => setSmsModal({ show: true, order })}
                        onRefresh={refresh}
                        onEditOrder={handleCardClick}
                    />
                )}
            </main>

            {/* Packing Sidebar */}
            <OrderPackingSidebar
                order={packingOrder}
                businessId={user?.business_id}
                onClose={() => setPackingOrder(null)}
                // Use wrapper that also updates order status
                onMarkItemReady={handleMarkItemReady}
                onFinishPacking={handleFinishPacking}
            />

            {/* Modals */}
            {smsModal.show && (
                <SMSModal
                    order={smsModal.order}
                    onClose={() => setSmsModal({ show: false, order: null })}
                />
            )}

            {paymentModal.show && (
                <KDSPaymentModal
                    order={paymentModal.order}
                    onClose={() => setPaymentModal({ show: false, order: null })}
                    onConfirm={handlePaymentConfirmed}
                />
            )}
        </div>
    );
}
