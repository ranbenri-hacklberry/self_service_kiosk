import React from 'react';

import Image from '../../../components/AppImage';

import Icon from '../../../components/AppIcon';



const MenuItemCard = ({ item, onAddToCart }) => {
  // Format price to Israeli Shekel (ILS) - number only
  const formatPrice = (price) => {
    return new Intl.NumberFormat('he-IL', {
      maximumFractionDigits: 0
    }).format(price);
  };



  const handleClick = () => {
    // לחיצה בכל מקום בכרטיסייה פותחת את מסך ה-Modifier

    if (onAddToCart && item?.available) {

      onAddToCart(item);

    }

  };



  // Helper to optimize image URLs (mainly for Unsplash)
  const optimizeImageUrl = (url, width = 400) => {
    if (!url) return null;
    try {
      if (url.includes('images.unsplash.com')) {
        // Create a URL object to handle existing params robustly
        const urlObj = new URL(url);
        urlObj.searchParams.set('w', width);
        urlObj.searchParams.set('q', '75'); // Slightly lower quality for better speed
        urlObj.searchParams.set('auto', 'format');
        urlObj.searchParams.set('fit', 'crop');
        return urlObj.toString();
      }
    } catch (e) {
      console.warn('Failed to optimize image URL:', url);
    }
    return url;
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex flex-col
        bg-white rounded-2xl shadow-sm border border-gray-100
        aspect-[5/4]
        hover:shadow-md hover:border-gray-200 hover:-translate-y-1
        transition-all duration-300 cursor-pointer overflow-hidden
        ${!item?.available ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      {/* Item Image - Takes up remaining space */}
      <div className="flex-1 relative overflow-hidden bg-gray-50">
        <Image
          src={optimizeImageUrl(item?.image)}
          alt={item?.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* 'Not Available' Overlay */}
        {!item?.available && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold shadow-sm border border-red-100 flex items-center gap-2">
              <Icon name="AlertCircle" size={18} />
              <span>לא זמין</span>
            </div>
          </div>
        )}

        {/* Popularity Badge */}
        {item?.isPopular && item?.available && (
          <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-950 px-3 py-1 rounded-full text-xs font-black shadow-sm z-10 flex items-center gap-1">
            <Icon name="Star" size={12} className="fill-current" />
            פופולרי
          </div>
        )}

        {/* Modifiers Indicator */}
        {(item?.options && item?.options?.length > 0) && item?.available && (
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur text-slate-700 p-2 rounded-full shadow-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Icon name="Settings" size={16} />
          </div>
        )}
      </div>

      {/* Details - Compact single line */}
      <div className="p-2 bg-white flex items-center justify-between gap-2 shrink-0 border-t border-gray-50" dir="rtl">
        <h3 className="font-bold text-sm text-slate-800 leading-tight truncate flex-1 group-hover:text-orange-600 transition-colors">
          {item?.name}
        </h3>

        <div className="flex flex-col items-end leading-none">
          {item?.originalPrice ? (
            <>
              <span className="text-[10px] text-gray-400 line-through mb-0.5">
                {formatPrice(item.originalPrice)}
              </span>
              <span className="font-mono font-bold text-base text-red-600 bg-red-50 px-1.5 py-0.5 rounded-lg">
                {formatPrice(item?.price)}
              </span>
            </>
          ) : (
            <span className="font-mono font-bold text-base text-slate-900 bg-gray-50 px-1.5 py-0.5 rounded-lg">
              {formatPrice(item?.price)}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

export default MenuItemCard;