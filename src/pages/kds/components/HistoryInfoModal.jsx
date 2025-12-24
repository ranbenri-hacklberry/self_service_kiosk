import React, { useState, useEffect } from 'react';
import { History, ArrowUp, CreditCard, CheckCircle } from 'lucide-react';

const DONT_SHOW_KEY = 'kds_history_info_dismissed';

/**
 * HistoryInfoModal - Shows when an unpaid order is moved to history
 * Explains how to access the order from the History tab
 */
const HistoryInfoModal = ({ isOpen, onClose, orderNumber }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    // Check if user dismissed this previously
    useEffect(() => {
        if (isOpen) {
            const dismissed = localStorage.getItem(DONT_SHOW_KEY);
            if (dismissed === 'true') {
                // Auto-close if user chose not to see this again
                onClose();
            }
        }
    }, [isOpen, onClose]);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem(DONT_SHOW_KEY, 'true');
        }
        onClose();
    };

    if (!isOpen) return null;

    // Check if already dismissed
    if (localStorage.getItem(DONT_SHOW_KEY) === 'true') {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
            dir="rtl"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-5 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <CheckCircle size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black">ההזמנה הועברה להיסטוריה</h2>
                            {orderNumber && (
                                <p className="text-sm opacity-80">הזמנה {orderNumber}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Info message */}
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                        <div className="flex gap-3">
                            <CreditCard className="text-amber-600 shrink-0 mt-0.5" size={22} />
                            <div>
                                <p className="font-bold text-amber-800">ההזמנה טרם שולמה</p>
                                <p className="text-sm text-amber-700 mt-1">
                                    ניתן לגשת אליה בכל עת דרך טאב ההיסטוריה ולגבות תשלום
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Visual guide */}
                    <div className="bg-slate-100 rounded-xl p-4">
                        <p className="text-sm font-bold text-slate-600 mb-3 text-center">איך לגשת להזמנה:</p>

                        {/* Mock top bar */}
                        <div className="bg-slate-800 rounded-xl p-3 relative">
                            <div className="flex items-center justify-between">
                                {/* Left side - placeholder */}
                                <div className="flex items-center gap-2 opacity-50">
                                    <div className="w-8 h-8 bg-slate-600 rounded-lg"></div>
                                    <div className="w-16 h-4 bg-slate-600 rounded"></div>
                                </div>

                                {/* Center - tabs */}
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1.5 bg-slate-700 rounded-lg text-slate-400 text-xs">
                                        פעיל
                                    </div>
                                    <div className="px-3 py-1.5 bg-blue-500 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 animate-pulse shadow-lg ring-2 ring-blue-300">
                                        <History size={12} />
                                        היסטוריה
                                    </div>
                                </div>

                                {/* Right side - placeholder */}
                                <div className="flex items-center gap-2 opacity-50">
                                    <div className="w-8 h-8 bg-slate-600 rounded-lg"></div>
                                </div>
                            </div>

                            {/* Arrow pointing to History tab */}
                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                                <ArrowUp className="text-blue-500 animate-bounce" size={24} />
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 text-center mt-8">
                            לחץ על "היסטוריה" בבר העליון כדי לראות הזמנות שהושלמו
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 space-y-3">
                    {/* Don't show again checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">לא להציג הודעה זו שוב</span>
                    </label>

                    <button
                        onClick={handleClose}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition shadow-md"
                    >
                        הבנתי
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HistoryInfoModal;
