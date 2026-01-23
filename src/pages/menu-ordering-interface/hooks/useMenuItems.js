import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { menu_cache } from '../../../db/database';

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
        if (!businessId) return;
        try {
            const { data, error: fetchError } = await supabase
                .from('item_category')
                .select('id, name, name_he, icon, position, is_hidden')
                .eq('business_id', businessId)
                .or('is_deleted.is.null,is_deleted.eq.false')
                .or('is_hidden.is.null,is_hidden.eq.false')
                .order('position', { ascending: true, nullsFirst: false });

            if (data && data.length > 0) {
                setCategories(data.map(cat => ({
                    id: cat.id,
                    name: cat.name_he || cat.name,
                    name_he: cat.name_he,
                    db_name: cat.name,
                    icon: cat.icon || 'Folder',
                    position: cat.position
                })));
            }
        } catch (e) { console.error(e); }
    }, [businessId]);

    const fetchMenuItems = useCallback(async () => {
        if (!businessId) return;
        const CACHE_VERSION = 'v6';
        const targetBusinessId = businessId + '_' + CACHE_VERSION;

        // 1. Load from Dexie cache first
        try {
            const cached = await menu_cache.get(targetBusinessId);
            if (cached) {
                // Version check: if cache is old version, ignore it
                if (cached.version !== CACHE_VERSION) {
                    console.log('🔄 Old cache version detected, ignoring...');
                } else {
                    setRawMenuData(cached.data);
                    if (Date.now() - cached.updated_at < 30 * 60 * 1000) {
                        // console.log('⚡ Cache is fresh');
                        setMenuLoading(false);
                    } else {
                        console.log('🔄 Cache expired, fetching new data...');
                    }
                }
            }
        } catch (e) { console.warn(e); }

        // 2. Network Sync
        try {
            if (rawMenuData.length === 0) setMenuLoading(true);

            const { data: metadata, error: metaError } = await supabase
                .from('menu_items')
                .select('id, name, price, sale_price, category, category_id, is_hot_drink, kds_routing_logic, allow_notes, is_in_stock, description')
                .eq('business_id', businessId)
                .not('is_in_stock', 'eq', false)
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (metaError) throw metaError;

            // Merge metadata immediately (keep current images if any)
            setRawMenuData(prev => {
                return metadata.map(newItem => ({
                    ...newItem,
                    image_url: prev.find(p => p.id === newItem.id)?.image_url || null
                }));
            });
            setMenuLoading(false);

            // 3. Batch Image Updates
            const BATCH_SIZE = 5;
            let finalData = [];
            for (let i = 0; i < metadata.length; i += BATCH_SIZE) {
                const chunkIds = metadata.slice(i, i + BATCH_SIZE).map(item => item.id);
                const { data: images } = await supabase
                    .from('menu_items')
                    .select('id, image_url')
                    .in('id', chunkIds);

                if (images) {
                    setRawMenuData(current => {
                        const updated = current.map(item => {
                            const img = images.find(img => img.id === item.id);
                            return img ? { ...item, image_url: img.image_url } : item;
                        });
                        finalData = updated;
                        return updated;
                    });
                }
            }

            // 4. Update Cache
            if (finalData.length > 0) {
                await menu_cache.put({
                    business_id: targetBusinessId,
                    version: CACHE_VERSION,
                    data: finalData,
                    updated_at: Date.now()
                });
            }
        } catch (err) {
            console.error('Menu fetch error:', err);
            setError('שגיאה בטעינת התפריט');
        } finally {
            setMenuLoading(false);
        }
    }, [businessId, rawMenuData.length]);

    useEffect(() => {
        fetchCategories();
        fetchMenuItems();
    }, [fetchCategories, fetchMenuItems]);

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
                image: item.image_url || `/cafe-images/item_${item.id}_${item.name}.png`,
                is_hot_drink: item.is_hot_drink,
                kds_routing_logic: item.kds_routing_logic,
                db_category: item.category
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
        isFoodItem
    };
};

export default useMenuItems;
