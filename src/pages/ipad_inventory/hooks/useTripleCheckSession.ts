import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { InventoryItem, ReceivingSession, ReceivingSessionItem } from '@/types';

export const useTripleCheckSession = (items: InventoryItem[], businessId?: string) => {
    const [session, setSession] = useState<ReceivingSession | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    const initializeSession = useCallback((ocrData: any, orderId: string | null = null, supplierId: string | null = null) => {
        if (!ocrData?.items) return;

        const sessionItems: ReceivingSessionItem[] = ocrData.items.map((ocrItem: any) => {
            const name = ocrItem.name || ocrItem.description || 'פריט ללא שם';
            const invoicedQty = ocrItem.quantity || ocrItem.amount || 0;
            const unitPrice = ocrItem.price || ocrItem.cost_per_unit || 0;

            const matchedItem = items.find(inv =>
                inv.name.toLowerCase() === name.toLowerCase() ||
                inv.name.includes(name) ||
                name.includes(inv.name)
            );

            return {
                id: ocrItem.id || `temp-${Date.now()}-${Math.random()}`,
                name,
                unit: ocrItem.unit || matchedItem?.unit || 'יח׳',
                invoicedQty,
                orderedQty: invoicedQty, // If from OCR, we assume invoiced = ordered for matching
                actualQty: invoicedQty,
                unitPrice,
                countStep: matchedItem?.count_step || 1,
                inventoryItemId: matchedItem?.id || null,
                catalogItemId: matchedItem?.catalog_item_id || null,
                isNew: !matchedItem,
                matchedItem
            };
        });

        setSession({
            items: sessionItems,
            orderId,
            supplierId,
            hasInvoice: true,
            totalInvoiced: ocrData.total_amount || sessionItems.reduce((sum, i) => sum + (i.invoicedQty! * i.unitPrice), 0)
        });
    }, [items]);

    const initializeFromOrder = useCallback((order: any) => {
        if (!order?.items) return;

        const sessionItems: ReceivingSessionItem[] = order.items.map((orderItem: any, idx: number) => {
            const matchedItem = items.find(inv =>
                inv.name.toLowerCase() === (orderItem.name || '').toLowerCase()
            );

            return {
                id: orderItem.id || `order-item-${idx}-${Date.now()}`,
                name: orderItem.name || 'פריט ללא שם',
                unit: orderItem.unit || matchedItem?.unit || 'יח׳',
                invoicedQty: null,
                orderedQty: orderItem.qty || 0,
                actualQty: orderItem.qty || 0,
                unitPrice: orderItem.price || matchedItem?.cost_per_unit || 0,
                countStep: matchedItem?.count_step || 1,
                inventoryItemId: matchedItem?.id || null,
                catalogItemId: matchedItem?.catalog_item_id || null,
                isNew: !matchedItem,
                matchedItem
            };
        });

        setSession({
            items: sessionItems,
            orderId: order.id,
            supplierId: order.supplier_id || null,
            supplierName: order.supplier_name,
            hasInvoice: false,
            totalInvoiced: 0
        });
    }, [items]);

    const updateActualQty = (itemId: string, newQty: number) => {
        setSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? { ...item, actualQty: newQty } : item
                )
            };
        });
    };

    const confirmReceipt = async () => {
        if (!session || !businessId) return { success: false, error: 'No session' };

        setIsConfirming(true);
        try {
            const rpcItems = session.items
                .filter(item => item.actualQty > 0)
                .map(item => ({
                    inventory_item_id: item.inventoryItemId || null,
                    catalog_item_id: item.catalogItemId || null,
                    actual_qty: item.actualQty,
                    invoiced_qty: item.invoicedQty,
                    unit_price: item.unitPrice
                }));

            const { data, error } = await supabase.rpc('receive_inventory_shipment', {
                p_items: rpcItems,
                p_order_id: session.orderId,
                p_supplier_id: session.supplierId,
                p_notes: null,
                p_business_id: businessId
            });

            if (error) throw error;
            setSession(null);
            return { success: true, data };
        } catch (err: any) {
            console.error('Error confirming receipt:', err);
            return { success: false, error: err.message };
        } finally {
            setIsConfirming(false);
        }
    };

    return {
        session,
        isConfirming,
        initializeSession,
        initializeFromOrder,
        updateActualQty,
        confirmReceipt,
        clearSession: () => setSession(null)
    };
};
