import React, { useState, useEffect } from 'react';
import { Check, Info, AlertCircle } from 'lucide-react';

const TaskManagementView = ({ tasks, onComplete, title }) => {
    const [selectedTask, setSelectedTask] = useState(null);

    // Separate pre-closing from regular closing tasks
    const preClosingTasks = tasks.filter(t => t.is_pre_closing);
    const regularTasks = tasks.filter(t => !t.is_pre_closing);

    // Auto-deselect if task was completed
    useEffect(() => {
        if (selectedTask && !tasks.find(t => t.id === selectedTask.id)) {
            setSelectedTask(null);
        }
    }, [tasks, selectedTask]);

    const TaskRow = ({ task }) => (
        <div
            onClick={() => setSelectedTask(task)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                ${selectedTask?.id === task.id
                    ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-100'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                }`}
        >
            {/* Complete Button - Green Square with Check */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onComplete(task);
                }}
                className="w-12 h-12 shrink-0 bg-gray-100 hover:bg-green-500 text-gray-400 hover:text-white rounded-xl transition-all flex items-center justify-center active:scale-95"
            >
                <Check size={24} strokeWidth={3} />
            </button>

            {/* Task Name */}
            <span className="flex-1 font-bold text-gray-800 text-base truncate">{task.name}</span>

            {/* Quantity Badge - Only if has target_qty */}
            {task.target_qty && task.target_qty > 0 && (
                <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold">
                    {task.logic_type === 'par_level' ? `השלמה ל-${task.target_qty}` : `×${task.target_qty}`}
                </span>
            )}
        </div>
    );

    return (
        <div className="flex bg-gray-50 h-[calc(100vh-140px)] overflow-hidden rounded-2xl shadow-inner border border-gray-200">
            {/* Right Side: Task List (2/3) - RTL so it's right */}
            <div className="flex-[2] p-4 overflow-y-auto border-l border-gray-200 custom-scrollbar">
                <h2 className="text-xl font-black text-gray-800 mb-4 sticky top-0 bg-gray-50 pb-2 z-10 flex items-center gap-2">
                    {title}
                    <span className="bg-blue-100 text-blue-700 text-sm py-1 px-3 rounded-full">{tasks.length}</span>
                </h2>

                {/* Pre-Closing Tasks Section */}
                {preClosingTasks.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-orange-600 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                            אפשר להתחיל עכשיו ({preClosingTasks.length})
                        </h3>
                        <div className="space-y-2">
                            {preClosingTasks.map(task => <TaskRow key={task.id} task={task} />)}
                        </div>
                    </div>
                )}

                {/* Regular Tasks Section */}
                {regularTasks.length > 0 && (
                    <div>
                        {preClosingTasks.length > 0 && (
                            <h3 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                רק אחרי סגירה ({regularTasks.length})
                            </h3>
                        )}
                        <div className="space-y-2">
                            {regularTasks.map(task => <TaskRow key={task.id} task={task} />)}
                        </div>
                    </div>
                )}

                {tasks.length === 0 && (
                    <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-4">
                        <Check size={48} className="text-green-300" />
                        <span className="text-lg font-bold">כל המשימות הושלמו! 🎉</span>
                    </div>
                )}
            </div>

            {/* Left Side: Detail View (1/3) */}
            <div className="flex-1 bg-white p-6 overflow-y-auto border-r border-gray-100 shadow-xl z-20 custom-scrollbar">
                {selectedTask ? (
                    <div className="space-y-4 animate-fadeIn">
                        {/* Image if exists */}
                        {selectedTask.image_url && (
                            <img src={selectedTask.image_url} alt="" className="w-full h-40 object-cover rounded-xl shadow-sm" />
                        )}

                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedTask.name}</h2>

                        {/* Target - Only if has target_qty */}
                        {selectedTask.target_qty && selectedTask.target_qty > 0 && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                                <div>
                                    <span className="text-gray-400 text-xs font-bold block mb-0.5">יעד</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-black text-2xl text-slate-800">{selectedTask.target_qty}</span>
                                        <span className="text-sm font-bold text-gray-500">
                                            {selectedTask.logic_type === 'par_level' ? 'השלמה' : 'יחידות'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {selectedTask.description && (
                            <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100 text-right">
                                <h4 className="font-bold flex items-center gap-2 mb-2 text-blue-700 text-xs uppercase tracking-wider">
                                    <Info size={14} /> הוראות
                                </h4>
                                <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                                    {selectedTask.description}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={() => onComplete(selectedTask)}
                            className="w-full py-4 bg-green-600 text-white rounded-xl font-black text-lg shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Check size={24} />
                            סמן כבוצע
                        </button>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                        <AlertCircle size={48} className="mb-4 opacity-20" />
                        <h3 className="text-xl font-bold mb-2">לא נבחרה משימה</h3>
                        <p className="text-sm">לחץ על משימה לפרטים נוספים</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskManagementView;
