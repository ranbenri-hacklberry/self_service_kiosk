import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Flame, Info, ShoppingBag } from 'lucide-react';

const MenuItemCard = ({ item, onAddToCart }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fallback for missing image
  const bgImage = item?.image || '/api/placeholder/400/300';

  // Handler for click (supports both onAddToCart and onAdd prop names)
  const handleClick = () => {
    if (item?.available !== false) {
      onAddToCart?.(item);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative group w-full aspect-square rounded-3xl overflow-hidden cursor-pointer select-none ${item?.available === false ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      onClick={handleClick}
    >
      {/* --- Background Image & Skeleton --- */}
      <div className="absolute inset-0 z-0">
        {!imageLoaded && (
          <div className="w-full h-full bg-slate-800 animate-pulse" />
        )}
        <img
          src={bgImage}
          alt={item?.name}
          className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isHovered ? 'scale-110' : 'scale-100'
            } ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setImageLoaded(true)}
        />
        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90" />
      </div>

      {/* --- Not Available Overlay --- */}
      {item?.available === false && (
        <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-red-500/80 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
            לא זמין
          </div>
        </div>
      )}

      {/* --- Glassmorphism Content Area --- */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-5">

        {/* Top Badges */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
          {item?.isPopular && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-md border border-white/10"
            >
              <Flame size={12} className="fill-white" />
              פופולרי
            </motion.div>
          )}
          {item?.isNew && (
            <div className="px-3 py-1 rounded-full bg-blue-500/80 text-white text-xs font-bold backdrop-blur-md border border-blue-400/20">
              חדש
            </div>
          )}
        </div>

        {/* Text Content - Name and price on same row */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center justify-between gap-2" dir="rtl">
            <h3 className="text-lg font-bold text-white leading-tight drop-shadow-md truncate flex-1">
              {item?.name}
            </h3>
            {item?.originalPrice ? (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400 text-sm line-through">{item.originalPrice}</span>
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  {item?.price}
                </span>
              </div>
            ) : (
              <span className="text-lg font-black text-white drop-shadow-lg shrink-0">{item?.price}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MenuItemCard;