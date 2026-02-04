import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, Database } from 'lucide-react';
import db from '@/db/database';
import { initialLoad } from '@/services/syncService';
import { useAuth } from '@/context/AuthContext';

/**
 * SyncStatusModal - Auto-detects missing data and syncs from Supabase
 * Shows friendly progress to staff with smooth animations
 */
const SyncStatusModal = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    const [showModal, setShowModal] = useState(false);
    const [showingPrompt, setShowingPrompt] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState({});
    const [complete, setComplete] = useState(false);
    const [error, setError] = useState(null);
    const [overallProgress, setOverallProgress] = useState(0);
    const [currentTable, setCurrentTable] = useState('');

    // Check if data exists on mount
    useEffect(() => {
        const checkData = async () => {
            const isModeSelection = location.pathname === '/mode-selection';

            console.log('🔍 [SyncModal] Checking data...', {
                hasBusinessId: !!currentUser?.business_id,
                path: location.pathname,
                isModeSelection
            });

            if (!currentUser?.business_id) {
                console.log('⏸️ [SyncModal] No business_id yet, waiting...');
                return;
            }

            // USER REQUEST: Check on Mode Selection OR KDS
            const isKDS = location.pathname === '/kds';
            if (!isModeSelection && !isKDS) {
                return;
            }

            // Don't check if we are already syncing
            if (syncing || complete) return;

            try {
                // NEW: Skip local backend checks if we are NOT on a local dev machine
                // This avoids 404/500 errors on Vercel
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (!isLocal) {
                    // console.log('☁️ [SyncStatusModal] On cloud/production, skipping local backend check');
                    return;
                }

                // NEW: Check Local Supabase (Docker) state via Backend
                const response = await fetch('/api/sync/wellness');
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Wellness check failed');
                }

                const wellness = await response.json();
                const menuCount = wellness.counts?.menu_items || 0;
                const ingredientsCount = wellness.counts?.ingredients || 0;
                const lastSyncTime = wellness.lastSync;

                // CHECK 1: Is the sync record itself old?
                let localBackendOutdated = false;
                if (lastSyncTime) {
                    const lastSyncDate = new Date(lastSyncTime);
                    const hoursSinceSync = (new Date() - lastSyncDate) / (1000 * 60 * 60);
                    if (hoursSinceSync > 24) {
                        localBackendOutdated = true;
                    }
                }

                // CRITICAL CHECKS
                const isUnhealthy = wellness.healthy === false;
                const noOrders = wellness.counts?.orders === 0;

                // Check if latest order is too old (e.g. more than 3 hours ago during working hours)
                let ordersStale = false;
                if (wellness.latestOrderTime) {
                    const latestOrderDate = new Date(wellness.latestOrderTime);
                    const minutesSinceLastOrder = (new Date() - latestOrderDate) / (1000 * 60);
                    if (minutesSinceLastOrder > 180) { // 3 hours
                        ordersStale = true;
                    }
                }

                // NEW: Check for stale active orders (orders stuck in active states for too long)
                const staleActiveCount = wellness.counts?.stale_active_orders || 0;
                const hasStaleOrders = staleActiveCount > 10;

                console.log('📊 [SyncModal] Local Supabase (Docker) Check:', {
                    menuCount,
                    ingredientsCount,
                    isUnhealthy,
                    noOrders,
                    ordersStale,
                    staleActiveCount,
                    hasStaleOrders,
                    latestOrderTime: wellness.latestOrderTime
                });

                // If Local Supabase is empty or outdated OR has stale ACTIVE orders, trigger sync
                // REMOVED ordersStale (3 hour check) to prevent nagging on morning shifts
                if (isUnhealthy || noOrders || localBackendOutdated || hasStaleOrders) {
                    if (hasStaleOrders) {
                        console.warn(`⚠️ [SyncModal] Detected ${staleActiveCount} stale active orders - forcing full sync`);
                    }

                    // Only use sessionStorage to silence it if it's JUST 'stale'
                    // If NO ORDERS or STALE ORDERS, it's a critical failure - NEVER silence.
                    if (!noOrders && !isUnhealthy && !hasStaleOrders) {
                        const sessionPrompted = sessionStorage.getItem(`sync_prompted_${currentUser.business_id}`);
                        if (sessionPrompted) return;
                        sessionStorage.setItem(`sync_prompted_${currentUser.business_id}`, 'true');
                    }

                    setShowingPrompt(true);
                    setShowModal(true);
                }
            } catch (err) {
                console.warn('Failed to check Local Supabase wellness:', err);
            }
        };

        const checkDataWithWait = () => setTimeout(checkData, 2000);
        checkDataWithWait();

        // Listen for manual open requests
        const handleOpenEvent = () => {
            console.log('📢 [SyncModal] Manual open triggered via event');
            setShowingPrompt(true);
            setShowModal(true);
        };
        window.addEventListener('open-sync-modal', handleOpenEvent);

        return () => {
            window.removeEventListener('open-sync-modal', handleOpenEvent);
        };
    }, [currentUser?.business_id, location.pathname]);

    const performSync = async (clearLocal = false) => {
        if (!currentUser?.business_id) return;

        setShowingPrompt(false);
        setSyncing(true);
        setError(null);
        setComplete(false);
        setProgress({});
        setOverallProgress(0);
        setCurrentTable('מתחבר לשרת...');

        try {
            // STEP 1: Sync Local Postgres via Backend (Docker)
            // This ensures the local database is up to date first
            try {
                setCurrentTable(clearLocal ? 'מנקה ומסנכרן בסיס נתונים מקומי...' : 'מסנכרן בסיס נתונים מקומי (Docker)...');
                const backendResp = await fetch('/api/sync-cloud-to-local', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessId: currentUser.business_id,
                        clearLocal: clearLocal
                    })
                });

                if (backendResp.ok) {
                    // Start polling for backend sync progress
                    let backendDone = false;
                    while (!backendDone) {
                        const statusResp = await fetch('/api/sync/status');
                        const status = await statusResp.json();

                        if (status.error) throw new Error(status.error);

                        if (!status.inProgress) {
                            backendDone = true;
                            setOverallProgress(50);
                        } else {
                            setCurrentTable(`Docker: ${status.currentTable} (${status.progress}%)`);
                            setOverallProgress(status.progress * 0.5); // Docker phase is 0-50%
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }

                    // NEW: If we cleared local, we MUST also clear Dexie to ensure browser is in sync
                    if (clearLocal) {
                        console.log('🧹 [SyncStatusModal] Full clear requested - cleaning all layers...');

                        // Step 1: Tell backend to archive stale orders BEFORE syncing
                        try {
                            const archiveResp = await fetch('/api/orders/archive-stale', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    businessId: currentUser.business_id,
                                    olderThanHours: 12,
                                    fromStatuses: ['new', 'in_progress', 'ready', 'held', 'pending']
                                })
                            });

                            if (archiveResp.ok) {
                                const result = await archiveResp.json();
                                console.log(`✅ [SyncModal] Archived ${result.archivedCount} stale orders`);
                            }
                        } catch (archiveErr) {
                            console.warn('⚠️ [SyncModal] Archive stale orders failed:', archiveErr);
                        }

                        // Step 2: Clear Dexie completely
                        console.log('🧹 Clearing browser cache (Dexie) for orders...');
                        await db.orders.clear();
                        await db.order_items.clear();

                        // Step 3: Clear all sync metadata
                        localStorage.removeItem('last_full_sync');
                        localStorage.removeItem('last_orders_sync');
                        localStorage.removeItem('kds_orders_cache');
                        localStorage.removeItem('last_sync_time');

                        // Step 4: Force metadata reset on backend
                        await fetch('/api/sync/reset-metadata', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ businessId: currentUser.business_id })
                        });
                    }
                }
            } catch (backendErr) {
                console.warn('Backend sync failed/not available, falling back to direct Dexie sync:', backendErr);
            }

            // STEP 2: Sync Dexie (Browser Storage)
            setOverallProgress(50);

            // Call initialLoad with progress callback
            // Dexie phase is the second 50% (50% to 100%)
            const result = await initialLoad(currentUser.business_id, (tableName, count, dexieProgress, message) => {
                setCurrentTable(tableName);
                setProgress(prev => ({
                    ...prev,
                    [tableName]: count
                }));
                // Set the overall progress: 50% (Docker) + up to 50% (Dexie)
                setOverallProgress(50 + (dexieProgress * 0.5));
            });

            if (result.success) {
                setComplete(true);
                setCurrentTable('');
                setOverallProgress(100);
                // Auto-close after 3 seconds
                setTimeout(() => {
                    setShowModal(false);
                }, 3000);
            } else {
                setError(result.reason || 'שגיאה בסנכרון');
            }
        } catch (err) {
            console.error('Sync failed:', err);
            setError(err.message);
        } finally {
            setSyncing(false);
        }
    };

    if (!showModal) return null;

    const totalRecords = Object.values(progress).reduce((sum, count) => sum + count, 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-100"
                >
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <motion.div
                            className={`w-16 h-16 bg-gradient-to-br ${showingPrompt ? 'from-orange-500 to-orange-600' : 'from-blue-500 to-blue-600'} rounded-2xl flex items-center justify-center shadow-lg`}
                            animate={syncing ? { rotate: 360 } : {}}
                            transition={{ duration: 2, repeat: syncing ? Infinity : 0, ease: "linear" }}
                        >
                            {complete ? (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.2 }}
                                >
                                    <CheckCircle size={32} className="text-white" />
                                </motion.div>
                            ) : showingPrompt ? (
                                <Database size={32} className="text-white animate-pulse" />
                            ) : (
                                <Database size={32} className="text-white" />
                            )}
                        </motion.div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">
                                {showingPrompt ? 'נדרש סנכרון נתונים' : complete ? 'סנכרון הושלם!' : 'טוען נתונים...'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {showingPrompt ? 'הסופבייס המקומי ריק או לא מעודכן' : complete ? 'המערכת מוכנה לעבודה' : 'מכין את המערכת לעבודה אופליין'}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {syncing && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">התקדמות</span>
                                <span className="text-sm font-bold text-blue-600">{Math.round(overallProgress)}%</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${overallProgress}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>

                            {/* Current loading text */}
                            <div className="mt-3 min-h-[20px]">
                                <AnimatePresence mode="wait">
                                    {currentTable && (
                                        <motion.p
                                            key={currentTable}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            transition={{ duration: 0.3 }}
                                            className="text-sm text-gray-600 text-center"
                                        >
                                            טוען {getTableDisplayName(currentTable)}...
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>

                            <p className="text-xs text-gray-500 mt-2 text-center">
                                {totalRecords} רשומות סונכרנו עד כה
                            </p>
                        </div>
                    )}

                    {/* Latest synced tables (show last 3) */}
                    {syncing && Object.keys(progress).length > 0 && (
                        <div className="space-y-2 mb-6 max-h-32 overflow-hidden">
                            {Object.entries(progress).slice(-3).map(([table, count], index) => (
                                <motion.div
                                    key={table}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-100"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={16} className="text-green-500" />
                                        <span className="text-sm font-medium text-gray-700">
                                            {getTableDisplayName(table)}
                                        </span>
                                    </div>
                                    <motion.span
                                        className="text-sm font-bold text-blue-600"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring" }}
                                    >
                                        {count}
                                    </motion.span>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Success Summary */}
                    {complete && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 mb-4"
                        >
                            <div className="flex items-start gap-3">
                                <CheckCircle size={20} className="text-green-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-bold text-green-800 mb-2">הנתונים נטענו בהצלחה!</p>
                                    <p className="text-sm text-green-700 mb-3">
                                        סה"כ {totalRecords} רשומות מ-{Object.keys(progress).length} טבלאות
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                                        {Object.entries(progress).slice(0, 6).map(([table, count]) => (
                                            <div key={table} className="flex justify-between bg-white/50 rounded px-2 py-1">
                                                <span>{getTableDisplayName(table)}</span>
                                                <span className="font-bold">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"
                        >
                            <p className="text-red-800 text-sm mb-3">{error}</p>
                            <button
                                onClick={performSync}
                                className="w-full bg-red-600 text-white py-2 rounded-xl hover:bg-red-700 transition font-medium"
                            >
                                נסה שוב
                            </button>
                        </motion.div>
                    )}

                    {/* Prompt Content */}
                    {showingPrompt && (
                        <div className="py-4">
                            <p className="text-gray-700 mb-6 leading-relaxed">
                                נראה שחסרים נתונים בבסיס הנתונים המקומי (Docker).
                                כדי לעבוד בצורה תקינה גם ללא אינטרנט, עלינו לסנכרן את המידע מהענן למחשב עכשיו.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => performSync(false)}
                                    className="w-full bg-blue-600 text-white py-4 rounded-2xl hover:bg-blue-700 transition-all font-bold text-lg shadow-blue-200 shadow-lg active:scale-[0.98]"
                                >
                                    סנכרן עכשיו מהענן
                                </button>
                                <button
                                    onClick={() => performSync(true)}
                                    className="w-full bg-orange-500 text-white py-3 rounded-2xl hover:bg-orange-600 transition font-bold text-sm shadow-orange-100 shadow-md border border-orange-400"
                                >
                                    ניקוי וסנכרון מלא (מומלץ לתיקון כפילויות)
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl hover:bg-gray-200 transition font-medium text-sm"
                                >
                                    דלג (לא מומלץ)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading indicator */}
                    {syncing && Object.keys(progress).length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 size={48} className="text-blue-500 animate-spin" />
                            <p className="text-gray-500">יוצר חיבור מאובטח ומייבא נתונים...</p>
                        </div>
                    )}

                    {/* Auto-close message */}
                    {complete && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-center text-xs text-gray-400"
                        >
                            החלון ייסגר אוטומטית בעוד 3 שניות...
                        </motion.p>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// Helper to translate table names to Hebrew
const getTableDisplayName = (tableName) => {
    const names = {
        menu_items: 'מנות',
        optiongroups: 'קבוצות תוספות',
        optionvalues: 'תוספות',
        menuitemoptions: 'קישורים',
        customers: 'לקוחות',
        employees: 'עובדים',
        discounts: 'הנחות',
        ingredients: 'מרכיבים',
        orders: 'הזמנות',
        order_items: 'פריטים'
    };
    return names[tableName] || tableName;
};

export default SyncStatusModal;
