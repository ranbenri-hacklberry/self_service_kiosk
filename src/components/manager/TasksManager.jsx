import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, X, Check, ClipboardList, ChevronLeft, Trash2, Coffee, ExternalLink } from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

const TasksManager = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Top Tabs: 'opening' | 'pre_closing' | 'closing'
  const [activeTab, setActiveTab] = useState('opening');
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    is_pre_closing: false
  });
  
  // Menu Item Task Modal (can't edit here)
  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [selectedMenuTask, setSelectedMenuTask] = useState(null);
  
  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info'
  });

  const categoryMap = {
    'opening': ['פתיחה', 'opening'],
    'pre_closing': ['סגירה'], // Pre-closing tasks are in סגירה category with is_pre_closing=true
    'closing': ['סגירה', 'closing']
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filter tasks by current tab
  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'opening') {
      return categoryMap.opening.includes(task.category);
    }
    if (activeTab === 'pre_closing') {
      return categoryMap.closing.includes(task.category) && task.is_pre_closing === true;
    }
    if (activeTab === 'closing') {
      return categoryMap.closing.includes(task.category) && !task.is_pre_closing;
    }
    return false;
  });

  const handleTaskClick = (task) => {
    // If task is from menu item (has menu_item_id), show special modal
    if (task.menu_item_id) {
      setSelectedMenuTask(task);
      setShowMenuItemModal(true);
    } else {
      // Regular task - open edit modal
      setEditingTask(task);
      setTaskForm({
        name: task.name || '',
        description: task.description || '',
        is_pre_closing: task.is_pre_closing || false
      });
      setShowEditModal(true);
    }
  };

  const handleAddNew = () => {
    setEditingTask(null);
    setTaskForm({
      name: '',
      description: '',
      is_pre_closing: activeTab === 'pre_closing'
    });
    setShowEditModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.name.trim()) return;
    
    try {
      const category = activeTab === 'opening' ? 'פתיחה' : 'סגירה';
      
      if (editingTask) {
        // Update existing
        const { error } = await supabase
          .from('recurring_tasks')
          .update({
            name: taskForm.name,
            description: taskForm.description,
            is_pre_closing: taskForm.is_pre_closing
          })
          .eq('id', editingTask.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('recurring_tasks')
          .insert([{
            name: taskForm.name,
            description: taskForm.description,
            category: category,
            is_pre_closing: taskForm.is_pre_closing,
            is_active: true,
            frequency: 'Daily'
          }]);
        
        if (error) throw error;
      }
      
      setShowEditModal(false);
      fetchTasks();
    } catch (err) {
      console.error('Error saving task:', err);
      alert('שגיאה בשמירת המשימה');
    }
  };

  const handleDeleteTask = (task) => {
    setConfirmModal({
      isOpen: true,
      title: 'מחיקת משימה',
      message: `האם אתה בטוח שברצונך למחוק את המשימה "${task.name}"?`,
      variant: 'danger',
      confirmText: 'מחק',
      onConfirm: () => executeDeleteTask(task.id)
    });
  };

  const executeDeleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('recurring_tasks')
        .update({ is_active: false })
        .eq('id', taskId);
      
      if (error) throw error;
      fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const goToMenuItem = () => {
    if (selectedMenuTask?.menu_item_id) {
      navigate('/data-manager-interface', { 
        state: { 
          activeTab: 'menu', 
          editItemId: selectedMenuTask.menu_item_id 
        } 
      });
    }
    setShowMenuItemModal(false);
  };

  const tabLabels = {
    'opening': 'פתיחה',
    'pre_closing': 'קדם-סגירה',
    'closing': 'סגירה'
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 font-heebo pt-4" dir="rtl">
      
      {/* Header */}
      <div className="bg-white shrink-0 z-20 shadow-sm border-b border-gray-100 pb-2">
        <div className="px-4 py-3 flex justify-between items-center relative">
          <div className="w-1/4"></div>
          
          {/* Centered Tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
            {['opening', 'pre_closing', 'closing'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${
                  activeTab === tab 
                    ? 'bg-black text-white shadow-sm' 
                    : 'bg-white text-gray-700 hover:text-black'
                }`}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
          
          <div className="w-1/4 flex justify-end"></div>
        </div>

        {/* Sub-header with title and add button */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="px-4 py-4 flex justify-between items-center max-w-4xl mx-auto w-full mb-1 mt-3"
        >
          <h2 className="text-2xl font-black text-slate-800">
            משימות {tabLabels[activeTab]}
          </h2>
          <button 
            onClick={handleAddNew}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PlusCircle size={20} />
            <span>משימה חדשה</span>
          </button>
        </motion.div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3 max-w-3xl mx-auto pb-20 pt-4 px-4"
          >
            {filteredTasks.length === 0 ? (
              <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-4">
                <ClipboardList size={48} className="text-gray-200" />
                <p className="text-lg font-bold text-gray-500">אין משימות {tabLabels[activeTab]}</p>
                <button 
                  onClick={handleAddNew}
                  className="text-blue-600 font-bold hover:underline"
                >
                  הוסף משימה ראשונה
                </button>
              </div>
            ) : (
              filteredTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 pr-2 flex items-center gap-3 relative transition-all cursor-pointer group h-[88px] hover:shadow-md hover:border-blue-200 hover:bg-blue-50/50"
                >
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center ${
                    task.menu_item_id ? 'bg-amber-100/50 text-amber-600' : 'bg-blue-100/50 text-blue-600'
                  }`}>
                    {task.menu_item_id ? <Coffee size={24} /> : <ClipboardList size={24} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-center min-w-0 h-full py-1">
                    <h3 className="font-bold text-gray-800 text-base leading-tight truncate mb-1 group-hover:text-blue-700 transition-colors">
                      {task.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {task.menu_item_id && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                          משימת הכנה
                        </span>
                      )}
                      {task.description && (
                        <span className="text-xs text-gray-400 truncate max-w-[150px]">
                          {task.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pl-2 flex-shrink-0 flex items-center gap-2">
                    {!task.menu_item_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-blue-500 transition-colors shadow-sm">
                      <ChevronLeft size={18} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {showEditModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 0.5 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowEditModal(false)} 
              className="fixed inset-0 bg-black z-40" 
            />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-2xl p-0 min-h-[50vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 pb-4 bg-white rounded-t-3xl border-b border-gray-50 shrink-0 relative">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-800 text-center">
                  {editingTask ? 'עריכת משימה' : 'משימה חדשה'}
                </h3>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="text-sm font-bold text-slate-500 mb-1 block">שם המשימה</label>
                  <input
                    type="text"
                    value={taskForm.name}
                    onChange={e => setTaskForm({ ...taskForm, name: e.target.value })}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-bold text-xl"
                    placeholder="שם המשימה..."
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-500 mb-1 block">תיאור / הוראות (אופציונלי)</label>
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-medium text-base min-h-[120px] resize-none"
                    placeholder="הוראות ביצוע, הערות..."
                  />
                </div>

                {/* Pre-closing toggle (only for closing tasks) */}
                {(activeTab === 'closing' || activeTab === 'pre_closing') && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="font-bold text-slate-700">אפשר לבצע לפני סגירה</span>
                        <p className="text-xs text-gray-400 mt-0.5">משימה שניתן להתחיל בזמן שהמקום עוד פתוח</p>
                      </div>
                      <div 
                        onClick={() => setTaskForm({ ...taskForm, is_pre_closing: !taskForm.is_pre_closing })}
                        className={`w-14 h-8 rounded-full transition-colors relative ${taskForm.is_pre_closing ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${taskForm.is_pre_closing ? 'right-1' : 'left-1'}`} />
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                <button 
                  onClick={handleSaveTask}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-all"
                >
                  {editingTask ? 'שמור שינויים' : 'צור משימה'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Menu Item Task Modal */}
      <AnimatePresence>
        {showMenuItemModal && selectedMenuTask && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 0.5 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowMenuItemModal(false)} 
              className="fixed inset-0 bg-black z-40" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto">
                {/* Header */}
                <div className="p-6 bg-amber-50/50 border-b border-amber-100 text-center">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coffee size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">משימת הכנת מנה</h3>
                  <p className="text-base font-bold text-amber-700 mt-2">{selectedMenuTask.name}</p>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                      משימה זו נוצרה אוטומטית מהגדרות הפריט בתפריט.
                      <br />
                      כדי לערוך אותה, יש לגשת לפריט עצמו בניהול התפריט.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-100 bg-white flex gap-3">
                  <button 
                    onClick={() => setShowMenuItemModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    ביטול
                  </button>
                  <button 
                    onClick={goToMenuItem}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={18} />
                    עבור לפריט
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
};

export default TasksManager;

