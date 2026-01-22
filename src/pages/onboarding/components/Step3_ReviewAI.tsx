import { useMemo, useState, useEffect } from 'react';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useTheme } from '../../../context/ThemeContext';
import { AlertCircle, Wand2, AlertTriangle, Play, X, Check, Coffee, Tag, LayoutGrid, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { findDuplicateErrors, analyzeVisualSeed, generateImagePrompt } from '../logic/onboardingLogic';
import { OnboardingItem, ModifierLogic, ModifierRequirement, AtmosphereSeed } from '../types/onboardingTypes';
import { supabase } from '../../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// 🆕 Humorous Loader for AI Generation
const HumorousLoader = () => {
    const LOADER_MESSAGES = [
        "מפטרים את מעצב המזון...",
        "רגע, הצלם שכח את העדשה באוטו...",
        "מחליפים סוללות למצלמה...",
        "מייצרים תאורה של מיליון דולר...",
        "מי צריך צלם אנושי בכלל?",
        "ה-AI מתווכח עם הסו-שף...",
        "מנקים פירורים וירטואליים...",
        "מבריקים את הסכו״ם בפיקסלים...",
        "מחכים שהאדים יעלו...",
        "מוסיפים פילטר 'טעים' למקסימום...",
        "הבינה המלאכותית נהייתה רעבה...",
        "שוטפים כלים (בכאילו)...",
        "מסדרים את הצלחת מחדש...",
        "בודקים שהקפה לא התקרר...",
        "מרנדרים קלוריות וירטואליות...",
        "זה לוקח רגע כי זה יוצא מושלם...",
        "חוסכים לך יום צילום שלם...",
        "מכוונים את הפוקוס...",
        "הצלם הדיגיטלי בהפסקת קפה...",
        "עוד שנייה זה מוכן..."
    ];

    const [msgIndex, setMsgIndex] = useState(0);

    // Cycle messages every 3.5s (Slower)
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex(prev => (prev + 1) % LOADER_MESSAGES.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white z-30 p-4 text-center animate-in fade-in duration-700">
            <div className="relative mb-4">
                <div className="w-12 h-12 border-4 border-white/20 border-t-indigo-400 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                </div>
            </div>

            <div className="h-8 flex items-center justify-center overflow-hidden w-full relative">
                <span
                    key={msgIndex}
                    className="text-xs font-black text-indigo-100 uppercase tracking-widest px-4 leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-700 absolute"
                >
                    {LOADER_MESSAGES[msgIndex]}
                </span>
            </div>
        </div>
    );
};

// 🆕 Enhanced Prompt Editor Modal
const PromptEditorModal = ({ item, onClose, onSave, isDarkMode, atmosphereSeeds }: { item: OnboardingItem, onClose: () => void, onSave: (updates: Partial<OnboardingItem>, autoGenerate?: boolean) => void, isDarkMode: boolean, atmosphereSeeds: AtmosphereSeed[] }) => {
    const [prompt, setPrompt] = useState(item.prompt || '');
    const [visualDesc, setVisualDesc] = useState(item.visualDescription || '');
    const [activeIngredients, setActiveIngredients] = useState<string[]>(item.ingredients || []);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [newTag, setNewTag] = useState('');

    // Parse tags from comma-separated string
    const tags = useMemo(() => {
        return prompt.split(',').map(t => t.trim()).filter(t => t !== '');
    }, [prompt]);

    const removeTag = (tagToRemove: string) => {
        const newPrompt = tags.filter(t => t !== tagToRemove).join(', ');
        setPrompt(newPrompt);
    };

    const addTag = () => {
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            const newPrompt = prompt ? `${prompt}, ${trimmed}` : trimmed;
            setPrompt(newPrompt);
            setNewTag('');
        }
    };

    const toggleIngredient = (ing: string) => {
        const newActive = activeIngredients.includes(ing)
            ? activeIngredients.filter(i => i !== ing)
            : [...activeIngredients, ing];

        setActiveIngredients(newActive);

        // Update tags
        const baseTags = tags.filter(t => !item.ingredients.includes(t));
        const newPrompt = [...baseTags, ...newActive].join(', ');
        setPrompt(newPrompt);
    };

    const handleSuggest = async () => {
        setIsSuggesting(true);
        try {
            const result = await generateImagePrompt(item, atmosphereSeeds, useOnboardingStore.getState().geminiApiKey || undefined);
            setPrompt(result.prompt);
        } catch (e) {
            console.error('Failed to suggest prompt:', e);
        } finally {
            setIsSuggesting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className={`w-full max-w-2xl rounded-[40px] overflow-hidden border shadow-2xl flex flex-col animate-in zoom-in-95 duration-300
                ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>

                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 shadow-xl shadow-indigo-500/20 flex items-center justify-center text-white">
                            <Wand2 size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl tracking-tight">AI Creative Suite</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{item.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh]">
                    {/* Visual Anchor Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <LayoutGrid size={14} className="text-indigo-400" />
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Visual Hook (Hebrew)</span>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase">Customer Facing</span>
                        </div>
                        <input
                            dir="rtl"
                            value={visualDesc}
                            onChange={(e) => setVisualDesc(e.target.value)}
                            className={`w-full p-6 rounded-[24px] font-black text-xl border focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all
                                ${isDarkMode ? 'bg-black/40 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                            placeholder="מה הלקוח רואה? (למשל: לאטה ארט בצורת לב...)"
                        />
                    </div>

                    {/* AI Tag Cloud Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Tag size={14} className="text-indigo-400" />
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">AI Instructions (Tags)</span>
                            </div>
                            <button
                                onClick={handleSuggest}
                                disabled={isSuggesting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-[10px] font-black hover:bg-indigo-400 transition-all disabled:opacity-50 hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20"
                            >
                                <Wand2 size={12} className={isSuggesting ? 'animate-spin' : ''} />
                                {isSuggesting ? 'THINKING...' : 'ENRICH PROMPT'}
                            </button>
                        </div>

                        {/* Tag Chips Grid */}
                        <div className={`p-6 rounded-[32px] border min-h-[140px] flex flex-wrap gap-2 content-start
                            ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                            {tags.length > 0 ? (
                                tags.map((t, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-[14px] border border-indigo-500/20 group animate-in zoom-in-90 duration-200">
                                        <span className="text-xs font-bold font-mono lowercase tracking-tight">{t}</span>
                                        <button onClick={() => removeTag(t)} className="hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"><X size={12} /></button>
                                    </div>
                                ))
                            ) : (
                                <div className="w-full flex flex-col items-center justify-center py-8 opacity-20 text-slate-500">
                                    <Tag size={32} strokeWidth={1} />
                                    <span className="text-xs font-black uppercase mt-2">No tags defined</span>
                                </div>
                            )}

                            {/* Add Tag Row */}
                            <div className="w-full flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                                <div className="flex-1 relative">
                                    <input
                                        value={newTag}
                                        onChange={e => setNewTag(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addTag()}
                                        placeholder="Add individual tag (e.g. moody lighting, 8k...)"
                                        className={`w-full bg-transparent border-b border-indigo-500/30 text-xs py-2 outline-none focus:border-indigo-400 transition-all ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                                    />
                                </div>
                                <button onClick={addTag} className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Ingredients Section */}
                    {item.ingredients.length > 0 && (
                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Core Elements (Ingredients)</span>
                            <div className="flex flex-wrap gap-2">
                                {item.ingredients.map(ing => (
                                    <button
                                        key={ing}
                                        onClick={() => toggleIngredient(ing)}
                                        className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all flex items-center gap-2 border-2
                                            ${activeIngredients.includes(ing)
                                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10 scale-105'
                                                : 'bg-slate-800/40 border-transparent text-slate-500 hover:border-slate-700'}`}
                                    >
                                        {activeIngredients.includes(ing) ? <Check size={12} /> : <Plus size={12} />}
                                        {ing}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Advanced Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2
                            ${showAdvanced ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        {showAdvanced ? 'Hide Raw Control' : 'Advanced (Raw Prompt Control)'}
                        <ChevronRight size={10} className={`transition-transform duration-300 ${showAdvanced ? 'rotate-90' : ''}`} />
                    </button>

                    {showAdvanced && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className={`w-full h-32 p-6 rounded-[28px] font-mono text-[11px] leading-relaxed border focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all
                                    ${isDarkMode ? 'bg-black/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                            />
                        </div>
                    )}
                </div>

                {/* Modal Footer Controls */}
                <div className="p-10 bg-black/30 backdrop-blur-md flex gap-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-5 font-black text-xs uppercase tracking-widest rounded-[20px] bg-slate-800 hover:bg-slate-700 text-white transition-all"
                    >
                        Discard
                    </button>
                    <button
                        onClick={() => { onSave({ prompt, visualDescription: visualDesc }); onClose(); }}
                        className="flex-1 py-5 font-black text-xs uppercase tracking-widest rounded-[20px] bg-white text-black hover:bg-slate-200 transition-all flex flex-col items-center justify-center leading-none"
                    >
                        <span>Update Suite</span>
                        <span className="text-[8px] opacity-50 mt-1">Manual Save Only</span>
                    </button>
                    <button
                        onClick={() => { onSave({ prompt, visualDescription: visualDesc }, true); onClose(); }}
                        className="flex-[1.5] py-5 font-black text-xs uppercase tracking-widest rounded-[20px] bg-indigo-500 hover:bg-indigo-400 text-white shadow-2xl shadow-indigo-500/40 transition-all flex flex-col items-center justify-center leading-none"
                    >
                        <span>Update & Generate</span>
                        <span className="text-[8px] opacity-70 mt-1">AI Action Pipeline</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// 🆕 Price Edit Modal
const PriceEditModal = ({ item, onClose, onSave, isDarkMode }: { item: OnboardingItem, onClose: () => void, onSave: (price: number, salePrice?: number) => void, isDarkMode: boolean }) => {
    const [price, setPrice] = useState(item.price);
    const [salePrice, setSalePrice] = useState(item.salePrice || 0);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className={`w-full max-w-sm rounded-[32px] overflow-hidden border shadow-2xl flex flex-col animate-in zoom-in-95 duration-300
                ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
                    <h3 className="font-black text-lg">Edit Price</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Regular Price (₪)</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="w-full bg-black/40 border border-slate-800 rounded-2xl p-4 text-xl font-black text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Sale Price (₪) - 0 to disable</label>
                        <input
                            type="number"
                            value={salePrice}
                            onChange={(e) => setSalePrice(Number(e.target.value))}
                            className="w-full bg-black/40 border border-slate-800 rounded-2xl p-4 text-xl font-black text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                    </div>
                </div>
                <div className="p-6 bg-black/20">
                    <button
                        onClick={() => { onSave(price, salePrice > 0 ? salePrice : undefined); onClose(); }}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20"
                    >
                        Save Price
                    </button>
                </div>
            </div>
        </div>
    );
};

// 🆕 Item Details Modal (Name, Desc, Ingredients, Production)
const ItemDetailsModal = ({ item, onClose, onSave, isDarkMode }: { item: OnboardingItem, onClose: () => void, onSave: (updates: Partial<OnboardingItem>) => void, isDarkMode: boolean }) => {
    const [name, setName] = useState(item.name);
    const [desc, setDesc] = useState(item.description);
    const [ingredients, setIngredients] = useState<string[]>(item.ingredients || []);
    const [newIng, setNewIng] = useState('');
    const [prodArea, setProdArea] = useState(item.productionArea);

    const areas = ['Kitchen', 'Bar', 'Oven', 'Bakery', 'Grill'];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className={`w-full max-w-2xl rounded-[40px] overflow-hidden border shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300
                ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

                <div className="p-8 border-b border-slate-800/50 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-2xl">Edit Item Details</h3>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Full Menu Integration</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="p-10 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Item Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded-2xl p-4 text-white font-bold" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Description</label>
                            <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded-2xl p-4 text-white min-h-[80px]" />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-3 block">Production Area</label>
                            <div className="flex flex-wrap gap-2">
                                {areas.map(a => (
                                    <button
                                        key={a}
                                        onClick={() => setProdArea(a)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all border
                                            ${prodArea === a ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-black/20 border-slate-800 text-slate-500'}`}
                                    >
                                        {a}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-3 block">Add Ingredients</label>
                            <div className="flex gap-2">
                                <input
                                    value={newIng}
                                    onChange={e => setNewIng(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { setIngredients([...ingredients, newIng]); setNewIng(''); } }}
                                    className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-4 text-xs text-white"
                                    placeholder="e.g. Milk, Onions..."
                                />
                                <button onClick={() => { setIngredients([...ingredients, newIng]); setNewIng(''); }} className="p-3 bg-indigo-500 text-white rounded-xl"><Plus size={18} /></button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {ingredients.map((ing, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/50">
                                        <span className="text-[10px] font-bold text-slate-300">{ing}</span>
                                        <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-black/20">
                    <button
                        onClick={() => { onSave({ name, description: desc, ingredients, productionArea: prodArea }); onClose(); }}
                        className="w-full py-5 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-[20px] shadow-2xl shadow-indigo-500/20 text-lg"
                    >
                        Confirm All Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// 🆕 POS Preview Modal Component
const POSPreviewModal = ({ item, onClose, isDarkMode, atmosphereSeeds }: { item: OnboardingItem, onClose: () => void, isDarkMode: boolean, atmosphereSeeds: AtmosphereSeed[] }) => {
    const [debugPrompt, setDebugPrompt] = useState<{ prompt: string, neg: string } | null>(null);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [selections, setSelections] = useState<{ [groupName: string]: string[] }>(() => {
        // Init with defaults
        const initial: { [key: string]: string[] } = {};
        item.modifiers?.forEach(group => {
            initial[group.name] = group.items.filter(i => i.isDefault).map(i => i.name);
        });
        return initial;
    });

    const isGroupValid = (groupName: string) => {
        const group = item.modifiers?.find(g => g.name === groupName);
        if (!group) return true;
        const count = selections[groupName]?.length || 0;
        if (group.requirement === ModifierRequirement.MANDATORY && count === 0) return false;
        return count <= group.maxSelection;
    };

    const handleToggle = (groupName: string, itemName: string, isRadio: boolean) => {
        setSelections(prev => {
            const current = prev[groupName] || [];
            if (isRadio) {
                return { ...prev, [groupName]: [itemName] };
            }
            if (current.includes(itemName)) {
                return { ...prev, [groupName]: current.filter(i => i !== itemName) };
            }
            const group = item.modifiers?.find(g => g.name === groupName);
            if (group && current.length >= group.maxSelection) return prev; // Limit reached
            return { ...prev, [groupName]: [...current, itemName] };
        });
    };

    const totalPrice = useMemo(() => {
        let total = item.price;
        item.modifiers?.forEach(group => {
            const selectedItems = group.items.filter(i => (selections[group.name] || []).includes(i.name));
            selectedItems.forEach(i => total += i.price);
        });
        return total;
    }, [item, selections]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200
                ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`}>

                {/* Modal Header */}
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-[10px] font-black uppercase text-white tracking-widest">POS Preview</span>
                            <h3 className="text-2xl font-black">{item.name}</h3>
                        </div>
                        <p className="text-slate-400 text-sm line-clamp-1">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                setIsLoadingPrompt(true);
                                try {
                                    const res = await generateImagePrompt(item, atmosphereSeeds);
                                    setDebugPrompt({ prompt: res.prompt, neg: res.negativePrompt });
                                } catch (err) {
                                    console.error('Debug prompt failed:', err);
                                } finally {
                                    setIsLoadingPrompt(false);
                                }
                            }}
                            className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-full transition-colors flex items-center gap-1 text-[10px] font-black"
                            title="Show AI Prompt"
                        >
                            <Wand2 size={16} className={isLoadingPrompt ? 'animate-spin' : ''} />
                            DEBUG
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* 🆕 Debug Prompt Overlay */}
                {debugPrompt && (
                    <div className="p-6 bg-indigo-500/10 border-b border-indigo-500/20 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-[10px] font-black uppercase text-indigo-400">Generated Prompt (Gemini 3 Flash)</h4>
                            <button onClick={() => setDebugPrompt(null)} className="text-white hover:text-indigo-300"><X size={14} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Prompt</p>
                                <p className="text-xs font-mono text-slate-300 bg-black/40 p-3 rounded-xl break-words leading-relaxed">{debugPrompt.prompt}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Negative</p>
                                <p className="text-xs font-mono text-red-400/80 bg-black/40 p-3 rounded-xl break-words leading-relaxed">{debugPrompt.neg}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Content - Scrollable Modifiers */}
                <div className="p-6 overflow-y-auto space-y-8 flex-1">
                    {item.modifiers?.map((group) => {
                        const isRadio = group.requirement === ModifierRequirement.MANDATORY && group.maxSelection === 1;
                        const isValid = isGroupValid(group.name);

                        return (
                            <div key={group.name} className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-lg">{group.name}</h4>
                                        {group.requirement === ModifierRequirement.MANDATORY && (
                                            <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">Required</span>
                                        )}
                                        {group.logic === ModifierLogic.REPLACE && (
                                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">Replacement</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        Select {group.maxSelection === 1 ? '1' : `up to ${group.maxSelection}`}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    {group.items.map((opt) => {
                                        const isSelected = (selections[group.name] || []).includes(opt.name);
                                        return (
                                            <button
                                                key={opt.name}
                                                onClick={() => handleToggle(group.name, opt.name, isRadio)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98]
                                                    ${isSelected
                                                        ? 'border-indigo-500 bg-indigo-500/10'
                                                        : isDarkMode ? 'border-slate-800 bg-slate-800/20 hover:border-slate-700' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                                                        ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700'}
                                                    `}>
                                                        {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="font-bold">{opt.name}</span>
                                                    {opt.isDefault && <span className="text-[10px] text-slate-500 italic">(Default)</span>}
                                                </div>
                                                {opt.price !== 0 && (
                                                    <span className={`text-sm font-mono ${opt.price > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {opt.price > 0 ? `+${opt.price}` : opt.price}₪
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!isValid && (
                                    <p className="text-xs text-red-500 flex items-center gap-1 font-bold animate-pulse">
                                        <AlertCircle size={12} /> Please make a selection for this group.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Modal Footer - Total & Add to cart */}
                <div className={`p-6 border-t flex items-center justify-between
                    ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Price</p>
                        <p className="text-3xl font-black text-emerald-400">₪{totalPrice}</p>
                    </div>
                    <button className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2">
                        Add to Order <Coffee size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// 🆕 Atmosphere Selection Modal Component (Refactored for single-mode)
const AtmosphereSelectionModal = ({
    item,
    atmosphereSeeds,
    onClose,
    onUpdate,
    onApplyToCategory,
    onUploadNew,
    isDarkMode,
    mode // 'background' | 'container'
}: {
    item: OnboardingItem;
    atmosphereSeeds: AtmosphereSeed[];
    onClose: () => void;
    onUpdate: (id: string) => void;
    onApplyToCategory: () => void;
    onUploadNew: (file: File, type: 'background' | 'container', promptHint: string) => Promise<void>;
    isDarkMode: boolean;
    mode: 'background' | 'container';
}) => {
    const [selectedId, setSelectedId] = useState(mode === 'background' ? item.selectedBackgroundId : item.selectedContainerId || '');
    const [showUpload, setShowUpload] = useState(false);
    const [uploadPrompt, setUploadPrompt] = useState('');

    const filteredSeeds = atmosphereSeeds.filter(s => s.type === mode);

    const handleSave = () => {
        onUpdate(selectedId || '');
        onClose();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadPrompt.trim()) {
            await onUploadNew(file, mode, uploadPrompt);
            setShowUpload(false);
            setUploadPrompt('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-6 border-b ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold">
                                {mode === 'background' ? '🖼️ Choose Background' : '🍽️ Choose Serving Dish'}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">For: <span className="font-semibold text-indigo-400">{item.name}</span></p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Items Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Available Seeds ({filteredSeeds.length})</h4>
                            <button
                                onClick={() => setShowUpload(!showUpload)}
                                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                {showUpload ? 'Cancel' : '+ Add New Seed'}
                            </button>
                        </div>

                        {showUpload && (
                            <div className={`mb-6 p-4 rounded-2xl border-2 border-dashed ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <input
                                    type="text"
                                    placeholder={mode === 'background' ? "Describe background (e.g., 'Modern bar counter')" : "Describe dish (e.g., 'Wooden board')"}
                                    value={uploadPrompt}
                                    onChange={(e) => setUploadPrompt(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border mb-3 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                                />
                                <div className="flex items-center gap-3">
                                    <input type="file" accept="image/*" onChange={handleUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-indigo-500 file:text-white hover:file:bg-indigo-600" />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                            <button
                                onClick={() => setSelectedId('')}
                                className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${selectedId === ''
                                    ? 'border-indigo-500 bg-indigo-500/10'
                                    : (isDarkMode ? 'border-slate-800 hover:border-slate-700' : 'border-slate-100 hover:border-slate-200')
                                    }`}
                            >
                                <Check size={16} className={selectedId === '' ? 'text-indigo-500' : 'text-slate-500'} />
                                <span className="text-[10px] font-black uppercase">Auto</span>
                            </button>
                            {filteredSeeds.map(seed => (
                                <div key={seed.id} className="relative group/wrapper">
                                    <button
                                        onClick={() => setSelectedId(seed.id)}
                                        className={`w-full aspect-square rounded-2xl border-2 overflow-hidden transition-all group ${selectedId === seed.id
                                            ? 'border-indigo-500 ring-4 ring-indigo-500/20'
                                            : (isDarkMode ? 'border-slate-800 hover:border-slate-700' : 'border-slate-100 hover:border-slate-200')
                                            }`}
                                    >
                                        <img src={seed.blob as string} alt={seed.promptHint} className="w-full h-full object-cover" />
                                        <div className={`absolute inset-0 flex items-center justify-center bg-indigo-500/40 opacity-0 transition-opacity ${selectedId === seed.id ? 'opacity-100' : 'group-hover:opacity-100'}`}>
                                            <Check size={24} className="text-white" strokeWidth={4} />
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-[8px] text-white truncate text-center font-bold uppercase">
                                            {seed.promptHint}
                                        </div>
                                    </button>

                                    {/* 🆕 Delete Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this seed permanently?')) {
                                                useOnboardingStore.getState().removeAtmosphereSeed(seed.id);
                                            }
                                        }}
                                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/wrapper:opacity-100 transition-opacity hover:bg-red-600 active:scale-90 z-10"
                                    >
                                        <X size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-6 border-t flex gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <button
                        onClick={onApplyToCategory}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2 text-sm"
                    >
                        Apply To All
                    </button>
                    <div className="flex-1"></div>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 font-bold rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'
                            }`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        Save Selection
                    </button>
                </div>
            </div>
        </div>
    );
};

const Step3_ReviewAI = () => {
    const { items, atmosphereSeeds, businessId, setStep, startLiveGeneration, regenerateSingleItem, uploadOriginalImage, updateItem, applyAtmosphereToCategory, geminiApiKey, setGeminiApiKey } = useOnboardingStore();
    const { isDarkMode } = useTheme();
    const [previewItem, setPreviewItem] = useState<OnboardingItem | null>(null);
    const [promptEditItem, setPromptEditItem] = useState<OnboardingItem | null>(null);
    const [priceEditItem, setPriceEditItem] = useState<OnboardingItem | null>(null);
    const [detailsEditItem, setDetailsEditItem] = useState<OnboardingItem | null>(null);
    const [atmosphereEditItem, setAtmosphereEditItem] = useState<OnboardingItem | null>(null);
    const [atmosphereEditMode, setAtmosphereEditMode] = useState<'background' | 'container' | null>(null);
    const [showApiSettings, setShowApiSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState(geminiApiKey || '');

    // Memoize stats
    const stats = useMemo(() => {
        const errors = items.filter(i => i.validationErrors && i.validationErrors.length > 0).length;
        const pending = items.filter(i => i.status === 'pending').length;
        const total = items.length;
        return { errors, pending, total };
    }, [items]);

    // Check for duplicates
    const duplicateErrors = useMemo(() => findDuplicateErrors(items), [items]);

    const handleGenerate = () => {
        startLiveGeneration();
        setStep(4);
    };

    const handleCardClick = (item: OnboardingItem) => {
        setPreviewItem(item);
    };

    return (
        <div className="flex flex-col h-full gap-4 pb-24">
            {/* 🛑 Missing API Key Warning */}
            {!geminiApiKey && (
                <div className="mx-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-4 animate-pulse">
                    <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-amber-200 leading-tight">מצב פעולה: מקומי (מכביד על המעבד)</p>
                        <p className="text-[10px] text-amber-400/70 mt-1">
                            לא נמצא מפתח Gemini. הגדר מפתח API כדי לעבור לג׳נרציה מהירה בענן ולחסוך בחום של המקבוק.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowApiSettings(true)}
                        className="px-4 py-2 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-400"
                    >
                        הגדר כעת
                    </button>
                </div>
            )}

            {/* Header with Settings Toggle */}
            <div className="flex items-center justify-between px-2 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">AI Creative Studio</h2>
                        <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest leading-none">Management & Generation Pipeline</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowApiSettings(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all
                        ${geminiApiKey ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${geminiApiKey ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{geminiApiKey ? 'Gemini Active' : 'Configure Gemini'}</span>
                </button>
            </div>

            {/* API Settings Modal */}
            {showApiSettings && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-white">Gemini API Configuration</h3>
                                <p className="text-xs text-slate-500 mt-1">Direct high-quality image generation (3¢ / img)</p>
                            </div>
                            <button onClick={() => setShowApiSettings(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                                <p className="text-[11px] text-indigo-300 leading-relaxed">
                                    <strong>PRO TIP:</strong> Using your own Gemini API key allows for significantly faster, more accurate, and cheaper generation compared to shared local models.
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest text-right">מפתח API של גוגל ג׳מיני</label>
                                <input
                                    type="password"
                                    value={tempApiKey}
                                    onChange={e => setTempApiKey(e.target.value)}
                                    placeholder="Paste your API key here..."
                                    className="w-full bg-black/40 border border-slate-700 rounded-2xl p-4 text-indigo-400 font-mono text-sm focus:border-indigo-500 outline-none transition-all"
                                />
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[9px] text-indigo-400 hover:underline mt-2 block text-left">Get a free key at AI Studio →</a>
                            </div>
                        </div>
                        <div className="p-8 bg-black/20 flex gap-3">
                            <button onClick={() => setShowApiSettings(false)} className="flex-1 py-4 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white transition-all">Cancel</button>
                            <button
                                onClick={() => {
                                    setGeminiApiKey(tempApiKey);
                                    setShowApiSettings(false);
                                }}
                                className="flex-[2] py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 text-[10px] uppercase tracking-widest"
                            >
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 🆕 POS Preview Modal */}
            {previewItem && (
                <POSPreviewModal
                    item={previewItem}
                    onClose={() => setPreviewItem(null)}
                    isDarkMode={isDarkMode}
                    atmosphereSeeds={atmosphereSeeds}
                />
            )}

            {/* 🆕 AI Prompt Editor Modal */}
            {promptEditItem && (
                <PromptEditorModal
                    item={promptEditItem}
                    isDarkMode={isDarkMode}
                    atmosphereSeeds={atmosphereSeeds}
                    onClose={() => setPromptEditItem(null)}
                    onSave={(updates, autoGenerate) => {
                        updateItem(promptEditItem.id, updates);
                        if (autoGenerate) {
                            regenerateSingleItem(promptEditItem.id);
                        }
                    }}
                />
            )}

            {/* 🆕 Price Editor Modal */}
            {priceEditItem && (
                <PriceEditModal
                    item={priceEditItem}
                    isDarkMode={isDarkMode}
                    onClose={() => setPriceEditItem(null)}
                    onSave={(price, salePrice) => updateItem(priceEditItem.id, { price, salePrice })}
                />
            )}

            {/* 🆕 Details Editor Modal */}
            {detailsEditItem && (
                <ItemDetailsModal
                    item={detailsEditItem}
                    isDarkMode={isDarkMode}
                    onClose={() => setDetailsEditItem(null)}
                    onSave={(updates) => updateItem(detailsEditItem.id, updates)}
                />
            )}

            {/* 🆕 Refactored Atmosphere Selection Modal (Specific to mode) */}
            {atmosphereEditItem && atmosphereEditMode && (
                <AtmosphereSelectionModal
                    item={atmosphereEditItem}
                    mode={atmosphereEditMode}
                    atmosphereSeeds={atmosphereSeeds}
                    isDarkMode={isDarkMode}
                    onClose={() => {
                        setAtmosphereEditItem(null);
                        setAtmosphereEditMode(null);
                    }}
                    onUpdate={(id) => {
                        if (atmosphereEditMode === 'background') {
                            updateItem(atmosphereEditItem.id, { selectedBackgroundId: id });
                        } else {
                            updateItem(atmosphereEditItem.id, { selectedContainerId: id });
                        }
                    }}
                    onApplyToCategory={() => {
                        applyAtmosphereToCategory(
                            atmosphereEditItem.category,
                            atmosphereEditMode === 'background' ? atmosphereEditItem.selectedBackgroundId : undefined,
                            atmosphereEditMode === 'container' ? atmosphereEditItem.selectedContainerId : undefined
                        );
                        setAtmosphereEditItem(null);
                        setAtmosphereEditMode(null);
                    }}
                    onUploadNew={async (file, type, _promptHint) => {
                        try {
                            const tempId = uuidv4();
                            const fileExt = file.name.split('.').pop();
                            const fileName = `wizard/${businessId || 'anonymous'}/${tempId}.${fileExt}`;

                            const { error: uploadError } = await supabase.storage
                                .from('menu-images')
                                .upload(fileName, file);

                            if (uploadError) throw uploadError;

                            const { data: { publicUrl } } = supabase.storage
                                .from('menu-images')
                                .getPublicUrl(fileName);

                            // 🆕 Analyze with Gemini Vision
                            const visionDescription = await analyzeVisualSeed(publicUrl, type);

                            const newSeed: AtmosphereSeed = {
                                id: tempId,
                                blob: publicUrl,
                                type: type,
                                promptHint: visionDescription,
                                storagePath: fileName
                            };

                            useOnboardingStore.getState().addAtmosphereSeed(newSeed);

                            if (type === 'background') {
                                updateItem(atmosphereEditItem.id, { selectedBackgroundId: tempId });
                            } else {
                                updateItem(atmosphereEditItem.id, { selectedContainerId: tempId });
                            }
                        } catch (err) {
                            console.error('Failed to upload atmosphere seed:', err);
                        }
                    }}
                />
            )}

            {/* Header / Stats */}
            <div className={`p-5 rounded-3xl flex items-center justify-between border shadow-sm
                ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Coffee size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black">Review Menu Items</h2>
                        <p className="text-sm text-slate-400">Validate items and choose atmosphere for AI generation</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 rounded-2xl bg-slate-500/10 text-slate-500 text-xs font-black border border-slate-500/20">
                        {stats.total} TOTAL
                    </div>
                    {stats.errors > 0 && (
                        <div className="px-4 py-2 rounded-2xl bg-red-500/10 text-red-400 text-xs font-black border border-red-500/20 flex items-center gap-2">
                            <AlertCircle size={14} /> {stats.errors} FIX NEEDED
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
                    {items.map((item) => {
                        const hasError = (item.validationErrors && item.validationErrors.length > 0) || duplicateErrors.has(item.id);
                        const errors = [...(item.validationErrors || []), ...(duplicateErrors.get(item.id) || [])];

                        const bgSeed = atmosphereSeeds.find(s => s.id === item.selectedBackgroundId);
                        const containerSeed = atmosphereSeeds.find(s => s.id === item.selectedContainerId);

                        return (
                            <div
                                key={item.id}
                                className={`relative p-5 rounded-3xl border flex flex-col gap-4 group transition-all duration-300 hover:shadow-2xl hover:-translate-y-1
                                ${isDarkMode ? 'bg-slate-900/50 hover:bg-slate-950/80 border-slate-800' : 'bg-white hover:bg-white border-slate-200'}
                                ${hasError ? 'border-red-500/30 bg-red-500/5' : ''}
                                `}
                            >
                                {/* Main Image Placeholder */}
                                <div
                                    className={`relative aspect-square rounded-2xl flex items-center justify-center overflow-hidden shadow-inner cursor-pointer
                                        ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}
                                        ${item.status === 'preparing' ? 'animate-pulse' : ''}
                                    `}
                                    onClick={() => handleCardClick(item)}
                                >
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 text-slate-600 opacity-30">
                                            <Wand2 size={42} strokeWidth={1} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting AI</span>
                                        </div>
                                    )}

                                    {/* Preparing Overlay */}
                                    {item.status === 'preparing' && (
                                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white z-30">
                                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Preparing...</span>
                                        </div>
                                    )}

                                    {/* 🆕 Error Overlay */}
                                    {item.status === 'error' && (
                                        <div className="absolute inset-0 bg-red-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white z-30 p-4 text-center animate-in fade-in duration-300">
                                            <AlertTriangle size={32} className="text-red-400 mb-2" />
                                            <span className="text-[14px] font-black uppercase tracking-widest text-red-100">Generation Failed</span>
                                            <p className="text-[10px] text-red-200 mt-2 font-mono leading-tight bg-red-950/50 p-2 rounded-lg border border-red-500/20">
                                                {item.error || 'Unknown Error'}
                                            </p>
                                        </div>
                                    )}

                                    {/* 🆕 Generation Metadata Overlay */}
                                    {item.generationTime && (
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg flex items-center gap-1.5 border border-white/10 z-30 animate-in fade-in slide-in-from-top-1 duration-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                            <span className="text-[9px] font-black text-white/90 uppercase tracking-tighter">
                                                {item.generationTime}s • {item.powerSource}
                                            </span>
                                        </div>
                                    )}

                                    {/* GENERATE / REGENERATE Logic Button */}
                                    <div className="absolute inset-0 bg-indigo-500/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); regenerateSingleItem(item.id); }}
                                            disabled={item.status === 'generating' || item.status === 'preparing'}
                                            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/40 transition-all active:scale-90 flex items-center gap-2"
                                        >
                                            <Wand2 size={18} className={item.status === 'preparing' ? 'animate-spin' : ''} />
                                            {item.imageUrl ? 'REGENERATE' : 'GENERATE'}
                                        </button>
                                    </div>

                                    {/* 🆕 Humorous AI Loading Overlay */}
                                    {(item.status === 'generating' || item.status === 'preparing') && (
                                        <HumorousLoader />
                                    )}
                                </div>

                                {/* content Row */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4
                                            className="font-black text-lg truncate leading-tight flex-1 cursor-pointer hover:text-indigo-500 transition-colors"
                                            title="Edit Item Details"
                                            onClick={() => setDetailsEditItem(item)}
                                        >
                                            {item.name}
                                        </h4>
                                        <div className="flex flex-col items-end">
                                            <button
                                                onClick={() => setPriceEditItem(item)}
                                                className={`text-sm font-black px-2 py-0.5 rounded-lg transition-all hover:scale-105
                                                    ${item.salePrice ? 'text-slate-400 line-through text-[10px]' : 'text-emerald-500 bg-emerald-500/10'}`}
                                            >
                                                {item.price}₪
                                            </button>
                                            {item.salePrice && (
                                                <button
                                                    onClick={() => setPriceEditItem(item)}
                                                    className="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg mt-1"
                                                >
                                                    {item.salePrice}₪
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 🆕 Visual Description (Hebrew Anchor) */}
                                    {item.visualDescription && (
                                        <div className="flex items-center gap-2 py-1 px-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 mb-1">
                                            <Wand2 size={12} className="text-indigo-400" />
                                            <p className="text-[11px] font-bold text-indigo-400/90 leading-tight">
                                                {item.visualDescription}
                                            </p>
                                        </div>
                                    )}

                                    <p
                                        className="text-xs text-slate-500 line-clamp-1 italic cursor-pointer hover:text-slate-400 transition-colors"
                                        onClick={() => setDetailsEditItem(item)}
                                        title="Edit description"
                                    >
                                        {item.description || 'No description provided'}
                                    </p>
                                </div>

                                {/* 🆕 SEED SELECTION ROW (3 Squares) */}
                                <div className="grid grid-cols-3 gap-3 pt-2">
                                    <div className="relative aspect-square group/box">
                                        <button
                                            onClick={() => { setAtmosphereEditItem(item); setAtmosphereEditMode('container'); }}
                                            className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden
                                                ${containerSeed
                                                    ? 'border-indigo-500 bg-indigo-500/5'
                                                    : isDarkMode ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40' : 'border-slate-100 hover:border-slate-200 bg-slate-50'}
                                            `}
                                            title="Choose Dish"
                                        >
                                            {containerSeed ? (
                                                <img src={containerSeed.blob as string} className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <Coffee size={16} className="text-slate-600" />
                                                    <span className="text-[8px] font-black uppercase text-slate-500">Dish</span>
                                                </>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/40 opacity-0 group-hover/box:opacity-100 transition-opacity">
                                                <Play size={14} className="text-white fill-current" />
                                            </div>
                                        </button>

                                        {containerSeed && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateItem(item.id, { selectedContainerId: undefined }); }}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity hover:bg-black border border-white/20 z-10"
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>

                                    {/* 2. BACKGROUND SEED */}
                                    <div className="relative aspect-square group/box">
                                        <button
                                            onClick={() => { setAtmosphereEditItem(item); setAtmosphereEditMode('background'); }}
                                            className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden
                                                ${bgSeed
                                                    ? 'border-indigo-500 bg-indigo-500/5'
                                                    : isDarkMode ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40' : 'border-slate-100 hover:border-slate-200 bg-slate-50'}
                                            `}
                                            title="Choose Background"
                                        >
                                            {bgSeed ? (
                                                <img src={bgSeed.blob as string} className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                                    <span className="text-[8px] font-black uppercase text-slate-500">Backgd</span>
                                                </>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/40 opacity-0 group-hover/box:opacity-100 transition-opacity">
                                                <Play size={14} className="text-white fill-current" />
                                            </div>
                                        </button>

                                        {bgSeed && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateItem(item.id, { selectedBackgroundId: undefined }); }}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity hover:bg-black border border-white/20 z-10"
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>

                                    {/* 3. ORIGINAL REF / UPLOAD AREA */}
                                    <div className="relative aspect-square group/box">
                                        <div className={`w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden
                                            ${item.originalImageUrl
                                                ? 'border-indigo-500 bg-indigo-500/5'
                                                : isDarkMode ? 'border-slate-800 hover:border-slate-700' : 'border-slate-100 hover:border-slate-200'}
                                        `}>
                                            {item.originalImageUrl ? (
                                                <img src={item.originalImageUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <label className="cursor-pointer flex flex-col items-center gap-1 w-full h-full justify-center">
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                uploadOriginalImage(item.id, file);
                                                            }
                                                        }}
                                                    />
                                                    <Play size={16} className="text-slate-600 rotate-90" />
                                                    <span className="text-[8px] font-black uppercase text-slate-500">Ref Img</span>
                                                </label>
                                            )}
                                        </div>

                                        {item.originalImageUrl && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateItem(item.id, { originalImageUrl: undefined }); }}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity hover:bg-black border border-white/20 z-10"
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 🆕 AI PROMPT EDIT BUTTON */}
                                <button
                                    onClick={() => setPromptEditItem(item)}
                                    className={`w-full py-2.5 rounded-2xl border-2 border-dashed text-[10px] font-black uppercase tracking-widest transition-all mt-2 flex items-center justify-center gap-2
                                        ${isDarkMode ? 'border-indigo-500/20 text-indigo-400/60 hover:border-indigo-500/40 hover:text-indigo-400 bg-indigo-500/5' : 'border-indigo-500/20 text-indigo-500/60 hover:border-indigo-500/40 hover:text-indigo-500 bg-indigo-500/5'}
                                    `}
                                >
                                    <Wand2 size={12} />
                                    Edit AI Prompt
                                </button>

                                {/* Footer Badges & Tools */}
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/50">
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-800 text-slate-400">
                                        {item.category}
                                    </span>
                                    <button
                                        onClick={() => setPreviewItem(item)}
                                        className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-1"
                                    >
                                        Test Logic <Play size={8} fill="currentColor" />
                                    </button>
                                </div>

                                {/* Error Overlay */}
                                {hasError && (
                                    <div className="absolute inset-0 bg-red-900/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-40 border-2 border-red-500/50 animate-in fade-in zoom-in-95 duration-200">
                                        <AlertTriangle className="text-red-500 mb-2" size={32} />
                                        <p className="text-xs text-white font-black uppercase tracking-widest mb-3">Validation Error</p>
                                        <ul className="text-[10px] text-red-200 space-y-1 mb-4">
                                            {errors.map((e, idx) => <li key={idx} className="line-clamp-1">{e}</li>)}
                                        </ul>
                                        <button className="px-6 py-2 bg-white text-red-600 font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                                            Edit Item Data
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Global Actions Footer */}
            <div className={`fixed bottom-0 left-0 right-0 p-6 border-t z-[60] flex justify-center backdrop-blur-xl shadow-[0_-20px_50px_rgba(0,0,0,0.1)]
                ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
                <div className="flex items-center gap-6 max-w-4xl w-full">
                    <div className="hidden md:block">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Global Progress</p>
                        <p className="text-lg font-black">{stats.pending} items remaining</p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={stats.errors > 0 || stats.total === 0}
                        className="flex-1 flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black rounded-3xl shadow-2xl shadow-purple-500/40 relative overflow-hidden group disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        <Wand2 className="relative z-10 animate-pulse" />
                        <span className="relative z-10 text-lg uppercase tracking-wider">Start Auto-Generation (Batch)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Step3_ReviewAI;
