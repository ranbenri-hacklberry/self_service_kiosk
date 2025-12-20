import React from 'react';
import { Star } from 'lucide-react';

/**
 * Star rating component with full, half, and empty states
 * @param {number} rating - Current rating (0-5)
 * @param {function} onRate - Callback when rating changes
 * @param {boolean} readonly - If true, cannot change rating
 * @param {string} size - Size of stars (small, medium, large)
 */
const RatingStars = ({
    rating = 0,
    onRate,
    readonly = false,
    size = 'medium',
    showValue = false
}) => {
    const sizes = {
        small: 14,
        medium: 20,
        large: 28
    };

    const starSize = sizes[size] || sizes.medium;

    const handleClick = (starIndex) => {
        if (readonly || !onRate) return;
        onRate(starIndex);
    };

    const renderStar = (index) => {
        const filled = index <= rating;
        const halfFilled = !filled && index - 0.5 <= rating;

        return (
            <button
                key={index}
                onClick={() => handleClick(index)}
                disabled={readonly}
                className={`
          music-star transition-all duration-200
          ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125'}
          ${filled ? 'text-yellow-400' : halfFilled ? 'text-yellow-400/50' : 'text-white/20'}
        `}
                style={{ padding: 0, border: 'none', background: 'none' }}
            >
                <Star
                    size={starSize}
                    fill={filled ? 'currentColor' : 'none'}
                    strokeWidth={filled ? 0 : 2}
                />
            </button>
        );
    };

    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(renderStar)}
            {showValue && rating > 0 && (
                <span className="mr-2 text-sm text-white/60 font-medium">
                    {rating.toFixed(1)}
                </span>
            )}
        </div>
    );
};

export default RatingStars;
