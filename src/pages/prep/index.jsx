import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { House, RotateCcw, List, CheckCircle, Sunrise, Sunset, Utensils } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import TaskManagementView from '../../components/kds/TaskManagementView';
import ConnectionStatusBar from '../../components/ConnectionStatusBar';
import MiniMusicPlayer from '../../components/music/MiniMusicPlayer';

const PrepPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // State
    const [tasksSubTab, setTasksSubTab] = useState('prep'); // 'opening' | 'prep' | 'closing'
    const [openingTasks, setOpeningTasks] = useState([]);
    const [prepBatches, setPrepBatches] = useState([]);
    const [closingTasks, setClosingTasks] = useState([]);
    const [currentHour, setCurrentHour] = useState(new Date().getHours());

    const handleExit = () => {
        navigate('/mode-selection');
    };

    // --- Task Fetching Logic (Extracted from KDS) ---
    const fetchTasksByCategory = async (categories, targetSetter) => {
        try {
            const todayIdx = new Date().getDay();
            const dateStr = new Date().toISOString().split('T')[0];
            const categoryList = Array.isArray(categories) ? categories : [categories];

            const { data: rawTasks, error } = await supabase
                .from('recurring_tasks')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;

            const allTasks = (rawTasks || []).filter(t => categoryList.includes(t.category));

            const scheduled = (allTasks || []).filter(t => {
                const schedule = t.weekly_schedule || {};
                if (Object.keys(schedule).length > 0) {
                    const config = schedule[todayIdx];
                    return config && config.qty > 0;
                }
                if (t.day_of_week !== null && t.day_of_week !== undefined) {
                    return t.day_of_week === todayIdx;
                }
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
                        due_time: t.due_time || '08:00',
                        is_recurring: true,
                        // Logic for pre-closing sort
                        is_pre_closing: t.category === 'closing' && t.due_time && t.due_time < '22:00' // Simple heuristic
                    };
                });

            targetSetter(final);
        } catch (err) {
            console.error(`Error fetching tasks:`, err);
        }
    };

    // Fetchers
    const fetchOpeningTasks = () => fetchTasksByCategory(['פתיחה', 'opening'], setOpeningTasks);
    const fetchPrepBatches = () => fetchTasksByCategory(['prep', 'הכנה'], setPrepBatches);
    const fetchClosingTasks = () => fetchTasksByCategory(['סגירה', 'closing'], setClosingTasks);

    // Initial Fetch & Auto-Switch
    useEffect(() => {
        fetchOpeningTasks();
        fetchPrepBatches();
        fetchClosingTasks();

        const isClosingPhase = currentHour >= 15; // 3 PM
        const isPrepPhase = currentHour >= 11 && currentHour < 15;

        if (isClosingPhase) setTasksSubTab('closing');
        else if (!isPrepPhase) setTasksSubTab('opening');
        else setTasksSubTab('prep');

    }, []); // Run once on mount

    const handleCompleteTask = async (task) => {
        // Optimistic Update
        const cat = task.category;
        if (cat === 'opening' || cat === 'פתיחה') setOpeningTasks(p => p.filter(t => t.id !== task.id));
        if (cat === 'prep' || cat === 'הכנה') setPrepBatches(p => p.filter(t => t.id !== task.id));
        if (cat === 'closing' || cat === 'סגירה') setClosingTasks(p => p.filter(t => t.id !== task.id));

        try {
            if (task.is_recurring) {
                await supabase.from('task_completions').insert({
                    recurring_task_id: task.id,
                    business_id: currentUser?.business_id,
                    quantity_produced: task.target_qty,
                    completion_date: new Date().toISOString().split('T')[0],
                    completed_by: currentUser?.id
                });
            }
        } catch (e) {
            console.error("Task completion failed:", e);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="bg-white shadow-sm z-20 shrink-0 px-6 py-4 flex justify-between items-center border-b border-gray-200 font-heebo">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 p-1 px-2 rounded-2xl border border-slate-200">
                        <MiniMusicPlayer />
                        <ConnectionStatusBar isIntegrated={true} />
                    </div>
                    
                    <button onClick={handleExit} className="p-2 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
                        <House size={24} />
                    </button>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <List className="text-blue-600" /> משימות והכנות
                    </h1>
                </div>

                {/* Sub-tabs */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setTasksSubTab('opening')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${tasksSubTab === 'opening' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>
                        <Sunrise size={16} /> פתיחה
                        <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{openingTasks.length}</span>
                    </button>
                    <button onClick={() => setTasksSubTab('prep')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${tasksSubTab === 'prep' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>
                        <Utensils size={16} /> הכנות
                        <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{prepBatches.length}</span>
                    </button>
                    <button onClick={() => setTasksSubTab('closing')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${tasksSubTab === 'closing' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
                        <Sunset size={16} /> סגירה
                        <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{closingTasks.length}</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
                {tasksSubTab === 'opening' && <TaskManagementView tasks={openingTasks} onComplete={handleCompleteTask} title="משימות פתיחה" />}
                {tasksSubTab === 'prep' && <TaskManagementView tasks={prepBatches} onComplete={handleCompleteTask} title="באץ' הכנות" />}
                {tasksSubTab === 'closing' && <TaskManagementView tasks={closingTasks} onComplete={handleCompleteTask} title="משימות סגירה" />}
            </div>
        </div>
    );
};

export default PrepPage;
