import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, Loader2, Database } from 'lucide-react';
import db from '../db/database';
import { initialLoad } from '../services/syncService';
import { useAuth } from '../context/AuthContext';

/**
 * SyncStatusModal - Auto-detects missing data and syncs from Supabase
 * Shows friendly progress to staff with smooth animations
 */
const SyncStatusModal = () => {
    const { currentUser } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState({});
    const [complete, setComplete] = useState(false);
    const [error, setError] = useState(null);
    const [totalTables, setTotalTables] = useState(0);
    const [completedTables, setCompletedTables] = useState(0);
    const [currentTable, setCurrentTable] = useState('');

    // Check if data exists on mount
    useEffect(() => {
        const checkData = async () => {
            console.log('🔍 [SyncModal] Checking data...', { hasBusinessId: !!currentUser?.business_id });

            if (!currentUser?.business_id) {
                console.log('⏸️ [SyncModal] No business_id yet, waiting...');
                return;
            }

            try {
                // Check critical tables
                const menuCount = await db.menu_items.count();
                const groupsCount = await db.optiongroups.count();
                const valuesCount = await db.optionvalues.count();

                console.log('📊 [SyncModal] Data check:', { menuCount, groupsCount, valuesCount });

                // If any critical data is missing, trigger sync
                if (menuCount === 0 || groupsCount === 0 || valuesCount === 0) {
                    console.log('🔄 Missing local data, triggering auto-sync...');
                    setShowModal(true);
                    performSync();
                } else {
                    console.log('✅ Local data exists:', { menuCount, groupsCount, valuesCount });
                }
            } catch (err) {
                console.error('Failed to check local data:', err);
            }
        };

        checkData();
    }, [currentUser?.business_id]);

    const performSync = async () => {
        if (!currentUser?.business_id) return;

        setSyncing(true);
        setError(null);
        setProgress({});
        setCompletedTables(0);
        setCurrentTable('');

        // Estimate total tables (from SYNC_CONFIG)
        setTotalTables(12);

        try {
            // Call initialLoad with progress callback
            const result = await initialLoad(currentUser.business_id, (tableName, count) => {
                setCurrentTable(tableName);
                setProgress(prev => ({
                    ...prev,
                    [tableName]: count
                }));
                setCompletedTables(prev => prev + 1);
            });

            if (result.success) {
                setComplete(true);
                setCurrentTable('');
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

    // TEMPORARILY DISABLED to debug infinite loop
    return null;

    const progressPercentage = totalTables > 0 ? Math.round((completedTables / totalTables) * 100) : 0;
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
                            className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg"
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
                            ) : (
                                <Database size={32} className="text-white" />
                            )}
                        </motion.div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">
                                {complete ? 'סנכרון הושלם!' : 'טוען נתונים...'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {complete ? 'המערכת מוכנה לעבודה' : 'מכין את המערכת לעבודה אופליין'}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {syncing && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-600">התקדמות</span>
                                <span className="text-sm font-bold text-blue-600">{progressPercentage}%</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
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
                                {completedTables} מתוך {totalTables} טבלאות • {totalRecords} רשומות
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

                    {/* Loading indicator */}
                    {syncing && Object.keys(progress).length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 size={48} className="text-blue-500 animate-spin" />
                            <p className="text-gray-500">מתחבר לשרת...</p>
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
