import React, { useState } from 'react';
import { Check, ChefHat, ShoppingBag } from 'lucide-react';

/**
 * SaladPrepDecision Component
 * For CONDITIONAL items (like salads) - allows cashier to decide if prep is needed
 * 
 * @param {Object} selectedItem - The menu item being added
 * @param {Function} onSubmitSelection - Callback with (mods, notes)
 * @param {Function} onClose - Close modal callback
 */
const SaladPrepDecision = ({ selectedItem, onSubmitSelection, onClose }) => {
    const [prepMode, setPrepMode] = useState('ready'); // 'ready' or 'prep'
    const [customNotes, setCustomNotes] = useState('');

    const handleNotesChange = (e) => {
        const text = e.target.value;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        // Limit to 7 words
        if (words.length <= 7) {
            setCustomNotes(text);
        }
    };

    const handleSubmit = () => {
        const mods = prepMode === 'prep' ? { kds_override: true } : {};

        // Add custom note as a modifier if provided
        if (customNotes.trim()) {
            mods.custom_note = customNotes.trim();
        }

        onSubmitSelection(mods);
    };

    const wordCount = customNotes.trim().split(/\s+/).filter(w => w.length > 0).length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[#FAFAFA] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative h-32 bg-slate-900 flex items-end p-6 overflow-hidden shrink-0">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500 rounded-full blur-3xl" />
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl" />
                    </div>

                    <div className="relative z-10 w-full">
                        <div className="flex items-center justify-between mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-xs font-medium backdrop-blur-md border border-white/10">
                                סלטים
                            </span>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
                            >
                                <Check size={16} className="rotate-45" />
                            </button>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{selectedItem?.name}</h2>
                        <p className="text-white/60 text-sm font-medium">איך להגיש?</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Prep Mode Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Ready (Default) */}
                        <button
                            onClick={() => setPrepMode('ready')}
                            className={`
                relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-2xl
                font-bold transition-all duration-200 border touch-manipulation active:scale-95
                ${prepMode === 'ready'
                                    ? 'bg-green-50 border-green-500 ring-1 ring-green-500 shadow-lg shadow-green-100'
                                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50'
                                }
              `}
                        >
                            <ShoppingBag size={32} className={prepMode === 'ready' ? 'text-green-600' : 'text-slate-400'} />
                            <div className="text-center">
                                <div className={`text-base ${prepMode === 'ready' ? 'text-green-700' : 'text-slate-600'}`}>
                                    קיבל מוכן
                                </div>
                                <div className="text-xs text-slate-400 mt-1">מהמדף</div>
                            </div>
                            {prepMode === 'ready' && (
                                <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1">
                                    <Check size={14} className="text-white" />
                                </div>
                            )}
                        </button>

                        {/* Prep Required */}
                        <button
                            onClick={() => setPrepMode('prep')}
                            className={`
                relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-2xl
                font-bold transition-all duration-200 border touch-manipulation active:scale-95
                ${prepMode === 'prep'
                                    ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500 shadow-lg shadow-orange-100'
                                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50'
                                }
              `}
                        >
                            <ChefHat size={32} className={prepMode === 'prep' ? 'text-orange-600' : 'text-slate-400'} />
                            <div className="text-center">
                                <div className={`text-base ${prepMode === 'prep' ? 'text-orange-700' : 'text-slate-600'}`}>
                                    דורש הכנה
                                </div>
                                <div className="text-xs text-slate-400 mt-1">הכן עכשיו</div>
                            </div>
                            {prepMode === 'prep' && (
                                <div className="absolute top-3 right-3 bg-orange-500 rounded-full p-1">
                                    <Check size={14} className="text-white" />
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Custom Notes as Modifier */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 px-1">
                            הערה מותאמת (עד 7 מילים)
                        </label>
                        <div className={`relative rounded-xl border transition-all duration-200 bg-white
              ${customNotes.trim().length > 0
                                ? 'border-orange-500 ring-1 ring-orange-500'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}>
                            <textarea
                                value={customNotes}
                                onChange={handleNotesChange}
                                placeholder="לדוגמה: בלי עגבניות תוספת זיתים"
                                rows={2}
                                className="w-full px-4 py-3 bg-transparent rounded-xl focus:outline-none resize-none text-sm placeholder:text-slate-400"
                            />
                            <div className="absolute bottom-2 left-2 text-[10px] font-medium text-slate-400">
                                {wordCount}/7 מילים
                            </div>
                        </div>
                        {customNotes.trim() && (
                            <div className="text-xs text-blue-600 mt-2 px-1 font-medium">
                                * יוצג כמוד בקופה ובKDS
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="w-1/3 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors active:scale-95"
                        >
                            ביטול
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 bg-slate-900 hover:bg-black text-white h-12 rounded-2xl flex items-center justify-center px-6 text-base font-bold shadow-xl shadow-slate-300/50 transition-colors active:scale-98"
                        >
                            <span>אישור והוספה</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default SaladPrepDecision;
