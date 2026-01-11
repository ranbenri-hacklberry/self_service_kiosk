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
import ShipmentModal from '../../components/kanban/ShipmentModal';
import KDSPaymentModal from '../../pages/kds/components/KDSPaymentModal';
import { sendSms } from '../../services/smsService';
import { supabase } from '../../lib/supabase';
import {
    RefreshCw, ArrowRight, Bell, BellOff,
    LayoutGrid, Truck
} from 'lucide-react';

// Columns to show (removed 'pending' as per user request)
const STAFF_COLUMNS = ['new', 'in_prep', 'ready', 'shipped'];

export default function KanbanPage() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [alertsEnabled, setAlertsEnabled] = useState(true);
    const [paymentModal, setPaymentModal] = useState({ show: false, order: null });
    const [shipmentModal, setShipmentModal] = useState({ show: false, order: null });
    const user = currentUser;

    // Get orders
    const {
        ordersByStatus,
        pendingAlertOrders,
        isLoading,
        updateStatus,
        updateOrderFields, // 🆕 For updating generic fields like driver
        markOrderSeen,
        markItemsReady,
        setItemsStatus, // 🆕 New function for Status Toggle
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
        // Intercept move to 'shipped' to show modal first
        if (newStatus === 'shipped') {
            // Find the order object to pass to modal
            let orderFound = null;
            Object.values(ordersByStatus).forEach(list => {
                const found = list.find(o => o.id === orderId);
                if (found) orderFound = found;
            });

            if (orderFound) {
                // Only show modal if NO driver is assigned yet (or if explicitly triggered by button to change driver - handled elsewhere)
                // But for drag/drop status change, if driver exists, just ship it.
                if (!orderFound.driver_id) {
                    setShipmentModal({ show: true, order: orderFound });
                    return; // Stop here, modal will handle rest
                }
                // If driver exists, fall through to updateStatus below
            }
        }

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

    const handleShipmentConfirmed = async (orderId) => {
        // Modal handles actual data update via RPC/DB
        // Here we just maximize the UI state update
        await updateStatus(orderId, 'shipped');
        setShipmentModal({ show: false, order: null });
        refresh();
    };

    const handlePackingClick = (orderId) => {
        let orderFound = null;
        Object.values(ordersByStatus).forEach(list => {
            const found = list.find(o => o.id === orderId);
            if (found) orderFound = found;
        });

        if (orderFound) {
            setShipmentModal({ show: true, order: orderFound });
        }
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
                        onClick={() => navigate('/')}
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
                        onReadyItems={handlePackingClick} // 🆕 Open modal instead of direct toggle
                        onSmsClick={(order) => setShipmentModal({ show: true, order })} // Reuse same modal for SMS/Truck icon
                    />
                )}
            </main>

            {/* Shipment/Packing Modal */}
            {shipmentModal.show && (
                <ShipmentModal
                    isOpen={true}
                    order={shipmentModal.order}
                    onClose={() => setShipmentModal({ show: false, order: null })}
                    onUpdateStatus={handleStatusUpdate}
                    onUpdateOrder={updateOrderFields} // 🆕
                    onToggleItemPacked={markItemsReady}
                    onShipmentConfirmed={handleShipmentConfirmed} // 🆕 Pass explicit confirm handler
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
