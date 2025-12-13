import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

// Map database categories to frontend category IDs
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

/**
 * Custom hook for menu items management
 * Handles fetching, filtering, and categorizing menu items
 */
export const useMenuItems = (defaultCategory = 'hot-drinks') => {
    const [rawMenuData, setRawMenuData] = useState([]); // Raw data from DB
    const [menuLoading, setMenuLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(defaultCategory);

    // Helper: Map database category to frontend category ID
    const getCategoryId = useCallback((dbCategory) => {
        return CATEGORY_MAP[dbCategory] || 'other';
    }, []);

    // Helper: Check if item is food (requires modal for notes)
    const isFoodItem = useCallback((item) => {
        if (!item) return false;

        // Always treat MADE_TO_ORDER items as food (opens modal for notes)
        if (item.kds_routing_logic === 'MADE_TO_ORDER') return true;

        const dbCat = (item.db_category || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();

        // Check DB category directly (Hebrew)
        if (dbCat.includes('כריך') || dbCat.includes('טוסט') || dbCat.includes('פיצה') || dbCat.includes('סלט') || dbCat.includes('מאפה')) return true;

        // Check mapped category (English IDs)
        if (['sandwiches', 'salads', 'pastries', 'toast', 'pizza'].some(c => cat.includes(c))) return true;

        // Check name
        if (name.includes('כריך') || name.includes('טוסט') || name.includes('פיצה') || name.includes('סלט')) return true;

        return false;
    }, []);

    // Fetch menu items from Supabase
    const fetchMenuItems = useCallback(async () => {
        try {
            setMenuLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('menu_items')
                .select('*')
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (fetchError) {
                throw new Error(`Supabase error: ${fetchError.message}`);
            }

            // Store raw data - transformation happens in useMemo below
            setRawMenuData(data || []);
        } catch (err) {
            console.error('Unexpected error:', err);
            setError('שגיאה בטעינת התפריט. אנא נסה שוב.');
        } finally {
            setMenuLoading(false);
        }
    }, []);

    // Memoized transformation of raw data to menu items
    // This ensures stable object references and avoids recreation on every render
    const menuItems = useMemo(() => {
        // Deduplicate by ID to prevent duplicate items
        const seenIds = new Set();

        return rawMenuData
            .filter(item => {
                if (item.is_in_stock === false) return false;
                if (seenIds.has(item.id)) {
                    console.warn('⚠️ Duplicate menu item detected:', item.id, item.name);
                    return false;
                }
                seenIds.add(item.id);
                return true;
            })
            .map((item) => ({
                id: item?.id,
                name: item?.name,
                price: item?.price,
                category: getCategoryId(item?.category),
                image: item?.image_url || "https://images.unsplash.com/photo-1551024506-0bccd828d307",
                imageAlt: `${item?.name} - פריט תפריט מבית הקפה`,
                available: true,
                isPopular: false,
                is_hot_drink: item?.is_hot_drink,
                kds_routing_logic: item?.kds_routing_logic,
                allow_notes: item?.allow_notes,
                db_category: item?.category,
                calories: 0,
                description: null,
                options: []
            }));
    }, [rawMenuData, getCategoryId]);

    // Load menu items on mount
    useEffect(() => {
        fetchMenuItems();
    }, [fetchMenuItems]);

    // Filter items based on active category
    const filteredItems = useMemo(() => {
        let items = menuItems?.filter((item) => item?.category === activeCategory) || [];

        // Sort מאפים and קינוחים by price (ascending)
        if (activeCategory === 'pastries' || activeCategory === 'desserts') {
            items = [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
        }

        return items;
    }, [menuItems, activeCategory]);

    // Group items for sandwiches category
    const groupedItems = useMemo(() => {
        if (activeCategory !== 'sandwiches') return null;

        const items = menuItems?.filter((item) => item?.category === activeCategory) || [];

        // Helper to determine subcategory
        const getSubCategory = (item) => {
            const name = item.name || '';

            if (name.includes('כריך') || name.includes('באגט') || name.includes('קרואס')) return 'כריכים';
            if (name.includes('פיצה') || name.includes('פיצ') || name.includes('מרגריטה') || name.includes('מוצה')) return 'פיצות';
            if (name.includes('טוסט')) return 'טוסטים';

            const dbCategory = item.db_category || '';
            if (dbCategory.includes('כריכ')) return 'כריכים';
            if (dbCategory.includes('פיצ')) return 'פיצות';
            if (dbCategory.includes('טוסט')) return 'טוסטים';

            return 'טוסטים';
        };

        // Group items
        const groups = { 'כריכים': [], 'טוסטים': [], 'פיצות': [] };

        items.forEach(item => {
            const subCat = getSubCategory(item);
            if (groups[subCat]) {
                groups[subCat].push(item);
            }
        });

        return [
            { title: 'כריכים', items: groups['כריכים'], showTitle: false },
            { title: 'טוסטים', items: groups['טוסטים'], showTitle: false },
            { title: 'פיצות', items: groups['פיצות'], showTitle: false }
        ].filter(g => g.items.length > 0);

    }, [menuItems, activeCategory]);

    // Handle category change
    const handleCategoryChange = useCallback((categoryId) => {
        setActiveCategory(categoryId);
    }, []);

    return {
        // State
        menuItems,
        menuLoading,
        error,
        activeCategory,
        filteredItems,
        groupedItems,

        // Actions
        fetchMenuItems,
        handleCategoryChange,
        setActiveCategory,

        // Utilities
        isFoodItem,
        getCategoryId
    };
};

export default useMenuItems;
