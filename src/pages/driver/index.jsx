/**
 * Driver Page
 * Simplified view for delivery drivers
 * Shows only 'ready' and 'shipped' delivery orders
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../hooks/useOrders';
import { KanbanBoard } from '../../components/kanban';
import {
    ArrowRight, Truck, RefreshCw, MapPin, Phone,
    AlertTriangle
} from 'lucide-react';

// Only show ready and shipped columns for drivers
const DRIVER_COLUMNS = ['ready', 'shipped'];

export default function DriverPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [hasAccess, setHasAccess] = useState(true); // TODO: Check is_driver

    // Get delivery orders only
    const {
        ordersByStatus,
        isLoading,
        updateStatus,
        refresh
    } = useOrders({
        businessId: user?.business_id,
        filters: { orderType: 'delivery' }
    });

    // Filter to only ready and shipped
    const driverOrdersByStatus = {
        ready: ordersByStatus.ready || [],
        shipped: ordersByStatus.shipped || []
    };

    // Check driver access
    useEffect(() => {
        // TODO: Implement is_driver check from employee record
        // For now, allow all
        setHasAccess(true);
    }, [user]);

    // Handle status update
    const handleStatusUpdate = async (orderId, newStatus) => {
        await updateStatus(orderId, newStatus);
    };

    // Access denied screen
    if (!hasAccess) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-100 font-heebo" dir="rtl">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-800 mb-2">אין גישה</h2>
                    <p className="text-gray-600 mb-6">
                        אין לך הרשאות נהג משלוחים. פנה למנהל.
                    </p>
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                    >
                        חזור
                    </button>
                </div>
            </div>
        );
    }

    const totalReady = driverOrdersByStatus.ready.length;
    const totalShipped = driverOrdersByStatus.shipped.length;

    return (
        <div className="h-screen flex flex-col bg-gray-900 font-heebo" dir="rtl">
            {/* Header - Dark theme for drivers */}
            <header className="bg-gray-800 px-4 py-3 flex items-center justify-between shrink-0 safe-area-pt">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        <ArrowRight size={24} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Truck size={24} className="text-purple-400" />
                        <h1 className="text-xl font-black text-white">מסך נהג</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Stats */}
                    <div className="flex items-center gap-2 text-sm">
                        <span className="bg-orange-500 text-white px-3 py-1 rounded-full font-bold">
                            {totalReady} לאיסוף
                        </span>
                        <span className="bg-purple-500 text-white px-3 py-1 rounded-full font-bold">
                            {totalShipped} בדרך
                        </span>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={refresh}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* Main Board */}
            <main className="flex-1 overflow-hidden bg-gray-900">
                {isLoading && totalReady === 0 && totalShipped === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                            <RefreshCw size={32} className="animate-spin" />
                            <span className="font-bold">טוען משלוחים...</span>
                        </div>
                    </div>
                ) : totalReady === 0 && totalShipped === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 text-gray-500">
                            <Truck size={64} className="opacity-30" />
                            <span className="font-bold text-lg">אין משלוחים כרגע</span>
                            <span className="text-sm">משלוחים חדשים יופיעו כאן אוטומטית</span>
                        </div>
                    </div>
                ) : (
                    <KanbanBoard
                        ordersByStatus={driverOrdersByStatus}
                        columns={DRIVER_COLUMNS}
                        businessType="cafe"
                        onOrderStatusUpdate={handleStatusUpdate}
                    />
                )}
            </main>
        </div>
    );
}
