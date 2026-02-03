import React, { useState, useEffect } from 'react';
import { Package, Search, PlusCircle, RefreshCw, X } from 'lucide-react';
import { OnboardingItem } from '../../../../types/onboardingTypes';
import { supabase } from '../../../../../../lib/supabase';
import { useOnboardingStore } from '../../../../store/useOnboardingStore';

interface InventoryItem {
    id: number | string;
    name: string;
    unit: string;
    cost_per_unit?: number;
}

interface TabRecipeProps {
    localItem: OnboardingItem;
    setLocalItem: React.Dispatch<React.SetStateAction<OnboardingItem>>;
    onSave: () => void;
}

const TabRecipe = ({ localItem, setLocalItem, onSave }: TabRecipeProps) => {
    const businessId = useOnboardingStore(state => state.businessId);

    // Inventory State
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoadingInventory, setIsLoadingInventory] = useState(false);
    const [isAddingIngredient, setIsAddingIngredient] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchInventory = async () => {
            setIsLoadingInventory(true);
            try {
                let query = supabase
                    .from('inventory_items')
                    .select('id, name, unit, cost_per_unit')
                    .order('name');

                if (businessId) {
                    query = query.eq('business_id', businessId);
                }

                const { data } = await query;
                if (data) setInventoryItems(data);
            } catch (err) {
                console.error('Failed to fetch inventory:', err);
            } finally {
                setIsLoadingInventory(false);
            }
        };
        fetchInventory();
    }, [businessId]);

    const filteredInventory = inventoryItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleAddIngredient = (invItem: InventoryItem) => {
        const newRecipe = [...(localItem.recipe || [])];
        newRecipe.push({
            ingredient: invItem.name,
            quantity: '1',
            unit: invItem.unit,
            cost: invItem.cost_per_unit || 0
        });
        setLocalItem({ ...localItem, recipe: newRecipe });
        setIsAddingIngredient(false);
        setSearchQuery('');
    };

    return (
        <div className="space-y-4 h-full flex flex-col" dir="rtl">
            {/* 1. Food Cost & Profitability (Compact) */}
            <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 flex-none">
                <div className="flex items-center gap-4 bg-white rounded-xl border border-emerald-100 p-3 shadow-sm">
                    <div className="flex-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-0.5">עלות מנה (Food Cost)</p>
                        <div className="flex items-center gap-1" dir="ltr">
                            <span className="text-emerald-400 font-bold text-sm">₪</span>
                            <input
                                type="number"
                                value={localItem.cost || 0}
                                onChange={e => setLocalItem({ ...localItem, cost: parseFloat(e.target.value) || 0 })}
                                className="w-20 bg-transparent font-black text-lg text-emerald-700 outline-none"
                            />
                        </div>
                    </div>
                    <div className="h-8 w-px bg-emerald-100" />
                    <div className="flex-1 text-right">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-0.5">רווח גולמי</p>
                        <p className="font-black text-lg text-emerald-700">₪{Math.max(0, (localItem.price || 0) - (localItem.cost || 0)).toFixed(1)}</p>
                    </div>
                </div>
            </div>

            {/* 2. Recipe & Ingredients (Scrollable) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
                {/* Header */}
                <div className="p-3 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between flex-none">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Package size={12} /> מתכון ורכיבים
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">סה"כ רכיבים:</span>
                        <span className="text-sm font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm">
                            ₪{(localItem.recipe || []).reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0).toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative">
                    {(localItem.recipe || []).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm transition-all" dir="ltr">
                            <button
                                onClick={() => {
                                    const updated = (localItem.recipe || []).filter((_, i) => i !== idx);
                                    setLocalItem(prev => {
                                        const newCost = updated.reduce((sum, start) => sum + (start.cost || 0) * (parseFloat(start.quantity) || 0), 0);
                                        return { ...prev, recipe: updated, cost: newCost };
                                    });
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors flex-none"
                            >
                                <X size={12} />
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-700 leading-tight truncate">{step.ingredient}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <span className="bg-slate-50 px-1.5 py-px rounded">₪{step.cost?.toFixed(2)} / {step.unit || 'unit'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 flex-none" dir="ltr">
                                <button
                                    onClick={() => {
                                        const current = parseFloat(step.quantity) || 0;
                                        const u = (step.unit || '').toLowerCase();
                                        const isLargeUnit = ['kg', 'l', 'liter', 'ק"ג', 'ליטר', 'kg.'].some(x => u.includes(x));
                                        const stepSize = isLargeUnit ? 0.01 : 10;
                                        const newVal = Math.max(0, current - stepSize);
                                        const updated = [...(localItem.recipe || [])];
                                        updated[idx].quantity = isLargeUnit ? newVal.toFixed(3) : String(Math.round(newVal));
                                        const newTotalCost = updated.reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0);
                                        setLocalItem({ ...localItem, recipe: updated, cost: newTotalCost });
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
                                >
                                    -
                                </button>
                                <div className="w-14 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                    <input
                                        type="number"
                                        value={step.quantity}
                                        onChange={e => {
                                            const updated = [...(localItem.recipe || [])];
                                            updated[idx].quantity = e.target.value;
                                            const newTotalCost = updated.reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0);
                                            setLocalItem({ ...localItem, recipe: updated, cost: newTotalCost });
                                        }}
                                        className="w-full text-center text-xs font-black text-indigo-700 outline-none bg-transparent px-1"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const current = parseFloat(step.quantity) || 0;
                                        const u = (step.unit || '').toLowerCase();
                                        const isLargeUnit = ['kg', 'l', 'liter', 'ק"ג', 'ליטר', 'kg.'].some(x => u.includes(x));
                                        const stepSize = isLargeUnit ? 0.01 : 10;
                                        const newVal = current + stepSize;
                                        const updated = [...(localItem.recipe || [])];
                                        updated[idx].quantity = isLargeUnit ? newVal.toFixed(3) : String(Math.round(newVal));
                                        const newTotalCost = updated.reduce((sum, item) => sum + (item.cost || 0) * (parseFloat(item.quantity) || 0), 0);
                                        setLocalItem({ ...localItem, recipe: updated, cost: newTotalCost });
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}

                    {(!localItem.recipe || localItem.recipe.length === 0) && !isAddingIngredient && (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-300 border-2 border-dashed border-slate-50 rounded-xl m-2">
                            <Package size={32} className="mb-2 opacity-20" />
                            <p className="text-[10px]">הרשימה ריקה</p>
                        </div>
                    )}
                </div>

                {/* Footer / Search */}
                <div className="p-3 bg-white border-t border-slate-100 flex-none relative">
                    {isAddingIngredient ? (
                        <div className="animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <div className="relative flex items-center mb-2">
                                <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
                                <input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="חפש מוצר ממלאי..."
                                    className="w-full h-10 pr-10 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                />
                                <button onClick={() => setIsAddingIngredient(false)} className="absolute left-3 p-1 rounded-full text-slate-400">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="absolute inset-x-3 bottom-full mb-2 max-h-48 overflow-y-auto custom-scrollbar rounded-xl border border-slate-100 shadow-lg bg-white z-50">
                                {isLoadingInventory ? (
                                    <div className="p-4 text-center text-xs text-slate-400">טוען...</div>
                                ) : filteredInventory.length > 0 ? (
                                    filteredInventory.slice(0, 20).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleAddIngredient(item)}
                                            className="w-full flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-indigo-50 text-right group"
                                        >
                                            <span className="text-xs font-bold text-slate-700">{item.name}</span>
                                            <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center">
                                                <PlusCircle size={12} />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400">לא נמצא</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingIngredient(true)}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                        >
                            <PlusCircle size={16} /> הוסף מרכיב
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TabRecipe;
