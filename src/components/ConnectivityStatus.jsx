import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isLocalInstance } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * ConnectivityStatus Component
 * Displays the current business name, connection status, and last sync time.
 * Refined Layout: Status Pill and Sync Time are on the same line (Sync left of Pill).
 */
const ConnectivityStatus = ({ mode = 'fixed', className = '' }) => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const [isLocal, setIsLocal] = useState(false);
    const [lastSyncLabel, setLastSyncLabel] = useState('');

    // Hide on Manager/Admin pages (only relevant for fixed mode usually)
    // ALSO hide on pages that use UnifiedHeader (to avoid duplication)
    const isManagerPage = location.pathname.startsWith('/data-manager') ||
        location.pathname.startsWith('/super-admin') ||
        location.pathname.startsWith('/dexie-admin') ||
        location.pathname.startsWith('/prep') ||
        location.pathname.startsWith('/kds') ||
        location.pathname.startsWith('/inventory') ||
        location.pathname === '/' ||
        location.pathname.startsWith('/menu-ordering') ||
        location.pathname.startsWith('/menu-editor') ||
        location.pathname.startsWith('/ipad-menu-editor'); // Uses UnifiedHeader

    useEffect(() => {
        const checkStatus = () => {
            // Check connection mode
            const localFlag = localStorage.getItem('is_local_instance') === 'true' || isLocalInstance();
            setIsLocal(localFlag);

            // Check sync time
            const lastSync = localStorage.getItem('last_sync_time');
            if (lastSync) {
                const diffMin = Math.floor((Date.now() - parseInt(lastSync)) / 60000);
                if (diffMin < 1) setLastSyncLabel('סונכרן עכשיו');
                else if (diffMin < 60) setLastSyncLabel(`לפני ${diffMin} דק'`);
                else {
                    const date = new Date(parseInt(lastSync));
                    // Short time format
                    setLastSyncLabel(date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
                }
            } else {
                setLastSyncLabel('');
            }
        };

        checkStatus();
        window.addEventListener('storage', checkStatus);
        const interval = setInterval(checkStatus, 5000);
        return () => {
            window.removeEventListener('storage', checkStatus);
            clearInterval(interval);
        };
    }, []);

    if (mode === 'fixed' && isManagerPage) return null;

    const displayName = currentUser?.business_name || '';

    // Common Content
    const Content = () => (
        <div className={`flex flex-col items-end pointer-events-auto ${className}`}>
            {/* 1. Business Name */}
            <div className="text-sm font-black text-gray-800 leading-none mb-0.5 whitespace-nowrap drop-shadow-sm/50">
                {displayName}
            </div>

            {/* Row: Pill + Sync Time */}
            {/* In RTL: First item is Right, Second item is Left */}
            <div className="flex items-center gap-1.5">

                {/* 2. Status Pill (Right in RTL) */}
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-white/40 backdrop-blur-sm border border-black/5 shadow-sm">
                    <div className="relative flex h-1.5 w-1.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLocal ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isLocal ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                    </div>
                    <span className={`text-[9px] font-bold leading-none ${isLocal ? 'text-emerald-800' : 'text-blue-800'}`}>
                        {isLocal ? 'מקומי' : 'ענן'}
                    </span>
                </div>

                {/* 3. Last Sync Label (Left in RTL) - Extra Small */}
                {lastSyncLabel && (
                    <div className="text-[8px] text-gray-500 font-medium leading-none tracking-tight whitespace-nowrap pt-0.5">
                        {lastSyncLabel}
                    </div>
                )}
            </div>
        </div>
    );

    // INLINE MODE
    if (mode === 'inline') {
        return <Content />;
    }

    // FIXED MODE
    return (
        <div
            className="fixed top-3 z-[9999] pointer-events-none select-none flex flex-col items-end"
            style={{ left: 'calc(50% - 160px)', transform: 'translateX(-100%)' }}
            dir="rtl"
        >
            <Content />
        </div>
    );
};

export default ConnectivityStatus;
