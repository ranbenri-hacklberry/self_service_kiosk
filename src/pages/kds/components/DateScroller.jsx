import React, { useRef, useEffect, useState } from 'react';

const DateScroller = ({ selectedDate, onSelectDate }) => {
    const containerRef = useRef(null);
    const [dates, setDates] = useState([]);
    const ITEM_WIDTH = 100;

    // 1. Generate Dates: PAST -> TODAY
    useEffect(() => {
        const tempDates = [];
        const range = 60;
        const today = new Date();

        // List: [Today, Yesterday, ..., -60]
        for (let i = 0; i >= -range; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            tempDates.push(d);
        }
        setDates(tempDates);
    }, []);

    // 2. Initial Center
    useEffect(() => {
        if (dates.length > 0 && containerRef.current) {
            const index = dates.findIndex(d =>
                d.getDate() === selectedDate.getDate() &&
                d.getMonth() === selectedDate.getMonth() &&
                d.getFullYear() === selectedDate.getFullYear()
            );
            const targetIndex = index === -1 ? 0 : index;
            scrollToIndex(targetIndex, 'auto');
        }
    }, [dates.length]);

    // 3. Scroll Helper
    const scrollToIndex = (index, behavior = 'smooth') => {
        const container = containerRef.current;
        if (!container) return;
        const targetEl = container.children[index];
        if (targetEl) {
            targetEl.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
        }
    };

    // 4. Select Handler
    const handleItemClick = (date, index) => {
        onSelectDate(date);
        scrollToIndex(index, 'smooth');
    };

    return (
        <div className={`w-full h-32 relative bg-white border-t border-gray-100 flex items-center justify-center shrink-0 z-40 select-none shadow-[0_-5px_30px_rgba(0,0,0,0.08)]`}>

            {/* CENTER FRAME / LENS */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-24 pointer-events-none z-10 flex flex-col justify-between py-1">
                <div className="w-full h-0.5 bg-blue-500/80 rounded-full shadow-sm"></div>
                <div className="w-full h-0.5 bg-blue-500/80 rounded-full shadow-sm"></div>
            </div>

            {/* FADE GRADIENTS (Keep minimal to not look 'faded') */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white via-white/80 to-transparent z-20 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white via-white/80 to-transparent z-20 pointer-events-none"></div>

            {/* CONTAINER */}
            <div
                ref={containerRef}
                className="flex items-center w-full h-full overflow-x-auto hide-scrollbar"
                // Center padding allows first/last items to reach middle
                style={{ paddingInline: 'calc(50% - 50px)' }}
                dir="rtl"
            >
                {dates.map((date, idx) => {
                    const isSelectedDate = date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                        <button
                            key={idx}
                            style={{ width: ITEM_WIDTH, minWidth: ITEM_WIDTH }}
                            onClick={() => handleItemClick(date, idx)}
                            // DESIGN UPDATE:
                            // 1. No opacity change (always 100 or near 100).
                            // 2. Scale: Selected = 1.1, Unselected = 0.85 (Make difference clear)
                            // 3. Font weight changes.
                            className={`flex flex-col items-center justify-center transition-all duration-300 transform outline-none
                    ${isSelectedDate ? 'scale-110 z-10' : 'scale-85 hover:scale-90 text-slate-500'}
                `}
                        >
                            <div className={`h-20 flex flex-col items-center justify-center rounded-xl px-2 transition-colors`}>
                                <span className={`text-sm font-medium ${isSelectedDate ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {date.toLocaleDateString('he-IL', { weekday: 'short' })}
                                </span>
                                <span className={`text-3xl font-black leading-none my-0.5 ${isSelectedDate ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {date.getDate()}
                                </span>
                                <span className={`text-[10px] uppercase font-bold ${isSelectedDate ? 'text-slate-500' : 'text-slate-300'}`}>
                                    {date.toLocaleDateString('he-IL', { month: 'short' })}
                                </span>
                            </div>

                            {isToday && <div className="absolute bottom-1 px-2 py-0.5 bg-blue-500 text-white text-[9px] rounded-full font-bold shadow-sm">היום</div>}
                        </button>
                    );
                })}
            </div>

            <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
       `}</style>
        </div>
    );
};

export default DateScroller;
