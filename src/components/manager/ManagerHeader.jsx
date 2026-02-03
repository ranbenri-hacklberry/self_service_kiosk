import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Package,
    CheckSquare,
    Sparkles,
    LogOut,
    Users,
    RefreshCcw,
    Reply
} from 'lucide-react';
import { initialLoad } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

const ManagerHeader = ({ activeTab, onTabChange, currentUser, isImpersonating, onLogout }) => {
    const navigate = useNavigate();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const role = (currentUser?.role || '').toLowerCase();
    const access = (currentUser?.access_level || '').toLowerCase();
    const isManagerOrAbove = role === 'owner' || role === 'admin' || role === 'manager' ||
        access === 'owner' || access === 'admin' || access === 'manager' ||
        currentUser?.is_admin;

    const handleManualSync = async () => {
        if (isSyncing || !currentUser?.business_id) return;
        setIsSyncing(true);
        setSyncProgress(0);
        try {
            await initialLoad(currentUser.business_id, (table, count, progress) => {
                setSyncProgress(progress);
            });
        } catch (err) {
            console.error('Manual sync failed:', err);
        } finally {
            setIsSyncing(false);
            setSyncProgress(0);
        }
    };

    const navItems = [
        { id: 'sales', label: 'מכירות', icon: <LayoutDashboard size={18} />, path: '/data-manager-interface' },
        { id: 'inventory', label: 'מלאי', icon: <Package size={18} />, path: '/data-manager-interface' },
        { id: 'tasks', label: 'משימות', icon: <CheckSquare size={18} />, path: '/data-manager-interface' },
        { id: 'employees', label: 'עובדים', icon: <Users size={18} />, path: '/data-manager-interface' },
        ...(isManagerOrAbove ? [{ id: 'maya', label: 'מאיה', icon: <Sparkles size={18} />, path: '/maya' }] : [])
    ];

    const handleNavClick = (item) => {
        if (item.id === activeTab && window.location.pathname === item.path) return;
        if (onTabChange && item.path === '/data-manager-interface') {
            if (window.location.pathname === '/data-manager-interface') {
                onTabChange(item.id);
            } else {
                navigate(item.path, { state: { initialTab: item.id } });
            }
        } else {
            navigate(item.path);
        }
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 shrink-0 z-20 relative px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

                {/* Left Side: Logout & Sync */}
                <div className="flex items-center gap-2 w-auto lg:w-48">
                    <button
                        onClick={onLogout}
                        className="group flex items-center justify-center w-10 h-10 rounded-xl transition-all bg-slate-800/50 hover:bg-red-500/10 border border-slate-700/50 hover:border-red-500/50 text-slate-400 hover:text-red-500 shadow-sm"
                        aria-label={isImpersonating ? 'חזור לסופר אדמין' : 'התנתק מהמערכת'}
                    >
                        {isImpersonating ? <Reply size={20} className="transition-transform group-hover:-translate-x-1" /> : <LogOut size={18} />}
                    </button>

                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className={`group flex items-center justify-center h-10 px-3 rounded-xl transition-all border shadow-sm ${isSyncing ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-blue-500/10 hover:border-blue-500/50 hover:text-blue-400'}`}
                        title="סנכרן נתונים מהענן"
                    >
                        <RefreshCcw size={18} className={isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                        {!isMobile && (
                            <span className="mr-2 text-xs font-bold whitespace-nowrap">
                                {isSyncing ? `${syncProgress}%` : 'סנכרן מהענן'}
                            </span>
                        )}
                    </button>
                </div>

                {/* Center: Navigation */}
                <div className="flex-1 flex justify-center">
                    <nav className="w-full max-w-xl">
                        <div className="flex items-center bg-slate-900/50 p-1 rounded-2xl border border-slate-800 shadow-inner gap-1">
                            {navItems.map((item) => {
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavClick(item)}
                                        className={`relative flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-300 gap-1 overflow-hidden active:scale-95 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                                    >
                                        <div className={`z-10 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                                            {item.icon}
                                        </div>
                                        <span className="z-10 text-[10px] sm:text-[11px] font-black leading-none tracking-tight">
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="tab-active-glow"
                                                className="absolute inset-0 bg-gradient-to-t from-blue-400/20 to-transparent pointer-events-none"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>
                </div>

                {/* Right Side: Business Info */}
                <div className="hidden lg:flex items-center justify-end w-48 gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">
                            {isImpersonating ? 'Super Admin' : 'מנהל מערכת'}
                        </span>
                        <span className="text-xs text-slate-200 font-black truncate max-w-[150px] leading-none">
                            {isImpersonating && currentUser?.impersonating_business_name ? (
                                <span className="text-blue-400">{currentUser.impersonating_business_name}</span>
                            ) : (
                                currentUser?.name || 'משתמש'
                            )}
                        </span>
                    </div>
                </div>

            </div>
        </header>
    );
};

export default ManagerHeader;
