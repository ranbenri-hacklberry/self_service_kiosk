import React from 'react';
import { Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];

const NumericKeypad = ({ onKeyPress }) => {
  const handleKeyPress = (key) => {
    if (key === '⌫') {
      onKeyPress('delete');
      return;
    }
    if (key === '') return;
    onKeyPress(key);
  };

  return (
    <div className="w-full grid grid-cols-3 gap-2 px-2" dir="ltr">
      {KEYS.map((key, index) => {
        const isDelete = key === '⌫';
        const isEmpty = key === '';

        if (isEmpty) return <div key={`empty-${index}`} />;

        return (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            className={`h-20 rounded-2xl text-2xl font-bold transition-colors active:scale-95 ${isDelete
              ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 flex items-center justify-center'
              : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'
              }`}
            aria-label={isDelete ? 'מחק' : key}
          >
            {isDelete ? <Delete size={24} strokeWidth={2.5} /> : key}
          </button>
        );
      })}
    </div>
  );
};

export default NumericKeypad;