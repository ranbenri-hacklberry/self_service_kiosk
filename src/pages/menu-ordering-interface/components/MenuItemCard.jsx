import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

const MenuItemCard = ({ item, onAddToCart }) => {
  const { isDarkMode } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fallback for missing/broken image
  const fallbackImage = '/api/placeholder/400/300';
  const bgImage = imageError ? fallbackImage : (item?.image || fallbackImage);

  // Handler for click - memoized to prevent unnecessary re-renders
  const handleClick = useCallback(() => {
    if (item?.available !== false) {
      onAddToCart?.(item);
    }
  }, [item, onAddToCart]);

  // Handler for keyboard accessibility
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // --- Dynamic Styles (memoized) ---
  const containerClass = useMemo(() =>
    isDarkMode
      ? 'bg-slate-900 border-slate-700 shadow-black/50'
      : 'bg-white border-slate-200 shadow-slate-200'
    , [isDarkMode]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative group w-full aspect-square compact-card-ratio rounded-3xl overflow-hidden cursor-pointer select-none 
        border shadow-2xl transition-colors duration-300
        ${containerClass}
        ${item?.available === false ? 'opacity-60 cursor-not-allowed grayscale' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={item?.available !== false ? 0 : -1}
      role="button"
      aria-label={`${item?.name} - ${item?.available !== false ? 'זמין' : 'לא זמין'}`}
    >
      {/* --- Background Image & Skeleton --- */}
      <div className={`absolute inset-0 z-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {!imageLoaded && (
          <div className={`w-full h-full animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
        )}
        <img
          src={bgImage}
          alt={item?.name}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-700 ease-out 
            ${isHovered ? 'scale-110' : 'scale-100'} 
            ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />

        {/* Premium Dark Gradient Overlay - Always keep dark for text readability on background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100" />
      </div>

      {/* --- Not Available Overlay --- */}
      {item?.available === false && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-xl font-bold shadow-lg border border-red-400/30">
            לא זמין
          </div>
        </div>
      )}

      {/* --- Content Area --- */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 compact-padding-s">

        {/* Top Badges */}
        <div className="flex justify-end w-full">
          <div className="flex flex-col gap-2 items-end">
            {item?.isPopular && (
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-md border border-white/20"
              >
                <Flame size={12} className="fill-white" />
                פופולרי
              </motion.div>
            )}
            {item?.isNew && (
              <div className="px-3 py-1 rounded-full bg-blue-600/90 text-white text-xs font-bold backdrop-blur-md border border-blue-400/30 shadow-lg">
                חדש
              </div>
            )}
          </div>
        </div>

        {/* Bottom Text Area - Minimalist & Clean */}
        <div className="w-full transform transition-transform duration-300 group-hover:-translate-y-1">
          <div className="flex items-baseline justify-between gap-3" dir="rtl">

            {/* Name */}
            <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg truncate flex-1 tracking-wide compact-text-lg">
              {item?.name}
            </h3>

            {/* Price */}
            <div className="flex flex-col items-end shrink-0">
              {item?.originalPrice && (
                <span className="text-slate-400 text-xs line-through mb-[-2px]">
                  {item.originalPrice}
                </span>
              )}
              <span className={`font-black text-xl drop-shadow-lg compact-text-lg ${item?.originalPrice
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400'
                : 'text-white'
                }`}>
                {item?.price}
              </span>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(MenuItemCard);