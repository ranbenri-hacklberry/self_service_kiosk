import React from 'react';
import MenuItemCard from './MenuItemCard';
import Icon from '../../../components/AppIcon';
import { useTheme } from '../../../context/ThemeContext';

const MenuGrid = ({ items = [], onAddToCart, isLoading = false, groupedItems = null }) => {
  const { isDarkMode } = useTheme();
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 responsive-menu-grid">
          {Array.from({ length: 8 })?.map((_, index) => (
            <div key={`skeleton-${index}`} className={`rounded-xl overflow-hidden animate-pulse shadow-xl ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-100'
              }`}>
              <div className={`h-48 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}></div>
              <div className="p-4 space-y-3">
                <div className={`h-4 rounded w-3/4 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}></div>
                <div className={`h-3 rounded w-full ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}></div>
                <div className={`h-3 rounded w-2/3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}></div>
                <div className="flex justify-between items-center pt-2">
                  <div className={`h-6 rounded w-16 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}></div>
                  <div className={`h-8 rounded w-20 ${isDarkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items?.length === 0 && !groupedItems) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 mt-10" dir="rtl">
        <div className={`rounded-full p-8 mb-6 transition-colors duration-300 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
          <Icon name="Search" size={56} className={isDarkMode ? 'text-slate-600' : 'text-gray-400'} />
        </div>
        <h3 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          לא נמצאו פריטים
        </h3>
        <p className={`text-center max-w-md transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          נסה לבחור קטגוריה אחרת או חזור לתפריט הראשי
        </p>
      </div>
    );
  }

  // If we have grouped items, render each group in its own row
  if (groupedItems && groupedItems.length > 0) {
    return (
      <div className="p-4 space-y-4">
        {groupedItems.map((group, groupIndex) => (
          <div key={group.title || groupIndex}>
            {/* Group Title - optional */}
            {group.showTitle && (
              <h3 className={`text-sm font-bold mb-3 pr-1 transition-colors duration-300 ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`} dir="rtl">
                {group.title}
              </h3>
            )}
            {/* Items in this group */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 responsive-menu-grid">
              {group.items?.map((item) => (
                <MenuItemCard
                  key={item?.id}
                  item={item}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: flat list
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 responsive-menu-grid">
        {items?.map((item) => (
          <MenuItemCard
            key={item?.id}
            item={item}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </div>
  );
};

export default MenuGrid;