import React from 'react';
import { useTheme } from '../../../context/ThemeContext';

const MenuCategoryFilter = ({ activeCategory = 'hot-drinks', onCategoryChange, categories: propCategories }) => {
  const { isDarkMode } = useTheme();

  // Fallback categories if none provided
  const defaultCategories = [
    { id: 'hot-drinks', name: 'שתיה חמה', icon: 'Coffee' },
    { id: 'cold-drinks', name: 'שתיה קרה', icon: 'GlassWater' },
    { id: 'pastries', name: 'מאפים', icon: 'Croissant' },
    { id: 'salads', name: 'סלטים', icon: 'Leaf' },
    { id: 'sandwiches', name: 'כריכים וטוסטים', icon: 'Sandwich' },
    { id: 'desserts', name: 'קינוחים', icon: 'IceCream' }
  ];

  // Use provided categories or fallback
  const categories = (propCategories && propCategories.length > 0) ? propCategories : defaultCategories;

  const handleCategorySelect = (categoryId) => {
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };

  return (
    <div className={`sticky top-0 z-20 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-gray-100'} backdrop-blur-sm border-b shadow-sm font-heebo transition-colors duration-300`}>
      <div className="px-4 py-3">
        <div className="flex items-center overflow-x-auto scrollbar-hide" dir="rtl">
          <div className={`flex items-center gap-1 p-1 rounded-xl min-w-max mx-auto ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
            {categories?.map((category) => {
              const isActive = activeCategory === category?.id;

              return (
                <button
                  key={category?.id}
                  onClick={() => handleCategorySelect(category?.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-3 rounded-lg transition-all duration-200 text-[15px] font-bold whitespace-nowrap
                    ${isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50')
                    }
                  `}
                >
                  <span>{category?.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuCategoryFilter;