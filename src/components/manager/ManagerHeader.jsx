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
    Reply
} from 'lucide-react';

const ManagerHeader = ({ activeTab, onTabChange, currentUser, isImpersonating, setShowLogoutConfirm }) => {
    const navigate = useNavigate();

    const navItems = [
        { id: 'sales', label: 'מכירות', icon: <LayoutDashboard size={18} />, path: '/data-manager-interface' },
        { id: 'menu', label: 'תפריט', icon: <Utensils size={18} />, path: '/data-manager-interface' },
        { id: 'inventory', label: 'מלאי', icon: <Package size={18} />, path: '/data-manager-interface' },
        { id: 'tasks', label: 'משימות', icon: <CheckSquare size={18} />, path: '/data-manager-interface' },
        {
            id: 'maya',
            label: 'מאיה AI',
            icon: <Sparkles size={18} />,
            path: '/maya',
            isAI: true
        },
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
                        onClick={() => setShowLogoutConfirm(true)}
                        className="group flex items-center justify-center w-10 h-10 rounded-xl transition-all bg-slate-800/50 hover:bg-red-500/20 border border-slate-700/50 hover:border-red-500/50 text-slate-400 hover:text-red-500 shadow-sm"
                        aria-label={isImpersonating ? 'חזור לסופר אדמין' : 'התנתק מהמערכת'}
                    >
                        {isImpersonating ? <Reply size={20} className="transition-transform group-hover:-translate-x-1" /> : <LogOut size={18} />}
                    </button>
                </div>

                {/* Navigation - Unified Equal Spacing */}
                <nav className="flex items-center bg-slate-800/30 p-1 rounded-2xl border border-slate-700/30 shadow-inner">
                    <div className="flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = activeTab === item.id;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item)}
                                    className={`
                    relative flex flex-col items-center justify-center w-20 sm:w-24 h-12 rounded-xl transition-all duration-300 gap-1 overflow-hidden
                    ${isActive && !item.isAI
                                            ? 'bg-white text-slate-900 shadow-lg shadow-white/10 ring-1 ring-white/50'
                                            : item.isAI && isActive
                                                ? 'text-white'
                                                : item.isAI
                                                    ? 'text-slate-200 hover:text-white group'
                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                        }
                  `}
                                >
                                    {/* Premium AI Glow for Maya */}
                                    {item.isAI && (
                                        <div className={`absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-600/30 to-pink-600/30 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                    )}

                                    <div className={`
                    z-10 transition-transform duration-300
                    ${item.isAI ? 'text-purple-400 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : ''}
                    ${isActive && item.isAI ? 'scale-110 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : ''}
                    ${isActive && !item.isAI ? 'scale-110' : ''}
                  `}>
                                        {item.icon}
                                    </div>

                                    <span className={`
                    z-10 text-[10px] sm:text-xs font-bold leading-none tracking-tight
                    ${item.isAI ? 'bg-gradient-to-l from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent opacity-80 group-hover:opacity-100' : ''}
                    ${isActive && item.isAI ? 'opacity-100 font-black' : ''}
                  `}>
                                        {item.label}
                                    </span>

                                    {/* Active Indicator for non-AI */}
                                    {isActive && !item.isAI && (
                                        <motion.div
                                            layoutId="tab-active"
                                            className="absolute bottom-1 w-1.5 h-1.5 bg-indigo-500 rounded-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* User Side Placeholder / Business Info */}
                <div className="hidden lg:flex items-center justify-end w-12 lg:w-32 gap-3 text-left">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1 text-right">מנהל מערכת</span>
                        <span className="text-xs text-slate-300 font-black truncate max-w-[100px] leading-none text-right">{currentUser?.name || 'משתמש'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default ManagerHeader;
