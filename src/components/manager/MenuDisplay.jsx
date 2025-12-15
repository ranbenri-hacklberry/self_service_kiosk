import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import MenuManagerCard from './MenuManagerCard';
import {
  Search, Coffee, GlassWater, Croissant, Sandwich,
  ArrowRight, Plus, X, Soup, Pizza, Salad, Cake, Wine, Beer,
  Sparkles, Flame, Package
} from 'lucide-react';

const MenuEditModal = lazy(() => import('./MenuEditModal'));

// Category icons mapping
const CATEGORY_ICONS = {
  'שתיה חמה': Coffee, 'hot-drinks': Coffee,
  'שתיה קרה': GlassWater, 'cold-drinks': GlassWater,
  'מאפים': Croissant, 'pastries': Croissant,
  'סלטים': Salad, 'salads': Salad,
  'כריכים וטוסטים': Sandwich, 'sandwiches': Sandwich,
  'קינוחים': Cake, 'desserts': Cake,
  'תוספות': Plus, 'מרקים': Soup, 'soups': Soup,
  'פיצות': Pizza, 'pizza': Pizza,
  'יין': Wine, 'wine': Wine, 'בירה': Beer, 'beer': Beer,
  'מנות עיקריות': Flame, 'main': Flame,
  'ארוחות בוקר': Sparkles, 'breakfast': Sparkles,
  'אחר': Package
};

const getCategoryIcon = (category) => {
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  const lowerCat = category.toLowerCase();
  if (lowerCat.includes('קפה') || lowerCat.includes('חם')) return Coffee;
  if (lowerCat.includes('קר') || lowerCat.includes('שתי')) return GlassWater;
  if (lowerCat.includes('מאפ') || lowerCat.includes('לחם')) return Croissant;
  if (lowerCat.includes('סלט')) return Salad;
  if (lowerCat.includes('כריך') || lowerCat.includes('טוסט')) return Sandwich;
  if (lowerCat.includes('קינוח') || lowerCat.includes('עוג')) return Cake;
  return Package;
};

