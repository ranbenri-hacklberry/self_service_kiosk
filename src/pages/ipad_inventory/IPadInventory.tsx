import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;
import { useAuth } from '@/context/AuthContext';

// Hooks
import { useInventoryData } from '@/pages/ipad_inventory/hooks/useInventoryData';
import { useStockUpdates } from '@/pages/ipad_inventory/hooks/useStockUpdates';
import { useIncomingOrders } from '@/pages/ipad_inventory/hooks/useIncomingOrders';
import { useTripleCheckSession } from '@/pages/ipad_inventory/hooks/useTripleCheckSession';
import { useInvoiceOCR } from '@/pages/ipad_inventory/hooks/useInvoiceOCR';

// Components
import InventoryHeader from '@/pages/ipad_inventory/components/InventoryHeader';
import SuppliersList from '@/pages/ipad_inventory/components/SuppliersList';
import InventoryItemsGrid from '@/pages/ipad_inventory/components/InventoryItemsGrid';
import IncomingOrdersList from '@/pages/ipad_inventory/components/IncomingOrdersList';
import TripleCheckSession from '@/pages/ipad_inventory/components/TripleCheckSession';
import { IncomingOrder } from '@/pages/ipad_inventory/types';

interface IPadInventoryProps {
    onExit: () => void;
}

export const IPadInventory: React.FC<IPadInventoryProps> = ({ onExit }) => {
    const { currentUser } = useAuth();
    const businessId = currentUser?.business_id;

    // View State
    const [activeTab, setActiveTab] = useState<'counts' | 'shipping'>('counts');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>('prepared');

    // Data Hooks
    const { items, suppliers, loading: dataLoading, refresh: refreshData } = useInventoryData(businessId);
    const { updateStock } = useStockUpdates();
    const { orders, loading: ordersLoading, refresh: refreshOrders } = useIncomingOrders(businessId);
    const { scanInvoice, isProcessing: isScanning } = useInvoiceOCR();
    const {
        session,
        initializeSession,
        initializeFromOrder,
        updateActualQty,
        confirmReceipt,
        clearSession,
        isConfirming
    } = useTripleCheckSession(items, businessId);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Computed
    const supplierCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        items.forEach(item => {
            const id = item.supplier_id || 'uncategorized';
            counts[id] = (counts[id] || 0) + 1;
        });
        // Count prepared (this is usually dynamic or from menu_items, but for now we mirror ItemsGrid logic)
        counts['prepared'] = items.filter(i => i.category?.includes('prep')).length;
        return counts;
    }, [items]);

    const filteredItems = useMemo(() => {
        if (!selectedSupplierId) return [];
        return items.filter(i => {
            if (selectedSupplierId === 'prepared') return i.category?.includes('prep');
            const supId = i.supplier_id || 'uncategorized';
            return supId === selectedSupplierId;
        });
    }, [items, selectedSupplierId]);

    // Handlers
    const handleStartScan = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const result = await scanInvoice(file);
        if (result) {
            initializeSession(result);
        }
    };

    const handleConfirmReceipt = async () => {
        const result = await confirmReceipt();
        if (result.success) {
            refreshData();
            refreshOrders();
        } else {
            alert('שגיאה בעדכון המלאי: ' + result.error);
        }
    };

    return (
        <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden font-heebo" dir="rtl">
            <InventoryHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onExit={onExit}
            />

            <main className="flex-1 flex overflow-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === 'counts' ? (
                        <MotionDiv
                            key="counts"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex h-full"
                        >
                            <SuppliersList
                                suppliers={suppliers}
                                selectedSupplierId={selectedSupplierId}
                                onSelectSupplier={setSelectedSupplierId}
                                supplierCounts={supplierCounts}
                            />

                            <InventoryItemsGrid
                                items={filteredItems}
                                onUpdateStock={updateStock}
                                isLoading={dataLoading}
                            />
                        </MotionDiv>
                    ) : (
                        <MotionDiv
                            key="shipping"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex-1 h-full"
                        >
                            <IncomingOrdersList
                                orders={orders}
                                onSelectOrder={initializeFromOrder}
                                onStartScan={handleStartScan}
                                isLoading={ordersLoading}
                            />
                        </MotionDiv>
                    )}
                </AnimatePresence>
            </main>

            {/* Overlays */}
            <AnimatePresence>
                {session && (
                    <TripleCheckSession
                        session={session}
                        onUpdateQty={updateActualQty}
                        onConfirm={handleConfirmReceipt}
                        onCancel={clearSession}
                        isSubmitting={isConfirming}
                    />
                )}

                {isScanning && (
                    <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-indigo-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">קורא חשבונית...</h3>
                            <p className="text-slate-500 font-bold italic">ה-AI שלנו מנתח את הפריטים והכמויות</p>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Hidden Inputs */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default IPadInventory;
