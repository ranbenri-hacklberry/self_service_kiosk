import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Monitor, ChefHat, LogOut, BarChart3 } from 'lucide-react';

const ModeSelectionScreen = () => {
    const navigate = useNavigate();
    const { currentUser, setMode, logout } = useAuth();

    // Check if user is a manager/admin
    const isManager = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.access_level === 'admin' || currentUser?.access_level === 'manager' || currentUser?.is_admin === true;

    const handleModeSelect = (mode) => {
        setMode(mode);
        if (mode === 'kiosk') {
            navigate('/');
        } else if (mode === 'kds') {
            navigate('/kds');
        } else if (mode === 'manager') {
            navigate('/data-manager-interface');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-heebo" dir="rtl">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-white mb-4">
                        שלום, {currentUser?.name || 'עובד'} 👋
                    </h1>
                    <p className="text-xl text-slate-300">
                        בחר את מצב העבודה עבור עמדה זו
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Manager Interface Card - Only for Managers */}
                    {isManager && (
                        <button
                            onClick={() => handleModeSelect('manager')}
                            className="group relative bg-white rounded-3xl p-8 hover:bg-purple-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-32 h-32 bg-purple-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                    <BarChart3 size={32} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">ממשק ניהול</h2>
                                <p className="text-slate-500 text-lg leading-relaxed">
                                    צפייה בנתוני מכירות, ניהול תפריט ומלאי.
                                </p>
                            </div>
                        </button>
                    )}

                    {/* Kiosk Mode Card - Hidden for Managers (Mobile) */}
                    {!isManager && (
                        <button
                            onClick={() => handleModeSelect('kiosk')}
                            className="group relative bg-white rounded-3xl p-8 hover:bg-blue-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                    <Monitor size={32} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">עמדת הזמנה</h2>
                                <p className="text-slate-500 text-lg leading-relaxed">
                                    מסך הזמנה ללקוחות (קיוסק).
                                    <br />
                                    מאפשר ביצוע הזמנות ותשלום עצמי.
                                </p>
                            </div>
                        </button>
                    )}

                    {/* KDS Mode Card - Available for everyone */}
                    <button
                        onClick={() => handleModeSelect('kds')}
                        className="group relative bg-white rounded-3xl p-8 hover:bg-orange-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-32 h-32 bg-orange-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                <ChefHat size={32} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">מסך מטבח (KDS)</h2>
                            <p className="text-slate-500 text-lg leading-relaxed">
                                מסך ניהול הזמנות למטבח.
                                <br />
                                צפייה בהזמנות נכנסות ועדכון סטטוסים.
                            </p>
                        </div>
                    </button>
                </div>

                <div className="mt-12 text-center">
                    <button
                        onClick={logout}
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-6 py-3 rounded-xl hover:bg-white/10"
                    >
                        <LogOut size={20} />
                        <span>יציאה מהמערכת</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModeSelectionScreen;
