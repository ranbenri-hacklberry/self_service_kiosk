import React, { useState, useEffect } from 'react';
import { Sparkles, ChefHat, ClipboardList, Settings, ArrowLeft, Monitor, Users } from 'lucide-react';
import { APP_VERSION } from '../version';

/**
 * WhatsNewModal - Shows version update highlights to users
 * Displays ONCE per version, stored in localStorage
 */
const WhatsNewModal = ({ onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        // Check if user already saw this version's update
        const lastSeenVersion = localStorage.getItem('whats_new_seen_version');

        if (lastSeenVersion !== APP_VERSION) {
            setShouldShow(true);
            // Small delay for smooth entrance
            setTimeout(() => setIsVisible(true), 100);
        }
    }, [APP_VERSION]);

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('whats_new_seen_version', APP_VERSION);
        setTimeout(() => {
            setShouldShow(false);
            onClose?.();
        }, 300);
    };

    if (!shouldShow) return null;

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent pointer-events-none'}`}>
            <div
                className={`bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                dir="rtl"
            >
                {/* Header - Tightened padding */}
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-5 text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-28 h-28 bg-white/10 rounded-full -translate-x-14 -translate-y-14" />
                    <div className="relative flex items-center gap-4">
                        <Sparkles className="w-7 h-7 text-yellow-300 animate-pulse" />
                        <div>
                            <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">v{APP_VERSION}</span>
                            <h2 className="text-2xl font-black mt-1 tracking-tight">מה חדש? 🎉</h2>
                        </div>
                    </div>
                </div>

                {/* Features List - Humor & Employee focused */}
                <div className="p-4 space-y-3">
                    {/* Feature 1: Supplier Tasks */}
                    <div className="flex gap-4 items-center p-3.5 bg-gradient-to-l from-indigo-50 to-blue-50 rounded-2xl border border-blue-100 shadow-sm transition-transform hover:scale-[1.01]">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <ChefHat className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-base">משימות ספירה אוטומטיות 🚛</h3>
                            <p className="text-slate-600 text-xs mt-0.5 leading-snug">
                                המערכת כבר יודעת מתי הספקים שלכם בדרך. יום לפני? בום, משימת ספירה קופצת. אין יותר "שכחתי".
                            </p>
                        </div>
                    </div>

                    {/* Feature 2: Weight & Precision */}
                    <div className="flex gap-4 items-center p-3.5 bg-gradient-to-l from-orange-50 to-amber-50 rounded-2xl border border-orange-100 shadow-sm transition-transform hover:scale-[1.01]">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-base">ק"ג או יחידות? מה שבא לכם ⚖️</h3>
                            <p className="text-slate-600 text-xs mt-0.5 leading-snug">
                                ירוק סופרים במשקל, חלב ביחידות. מעכשיו אפשר להחליף מצב בלחיצה. בלי ניחושים ובלי מחשבון.
                            </p>
                        </div>
                    </div>

                    {/* Feature 3: Visual Confirmations & Blockers */}
                    <div className="flex gap-4 items-center p-3.5 bg-gradient-to-l from-emerald-50 to-green-50 rounded-2xl border border-emerald-100 shadow-sm transition-transform hover:scale-[1.01]">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <ClipboardList className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-base">סיימתם? נהיה ירוק! ✅</h3>
                            <p className="text-slate-600 text-xs mt-0.5 leading-snug">
                                שמרתם פריט? הוא ייצבע בירוק בכל המסכים. לא ספרתם הכל? המערכת לא תיתן לכם לסגור את המשימה. סורי!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer - Tightened button & padding */}
                <div className="px-5 pb-6">
                    <button
                        onClick={handleClose}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black py-4 px-8 rounded-xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg"
                    >
                        <span>הבנתי, יאללה לעבודה!</span>
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsNewModal;
