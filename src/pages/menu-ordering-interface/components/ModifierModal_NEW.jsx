import React, { useEffect, useState, useMemo } from 'react';
import {
    X, Check, Coffee, Milk, Sprout, Wheat, Droplet, Flame,
    Thermometer, Ban, Puzzle, Cloud, CloudOff, Gauge, Blend, Circle, Activity
} from 'lucide-react';
import { fetchManagerItemOptions } from '@/lib/managerApi';

// --- Helper: מיפוי אייקונים לפי שם ---
const getIconForName = (name) => {
    if (!name) return Circle;
    const lower = name.toLowerCase();

    // חלב
    if (lower.includes('רגיל')) return Milk;
    if (lower.includes('סויה')) return Sprout;
    if (lower.includes('שיבולת')) return Wheat;
    if (lower.includes('שקדים')) return Wheat;

    // קצף
    if (lower.includes('הרבה') || lower.includes('אקסטרה')) return Cloud;
    if (lower.includes('מעט') || lower.includes('קצת')) return CloudOff;
    if (lower.includes('בלי')) return X;

    // טמפרטורה
    if (lower.includes('רותח') || lower.includes('חם מאוד')) return Flame;
    if (lower.includes('פושר')) return Thermometer;

    // בסיס / חוזק
    if (lower.includes('מים')) return Droplet;
    if (lower.includes('חצי')) return Blend;
    if (lower.includes('חזק')) return Gauge;
    if (lower.includes('חלש')) return Activity; // אייקון חדש לחלש

    // מיוחדים
    if (lower.includes('נטול')) return Ban;
    if (lower.includes('מפורק')) return Puzzle;

    return Circle;
};

