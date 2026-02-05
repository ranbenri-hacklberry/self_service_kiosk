import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, HardDrive, ArrowRight, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import GoogleConnectButton from '@/components/GoogleConnectButton';
import AccountantAccess from '@/components/settings/AccountantAccess';
import WhatsAppConnect from '@/components/settings/WhatsAppConnect';

const OwnerSettings = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [googleStatus, setGoogleStatus] = useState('loading'); // loading, connected, disconnected
    const [geminiKey, setGeminiKey] = useState('');
    const [isSavingGemini, setIsSavingGemini] = useState(false);
    const [folderId, setFolderId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser?.business_id) return;

            // Fetch Google connection status
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('is_google_connected, gemini_api_key')
                    .eq('id', currentUser.business_id)
                    .single();

                if (error) throw error;

                if (data?.is_google_connected) {
                    setGoogleStatus('connected');
                } else {
                    setGoogleStatus('disconnected');
                }

                if (data?.gemini_api_key) {
                    setGeminiKey(data.gemini_api_key);
                }
            } catch (err) {
                console.error('Error fetching settings:', err);
                setGoogleStatus('disconnected');
            }
        };

        fetchData();
    }, [currentUser?.business_id]);

    const handleSaveGemini = async () => {
        if (!currentUser?.business_id) return;
        setIsSavingGemini(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({ gemini_api_key: geminiKey })
                .eq('id', currentUser.business_id);

            if (error) throw error;
            alert('✅ מפתח Gemini נשמר בהצלחה!');
            // Also update local storage for onboarding if needed
            localStorage.setItem('onboarding_gemini_api_key', geminiKey);
        } catch (err) {
            console.error('Error saving Gemini key:', err);
            alert('❌ שגיאה בשמירת המפתח');
        } finally {
            setIsSavingGemini(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6 font-heebo" dir="rtl">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header with Back Button */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/mode-selection')}
                        className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                    >
                        <ArrowRight size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-white mb-1">הגדרות בעלים (Owner)</h1>
                        <p className="text-slate-400 text-lg">ניהול חיבורים ושירותים רגישים</p>
                    </div>
                </div>

                {/* Gemini AI Integration Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-slate-800 rounded-2xl shadow-xl border border-indigo-500/20 p-8"
                >
                    <div className="flex flex-col md:flex-row items-start justify-between gap-8">
                        <div className="space-y-6 flex-1">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Google Gemini AI</h2>
                                    <p className="text-slate-400 text-base leading-relaxed">
                                        חבר את העסק למנוע ה-AI העוצמתי של גוגל.
                                        חיבור מפתח אישי מאפשר ג׳נרציית תמונות תפריט באיכות המקסימלית (Imagen 3) במהירות שיא ובעלות אפסית.
                                    </p>
                                </div>
                            </div>

                            <div className="pr-16 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">מפתח Gemini API</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="password"
                                            value={geminiKey}
                                            onChange={e => setGeminiKey(e.target.value)}
                                            placeholder="Paste your key here..."
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-indigo-400 font-mono text-sm focus:border-indigo-500 outline-none transition-all"
                                        />
                                        <button
                                            onClick={handleSaveGemini}
                                            disabled={isSavingGemini}
                                            className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all"
                                        >
                                            {isSavingGemini ? 'שומר...' : 'שמור'}
                                        </button>
                                    </div>
                                    <a
                                        href="https://aistudio.google.com/app/apikey"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors mt-3 inline-block font-medium"
                                    >
                                        🌐 השג מפתח חינמי ב-Google AI Studio
                                    </a>
                                </div>

                                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                    <div className="flex items-center gap-2 text-xs text-slate-300">
                                        <div className={`w-2 h-2 rounded-full ${geminiKey ? 'bg-green-500' : 'bg-slate-600'}`} />
                                        <span>{geminiKey ? 'המנוע מוכן לעבודה' : 'לא מוגדר מפתח - המערכת תשתמש במנוע ברירת מחדל איטי יותר'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* WhatsApp Integration Card */}
                <WhatsAppConnect />

                {/* Google Integration Card */}
                <motion.div>
                    {/* ... existing card content ... */}
                </motion.div>

                {/* Accountant Access - Only show if connected */}
                {googleStatus === 'connected' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AccountantAccess />
                    </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Onboarding Wizard Entry */}
                    <div
                        onClick={() => navigate('/onboarding')}
                        className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl border border-indigo-500/50 p-6 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Magic Menu Wizard</h3>
                                <p className="text-indigo-200/60 text-sm">Launch AI Onboarding</p>
                            </div>
                        </div>
                        <ArrowRight className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                    </div>

                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex items-center justify-between opacity-40 grayscale pointer-events-none">
                        <span className="text-white font-medium">Wolt Integration</span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">בקרוב</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OwnerSettings;
