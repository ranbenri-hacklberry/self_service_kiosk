import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { db, menu_cache } from '../../../db/database';

// Map database categories to frontend category IDs (legacy fallback)
const CATEGORY_MAP = {
    'שתיה חמה': 'hot-drinks',
    'שתיה קרה': 'cold-drinks',
    'מאפים': 'pastries',
    'סלטים': 'salads',
    'סלט': 'salads',
    'כריכים וטוסטים': 'sandwiches',
    'כריכים וטוסט': 'sandwiches',
    'כריכים': 'sandwiches',
    'טוסטים': 'sandwiches',
    'קינוחים': 'desserts',
    'תוספות': 'additions'
};

// Fallback categories if DB is empty or unavailable
const FALLBACK_CATEGORIES = [
    { id: 'hot-drinks', name: 'שתיה חמה', icon: 'Coffee' },
    { id: 'cold-drinks', name: 'שתיה קרה', icon: 'GlassWater' },
    { id: 'pastries', name: 'מאפים', icon: 'Croissant' },
    { id: 'salads', name: 'סלטים', icon: 'Leaf' },
    { id: 'sandwiches', name: 'כריכים וטוסטים', icon: 'Sandwich' },
    { id: 'desserts', name: 'קינוחים', icon: 'IceCream' }
];

/**
 * Custom hook for menu items management
 */
