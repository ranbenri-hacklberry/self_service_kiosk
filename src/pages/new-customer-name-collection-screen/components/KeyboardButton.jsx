import React from 'react';
import { cn } from '../../../utils/cn';

const KeyboardButton = ({ children, onClick, className, ...props }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'min-w-[52px] px-4 py-3 bg-white border border-amber-200 rounded-xl text-xl font-semibold text-gray-800 shadow-sm hover:bg-amber-50 active:bg-amber-100 transition',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default KeyboardButton;
