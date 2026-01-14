import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, HardDrive, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import GoogleConnectButton from '@/components/GoogleConnectButton';
import AccountantAccess from '@/components/settings/AccountantAccess';

const OwnerSettings = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [googleStatus, setGoogleStatus] = useState('loading'); // loading, connected, disconnected
    const [folderId, setFolderId] = useState(null);

    useEffect(() => {
        const checkGoogleConnection = async () => {
            if (!currentUser?.business_id) {
                setGoogleStatus('disconnected');
                return;
            }

            try {
                // Check the public flag instead of sensitive tokens
                const { data, error } = await supabase
                    .from('businesses')
                    .select('is_google_connected')
                    .eq('id', currentUser.business_id)
                    .single();

                if (error) throw error;

                if (data?.is_google_connected) {
                    setGoogleStatus('connected');
                } else {
                    setGoogleStatus('disconnected');
                }
            } catch (err) {
                console.error('Error checking Google connection:', err);
                setGoogleStatus('disconnected');
            }
        };

        checkGoogleConnection();
    }, [currentUser?.business_id]);

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

                {/* Google Integration Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-8"
                >
                    <div className="flex flex-col md:flex-row items-start justify-between gap-8">
                        <div className="space-y-6 flex-1">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <HardDrive className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Google Workspace</h2>
                                    <p className="text-slate-400 text-base leading-relaxed">
                                        חבר את העסק לגוגל דרייב כדי ליצור את "תיקיית הקסם" שלנו.
                                        המערכת תיצור אוטומטית מבנה תיקיות חכם ותתחיל לגבות דוחות, חשבוניות ונתונים עסקיים בזמן אמת.
                                    </p>
                                </div>
                            </div>

                            <div className="pr-16">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">מה כולל החיבור?</h3>
                                <ul className="space-y-3 mb-8">
                                    <li className="flex items-center gap-3 text-slate-300">
                                        <BadgeCheck className="w-5 h-5 text-green-400" />
                                        <span>יצירת תיקיית <strong>icaffeOS Data</strong> בדרייב שלך</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-300">
                                        <BadgeCheck className="w-5 h-5 text-green-400" />
                                        <span>סנכרון דוחות סגירת יום (Z Reports)</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-300">
                                        <BadgeCheck className="w-5 h-5 text-green-400" />
                                        <span>גיבוי חשבוניות מס וקבלות</span>
                                    </li>
                                </ul>

                                {/* Dynamic Status Display */}
                                {googleStatus === 'loading' && (
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>בודק סטטוס חיבור...</span>
                                    </div>
                                )}

                                {googleStatus === 'connected' && (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                        <div className="flex items-center gap-3 text-green-400 mb-2">
                                            <CheckCircle className="w-6 h-6" />
                                            <span className="font-bold text-lg">מחובר בהצלחה!</span>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-3">
                                            תיקיית הגיבוי נוצרה ב-Google Cloud שלכם.
                                        </p>

                                        {/* AI Integration Tip */}
                                        <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-slate-600/50">
                                            <p className="text-slate-300 text-xs font-medium mb-2">
                                                💡 <strong>טיפ:</strong> שתף את התיקייה עם ChatGPT, Claude או Gemini לניתוח חכם!
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 bg-slate-900 text-emerald-400 text-xs px-3 py-2 rounded-lg font-mono overflow-x-auto" dir="ltr">
                                                    📁 icaffeOS Data (Do Not Delete)
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('icaffeOS Data (Do Not Delete)');
                                                        const btn = document.getElementById('copy-path-btn');
                                                        if (btn) {
                                                            btn.innerText = '✓';
                                                            setTimeout(() => btn.innerText = '📋', 1500);
                                                        }
                                                    }}
                                                    id="copy-path-btn"
                                                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                                                    title="העתק שם תיקייה"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        </div>

                                        {/* Test Button */}
                                        <button
                                            onClick={async () => {
                                                const btn = document.getElementById('test-backup-btn');
                                                if (btn) btn.innerText = 'מעלה...';
                                                try {
                                                    const { data, error } = await supabase.functions.invoke('google-auth', {
                                                        body: {
                                                            action: 'upload_file',
                                                            business_id: currentUser.business_id,
                                                            file_base64: 'SGVsbG8gaWNhZmZlT1MhIFRoaXMgaXMgYSBzZWN1cmUgdGVzdCB1cGxvYWQu', // "Hello icaffeOS!..." in base64
                                                            filename: `Test_Upload_${new Date().toISOString()}.txt`
                                                        }
                                                    });
                                                    if (error) throw error;
                                                    alert('✅ בוצע בהצלחה! בדוק את הדרייב.');
                                                } catch (e) {
                                                    let errorMessage = e.message;
                                                    // Try to parse detailed error from server response
                                                    try {
                                                        if (e && typeof e.context?.json === 'function') {
                                                            const errBody = await e.context.json();
                                                            errorMessage = errBody.error || errBody.details || e.message;
                                                            console.error('🔴 Detailed server error:', errBody);
                                                        }
                                                    } catch (parseErr) {
                                                        console.error('Failed to parse error body', parseErr);
                                                    }
                                                    alert('❌ שגיאה: ' + errorMessage);
                                                    console.error(e);
                                                } finally {
                                                    if (btn) btn.innerText = 'בצע בדיקת העלאה 🚀';
                                                }
                                            }}
                                            id="test-backup-btn"
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            בצע בדיקת העלאה 🚀
                                        </button>

                                        {/* Full Backup Button */}
                                        <button
                                            onClick={async () => {
                                                const btn = document.getElementById('full-backup-btn');
                                                if (btn) {
                                                    btn.disabled = true;
                                                    btn.innerText = 'מגבה נתונים...';
                                                }
                                                try {
                                                    const { data, error } = await supabase.functions.invoke('google-auth', {
                                                        body: {
                                                            action: 'backup_orders',
                                                            business_id: currentUser.business_id
                                                        }
                                                    });
                                                    if (error) throw error;

                                                    // Success popup with count
                                                    alert(`✅ גיבוי הושלם בהצלחה!\n\n📦 ${data.ordersCount} הזמנות סונכרנו\n📄 קובץ: ${data.filename}\n\nהקובץ נשמר בתיקיית icaffeOS Data בדרייב שלך.`);
                                                } catch (e) {
                                                    let errorMessage = e.message;
                                                    try {
                                                        if (e && typeof e.context?.json === 'function') {
                                                            const errBody = await e.context.json();
                                                            errorMessage = errBody.error || errBody.details || e.message;
                                                            console.error('🔴 Detailed server error:', errBody);
                                                        }
                                                    } catch (parseErr) {
                                                        console.error('Failed to parse error body', parseErr);
                                                    }
                                                    alert('❌ שגיאה בגיבוי: ' + errorMessage);
                                                    console.error(e);
                                                } finally {
                                                    if (btn) {
                                                        btn.disabled = false;
                                                        btn.innerText = 'גבה את כל ההזמנות 📦';
                                                    }
                                                }
                                            }}
                                            id="full-backup-btn"
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            גבה את כל ההזמנות 📦
                                        </button>
                                    </div>
                                )}

                                {googleStatus === 'disconnected' && (
                                    <GoogleConnectButton />
                                )}
                            </div>
                        </div>

                        {/* Status Side Panel */}
                        <div className="hidden md:block w-72 bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                            <h4 className="text-white font-bold mb-4">סטטוס חיבור</h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <div className={`w-2 h-2 rounded-full ${googleStatus === 'connected' ? 'bg-green-500' : 'bg-slate-600'}`} />
                                    <span>Google Drive</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <div className={`w-2 h-2 rounded-full ${googleStatus === 'connected' ? 'bg-green-500' : 'bg-slate-600'}`} />
                                    <span>Google Calendar</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <div className={`w-2 h-2 rounded-full ${googleStatus === 'connected' ? 'bg-green-500' : 'bg-slate-600'}`} />
                                    <span>Gmail Alerts</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

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

                {/* Future Integrations / Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-40 pointer-events-none grayscale">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex items-center justify-between">
                        <span className="text-white font-medium">Wolt Integration</span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">בקרוב</span>
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex items-center justify-between">
                        <span className="text-white font-medium">Tenbis Integration</span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">בקרוב</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OwnerSettings;
