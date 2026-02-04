import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Minus, History, AlertTriangle } from 'lucide-react';
import { InventoryItem } from '@/pages/ipad_inventory/types';

const MotionDiv = motion.div as any;

interface InventoryItemsGridProps {
    items: InventoryItem[];
    onUpdateStock: (itemId: string, newStock: number) => void;
    isLoading: boolean;
}

const InventoryItemsGrid: React.FC<InventoryItemsGridProps> = ({
    items,
    onUpdateStock,
    isLoading
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 h-full bg-slate-50 overflow-hidden flex flex-col">
            {/* Local Search & Toolbar */}
            <div className="px-8 py-6 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-xl">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="חיפוש מהיר של פריטים..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-4 pr-12 pl-4 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-100 transition-all shadow-sm">
                        <History size={18} />
                        <span>היסטוריה</span>
                    </button>
                    <button className="flex items-center gap-2 px-5 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        <Plus size={18} />
                        <span>פריט חדש</span>
                    </button>
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto px-8 pb-32 no-scrollbar">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <div className="p-6 bg-slate-100 rounded-full">
                            <Search size={48} />
                        </div>
                        <span className="text-xl font-bold">לא נמצאו פריטים תואמים</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredItems.map((item) => (
                            <InventoryItemCard
                                key={item.id}
                                item={item}
                                onUpdateStock={onUpdateStock}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const InventoryItemCard: React.FC<{ item: InventoryItem, onUpdateStock: (itemId: string, newStock: number) => void }> = ({ item, onUpdateStock }) => {
    const isLowStock = item.current_stock <= (item.low_stock_alert || 0);
    const [localStock, setLocalStock] = useState(item.current_stock);

    const handleIncrement = () => {
        const step = Number(item.count_step) || 1;
        const next = localStock + step;
        setLocalStock(next);
        onUpdateStock(item.id, next);
    };

    const handleDecrement = () => {
        const step = Number(item.count_step) || 1;
        const next = Math.max(0, localStock - step);
        setLocalStock(next);
        onUpdateStock(item.id, next);
    };

    return (
        <MotionDiv
            layout
            className={`bg-white rounded-3xl p-6 shadow-sm border ${isLowStock ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100'
                } group hover:shadow-md transition-all`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 mb-1">{item.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg self-start ${isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {item.unit}
                    </span>
                </div>
                {isLowStock && (
                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                        <AlertTriangle size={20} />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-4 mt-6">
                <button
                    onClick={handleDecrement}
                    className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
                >
                    <Minus size={24} />
                </button>

                <div className="flex-1 flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-900 tabular-nums">
                        {localStock % 1 === 0 ? localStock : localStock.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">מלאי נוכחי</span>
                </div>

                <button
                    onClick={handleIncrement}
                    className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-100 active:scale-95 transition-all"
                >
                    <Plus size={24} />
                </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-1">
                    <History size={12} />
                    <span>עדכון אחרון: {item.last_counted_at ? new Date(item.last_counted_at).toLocaleDateString('he-IL') : 'מעולם לא'}</span>
                </div>
                <span>{item.last_counted_by_name || ''}</span>
            </div>
        </MotionDiv>
    );
};

export default InventoryItemsGrid;