export const useMenuItems = (defaultCategory = 'hot-drinks', businessId = null) => {
    const [rawMenuData, setRawMenuData] = useState([]);
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
    const [menuLoading, setMenuLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(defaultCategory);

    const getCategoryId = useCallback((dbCategory, categoryId) => {
        if (categoryId) {
            const foundById = categories.find(c => c.id === categoryId);
            if (foundById) return foundById.id;
        }
        const found = categories.find(c =>
            c.name === dbCategory ||
            c.name_he === dbCategory ||
            c.db_name === dbCategory
        );
        if (found) return found.id;
        return CATEGORY_MAP[dbCategory] || 'other';
    }, [categories]);

    const isFoodItem = useCallback((item) => {
        if (!item) return false;
        if (item.kds_routing_logic === 'MADE_TO_ORDER') return true;
        const dbCat = (item.db_category || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        if (dbCat.includes('כריך') || dbCat.includes('טוסט') || dbCat.includes('פיצה') || dbCat.includes('סלט')) return true;
        if (name.includes('כריך') || name.includes('טוסט') || name.includes('פיצה')) return true;
        return false;
    }, []);

    const fetchCategories = useCallback(async () => {
        const effectiveId = businessId || localStorage.getItem('businessId') || localStorage.getItem('business_id');
        if (!effectiveId) return;

        try {
            // 🚀 STEP 1: Instant Local Categories
            const searchId = isNaN(effectiveId) ? effectiveId : Number(effectiveId);
            const [localCatsNum, localCatsStr] = await Promise.all([
                db.item_category.where('business_id').equals(searchId).toArray(),
                db.item_category.where('business_id').equals(String(effectiveId)).toArray()
            ]);

            const localCats = localCatsNum.length > 0 ? localCatsNum : localCatsStr;

            if (localCats.length > 0) {
                setCategories(localCats.map(cat => ({
                    id: cat.id,
                    name: cat.name_he || cat.name,
                    name_he: cat.name_he,
                    db_name: cat.name,
                    icon: cat.icon || 'Folder',
                    position: cat.position
                })));
            }
        } catch (e) { console.warn('Local categories failed:', e); }

        try {
            // ☁️ STEP 2: Background Sync
            const syncPromise = supabase
                .from('item_category')
                .select('id, name, name_he, icon, position, is_hidden')
                .eq('business_id', effectiveId)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .or('is_hidden.is.null,is_hidden.eq.false')
                .order('position', { ascending: true, nullsFirst: false });

            // If we have categories, we don't await. If not, we await.
            const { data } = await syncPromise;

            if (data && data.length > 0) {
                setCategories(data.map(cat => ({
                    id: cat.id,
                    name: cat.name_he || cat.name,
                    name_he: cat.name_he,
                    db_name: cat.name,
                    icon: cat.icon || 'Folder',
                    position: cat.position
                })));
                await db.item_category.bulkPut(data.map(d => ({ ...d, business_id: effectiveId })));
            }
        } catch (e) { console.error('BG categories error:', e); }
    }, [businessId]);

    const fetchMenuItems = useCallback(async () => {
        const effectiveId = businessId || localStorage.getItem('businessId') || localStorage.getItem('business_id');

        if (!effectiveId) {
            console.warn('⚠️ [Blocked] No Business ID.');
            return;
        }

        try {
            // 🚀 STEP 1: Aggressive Local Fetch
            const searchId = isNaN(effectiveId) ? effectiveId : Number(effectiveId);

            // Try both numeric and string formats for maximum compatibility
            const [localDataNum, localDataStr] = await Promise.all([
                db.menu_items.where('business_id').equals(searchId).toArray(),
                db.menu_items.where('business_id').equals(String(effectiveId)).toArray()
            ]);

            const localData = localDataNum.length > 0 ? localDataNum : localDataStr;

            // 🔥 Also fetch inventory stock from local DB
            const localInventory = await db.prepared_items_inventory.toArray();
            const inventoryMap = new Map(localInventory.map(inv => [inv.item_id, inv.current_stock]));

            if (localData.length > 0) {
                console.log(`🚀 [Instant Load] Found ${localData.length} items locally for ${effectiveId}`);
                const enrichedData = localData.filter(i => !i.is_deleted).map(item => ({
                    ...item,
                    current_stock: inventoryMap.get(item.id) ?? item.current_stock
                }));
                setRawMenuData(enrichedData);
                setMenuLoading(false);
            }

            // ☁️ STEP 2: Background Sync (Non-blocking if local exists)
            const syncPromise = supabase.from('menu_items')
                .select('id, name, price, sale_price, category, category_id, is_hot_drink, kds_routing_logic, allow_notes, is_in_stock, description, modifiers, image_url, inventory_settings, is_deleted')
                .eq('business_id', effectiveId)
                .not('is_deleted', 'eq', true);

            // Also fetch inventory from cloud
            const inventoryPromise = supabase.from('prepared_items_inventory')
                .select('item_id, current_stock')
                .eq('business_id', effectiveId);

            if (localData.length === 0) {
                const [{ data: cloudData }, { data: cloudInventory }] = await Promise.all([syncPromise, inventoryPromise]);

                if (cloudData && cloudData.length > 0) {
                    console.log(`✅ [First Load] Pulled ${cloudData.length} items from server`);

                    // Merge inventory
                    const invMap = new Map((cloudInventory || []).map(inv => [inv.item_id, inv.current_stock]));
                    const enrichedCloudData = cloudData.map(item => ({
                        ...item,
                        current_stock: invMap.get(item.id) ?? null
                    }));

                    setRawMenuData(enrichedCloudData);
                    await db.menu_items.bulkPut(cloudData);
                    if (cloudInventory) await db.prepared_items_inventory.bulkPut(cloudInventory);

                    // 🖼️ Cache images for offline use
                    import('../../../services/imageSyncService').then(m => m.syncMenuImages(cloudData));
                }
            } else {
                // Background update
                Promise.all([syncPromise, inventoryPromise]).then(async ([{ data: cloudData }, { data: cloudInventory }]) => {
                    if (cloudData && cloudData.length > 0) {
                        const invMap = new Map((cloudInventory || []).map(inv => [inv.item_id, inv.current_stock]));
                        const enrichedCloudData = cloudData.map(item => ({
                            ...item,
                            current_stock: invMap.get(item.id) ?? null
                        }));

                        setRawMenuData(enrichedCloudData);
                        await db.menu_items.bulkPut(cloudData);
                        if (cloudInventory) await db.prepared_items_inventory.bulkPut(cloudInventory);

                        // 🖼️ Cache images for offline use
                        import('../../../services/imageSyncService').then(m => m.syncMenuImages(cloudData));
                    }
                });
            }
        } catch (err) {
            console.error('🔥 Fetch Error:', err);
        } finally {
            setMenuLoading(false);
        }
    }, [businessId]);

    useEffect(() => {
        fetchCategories();
        fetchMenuItems();
    }, [fetchCategories, fetchMenuItems]);

    // REAL-TIME INVENTORY SUBSCRIPTION
    useEffect(() => {
        if (!businessId) return;

        const channel = supabase
            .channel('inventory_updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'prepared_items_inventory'
                },
                (payload) => {
                    const updated = payload.new;
                    setRawMenuData(prev => prev.map(item => {
                        if (item.id === updated.item_id) {
                            return { ...item, current_stock: updated.current_stock };
                        }
                        return item;
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [businessId]);

    const updateStockLocally = useCallback((itemId, newStock) => {
        setRawMenuData(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, current_stock: newStock };
            }
            return item;
        }));
    }, []);

    useEffect(() => {
        if (categories.length > 0 && !categories.some(c => c.id === activeCategory)) {
            setActiveCategory(categories[0].id);
        }
    }, [categories, activeCategory]);

    const menuItems = useMemo(() => {
        const seen = new Set();
        return rawMenuData
            .filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            })
            .map(item => ({
                id: item.id,
                name: item.name,
                price: item.sale_price > 0 ? item.sale_price : item.price,
                originalPrice: item.sale_price > 0 ? item.price : null,
                category: getCategoryId(item.category, item.category_id),
                image: item.image_url || null,
                is_hot_drink: item.is_hot_drink,
                kds_routing_logic: item.kds_routing_logic,
                db_category: item.category,
                modifiers: item.modifiers || [],
                // Ensure tracked items show 0 instead of null/hidden
                current_stock: (item.inventory_settings?.isPreparedItem || item.kds_routing_logic === 'hybrid')
                    ? (item.current_stock ?? 0)
                    : null,
                available: (item.inventory_settings?.isPreparedItem || item.kds_routing_logic === 'hybrid')
                    ? ((item.current_stock ?? 0) > 0 || item.inventory_settings?.hideOnZeroStock === false)
                    : true,
                inventory_settings: item.inventory_settings,
                prepared_items_inventory: item.prepared_items_inventory
            }));
    }, [rawMenuData, getCategoryId]);

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => item.category === activeCategory);
    }, [menuItems, activeCategory]);

    return {
        menuItems,
        menuLoading,
        error,
        activeCategory,
        filteredItems,
        categories,
        handleCategoryChange: setActiveCategory,
        isFoodItem,
        updateStockLocally
    };
};

export default useMenuItems;