const MenuDisplay = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category')
        .order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching menu items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  // Sync selectedItem with fresh data when items update
  useEffect(() => {
    if (selectedItem && items.length > 0) {
      const fresh = items.find(i => i.id === selectedItem.id);
      // Only update if data changed to avoid loops/unnecessary renders
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedItem)) {
        setSelectedItem(fresh);
      }
    }
  }, [items]);

  const handleToggleAvailability = async (item) => {
    const newStatus = item.is_in_stock === false ? true : false;
    try {
      await supabase.from('menu_items').update({ is_in_stock: newStatus }).eq('id', item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_in_stock: newStatus } : i));
    } catch (e) { alert('שגיאה בעדכון זמינות'); }
  };

  const handleSelectCategory = (cat) => {
    setIsAnimating(true);
    setTimeout(() => {
      setActiveCategory(cat);
      setTimeout(() => setIsAnimating(false), 50);
    }, 200);
  };

  const handleBackToCategories = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setActiveCategory(null);
      setTimeout(() => setIsAnimating(false), 50);
    }, 200);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    setSelectedItem({ name: '', price: '', category: newCategoryName.trim(), is_in_stock: true });
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleAddItem = () => {
    setSelectedItem({ name: '', price: '', category: activeCategory, is_in_stock: true });
  };

  const groupedCategories = useMemo(() => {
    return items.reduce((acc, item) => {
      const cat = item.category || 'אחר';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [items]);

  const categoriesList = useMemo(() => Object.keys(groupedCategories), [groupedCategories]);

  const displayItems = useMemo(() => {
    let relevantItems = activeCategory ? groupedCategories[activeCategory] || [] : items;
    if (searchTerm.trim()) {
      relevantItems = relevantItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return relevantItems;
  }, [items, groupedCategories, activeCategory, searchTerm]);

  if (loading) return (
    <div className="h-full flex flex-col bg-gray-50 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );

  const ActiveIcon = activeCategory ? getCategoryIcon(activeCategory) : null;

  return (
    <div className="space-y-4 pb-24 relative min-h-screen font-heebo" dir="rtl">

      {/* Sticky Header with Permanent Search */}
      <div className="bg-gray-100/95 backdrop-blur-sm sticky top-0 z-30 transition-all pb-3 pt-2 px-2 shadow-sm border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto flex items-center gap-2">

          {/* Back Button / Category Indicator */}
          {activeCategory ? (
            <button
              onClick={() => setActiveCategory(null)}
              className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all group"
            >
              <ArrowRight size={22} className="group-hover:-translate-x-1 transition-transform" />
            </button>
          ) : null}

          {/* Search Bar - Main Permanent Element */}
          <div className="flex-1 relative group">
            <div className={`absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl transition-opacity ${searchTerm ? 'opacity-100' : 'opacity-0'}`} />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200/80 rounded-2xl pr-11 pl-4 py-3.5 shadow-sm focus:shadow-md focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 placeholder-gray-400 transition-all text-base"
              placeholder={activeCategory ? `חיפוש ב${activeCategory}...` : "חיפוש בתפריט..."}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Add Action Button */}
          <button
            onClick={() => activeCategory ? handleAddItem() : setIsAddingCategory(true)}
            className="bg-blue-600 text-white p-3.5 rounded-2xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-95 transition-all border border-blue-500"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">

        {/* Search results header */}
        {searchTerm && !activeCategory && (
          <div className="mb-4 text-sm text-gray-500 font-medium">
            תוצאות חיפוש עבור: <span className="text-gray-800 font-bold">"{searchTerm}" (נמצאו {displayItems.length})</span>
          </div>
        )}

        {/* VIEW: Category Cards Grid - Same design as item cards */}
        {!activeCategory && !searchTerm && (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 max-w-6xl mx-auto transition-all duration-300 ease-out
              ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
          >
            {categoriesList.map(cat => {
              const CatIcon = getCategoryIcon(cat);
              const count = groupedCategories[cat]?.length || 0;

              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 pr-2 flex items-center gap-3 text-right transition-all cursor-pointer group hover:shadow-md hover:border-blue-200 hover:bg-blue-50/50 active:scale-[0.98]"
                >
                  {/* Icon - Same size as image in MenuManagerCard */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gray-50 transition-colors">
                    <CatIcon size={28} strokeWidth={1.5} className="text-gray-400 group-hover:text-gray-500 transition-colors" />
                  </div>

                  {/* Content - Same layout as MenuManagerCard */}
                  <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
                    <h3 className="font-bold text-gray-800 text-sm leading-tight truncate pr-1">
                      {cat}
                    </h3>
                    <span className="text-xs text-blue-600 font-bold mt-0.5">
                      {count} פריטים
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Add Category Card - Same design */}
            {/* Add Category Inline Form - Only show when active */}
            {isAddingCategory && (
              <div className="bg-white rounded-xl border-2 border-blue-500 p-3 flex items-center gap-2 shadow-lg animate-in fade-in zoom-in-95">
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  placeholder="שם הקטגוריה..."
                  className="flex-1 px-3 py-2 bg-gray-50 border border-transparent focus:bg-white rounded-xl text-sm font-bold outline-none"
                />
                <button onClick={handleAddCategory} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                  <Plus size={18} strokeWidth={3} />
                </button>
                <button onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }} className="p-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors">
                  <X size={18} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW: Items Grid */}
        {(activeCategory || searchTerm) && (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 max-w-6xl mx-auto transition-all duration-300 ease-out
              ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
          >
            {displayItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 col-span-full">
                לא נמצאו פריטים...
              </div>
            ) : (
              displayItems.map(item => (
                <MenuManagerCard
                  key={item.id}
                  item={item}
                  onClick={setSelectedItem}
                  onToggleAvailability={handleToggleAvailability}
                />
              ))
            )}
          </div>
        )}

      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedItem && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <MenuEditModal
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onSave={fetchItems}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(MenuDisplay);
