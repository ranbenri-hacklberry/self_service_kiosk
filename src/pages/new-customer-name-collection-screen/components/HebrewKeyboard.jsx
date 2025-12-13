import React, { useState } from 'react';
import { Delete, Globe } from 'lucide-react';

const hebrewKeys = [
  ['פ', 'ם', 'ן', 'ו', 'ט', 'א', 'ר', 'ק'],
  ['ף', 'ך', 'ל', 'ח', 'י', 'ע', 'כ', 'ג', 'ד', 'ש'],
  ['ץ', 'ת', 'צ', 'מ', 'נ', 'ה', 'ב', 'ס', 'ז']
];

const englishKeys = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const HebrewKeyboard = ({ onKeyPress }) => {
  const [language, setLanguage] = useState('he');
  const isHebrew = language === 'he';
  const currentKeys = isHebrew ? hebrewKeys : englishKeys;

  const handleCharClick = (char) => {
    onKeyPress?.(char);
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'he' ? 'en' : 'he'));
  };

  return (
    <div className="w-full flex flex-col gap-2 select-none" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* Rows of keys */}
      {currentKeys.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-2 w-full">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handleCharClick(key)}
              className="flex-1 h-16 min-w-[40px] bg-white border border-gray-200 rounded-2xl text-2xl font-bold text-slate-800 shadow-sm hover:bg-gray-50 active:bg-orange-50 active:border-orange-500 active:text-orange-600 active:scale-95 transition-all duration-150"
            >
              {key}
            </button>
          ))}
        </div>
      ))}

      {/* Bottom Row: Delete (Right in RTL), Space, Language (Left in RTL) */}
      <div className="flex justify-center gap-2 w-full mt-1">
        <button
          onClick={() => onKeyPress?.('delete')}
          className="h-16 px-6 min-w-[80px] bg-red-50 border border-red-100 rounded-2xl text-red-500 hover:bg-red-100 active:bg-red-200 active:scale-95 transition-all flex items-center justify-center"
        >
          <Delete size={28} />
        </button>

        <button
          onClick={() => onKeyPress?.('space')}
          className="flex-[2] h-16 bg-white border border-gray-200 rounded-2xl text-gray-600 font-bold text-xl shadow-sm hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all"
        >
          רווח
        </button>

        <button
          onClick={toggleLanguage}
          className="h-16 px-6 min-w-[80px] bg-gray-100 border border-gray-200 rounded-2xl text-gray-700 font-bold text-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Globe size={24} />
          <span>{isHebrew ? 'En' : 'עב'}</span>
        </button>
      </div>
    </div>
  );
};

export default HebrewKeyboard;