// --- רכיב כפתור חלב (Hero) ---
const MilkCard = ({ label, price, isSelected, onClick }) => {
    const Icon = getIconForName(label);
    return (
        <button
            onClick={onClick}
            className={`
        relative flex-1 flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-2xl
        font-bold transition-all duration-200 touch-manipulation min-h-[96px] active:scale-95
        ${isSelected
                    ? "bg-orange-50 text-orange-600 ring-[3px] ring-orange-500 ring-offset-2 shadow-xl shadow-orange-200/60 scale-[1.02]"
                    : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md"
                }
      `}
        >
            <Icon
                size={28}
                strokeWidth={isSelected ? 2.5 : 2}
                className={`transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}
            />
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-base leading-tight">{label}</span>
                {price > 0 && (
                    <span className={`text-[10px] font-medium ${isSelected ? "text-orange-500" : "text-slate-400"}`}>
                        +{price}₪
                    </span>
                )}
            </div>
        </button>
    );
};

// --- רכיב כפתור רגיל (Pill) ---
const ModifierPill = ({ label, isSelected, onClick, price }) => {
    const Icon = getIconForName(label);

    return (
        <button
            onClick={onClick}
            className={`
        w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl
        font-medium transition-all duration-200 touch-manipulation active:scale-95
        ${isSelected
                    ? "bg-slate-800 text-white shadow-lg shadow-slate-300"
                    : "bg-white text-slate-600 border border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50"
                }
      `}
        >
            <Icon size={18} strokeWidth={isSelected ? 2.5 : 2} />
            <span className="text-sm">{label}</span>
            {price > 0 && (
                <span className={`text-xs ${isSelected ? "text-white/80" : "text-slate-400"}`}>+{price}₪</span>
            )}
        </button>
    );
};

// --- הקומפוננטה הראשית ---
const ModifierModal = ({ isOpen, selectedItem, onClose, onAddItem }) => {
    const [optionGroups, setOptionGroups] = useState([]);
    const [optionSelections, setOptionSelections] = useState({});

    // 1. טעינת נתונים
    useEffect(() => {
        if (!isOpen || !selectedItem) return;

        const loadOptions = async () => {
            try {
                const options = await fetchManagerItemOptions(selectedItem.id);
                if (!options || options.length === 0) {
                    onAddItem?.({ ...selectedItem, selectedOptions: [], totalPrice: selectedItem.price, price: selectedItem.price });
                    onClose();
                    return;
                }

                setOptionGroups(options);

                const defaults = {};
                const existingSelections = selectedItem.selectedOptions || [];

                options.forEach(group => {
                    const existingChoice = existingSelections.find(opt => String(opt.groupId) === String(group.id));
                    if (existingChoice) {
                        defaults[group.id] = String(existingChoice.valueId);
                    } else {
                        const defaultVal = group.values?.find(v => v.is_default) ||
                            group.values?.find(v => v.name?.includes('רגיל')) ||
                            group.values?.[0];
                        if (defaultVal) defaults[group.id] = String(defaultVal.id);
                    }
                });
                setOptionSelections(defaults);

            } catch (err) {
                console.error(err);
                onClose();
            }
        };
        loadOptions();
    }, [isOpen, selectedItem?.id]);

    // 2. מיון לקבוצות לוגיות
    const { milkGroup, foamGroup, tempGroup, baseGroup, strengthGroup, specialOptions } = useMemo(() => {
        if (!optionGroups.length) return {};

        const milk = optionGroups.find(g => g.name.includes('חלב'));
        const foam = optionGroups.find(g => g.name.includes('קצף'));
        const temp = optionGroups.find(g => g.name.includes('טמפרטורה') || g.name.includes('חום'));
        const base = optionGroups.find(g => g.name.includes('בסיס'));
        const strength = optionGroups.find(g => g.name.includes('חוזק'));

        const specials = [];
        optionGroups.forEach(g => {
            g.values?.forEach(v => {
                if (v.name.includes('נטול') || v.name.includes('מפורק')) {
                    specials.push({ ...v, groupId: g.id });
                }
            });
        });

        return {
            milkGroup: milk,
            foamGroup: foam,
            tempGroup: temp,
            baseGroup: base,
            strengthGroup: strength,
            specialOptions: specials
        };
    }, [optionGroups]);

    // 3. חישוב מחיר
    const totalPrice = useMemo(() => {
        if (!selectedItem) return 0;
        let sum = Number(selectedItem.price || 0);
        optionGroups.forEach(group => {
            const selectedId = optionSelections[group.id];
            if (!selectedId) return;
            const value = group.values?.find(v => String(v.id) === String(selectedId));
            if (value) sum += Number(value.priceAdjustment || 0);
        });
        return sum;
    }, [selectedItem, optionGroups, optionSelections]);

    // 4. לוגיקת בחירה
    const toggleOption = (groupId, valueId) => {
        setOptionSelections(prev => {
            if (groupId === milkGroup?.id) {
                return { ...prev, [groupId]: valueId };
            }
            const current = prev[groupId];
            return { ...prev, [groupId]: current === valueId ? null : valueId };
        });
    };

    // 5. שמירה
    const handleAdd = () => {
        const selectedOptions = optionGroups.flatMap(group => {
            const selId = optionSelections[group.id];
            if (!selId) return [];
            const val = group.values.find(v => String(v.id) === String(selId));
            if (!val) return [];
            if (val.name?.includes('רגיל') && Number(val.priceAdjustment) === 0) return [];

            return [{
                groupId: group.id,
                groupName: group.name,
                valueId: val.id,
                valueName: val.name,
                priceAdjustment: Number(val.priceAdjustment)
            }];
        });

        onAddItem?.({
            ...selectedItem,
            tempId: `${selectedItem.id}-${Date.now()}`,
            quantity: 1,
            selectedOptions,
            totalPrice,
            price: totalPrice
        });
        onClose();
    };

    if (!isOpen || !selectedItem) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
            <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#FAFAFA] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">

                {/* Header */}
                <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex items-center sticky top-0 z-20 border-b border-slate-100/50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
                            <Coffee size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{selectedItem.name}</h2>
                            <p className="text-sm text-slate-400">התאמה אישית</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                    {/* Milk Selection - Hero */}
                    {milkGroup && (
                        <section>
                            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex gap-2">
                                    {milkGroup.values.map((val) => (
                                        <MilkCard
                                            key={val.id}
                                            label={val.name}
                                            price={val.priceAdjustment}
                                            isSelected={String(optionSelections[milkGroup.id]) === String(val.id)}
                                            onClick={() => toggleOption(milkGroup.id, String(val.id))}
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Modifiers Grid - 4 Columns */}
                    <section>
                        <div className="grid grid-cols-4 gap-2">

                            {/* Foam */}
                            {foamGroup && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-slate-400 text-center mb-1">{foamGroup.name}</p>
                                    {foamGroup.values.map((val) => (
                                        <ModifierPill
                                            key={val.id}
                                            label={val.name}
                                            isSelected={String(optionSelections[foamGroup.id]) === String(val.id)}
                                            onClick={() => toggleOption(foamGroup.id, String(val.id))}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Temp */}
                            {tempGroup && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-slate-400 text-center mb-1">{tempGroup.name}</p>
                                    {tempGroup.values.map((val) => (
                                        <ModifierPill
                                            key={val.id}
                                            label={val.name}
                                            isSelected={String(optionSelections[tempGroup.id]) === String(val.id)}
                                            onClick={() => toggleOption(tempGroup.id, String(val.id))}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Base */}
                            {baseGroup && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-slate-400 text-center mb-1">{baseGroup.name}</p>
                                    {baseGroup.values.map((val) => (
                                        <ModifierPill
                                            key={val.id}
                                            label={val.name}
                                            isSelected={String(optionSelections[baseGroup.id]) === String(val.id)}
                                            onClick={() => toggleOption(baseGroup.id, String(val.id))}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Strength */}
                            {strengthGroup && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-slate-400 text-center mb-1">{strengthGroup.name}</p>
                                    {strengthGroup.values.map((val) => (
                                        <ModifierPill
                                            key={val.id}
                                            label={val.name}
                                            isSelected={String(optionSelections[strengthGroup.id]) === String(val.id)}
                                            onClick={() => toggleOption(strengthGroup.id, String(val.id))}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Special Options */}
                    {specialOptions.length > 0 && (
                        <section>
                            <div className="flex gap-3">
                                {specialOptions.map((val) => (
                                    <div key={val.id} className="flex-1">
                                        <ModifierPill
                                            label={val.name}
                                            isSelected={String(optionSelections[val.groupId]) === String(val.id)}
                                            onClick={() => toggleOption(val.groupId, String(val.id))}
                                            price={val.priceAdjustment}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
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
                            onClick={handleAdd}
                            className="flex-1 bg-slate-900 hover:bg-black text-white h-12 rounded-2xl flex items-center justify-between px-6 text-base font-bold shadow-xl shadow-slate-300/50 transition-colors active:scale-98"
                        >
                            <span>הוסף להזמנה</span>
                            <div className="flex items-center gap-2 bg-white/15 px-3 py-1 rounded-xl">
                                <span>₪{totalPrice}</span>
                                <Check size={16} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModifierModal;
