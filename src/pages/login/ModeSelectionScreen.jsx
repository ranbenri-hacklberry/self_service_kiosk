import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Monitor, ChefHat, LogOut, BarChart3, Coffee, Users, Music, ShieldAlert } from 'lucide-react';

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

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">

                    {/* 0. Super Admin - Only for Super Admin */}
                    {currentUser?.is_super_admin && (
                        <button
                            onClick={() => navigate('/super-admin')}
                            className="group relative bg-slate-900 rounded-3xl p-8 hover:bg-slate-800 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden border-2 border-transparent hover:border-slate-700"
                        >
                            <div className="absolute top-0 left-0 w-32 h-32 bg-slate-800 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-12 transition-transform">
                                    <ShieldAlert size={32} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2">Super Admin</h2>
                                <p className="text-slate-400 text-lg leading-relaxed font-medium">
                                    אזור מסוכן. כניסה למורשים בלבד. <br /> ניהול עסקים, משתמשים והגדרות על.
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 1. Manager Interface - Visible to Manager/Admin on ALL devices */}
                    {isManager && (
                        <button
                            onClick={() => handleModeSelect('manager')}
                            className="group relative bg-white rounded-3xl p-8 hover:bg-purple-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden border-2 border-transparent hover:border-purple-100"
                        >
                            <div className="absolute top-0 left-0 w-32 h-32 bg-purple-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                    <BarChart3 size={32} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">הקוקפיט (מנהלים)</h2>
                                <p className="text-slate-500 text-lg leading-relaxed font-medium">
                                    לראות הכל מלמעלה. מספרים, מלאי, והחלטות הרות גורל (או סתם לבדוק כמה קרואסונים נשארו).
                                </p>
                            </div>
                        </button>
                    )}

                    {/* 2. active Cash Register (ex-Coffee) - Hidden on Mobile */}
                    <button
                        onClick={() => handleModeSelect('kiosk')}
                        className="hidden md:block group relative bg-white rounded-3xl p-8 hover:bg-orange-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden border-2 border-transparent hover:border-orange-100"
                    >
                        <div className="absolute top-0 left-0 w-32 h-32 bg-orange-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                <Coffee size={32} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">עמדת קופה</h2>
                            <p className="text-slate-500 text-lg leading-relaxed font-medium">
                                להקליד הזמנות בקצב מסחרר. מי אמר שאי אפשר לעשות דברים טובים ומהר? יאללה לעבודה.
                            </p>
                        </div>
                    </button>

                    {/* 3. Service (ex-KDS) - Active - Tablet/Desktop */}
                    <button
                        onClick={() => handleModeSelect('kds')}
                        className="hidden md:block group relative bg-white rounded-3xl p-8 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden border-2 border-transparent hover:border-emerald-100"
                    >
                        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                <Monitor size={32} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">סרוויס (KDS)</h2>
                            <p className="text-slate-500 text-lg leading-relaxed font-medium">
                                איפה שהקסם קורה והבונים יוצאים. רק בלי הנייר והצעקות (בתקווה). שיהיה סרוויס רגוע.
                            </p>
                        </div>
                    </button>

                    {/* 3b. Mobile KDS - Only visible on mobile */}
                    <button
                        onClick={() => handleModeSelect('kds')}
                        className="md:hidden group relative bg-white rounded-3xl p-8 hover:bg-emerald-50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl text-right overflow-hidden border-2 border-transparent hover:border-emerald-100"
                    >
                        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-100 rounded-br-full -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
                                <ChefHat size={32} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">צפייה בהזמנות</h2>
                            <p className="text-slate-500 text-lg leading-relaxed font-medium">
                                לעקוב אחרי ההזמנות מהטלפון. לראות מה בתהליך, מה מוכן ומה מחכה לתשלום.
                            </p>
                        </div>
                    </button>

                    {/* 4. Customer Station - Coming Soon */}
                    <button
                        disabled
                        className="group relative bg-gray-50 rounded-3xl p-8 cursor-not-allowed opacity-80 text-right overflow-hidden border-2 border-dashed border-gray-200"
                    >
                        <div className="absolute top-4 left-4 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            בקרוב
                        </div>
                        <div className="relative z-10 opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500">
                            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-sm">
                                <Users size={32} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-700 mb-2">עמדת לקוחות</h2>
                            <p className="text-slate-500 text-lg leading-relaxed font-medium">
                                תנו ללקוחות לעבוד בשבילכם. <br />הם מזמינים, אתם נחים (או מכינים קפה). בקרוב מאוד.
                            </p>
                        </div>
                    </button>

                    {/* 5. Music - Coming Soon */}
                    <button
                        disabled
                        className="group relative bg-gray-50 rounded-3xl p-8 cursor-not-allowed opacity-80 text-right overflow-hidden border-2 border-dashed border-gray-200"
                    >
                        <div className="absolute top-4 left-4 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            בקרוב
                        </div>
                        <div className="relative z-10 opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500">
                            <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-sm">
                                <Music size={32} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-700 mb-2">דיג'יי (מוזיקה)</h2>
                            <p className="text-slate-500 text-lg leading-relaxed font-medium">
                                כי בלי אווירה זה סתם קפה. <br />בקרוב תוכלו לשלוט בפלייליסט ולהרים (או להוריד) את הקצב.
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
