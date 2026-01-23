import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Utensils,
    Package,
    CheckSquare,
    Sparkles,
    LogOut,
    Activity,
    Users
} from 'lucide-react';

const ManagerHeader = ({ activeTab, onTabChange, currentUser, isImpersonating, onLogout }) => {
    const navigate = useNavigate();

    const navItems = [
        { id: 'sales', label: 'מכירות', icon: <LayoutDashboard size={18} />, path: '/data-manager-interface' },
        { id: 'menu', label: 'תפריט', icon: <Utensils size={18} />, path: '/data-manager-interface' },
        { id: 'inventory', label: 'מלאי', icon: <Package size={18} />, path: '/data-manager-interface' },
        { id: 'tasks', label: 'משימות', icon: <CheckSquare size={18} />, path: '/data-manager-interface' },
        { id: 'employees', label: 'עובדים', icon: <Users size={18} />, path: '/data-manager-interface' }
    ];



    const handleNavClick = (item) => {
        if (item.id === activeTab && window.location.pathname === item.path) return;

        if (onTabChange && item.path === '/data-manager-interface') {
            // If we are already on the manager dashboard, just change the tab
            if (window.location.pathname === '/data-manager-interface') {
                onTabChange(item.id);
            } else {
                // Navigate with state to set the initial tab
                navigate(item.path, { state: { initialTab: item.id } });
            }
        } else {
            navigate(item.path);
        }
    };

    return (
        <header className="bg-slate-900 border-b border-slate-800 shrink-0 z-20 relative px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between">

                {/* Action Side (Logout) */}
                <div className="flex items-center w-12 lg:w-32">
                    <button
                        onClick={onLogout}
                        className="group flex items-center justify-center w-10 h-10 rounded-xl transition-all bg-slate-800/50 hover:bg-red-500/20 border border-slate-700/50 hover:border-red-500/50 text-slate-400 hover:text-red-500 shadow-sm"
                        aria-label={isImpersonating ? 'חזור לסופר אדמין' : 'התנתק מהמערכת'}
                    >
                        {isImpersonating ? <Reply size={20} className="transition-transform group-hover:-translate-x-1" /> : <LogOut size={18} />}
                    </button>
                </div>

                {/* Navigation - Unified Equal Spacing - No Scroll */}
                <div className="flex-1 relative flex justify-center px-1">
                    <nav className="w-full max-w-lg">
                        <div className="flex items-center bg-slate-800/30 p-1 rounded-xl border border-slate-700/30 shadow-inner gap-1">
                            {navItems.filter(item => {
                                // Default allowed/base features
                                if (['sales', 'menu'].includes(item.id)) return true;

                                // Restricted features - only for Owner or Admin
                                const role = (currentUser?.role || '').toLowerCase();
                                const access = (currentUser?.access_level || '').toLowerCase();
                                const isPrivileged = role === 'owner' || role === 'admin' || access === 'owner' || access === 'admin' || currentUser?.is_admin;

                                return isPrivileged;
                            }).map((item) => {
                                const isActive = activeTab === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavClick(item)}
                                        className={`
                                            relative flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all duration-300 gap-1 overflow-hidden active:scale-95
                                            ${isActive
                                                ? 'bg-white text-slate-900 shadow-md'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                                            }
                                        `}
                                    >
                                        <div className={`z-10 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                                            {item.icon}
                                        </div>

                                        <span className={`z-10 text-[9px] sm:text-[10px] font-black leading-none tracking-tight`}>
                                            {item.label}
                                        </span>

                                        {/* Active Indicator */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="tab-active"
                                                className="absolute bottom-0.5 w-1 h-1 bg-indigo-500 rounded-full"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>
                </div>

                {/* User Side Placeholder / Business Info */}
                <div className="hidden lg:flex items-center justify-end w-48 gap-3 text-left">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1 text-right">
                            {isImpersonating ? (
                                <span className="text-blue-500">Super Admin Mode</span>
                            ) : (
                                'מנהל מערכת'
                            )}
                        </span>
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-slate-300 font-black truncate max-w-[150px] leading-none text-right">
                                {isImpersonating && currentUser?.impersonating_business_name ? (
                                    <>
                                        <span className="opacity-60 text-[10px] block mb-0.5">מנהל את:</span>
                                        <span className="text-white">{currentUser.impersonating_business_name}</span>
                                    </>
                                ) : (
                                    currentUser?.name || 'משתמש'
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default ManagerHeader;
