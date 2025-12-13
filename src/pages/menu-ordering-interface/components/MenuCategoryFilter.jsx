import React from 'react';
import Button from '../../../components/ui/Button';


const MenuCategoryFilter = ({ activeCategory = 'hot-drinks', onCategoryChange }) => {
  const categories = [
    { id: 'hot-drinks', name: 'שתיה חמה', icon: 'Coffee' },
    { id: 'cold-drinks', name: 'שתיה קרה', icon: 'GlassWater' },
    { id: 'pastries', name: 'מאפים', icon: 'Croissant' },
    { id: 'salads', name: 'סלטים', icon: 'Leaf' },
    { id: 'sandwiches', name: 'כריכים וטוסטים', icon: 'Sandwich' },
    { id: 'desserts', name: 'קינוחים', icon: 'IceCream' }
  ];

  const handleCategorySelect = (categoryId) => {
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm font-heebo">
      <div className="px-4 py-3">
        <div className="flex items-center overflow-x-auto scrollbar-hide" dir="rtl">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl min-w-max mx-auto">
            {categories?.map((category) => {
              // Icon mapping if needed, or just use text
              const isActive = activeCategory === category?.id;

              return (
                <button
                  key={category?.id}
                  onClick={() => handleCategorySelect(category?.id)}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 text-base font-bold
                    ${isActive
                      ? 'bg-white text-slate-900 shadow-sm scale-[1.02]'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }
                  `}
                >
                  {/* We can add icons here if we import them, but text is clean */}
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