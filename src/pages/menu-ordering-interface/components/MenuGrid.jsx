import React from 'react';
import MenuItemCard from './MenuItemCard';
import Icon from '../../../components/AppIcon';

const MenuGrid = ({ items = [], onAddToCart, isLoading = false, groupedItems = null }) => {
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 8 })?.map((_, index) => (
            <div key={`skeleton-${index}`} className="bg-card rounded-lg shadow-kiosk overflow-hidden animate-pulse">
              <div className="h-48 bg-muted"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="flex justify-between items-center">
                  <div className="h-6 bg-muted rounded w-16"></div>
                  <div className="h-8 bg-muted rounded w-20"></div>
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
      <div className="flex flex-col items-center justify-center py-16 px-6" dir="rtl">
        <div className="bg-muted/30 rounded-full p-6 mb-6">
          <Icon name="Search" size={48} color="var(--color-muted-foreground)" />
        </div>
        <h3 className="text-xl font-semibold text-card-foreground mb-2">
          לא נמצאו פריטים
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
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
              <h3 className="text-sm font-bold text-gray-500 mb-2 pr-1" dir="rtl">
                {group.title}
              </h3>
            )}
            {/* Items in this group */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
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