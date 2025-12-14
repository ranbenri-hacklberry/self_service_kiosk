import React, { useState, useEffect } from 'react';
import { Check, Clock, Info, AlertCircle } from 'lucide-react';

const TaskManagementView = ({ tasks, onComplete, title }) => {
    const [selectedTask, setSelectedTask] = useState(null);

    // Auto-select first task if none selected and tasks exist
    useEffect(() => {
        if (tasks.length > 0 && !selectedTask) {
            // setSelectedTask(tasks[0]); // Optional: maybe annoying if list updates?
        }
    }, [tasks]);

    return (
        <div className="flex bg-gray-50 h-[calc(100vh-140px)] overflow-hidden rounded-2xl shadow-inner border border-gray-200">
            {/* Right Side: Task Grid (2/3) - RTL so it's right */}
            <div className="flex-[2] p-4 overflow-y-auto border-l border-gray-200 custom-scrollbar">
                <h2 className="text-2xl font-black text-gray-800 mb-6 sticky top-0 bg-gray-50 pb-2 z-10 flex items-center gap-2">
                    {title}
                    <span className="bg-blue-100 text-blue-700 text-sm py-1 px-3 rounded-full">{tasks.length}</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col gap-3 relative
                                ${selectedTask?.id === task.id
                                    ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-100'
                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-lg text-gray-800 line-clamp-2">{task.name}</h3>
                                {task.logic_type === 'par_level' && (
                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-md font-bold whitespace-nowrap">
                                        השלמה ל-{task.target_qty}
                                    </span>
                                )}
                                {task.logic_type === 'fixed' && (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold whitespace-nowrap">
                                        ייצור: {task.target_qty}
                                    </span>
                                )}
                            </div>

                            {/* Status / Time */}
                            <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                <Clock size={14} />
                                <span>{task.due_time || 'יומי'}</span>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onComplete(task);
                                }}
                                className="mt-auto w-full py-2 bg-gray-100 hover:bg-green-500 hover:text-white text-gray-600 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={18} />
                                <span>סיום משימה</span>
                            </button>
                        </div>
                    ))}

                    {tasks.length === 0 && (
                        <div className="col-span-2 text-center py-20 text-gray-400 flex flex-col items-center gap-4">
                            <Info size={40} className="opacity-20" />
                            <span>אין משימות פתוחות להיום</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Left Side: Detail View (1/3) */}
            <div className="flex-1 bg-white p-6 overflow-y-auto border-r border-gray-100 shadow-xl z-20 custom-scrollbar">
                {selectedTask ? (
                    <div className="space-y-4 animate-fadeIn pb-20">
                        {/* Image if exists */}
                        {selectedTask.image_url && (
                            <img src={selectedTask.image_url} alt="" className="w-full h-40 object-cover rounded-xl shadow-sm mb-2" />
                        )}

                        <div>
                            <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedTask.name}</h2>
                        </div>

                        {/* Combined Target & Type */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                            <div>
                                <span className="text-gray-400 text-xs font-bold block mb-0.5">יעד יומי</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="font-black text-2xl text-slate-800">{selectedTask.target_qty}</span>
                                    <span className="text-sm font-bold text-gray-500">
                                        {selectedTask.logic_type === 'par_level' ? 'השלמה ל-' : 'ייצור'}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-xs font-bold text-gray-500">
                                {selectedTask.category === 'opening' ? 'פתיחה' : selectedTask.category === 'closing' ? 'סגירה' : 'הכנה'}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100 text-right">
                            <h4 className="font-bold flex items-center gap-2 mb-2 text-blue-700 text-xs uppercase tracking-wider">
                                <Info size={14} /> הוראות ביצוע
                            </h4>
                            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                                {selectedTask.description || 'אין תיאור זמין למשימה זו.'}
                            </p>
                        </div>

                        <button
                            onClick={() => onComplete(selectedTask)}
                            className="w-full py-4 bg-green-600 text-white rounded-xl font-black text-lg shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-auto"
                        >
                            <Check size={24} />
                            סמן כבוצע
                        </button>

                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                        <AlertCircle size={48} className="mb-4 opacity-20" />
                        <h3 className="text-xl font-bold mb-2">לא נבחרה משימה</h3>
                        <p className="text-sm">בחר משימה מהרשימה כדי לצפות בפרטים והוראות</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskManagementView;
