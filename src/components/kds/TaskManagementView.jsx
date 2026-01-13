import React, { useState, useEffect } from 'react';
import { ArrowRight, Clock, Check, ChevronRight, AlertCircle, Info, Image, PlayCircle, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isCategoryMatch, TASK_CATEGORIES } from '@/config/taskCategories';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1]
        }
    },
    exit: {
        opacity: 0,
        y: -15,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
    }
};

const detailVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: {
        x: 0,
        opacity: 1,
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    exit: {
        x: '100%',
        opacity: 0,
        transition: { duration: 0.3 }
    }
};

const TaskManagementView = ({ tasks, onComplete, title, tabType }) => {
    const [selectedTask, setSelectedTask] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Separate pre-closing from regular closing tasks
    const preClosingTasks = tasks.filter(t => t.is_pre_closing);
    const regularTasks = tasks.filter(t => !t.is_pre_closing);

    // Auto-deselect if task was completed
    useEffect(() => {
        if (selectedTask && !tasks.find(t => t.id === selectedTask.id)) {
            setSelectedTask(null);
            setShowDetails(false);
        }
    }, [tasks, selectedTask]);

    const handleSelectTask = (task) => {
        setSelectedTask(task);
        if (isMobile) {
            setShowDetails(true);
        }
    };

    // Memoized TaskCard for performance (Maya's suggestion)
    const TaskCard = React.memo(({ task }) => {
        const isSelected = selectedTask?.id === task.id;

        return (
            <motion.div
                variants={itemVariants}
                layout
                transition={{
                    layout: { type: "tween", duration: 0.8, ease: [0.22, 1, 0.36, 1] }
                }}
                onClick={() => handleSelectTask(task)}
                className={`flex items-center gap-4 p-4 rounded-3xl border-2 cursor-pointer active:scale-[0.98]
                    ${isSelected
                        ? 'bg-white border-blue-500 shadow-[0_10px_30px_rgba(59,130,246,0.12)] z-10'
                        : 'bg-white/60 border-transparent hover:border-slate-200 hover:bg-white'
                    }`}
            >
                {/* Complete Button */}
                <div className="relative w-14 h-14 shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onComplete(task);
                        }}
                        className={`w-full h-full flex items-center justify-center rounded-2xl transition-all duration-300
                            ${tabType === 'opening' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' :
                                tabType === 'prep' ? 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white' :
                                    'bg-purple-50 text-purple-600 hover:bg-purple-500 hover:text-white'}
                            group shadow-sm hover:shadow-md active:scale-90`}
                    >
                        <Check size={26} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className={`font-black truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {task.name}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium">
                        {task.due_time || (isCategoryMatch(TASK_CATEGORIES.OPENING.id, task.category) ? 'פתיחה' : 'יומי')}
                    </p>
                </div>

                <ChevronRight className={`shrink-0 transition-transform ${isSelected ? 'text-blue-500 translate-x-1' : 'text-slate-300'}`} size={20} />
            </motion.div>
        );
    });
    TaskCard.displayName = 'TaskCard';

    return (
        <div className="flex h-full w-full overflow-hidden bg-transparent">
            {/* Right Side: Task List (Desktop 2/3, Mobile full) */}
            <motion.div
                className="flex-1 h-full flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar shadow-inner"
                initial={{ opacity: 0, scale: 1 }}
                animate={{
                    opacity: selectedTask && isMobile && showDetails ? 0 : 1,
                    scale: selectedTask && isMobile && showDetails ? 0.96 : 1,
                    pointerEvents: selectedTask && isMobile && showDetails ? 'none' : 'auto'
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <header className="mb-8 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            {title}
                            <span className="text-xl text-slate-300 font-bold bg-slate-100 px-3 py-1 rounded-2xl">
                                {tasks.length}
                            </span>
                        </h2>
                    </div>
                    <div className="h-1 w-20 bg-slate-200 rounded-full" />
                </header>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-4"
                >
                    {/* Pre-Closing Section */}
                    {preClosingTasks.length > 0 && (
                        <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                                <span>ניתן להתחיל עכשיו</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence initial={false}>
                                    {preClosingTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {/* Regular Tasks Section */}
                    {regularTasks.length > 0 && (
                        <section className={preClosingTasks.length > 0 ? "mt-4" : ""}>
                            {preClosingTasks.length > 0 && (
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3">
                                    <span>משימות סיום</span>
                                    <div className="flex-1 h-px bg-slate-200" />
                                </h3>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence initial={false}>
                                    {regularTasks.map(task => <TaskCard key={task.id} task={task} />)}
                                </AnimatePresence>
                            </div>
                        </section>
                    )}

                    {tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-400">
                                <Check size={48} />
                            </div>
                            <p className="text-xl font-black text-slate-400 italic">הכל מוכן! עבודה מצוינת.</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Left Side: Task Detail (Desktop 1/3, Mobile Overlay) */}
            <AnimatePresence>
                {(selectedTask && (!isMobile || showDetails)) && (
                    <motion.div
                        variants={detailVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`w-full md:w-[450px] bg-white border-r border-slate-200 flex flex-col shadow-2xl z-50 overflow-hidden
                            ${isMobile ? 'fixed inset-0' : 'relative h-full'}`}
                    >
                        {/* Detail Header */}
                        <div className="p-6 md:p-8 shrink-0 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">
                                    פרטי משימה
                                </h3>
                                <div className="h-1 w-12 bg-blue-500 rounded-full" />
                            </div>
                            <button
                                onClick={() => {
                                    setShowDetails(false);
                                    setSelectedTask(null);
                                }}
                                className="p-3 bg-slate-100 rounded-2xl text-slate-500 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <ArrowRight size={20} />
                                <span className="font-black text-sm">חזרה</span>
                            </button>
                        </div>

                        {/* Detail Scrollable Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
                            <div className="bg-slate-50/50 rounded-[2.5rem] p-8 md:p-10 border border-slate-100 mb-8 overflow-hidden relative group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

                                <h4 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">
                                    {selectedTask.name}
                                </h4>

                                <div className="flex flex-wrap gap-3 mb-8">
                                    <div className="px-4 py-2 bg-blue-100/50 text-blue-700 rounded-xl text-xs font-black flex items-center gap-2">
                                        <Clock size={14} />
                                        ביצוע יומי
                                    </div>
                                    <div className="px-4 py-2 bg-emerald-100/50 text-emerald-700 rounded-xl text-xs font-black flex items-center gap-2">
                                        <Info size={14} />
                                        מספר # {selectedTask.id}
                                    </div>
                                </div>

                                <p className="text-lg text-slate-500 font-medium leading-relaxed">
                                    {selectedTask.description || 'אין תיאור מפורט למשימה זו.'}
                                </p>
                            </div>

                            {/* Media Placeholder */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="aspect-square bg-slate-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer border-2 border-dashed border-slate-200">
                                    <Image size={32} strokeWidth={1.5} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">תמונה</span>
                                </div>
                                <div className="aspect-square bg-slate-100 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer border-2 border-dashed border-slate-200">
                                    <PlayCircle size={32} strokeWidth={1.5} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">וידאו</span>
                                </div>
                            </div>
                        </div>

                        {/* Complete Action Footer */}
                        <div className="p-6 md:p-8 bg-white border-t border-slate-100 sticky bottom-0">
                            <button
                                onClick={() => onComplete(selectedTask)}
                                className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95
                                    ${tabType === 'opening' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200' :
                                        tabType === 'prep' ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200' :
                                            'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-200'}`}
                            >
                                <Check size={28} strokeWidth={4} />
                                סיימתי את המשימה
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskManagementView;
