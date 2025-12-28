import { useState } from 'react';
import { WifiOff, CreditCard } from 'lucide-react';

/**
 * OfflineAlert - Compact but informative offline notification
 */
const OfflineAlert = ({ onDismiss }) => {
    const [isExiting, setIsExiting] = useState(false);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => onDismiss?.(), 200);
    };

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`bg-slate-800 rounded-2xl shadow-2xl max-w-sm mx-4 overflow-hidden border border-slate-600 transition-transform duration-200 ${isExiting ? 'scale-95' : 'scale-100'}`} dir="rtl">

                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <WifiOff size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white">אין חיבור לאינטרנט 😢</h2>
                        <p className="text-white/90 text-sm">אפשר להמשיך לעבוד!</p>
                    </div>
                </div>

                {/* Warnings */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3 text-slate-300 bg-slate-700/50 rounded-xl p-3">
                        <span className="text-xl">📴</span>
                        <span className="text-sm">הנתונים לא מסתנכרנים לענן</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300 bg-slate-700/50 rounded-xl p-3">
                        <span className="text-xl">📱</span>
                        <span className="text-sm">אין תקשורת עם מכשירים אחרים</span>
                    </div>
                    <div className="flex items-start gap-3 text-red-300 bg-red-900/40 rounded-xl p-3 border border-red-700/50">
                        <CreditCard size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">סליקת אשראי לא תעבוד!</p>
                            <p className="text-red-400/90 text-xs mt-0.5">אם מסוף הסליקה מחובר לאותה רשת WiFi</p>
                        </div>
                    </div>
                </div>

                {/* Button */}
                <div className="p-4 pt-0">
                    <button
                        onClick={handleDismiss}
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 active:scale-[0.98] transition-all text-lg"
                    >
                        הבנתי, נמשיך! 👍
                    </button>
                </div>

            </div>
        </div>
    );
};

export default OfflineAlert;
