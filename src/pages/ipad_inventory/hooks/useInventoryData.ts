import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { InventoryItem, Supplier } from '../types';

export const useInventoryData = (businessId?: string) => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!businessId) return;
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Suppliers
            const { data: suppliersData, error: supError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('business_id', businessId)
                .order('name');
            if (supError) throw supError;
            setSuppliers(suppliersData || []);

            // 2. Fetch Inventory Items
            const { data: itemsData, error: itemError } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('business_id', businessId)
                .order('name');
            if (itemError) throw itemError;
            setItems(itemsData || []);
        } catch (err: any) {
            console.error('Error fetching inventory data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { items, suppliers, loading, error, refresh: fetchData };
};
