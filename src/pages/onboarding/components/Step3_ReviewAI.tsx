
import { useMemo, useState, useEffect } from 'react';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useTheme } from '../../../context/ThemeContext';
import {
    AlertCircle, Wand2, AlertTriangle, Play, X, Check, Coffee, Tag,
    Plus, Sparkles, Image as ImageIcon,
    Settings, Clock, ChefHat, Layers, Trash2, Save, ChevronRight
} from 'lucide-react';
import { findDuplicateErrors, analyzeVisualSeed, generateImagePrompt } from '../logic/onboardingLogic';
import { OnboardingItem, ModifierLogic, ModifierRequirement, AtmosphereSeed } from '../types/onboardingTypes';
import { supabase } from '../../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// --- Humorous Loader Component ---
const HumorousLoader = () => {
    const [msgIndex, setMsgIndex] = useState(0);
    const MESSAGES = ["מצחצחים את העלי כותרת...", "מיישרים את העציץ...", "ה-AI מחפש תאורה מושלמת..."];
    useEffect(() => {
        const interval = setInterval(() => setMsgIndex(p => (p + 1) % MESSAGES.length), 3000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{MESSAGES[msgIndex]}</span>
        </div>
    );
};

// --- Universal Edit Modal ---
const UniversalEditModal = ({ item, onClose, isDarkMode, atmosphereSeeds }: { item: OnboardingItem, onClose: () => void, isDarkMode: boolean, atmosphereSeeds: AtmosphereSeed[] }) => {
    const [activeTab, setActiveTab] = useState<'main' | 'ai' | 'modifiers'>('main');
    const { updateItem, regenerateSingleItem, uploadOriginalImage } = useOnboardingStore();
    const [localItem, setLocalItem] = useState<OnboardingItem>({ ...item });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (autoGenerate = false) => {
        setIsSaving(true);
        await updateItem(item.id, localItem);
        if (autoGenerate) await regenerateSingleItem(item.id);
        setIsSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white"><ChefHat size={20} /></div>
                        <div>
                            <h3 className="font-bold text-slate-900">{localItem.name}</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{localItem.category}</p>
                        </div>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['main', 'ai', 'modifiers'].map(t => (
                            <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {t === 'main' ? 'Basic' : t === 'ai' ? 'AI & Visual' : 'Advanced'}
                            </button>
                        ))}
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {activeTab === 'main' && (
                        <div className="grid grid-cols-2 gap-8" dir="rtl">
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">שם הפריט</label>
                                <input value={localItem.name} onChange={e => setLocalItem({ ...localItem, name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/10" />
                                <label className="text-[10px] font-bold text-slate-500 uppercase">תיאור</label>
                                <textarea value={localItem.description} onChange={e => setLocalItem({ ...localItem, description: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/10 min-h-[100px]" />
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">מחיר</label>
                                        <input type="number" value={localItem.price} onChange={e => setLocalItem({ ...localItem, price: Number(e.target.value) })} className="w-full p-3 border border-slate-200 rounded-lg text-lg font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase font-black">מבצע</label>
                                        <input type="number" value={localItem.salePrice || 0} onChange={e => setLocalItem({ ...localItem, salePrice: Number(e.target.value) })} className="w-full p-3 border border-slate-200 rounded-lg text-lg font-bold text-amber-600" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">תאריכי מבצע</label>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <input type="date" value={localItem.saleStartDate} onChange={e => setLocalItem({ ...localItem, saleStartDate: e.target.value })} className="p-2 border border-slate-200 rounded-lg text-xs" />
                                        <input type="date" value={localItem.saleEndDate} onChange={e => setLocalItem({ ...localItem, saleEndDate: e.target.value })} className="p-2 border border-slate-200 rounded-lg text-xs" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="grid grid-cols-3 gap-10">
                            <div className="col-span-1 space-y-4">
                                <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative group">
                                    {localItem.imageUrl ? <img src={localItem.imageUrl} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-slate-300"><ImageIcon size={48} /></div>}
                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                        <button onClick={() => regenerateSingleItem(localItem.id)} className="px-4 py-2 bg-white text-slate-900 font-bold text-xs rounded-lg">Regenerate</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="aspect-square bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-400">DISH</div>
                                    <div className="aspect-square bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-400">SURFACE</div>
                                    <div className="aspect-square border-2 border-dashed border-indigo-200 rounded-lg flex items-center justify-center text-[8px] font-bold text-indigo-400">REF</div>
                                </div>
                            </div>
                            <div className="col-span-2 space-y-6" dir="rtl">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">עוגן ויזואלי (Hebrew)</label>
                                    <input value={localItem.visualDescription} onChange={e => setLocalItem({ ...localItem, visualDescription: e.target.value })} className="w-full p-4 border border-slate-200 rounded-xl font-bold text-slate-700" />
                                </div>
                                <div className="space-y-2" dir="ltr">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Prompt (English)</label>
                                    <textarea value={localItem.prompt} onChange={e => setLocalItem({ ...localItem, prompt: e.target.value })} className="w-full h-32 p-4 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-500 leading-relaxed" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'modifiers' && (
                        <div className="space-y-8" dir="rtl">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                                <h4 className="font-bold text-slate-700">קבוצות תוספות ומודיפיירים</h4>
                                <button className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">+ קבוצה חדשה</button>
                            </div>
                            {(localItem.modifiers || []).map((m, i) => (
                                <div key={i} className="p-4 border border-slate-100 rounded-xl space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-black text-slate-800">{m.name}</span>
                                        <span className="text-[10px] px-2 py-1 bg-slate-100 rounded text-slate-500 font-bold uppercase">{m.requirement === 'M' ? 'חובה' : 'רשות'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[10px]">
                                        {m.items.map((opt, oi) => <span key={oi} className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold">{opt.name} (₪{opt.price})</span>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-100">Cancel</button>
                    <button onClick={() => handleSave()} disabled={isSaving} className="flex-1 py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm">
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                    {activeTab === 'ai' && (
                        <button onClick={() => handleSave(true)} className="flex-1 py-3 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg">Save & Generate</button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---
const Step3_ReviewAI = () => {
    const {
        items, setStep, startLiveGeneration,
        addNewItem, cleanupDuplicates, geminiApiKey, setGeminiApiKey
    } = useOnboardingStore();

    const { isDarkMode } = useTheme();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [editItem, setEditItem] = useState<OnboardingItem | null>(null);
    const [showApiSettings, setShowApiSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState(geminiApiKey || '');

    const categories = useMemo(() => {
        const cats = new Set(items.map(i => i.category));
        return ['All', ...Array.from(cats)].sort();
    }, [items]);

    const filteredItems = useMemo(() => {
        if (selectedCategory === 'All') return items;
        return items.filter(i => i.category === selectedCategory);
    }, [items, selectedCategory]);

    const stats = useMemo(() => {
        const errors = items.filter(i => (i.validationErrors?.length || 0) > 0).length;
        const pending = items.filter(i => i.status === 'pending').length;
        return { errors, pending, total: items.length };
    }, [items]);

    return (
        <div className="flex flex-col h-full gap-0 font-sans select-none bg-slate-50/50" dir="rtl">
            {/* Professional Sticky Header */}
            <div className="p-4 bg-white border-b border-slate-200 z-50 flex items-center justify-between sticky top-0 shadow-sm">
                <div className="flex items-center gap-4 text-right">
                    <button onClick={() => setStep(2)} className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
                        <ChevronRight size={20} />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-slate-900">ניהול קטלוג ובינה מלאכותית</h2>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stats.total} פריטים במערכת</span>
                            {stats.errors > 0 && <span className="text-[10px] text-red-500 font-black animate-pulse flex items-center gap-1"><AlertCircle size={10} /> {stats.errors} שגיאות נתונים</span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => cleanupDuplicates()} className="px-4 py-2 text-slate-400 text-[10px] font-bold uppercase hover:bg-slate-50 rounded-lg transition-all border border-transparent">
                        <Trash2 size={14} className="ml-1 inline" /> נקה כפולים
                    </button>
                    <button onClick={() => addNewItem()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase rounded-lg shadow-md tracking-widest transition-all">
                        <Plus size={16} /> הוסף מוצר
                    </button>
                    <button onClick={() => setShowApiSettings(true)} className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${geminiApiKey ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Category Sub-Header */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-inner">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border
                            ${selectedCategory === cat ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                    >
                        {cat}
                        <span className={`mr-2 opacity-40 text-[9px] ${selectedCategory === cat ? 'text-white' : ''}`}>{items.filter(i => i.category === cat || cat === 'All').length}</span>
                    </button>
                ))}
            </div>

            {/* Item Grid */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6 pb-40">
                    {filteredItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => setEditItem(item)}
                            className="group bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-indigo-200 transition-all flex flex-col h-full"
                        >
                            {/* Image with tight aspect ratio */}
                            <div className="relative aspect-[4/3] bg-slate-50 border-b border-slate-100 overflow-hidden">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} className="w-full h-full object-cover grayscale-[10%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-10"><ImageIcon size={40} /><span className="text-[8px] font-black mt-2">NO IMAGE</span></div>
                                )}
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shadow-sm border ${item.status === 'completed' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white/90 text-slate-500 border-slate-100'}`}>
                                        {item.status}
                                    </span>
                                </div>
                                {item.status === 'generating' && <HumorousLoader />}
                            </div>

                            {/* Info Section - Classic white with colorful chips */}
                            <div className="p-4 flex flex-col gap-2 flex-1">
                                <h4 className="text-[13px] font-bold text-slate-900 line-clamp-1 h-5">{item.name}</h4>

                                <div className="flex flex-wrap gap-1 mt-auto pt-2">
                                    <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase bg-indigo-50 text-indigo-500 border border-indigo-100/50">
                                        {item.category}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                                        ₪{item.price}
                                    </span>
                                    {item.salePrice && (
                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase bg-rose-50 text-rose-600 border border-rose-100/50">
                                            SALE ₪{item.salePrice}
                                        </span>
                                    )}
                                    {item.validationErrors?.length ? (
                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase bg-red-50 text-red-600 border border-red-100/50">שגיאה</span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Batch Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-slate-200 z-[100] bg-white/90 backdrop-blur-md flex items-center justify-center shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl w-full flex gap-4">
                    <div className="hidden md:flex flex-col justify-center px-6 border-l border-slate-100 text-right">
                        <span className="text-[9px] font-bold uppercase text-slate-400">תור ג׳נרציה</span>
                        <span className="text-sm font-black text-slate-900">{stats.pending} פריטים ממתינים</span>
                    </div>
                    <button
                        onClick={() => startLiveGeneration()}
                        disabled={stats.errors > 0 || stats.total === 0}
                        className="flex-1 py-4 bg-slate-900 hover:bg-black text-white font-black text-[13px] uppercase tracking-[0.1em] rounded-xl shadow-lg transition-all active:scale-95 disabled:grayscale disabled:opacity-30 flex items-center justify-center gap-3"
                    >
                        <Wand2 size={18} className="animate-pulse" />
                        הפעל תזמור בינה מלאכותית (Automated Batch)
                    </button>
                </div>
            </div>

            {/* Modals */}
            {editItem && <UniversalEditModal item={editItem} isDarkMode={isDarkMode} atmosphereSeeds={[]} onClose={() => setEditItem(null)} />}

            {showApiSettings && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-8 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900">הגדרות Gemini AI</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 mb-6">Cloud Acceleration API</p>
                        <input type="password" value={tempApiKey} onChange={e => setTempApiKey(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none mb-6" placeholder="Paste Key..." />
                        <div className="flex gap-3">
                            <button onClick={() => setShowApiSettings(false)} className="flex-1 py-2 text-slate-400 font-bold text-xs uppercase">Cancel</button>
                            <button onClick={() => { setGeminiApiKey(tempApiKey); setShowApiSettings(false); }} className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs uppercase rounded-lg">Save Key</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Step3_ReviewAI;
