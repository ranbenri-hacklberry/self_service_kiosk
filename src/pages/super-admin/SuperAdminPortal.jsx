import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Building2, Shield, LogOut, LayoutDashboard, Search, ChevronRight, Activity, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import SystemDiagnostics from '@/components/manager/SystemDiagnostics';
import SystemMap from '@/components/super-admin/SystemMap';

const SuperAdminPortal = () => {
    const navigate = useNavigate();
    const { switchBusinessContext, logout } = useAuth();
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [diagnosticsBusiness, setDiagnosticsBusiness] = useState(null);

    useEffect(() => {
        fetchBusinesses();
    }, []);

    const fetchBusinesses = async () => {
        try {
            setLoading(true);
            console.log('🔍 Fetching businesses for Super Admin Portal...');

            // Use direct query - more reliable than RPC
            const { data: businessData, error: queryError } = await supabase
                .from('businesses')
                .select('id, name, created_at, settings')
                .order('created_at', { ascending: false });

            if (queryError) {
                console.error('❌ Business query error:', queryError);
                throw queryError;
            }

            console.log('✅ Fetched businesses:', businessData?.length || 0);

            if (businessData && businessData.length > 0) {
                setBusinesses(businessData.map(b => ({
                    ...b,
                    is_online: false,
                    active_orders_count: 0
                })));
            } else {
                console.warn('⚠️ No businesses found in database');
                setBusinesses([]);
            }
        } catch (err) {
            console.error('❌ Error fetching businesses:', err);
            setBusinesses([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBusinessClick = (business) => {
        console.log('🚀 Impersonating business as Super Admin:', business.name);
        switchBusinessContext(business.id, business.name);
        // Navigate to Mode Selection of that business, NOT manager dashboard directly
        navigate('/mode-selection');
    };

    const mainOptions = [
        {
            title: 'סייר מסד נתונים',
            subtitle: 'ניהול טבלאות, שאילתות ו-RLS',
            icon: <Database size={32} className="text-purple-400" />,
            path: '/super-admin/db',
            color: 'from-purple-600/20 to-purple-900/40',
            borderColor: 'border-purple-500/30'
        },
        {
            title: 'דשבורד ראשי',
            subtitle: 'ניהול והוספת עסקים',
            icon: <Building2 size={32} className="text-blue-400" />,
            path: '/super-admin/businesses',
            color: 'from-blue-600/20 to-blue-900/40',
            borderColor: 'border-blue-500/30'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white font-heebo p-6 flex flex-col items-center overflow-auto custom-scrollbar" dir="rtl">
            {/* Background Decorations */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
            <div className="fixed bottom-0 left-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6"
            >
                <div className="text-center md:text-right">
                    <div className="inline-flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/20 rounded-xl ring-1 ring-red-500/30 shadow-lg shadow-red-500/10">
                            <Shield className="text-red-500 w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                            Super <span className="text-blue-500">Admin</span> Portal
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm font-medium pr-1">ברוך הבא למרכז השליטה</p>
                </div>

                <button
                    onClick={logout}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold active:scale-95 text-sm"
                >
                    <LogOut size={16} />
                    <span>התנתק מהמערכת</span>
                </button>
            </motion.div>

            {/* Main Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl relative z-10 mb-10">
                {mainOptions.map((item, idx) => (
                    <motion.button
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => navigate(item.path)}
                        className={`group relative p-6 bg-gradient-to-br ${item.color} rounded-2xl border ${item.borderColor} backdrop-blur-sm hover:translate-y-[-2px] hover:shadow-xl transition-all duration-300 text-right overflow-hidden`}
                    >
                        <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-br-[3rem] -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500 blur-xl opacity-30"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900/60 rounded-xl flex items-center justify-center shadow-inner ring-1 ring-white/10">
                                    {item.icon}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black group-hover:text-white transition-colors">
                                        {item.title}
                                    </h2>
                                    <p className="text-slate-400 text-sm font-medium opacity-80">
                                        {item.subtitle}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* Businesses List Section */}
            <div className="w-full max-w-6xl relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <Building2 className="text-slate-400" size={20} />
                    <h2 className="text-xl font-bold text-slate-200">גישה מהירה לעסקים ({businesses.length})</h2>
                    <div className="h-px bg-slate-800 flex-1 ml-4"></div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-32 bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800/50"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                        {businesses.map((business, idx) => (
                            <motion.button
                                key={business.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + (idx * 0.05) }}
                                onClick={() => handleBusinessClick(business)}
                                className="group relative bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/30 rounded-2xl p-5 text-right transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/10 flex flex-col justify-between h-full min-h-[140px]"
                            >
                                <div className="flex justify-between items-start w-full mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-bold text-lg text-slate-300 shadow-inner group-hover:text-white transition-colors">
                                            {business.name.substring(0, 2)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-200 group-hover:text-white transition-colors line-clamp-1">
                                                {business.name}
                                            </h3>
                                            <p className="text-[10px] text-slate-500 font-mono">
                                                {business.id.substring(0, 8)}...
                                            </p>
                                        </div>
                                    </div>
                                    {business.is_online && (
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                    )}
                                </div>

                                <div className="mt-auto flex items-center justify-between w-full border-t border-slate-800/50 pt-3">
                                    <span className="text-xs font-bold text-blue-500 group-hover:text-blue-400 flex items-center gap-1 transition-colors">
                                        כניסה לממשק
                                        <ChevronRight size={12} className="group-hover:translate-x-[-2px] transition-transform" />
                                    </span>

                                    <div className="flex items-center gap-2">
                                        {business.active_orders_count > 0 && (
                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                                                {business.active_orders_count} פעילות
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDiagnosticsBusiness(business);
                                            }}
                                            className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-colors z-20 relative"
                                            title="דיאגנוסטיקה"
                                        >
                                            <Activity size={14} />
                                        </button>
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            {/* SYSTEM DIRECTORY (NEW) */}
            <div className="w-full max-w-6xl relative z-10 mt-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <SystemMap />
            </div>

            {/* DIAGNOSTICS MODAL */}
            {diagnosticsBusiness && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative"
                    >
                        <button
                            onClick={() => setDiagnosticsBusiness(null)}
                            className="absolute top-4 left-4 z-50 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700"
                        >
                            <X size={24} />
                        </button>
                        <div className="h-full overflow-hidden">
                            <SystemDiagnostics businessId={diagnosticsBusiness.id} />
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminPortal;
