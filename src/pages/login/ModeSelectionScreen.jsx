import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Monitor, ChefHat, LogOut, BarChart3, Coffee, Users, Music, ShieldAlert, Package, List } from 'lucide-react';

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
        } else if (mode === 'inventory') {
            navigate('/inventory');
        } else if (mode === 'prep') {
            navigate('/prep');
        } else if (mode === 'mobile-kds') {
            setMode('kds'); // Set as KDS mode for auth
            navigate('/mobile-kds');
        } else if (mode === 'manager') {
            navigate('/data-manager-interface');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-3 font-heebo" dir="rtl">
            <div className="max-w-5xl w-full">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-black text-white mb-2">
                        שלום, {currentUser?.name || 'עובד'} 👋
                    </h1>
                    <p className="text-base text-slate-300">
                        בחר את מצב העבודה
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl mx-auto">

                    {/* 0. Super Admin - Only for Super Admin */}
                    {currentUser?.is_super_admin && (
                        <button
                            onClick={() => navigate('/super-admin')}
                            className="group relative bg-slate-900 rounded-2xl p-5 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-slate-700"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-slate-800 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-12 transition-transform">
                                    <ShieldAlert size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-white mb-1">Super Admin</h2>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                    ניהול עסקים והגדרות על
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 1. Manager Interface - Mobile & Desktop only (hidden on tablet up to 1536px) */}
                    {isManager && (
                        <button
                            onClick={() => handleModeSelect('manager')}
                            className="lg:hidden 2xl:block group relative bg-white rounded-2xl p-5 hover:bg-purple-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-purple-100"
                        >
                            <div className="absolute top-0 left-0 w-20 h-20 bg-purple-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                    <BarChart3 size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 mb-1">הקוקפיט</h2>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                    מכירות, תפריט, מלאי ומשימות
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 2. Cash Register - Hidden on Mobile */}
                    <button
                        onClick={() => handleModeSelect('kiosk')}
                        className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-orange-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-orange-100"
                    >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-orange-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                <Coffee size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">עמדת קופה</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                הקלדת הזמנות ומכירות
                            </p>
                        </div>
                    </button>

                    {/* 3. Service (KDS) - Tablet/Desktop */}
                    <button
                        onClick={() => handleModeSelect('kds')}
                        className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-emerald-100"
                    >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                <Monitor size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">סרוויס (KDS)</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                ניהול הזמנות ומשימות הכנה
                            </p>
                        </div>
                    </button>

                    {/* NEW: Inventory */}
                    <button
                        onClick={() => handleModeSelect('inventory')}
                        className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-blue-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-blue-100"
                    >
                        <div className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            חדש
                        </div>
                        <div className="absolute top-0 left-0 w-20 h-20 bg-blue-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                <Package size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">ניהול מלאי</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                ספירות מלאי והזמנות רכש
                            </p>
                        </div>
                    </button>

                    {/* NEW: Prep Tasks */}
                    <button
                        onClick={() => handleModeSelect('prep')}
                        className="hidden md:block group relative bg-white rounded-2xl p-5 hover:bg-indigo-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-indigo-100"
                    >
                        <div className="absolute top-3 left-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            חדש
                        </div>
                        <div className="absolute top-0 left-0 w-20 h-20 bg-indigo-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                <List size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">משימות</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                פתיחה, סגירה והכנות
                            </p>
                        </div>
                    </button>

                    {/* 3b. Mobile KDS - Only visible on mobile */}
                    <button
                        onClick={() => handleModeSelect('mobile-kds')}
                        className="md:hidden group relative bg-white rounded-2xl p-5 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-right overflow-hidden border-2 border-transparent hover:border-emerald-100"
                    >
                        <div className="absolute top-0 left-0 w-20 h-20 bg-emerald-100 rounded-br-full -translate-x-5 -translate-y-5 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg group-hover:rotate-6 transition-transform">
                                <ChefHat size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-1">צפייה בהזמנות</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                מעקב הזמנות מהטלפון
                            </p>
                        </div>
                    </button>

                    {/* 4. Customer Station - Coming Soon */}
                    <button
                        disabled
                        className="group relative bg-gray-50 rounded-2xl p-5 cursor-not-allowed opacity-80 text-right overflow-hidden border-2 border-dashed border-gray-200"
                    >
                        <div className="absolute top-3 left-3 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            בקרוב
                        </div>
                        <div className="relative z-10 opacity-60 grayscale">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-sm">
                                <Users size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-700 mb-1">עמדת לקוחות</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                הזמנה עצמית ללקוחות
                            </p>
                        </div>
                    </button>

                    {/* 5. Music - Coming Soon */}
                    <button
                        disabled
                        className="group relative bg-gray-50 rounded-2xl p-5 cursor-not-allowed opacity-80 text-right overflow-hidden border-2 border-dashed border-gray-200"
                    >
                        <div className="absolute top-3 left-3 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            בקרוב
                        </div>
                        <div className="relative z-10 opacity-60 grayscale">
                            <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center text-white mb-3 shadow-sm">
                                <Music size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-black text-slate-700 mb-1">מוזיקה</h2>
                            <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                שליטה בפלייליסט
                            </p>
                        </div>
                    </button>

                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={logout}
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/10 text-sm"
                    >
                        <LogOut size={16} />
                        <span>יציאה</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModeSelectionScreen;
