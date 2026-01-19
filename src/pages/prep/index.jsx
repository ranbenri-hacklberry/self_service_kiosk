import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { House, RotateCcw, List, CheckCircle, Sunrise, Sunset, Utensils, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import TaskManagementView from '../../components/kds/TaskManagementView';
import ConnectionStatusBar from '../../components/ConnectionStatusBar';
import MiniMusicPlayer from '../../components/music/MiniMusicPlayer';
import { isCategoryMatch, getCategoryAliases, TASK_CATEGORIES } from '../../config/taskCategories';

const PrepPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // State
    const [tasksSubTab, setTasksSubTab] = useState('prep'); // 'opening' | 'prep' | 'closing'
    const [openingTasks, setOpeningTasks] = useState([]);
    const [prepBatches, setPrepBatches] = useState([]);
    const [closingTasks, setClosingTasks] = useState([]);
    const [supplierTasks, setSupplierTasks] = useState([]); // New: Inventory counting tasks
    const [currentHour, setCurrentHour] = useState(new Date().getHours());
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Monitor screen size
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [error, setError] = useState(null);

    const handleExit = () => {
        navigate('/mode-selection');
    };

    // --- Task Fetching Logic ---
    const fetchTasksByCategory = useCallback(async (tabId, targetSetter) => {
        try {
            const todayIdx = new Date().getDay();
            const dateStr = new Date().toISOString().split('T')[0];
            const aliases = getCategoryAliases(tabId);

            if (!currentUser?.business_id) {
                console.warn('PrepPage: No business_id found for current user');
                return;
            }

            const { data: rawTasks, error } = await supabase
                .from('recurring_tasks')
                .select('*')
                .eq('business_id', currentUser.business_id)
                .eq('is_active', true);

            if (error) throw error;

            const allTasks = (rawTasks || []).filter(t => aliases.includes((t.category || '').toLowerCase()));

            const scheduled = (allTasks || []).filter(t => {
                const schedule = t.weekly_schedule || {};
                if (schedule && Object.keys(schedule).length > 0) {
                    const config = schedule[todayIdx];
                    // Show if specifically scheduled for today with qty > 0
                    return config && config.qty > 0;
                }

                // Fallback A: If explicitly assigned to a day of week
                if (t.day_of_week !== null && t.day_of_week !== undefined) {
                    return t.day_of_week === todayIdx;
                }

                // Fallback B: If schedule is missing or empty, assume it's a daily task
                return true;
            });

            const { data: logs } = await supabase
                .from('task_completions')
                .select('recurring_task_id')
                .eq('completion_date', dateStr);

            const completedSet = new Set(logs?.map(l => l.recurring_task_id));

            const final = scheduled
                .filter(t => !completedSet.has(t.id))
                .map(t => {
                    const config = (t.weekly_schedule || {})[todayIdx] || {};
                    return {
                        id: t.id,
                        name: t.name,
                        description: t.description || t.menu_item?.description,
                        image_url: t.image_url || t.menu_item?.image_url,
                        target_qty: config.qty || t.quantity,
                        logic_type: config.mode || t.logic_type || 'fixed',
                        category: t.category,
                        due_time: t.due_time || (t.category === 'opening' || t.category === 'פתיחה' ? '08:00' : null),
                        is_recurring: true,
                        is_completed: false,
                        is_pre_closing: t.is_pre_closing === true
                    };
                });

            targetSetter(final);
        } catch (err) {
            console.error(`Error fetching tasks:`, err);
            setError("שגיאה בטעינת המשימות. אנא רענן את העמוד.");
            setTimeout(() => setError(null), 5000);
        }
    }, [currentUser?.business_id]);

    const fetchSupplierTasks = useCallback(async () => {
        if (!currentUser?.business_id) return;
        try {
            const today = new Date();
            // Map JS Day (0=Sun, 6=Sat) to User Day (1=Sun, 7=Sat) for TOMORROW
            // Formula: ((today.getDay() + 1) % 7) + 1
            const tomorrowIdx = ((today.getDay() + 1) % 7) + 1;
            const dateStr = today.toISOString().split('T')[0];

            // 1. Fetch suppliers with delivery tomorrow
            const { data: suppliers } = await supabase
                .from('suppliers')
                .select('*')
                .eq('business_id', currentUser.business_id);

            console.log(`🔍 Total suppliers for business: ${suppliers?.length || 0}`);

            const relevantSuppliers = (suppliers || []).filter(s => {
                if (!s.delivery_days) return false;

                let days = [];
                if (Array.isArray(s.delivery_days)) {
                    days = s.delivery_days;
                } else if (typeof s.delivery_days === 'string') {
                    try {
                        // Try JSON first
                        const parsed = JSON.parse(s.delivery_days);
                        days = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        // Fallback to comma-separated
                        days = s.delivery_days.split(',').map(d => d.trim());
                    }
                }

                // Ensure we compare numbers to numbers
                const isMatch = days.map(d => Number(d)).includes(tomorrowIdx);
                if (isMatch) console.log(`🎯 Match found for supplier: ${s.name} (tomorrowIdx: ${tomorrowIdx})`);
                return isMatch;
            });

            console.log(`📦 Relevant suppliers for tomorrow's delivery: ${relevantSuppliers.map(s => s.name).join(', ')}`);

            // 2. Check completions (Virtual tasks are stored in the 'notes' column because recurring_task_id is an integer)
            const { data: logs } = await supabase
                .from('task_completions')
                .select('notes')
                .eq('completion_date', dateStr)
                .like('notes', 'inv-count-%');

            const completedSet = new Set(logs?.map(l => l.notes));

            // 3. Generate virtual tasks
            const virtualTasks = relevantSuppliers
                .map(s => ({
                    id: `inv-count-${s.id}`,
                    supplier_id: s.id,
                    name: `ספירת מלאי: ${s.name}`,
                    description: `הספק מגיע מחר. יש לבצע ספירת מלאי כדי לוודא שכל החוסרים הוזמנו.`,
                    image_url: null,
                    target_qty: 1,
                    unit: 'שגרה',
                    logic_type: 'fixed',
                    category: 'prep',
                    is_recurring: true,
                    is_completed: false,
                    is_supplier_task: true
                }))
                .filter(t => !completedSet.has(t.id));

            console.log(`✅ Filtered virtual tasks: ${virtualTasks.length}`);

            setSupplierTasks(virtualTasks);
        } catch (err) {
            console.error('Error fetching supplier tasks:', err);
        }
    }, [currentUser?.business_id]);

    const fetchAllTasks = useCallback(async () => {
        if (!currentUser?.business_id) return;

        // Fetch standard tasks
        await fetchTasksByCategory(TASK_CATEGORIES.OPENING.id, setOpeningTasks);
        await fetchTasksByCategory(TASK_CATEGORIES.PREP.id, setPrepBatches);
        await fetchTasksByCategory(TASK_CATEGORIES.CLOSING.id, setClosingTasks);

        // Fetch supplier related tasks
        await fetchSupplierTasks();
    }, [fetchTasksByCategory, fetchSupplierTasks, currentUser?.business_id]);

    const skipRealtimeRef = React.useRef(false);

    // Initial Fetch & Auto-Switch
    useEffect(() => {
        fetchAllTasks();

        const isClosingPhase = currentHour >= 12;
        const isPrepPhase = currentHour >= 5 && currentHour < 12;

        let initialTab = 'prep';
        if (isClosingPhase) initialTab = 'closing';
        else if (!isPrepPhase) initialTab = 'opening';

        // Auto-switch to first tab with tasks on mount
        setTasksSubTab(initialTab);

        // Realtime Subscription
        const channel = supabase
            .channel('prep-tasks-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task_completions' },
                () => {
                    if (!skipRealtimeRef.current) {
                        fetchAllTasks();
                    }
                }
            )
            .subscribe();

        const tasksDefinitionChannel = supabase
            .channel('prep-tasks-definitions')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'recurring_tasks' },
                () => fetchAllTasks()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(tasksDefinitionChannel);
        };
    }, [fetchAllTasks, currentHour]);

    const handleCompleteTask = async (task) => {
        skipRealtimeRef.current = true;
        setTimeout(() => { skipRealtimeRef.current = false; }, 2000);

        // Optimistic Update with centralized category check
        const isOpening = isCategoryMatch(TASK_CATEGORIES.OPENING.id, task.category);
        const isPrep = isCategoryMatch(TASK_CATEGORIES.PREP.id, task.category);
        const isClosing = isCategoryMatch(TASK_CATEGORIES.CLOSING.id, task.category);

        if (isOpening) setOpeningTasks(p => p.filter(t => t.id !== task.id));
        if (isPrep || task.is_supplier_task) {
            setPrepBatches(p => p.filter(t => t.id !== task.id));
            if (task.is_supplier_task) {
                setSupplierTasks(p => p.filter(t => t.id !== task.id));
            }
        }
        if (isClosing) setClosingTasks(p => p.filter(t => t.id !== task.id));

        try {
            if (task.id) {
                // If it's a supplier task, store ID in 'notes' (string) and leave recurring_task_id (int) as null
                await supabase.from('task_completions').insert({
                    recurring_task_id: task.is_supplier_task ? null : task.id,
                    business_id: currentUser?.business_id,
                    quantity_produced: task.target_qty || 1,
                    completion_date: new Date().toISOString().split('T')[0],
                    completed_by: currentUser?.id,
                    notes: task.is_supplier_task ? task.id : null
                });
            }
        } catch (e) {
            console.error("Task completion failed:", e);
            setError("שגיאה בסימון המשימה. אנא נסה שוב.");
            setTimeout(() => setError(null), 3000);
            fetchAllTasks(); // Rollback
        }
    };

    const getActiveTasks = () => {
        const morningPrepSelector = (t) =>
            (t.due_time && t.due_time < '10:00') ||
            (t.category || '').includes('בוקר') ||
            (t.name || '').includes('פתיחה') ||
            (t.category || '').includes('פתיחה');

        if (tasksSubTab === 'opening') {
            const morningPrepFromBatches = prepBatches.filter(morningPrepSelector);
            return [...openingTasks, ...morningPrepFromBatches];
        } else if (tasksSubTab === 'prep') {
            const actualPrepBatches = prepBatches.filter(t => !morningPrepSelector(t));
            return [...actualPrepBatches, ...supplierTasks];
        } else {
            return [...closingTasks];
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-[#F8FAFC] overflow-hidden font-heebo" dir="rtl">
            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-8 py-4 rounded-3xl shadow-2xl font-black flex items-center gap-3 border-2 border-white/20 backdrop-blur-md"
                    >
                        <span className="text-2xl">⚠️</span> {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Header */}
            <div className="bg-white/80 backdrop-blur-xl shrink-0 h-20 flex items-center border-b border-slate-200/60 transition-all z-30 px-4 md:px-8">
                {/* Right: Exit + Tabs */}
                <div className="flex items-center gap-4 flex-1">
                    <button
                        onClick={handleExit}
                        className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all active:scale-95"
                    >
                        <House size={isMobile ? 20 : 24} />
                    </button>

                    {/* Modern Sub-tabs */}
                    <div className="flex bg-slate-100/80 p-1 rounded-[1.25rem] border border-slate-200/50">
                        <button
                            onClick={() => setTasksSubTab('opening')}
                            className={`flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-2xl text-sm font-black transition-all ${tasksSubTab === 'opening' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Sunrise size={18} />
                            <span className="hidden sm:inline">פתיחה</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${tasksSubTab === 'opening' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                {(() => {
                                    const morningPrepCount = prepBatches.filter(t =>
                                        (t.due_time && t.due_time < '10:00') ||
                                        (t.category || '').includes('בוקר') ||
                                        (t.name || '').includes('פתיחה') ||
                                        (t.category || '').includes('פתיחה')
                                    ).length;
                                    return openingTasks.length + morningPrepCount;
                                })()}
                            </span>
                        </button>
                        <button
                            onClick={() => setTasksSubTab('prep')}
                            className={`flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-2xl text-sm font-black transition-all ${tasksSubTab === 'prep' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Utensils size={18} />
                            <span className="hidden sm:inline">משימות</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${tasksSubTab === 'prep' ? 'bg-orange-50 text-orange-600' : 'bg-slate-200 text-slate-500'}`}>
                                {(() => {
                                    const morningPrepCount = prepBatches.filter(t =>
                                        (t.due_time && t.due_time < '10:00') ||
                                        (t.category || '').includes('בוקר') ||
                                        (t.name || '').includes('פתיחה') ||
                                        (t.category || '').includes('פתיחה')
                                    ).length;
                                    return (prepBatches.length - morningPrepCount) + supplierTasks.length;
                                })()}
                            </span>
                        </button>
                        <button
                            onClick={() => setTasksSubTab('closing')}
                            className={`flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-2xl text-sm font-black transition-all ${tasksSubTab === 'closing' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Sunset size={18} />
                            <span className="hidden sm:inline">סגירה</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${tasksSubTab === 'closing' ? 'bg-purple-50 text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
                                {closingTasks.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Center: Clock (Desktop only) */}
                <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                    <Clock size={16} className="text-slate-400" />
                    <span className="text-lg font-black text-slate-700 font-mono">
                        {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* Left: Music Player */}
                {!isMobile && (
                    <div className="flex items-center gap-4">
                        <MiniMusicPlayer />
                    </div>
                )}
                {/* Connection Status Bar (always visible) */}
                <div className="flex items-center gap-3 md:gap-6 justify-end">
                    <ConnectionStatusBar isIntegrated={true} />
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-hidden relative bg-white md:bg-transparent">
                <TaskManagementView
                    tasks={getActiveTasks()}
                    onComplete={handleCompleteTask}
                    title={
                        tasksSubTab === 'opening' ? 'משימות פתיחה' :
                            tasksSubTab === 'prep' ? `משימות והכנות יום - ${new Date().toLocaleDateString('he-IL')}` :
                                'משימות סגירה'
                    }
                    tabType={tasksSubTab}
                />
            </main>
        </div>
    );
};

export default PrepPage;
