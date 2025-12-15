import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Package, Plus, RotateCcw,
  Clock, CreditCard, ChefHat, CheckCircle, List,
  Check, AlertTriangle, X, RefreshCw, Flame, Edit, ChevronRight, House
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendSms } from '../../services/smsService';
import CashPaymentModal from './components/CashPaymentModal';
import StaffQuickAccessModal from '../../components/StaffQuickAccessModal';
import { useAuth } from '../../context/AuthContext';
import { isDrink, isHotDrink, sortItems, groupOrderItems } from '../../utils/kdsUtils';
import OrderCard from './components/OrderCard';
import { useKDSData } from './hooks/useKDSData';
import KDSInventoryScreen from './components/KDSInventoryScreen';
import TaskManagementView from '../../components/kds/TaskManagementView';

const API_URL =
  (import.meta.env.VITE_MANAGER_API_URL ||
    import.meta.env.VITE_DATA_MANAGER_API_URL ||
    'https://aimanageragentrani-625352399481.europe-west1.run.app').replace(/\/$/, '');

// --- סגנונות (CSS) ---
const kdsStyles = `
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');

  .font-heebo { font-family: 'Heebo', sans-serif; }

  .kds-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
  .kds-card:active {
  transform: scale(0.99);
}

  /* שם הפריט - קומפקטי יותר */
  .item-text {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

/* אנימציית הבהוב חזקה בכתום/צהוב */
@keyframes strongOrangePulse {
  0%, 100% {
    box-shadow: 0 0 4px rgba(245, 158, 11, 0.6);
  border-color: #f59e0b;
  transform: scale(1);
}
50% {
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.9);
border-color: #fbbf24;
transform: scale(1.02);
    }
  }
  .animate-strong-pulse { animation: strongOrangePulse 1.2s ease-in-out infinite; }

`;

// --- רכיבים ---

// --- רכיבים ---

const Header = ({ onRefresh, lastUpdated, viewMode, setViewMode, onUndoLastAction, canUndo, currentUser }) => {
  const navigate = useNavigate();

  const handleNewOrder = () => {
    sessionStorage.setItem('order_origin', 'kds');
    navigate('/customer-phone-input-screen?from=kds');
  };

  const handleExit = () => {
    navigate('/mode-selection');
  };

  const tabs = [
    { id: 'kds', label: 'מטבח', icon: LayoutGrid },
    { id: 'orders_inventory', label: 'מלאי', icon: Package },
    { id: 'tasks_prep', label: 'משימות', icon: List },
  ];

  return (
    <div className="bg-white shadow-sm z-20 shrink-0 px-6 py-2 flex justify-between items-center border-b border-gray-200 font-heebo">
      <div className="flex items-center gap-4">
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${viewMode === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-lg font-black text-slate-700 hidden md:block">
          {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div className="w-px h-6 bg-gray-200 hidden md:block" />

        <button
          onClick={canUndo ? onUndoLastAction : undefined}
          disabled={!canUndo}
          className={`p-2 rounded-xl transition ${canUndo ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300'}`}
        >
          <RotateCcw size={18} />
        </button>

        <button onClick={handleExit} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
          <House size={18} />
        </button>

        <button onClick={handleNewOrder} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shadow-sm text-sm font-bold">
          <Plus size={16} /> הזמנה
        </button>
      </div>
    </div>
  );
};

// --- לוגיקה ראשית ---

const KdsScreen = () => {
  const { currentUser } = useAuth();
  const {
    currentOrders,
    completedOrders,
    isLoading,
    lastUpdated,
    lastAction,
    smsToast,
    setSmsToast,
    errorModal,
    setErrorModal,
    isSendingSms,
    fetchOrders,
    updateOrderStatus,
    handleFireItems,
    handleReadyItems,
    handleUndoLastAction,
    handleConfirmPayment,
    handleCancelOrder
  } = useKDSData();

  const [viewMode, setViewMode] = useState('kds'); // 'kds' | 'orders_inventory' | 'tasks_prep'
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // States for tasks and inventory views
  const [tasksSubTab, setTasksSubTab] = useState('prep'); // 'opening' | 'prep' | 'closing'
  /* inventorySubTab, supplierOrders, inventoryCounts removed */
  const [openingTasks, setOpeningTasks] = useState([]);
  const [prepBatches, setPrepBatches] = useState([]);
  const [closingTasks, setClosingTasks] = useState([]);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const navigate = useNavigate();

  const handlePaymentCollected = (order) => {
    setSelectedOrderForPayment(order);
  };


  // Unified Task Fetching
  const fetchTasksByCategory = async (categories, targetSetter) => {
    try {
      const todayIdx = new Date().getDay();
      const dateStr = new Date().toISOString().split('T')[0];

      // Support single category or array of categories
      const categoryList = Array.isArray(categories) ? categories : [categories];
      console.log(`📋 Fetching tasks for categories:`, categoryList, 'day:', todayIdx);

      // 1. Fetch active recurring tasks for these categories
      const { data: allTasks, error } = await supabase
        .from('recurring_tasks')
        .select('*')
        .in('category', categoryList)
        .eq('is_active', true);

      console.log(`📋 ${category} tasks fetched:`, allTasks?.length || 0, error ? `Error: ${error.message}` : '');

      if (error) throw error;

      // 2. Filter by Schedule (Client-side)
      const scheduled = (allTasks || []).filter(t => {
        const schedule = t.weekly_schedule || {};
        // Legacy support: if no schedule, rely on day_of_week check or show everyday if day_of_week is null?
        // If new schedule exists:
        if (Object.keys(schedule).length > 0) {
          const config = schedule[todayIdx];
          return config && config.qty > 0;
        }
        // Legacy fallback (simple day_of_week int)
        if (t.day_of_week !== null && t.day_of_week !== undefined) {
          return t.day_of_week === todayIdx;
        }
        // Default: show everyday if no constraints?
        return true;
      });

      // 3. Fetch logs specifically for today to exclude completed
      const { data: logs, error: logsError } = await supabase
        .from('task_completions')
        .select('recurring_task_id')
        .eq('completion_date', dateStr);
      
      if (logsError) {
        console.warn('⚠️ Could not fetch task completions:', logsError.message);
      }

      console.log(`📋 Completed tasks today:`, logs?.length || 0);

      const completedSet = new Set(logs?.map(l => l.recurring_task_id));

      // 4. Map to display format
      const final = scheduled
        .filter(t => !completedSet.has(t.id))
        .map(t => {
          const config = (t.weekly_schedule || {})[todayIdx] || {};
          return {
            id: t.id,
            name: t.name,
            description: t.description || t.menu_item?.description,
            image_url: t.image_url || t.menu_item?.image_url,
            target_qty: config.qty || t.quantity, // Prioritize daily schedule
            logic_type: config.mode || t.logic_type || 'fixed',
            category: t.category,
            due_time: t.due_time || '08:00',
            is_recurring: true
          };
        });

      console.log(`📋 Final tasks to display:`, final.length, final.map(t => t.name));

      // Update state using the provided setter
      if (targetSetter) {
        targetSetter(final);
      }

    } catch (err) {
      console.error(`Error fetching tasks:`, err);
    }
  };

  // Category mappings - support both Hebrew and English
  const fetchOpeningTasks = () => fetchTasksByCategory(['פתיחה', 'opening'], setOpeningTasks);
  const fetchPrepBatches = () => fetchTasksByCategory(['prep', 'הכנה'], setPrepBatches);
  const fetchClosingTasks = () => fetchTasksByCategory(['סגירה', 'closing'], setClosingTasks);


  // --- Task Operations ---

  const handleCompleteTask = async (task) => {
    // Optimistic Update - handle both Hebrew and English categories
    const cat = task.category;
    if (cat === 'opening' || cat === 'פתיחה') setOpeningTasks(p => p.filter(t => t.id !== task.id));
    if (cat === 'prep' || cat === 'הכנה') setPrepBatches(p => p.filter(t => t.id !== task.id));
    if (cat === 'closing' || cat === 'סגירה') setClosingTasks(p => p.filter(t => t.id !== task.id));

    try {
      if (task.is_recurring) {
        const { error } = await supabase.from('task_completions').insert({
          recurring_task_id: task.id,
          business_id: currentUser?.business_id,
          quantity_produced: task.target_qty,
          completion_date: new Date().toISOString().split('T')[0],
          completed_by: currentUser?.id
        });
        if (error) throw error;
      }
    } catch (e) {
      console.error("Task completion failed:", e);
    }
  };

  // Fetch based on Time Phase (Auto-Switch)
  useEffect(() => {
    if (viewMode === 'tasks_prep') {
      console.log('📋 Tasks view active, fetching all task types...');
      
      // Always fetch prep tasks
      fetchPrepBatches();
      
      // Logic: Opening starts 3 hours before 9:00 = 06:00.
      // Closing starts at 15:00.
      const isClosingPhase = currentHour >= 15; // 3 PM

      if (isClosingPhase) {
        fetchClosingTasks();
      } else {
        fetchOpeningTasks();
      }
    }
  }, [viewMode, currentHour]);

  // Update current hour every minute
  useEffect(() => {
    const updateHour = () => {
      setCurrentHour(new Date().getHours());
    };
    const interval = setInterval(updateHour, 60000);
    return () => clearInterval(interval);
  }, []);

  // Render tasks view (Auto Phase)
  const renderTasksPrepView = () => {
    // Current Phase Logic
    const isClosingPhase = currentHour >= 15;
    const title = isClosingPhase ? 'משימות סגירה' : 'משימות פתיחה';
    const activeList = isClosingPhase ? closingTasks : openingTasks;

    return (
      <div className="flex flex-col h-full bg-slate-50 p-4">
        {/* Info Badge */}
        <div className="flex justify-center mb-4">
          <span className={`px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm border ${isClosingPhase ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
            <Clock size={12} />
            {isClosingPhase ? 'נוהל סגירה פעיל (החל מ-15:00)' : 'נוהל פתיחה פעיל (עד 15:00)'}
          </span>
        </div>

        <TaskManagementView
          tasks={activeList}
          onComplete={handleCompleteTask}
          title={title}
        />
      </div>
    );
  };

  // renderInventoryOrdersView removed - replaced by KDSInventoryScreen component

  const handleEditOrder = (order) => {
    console.log('🖊️ KDS: Editing order:', order);
    console.log('🆔 KDS: Using order ID:', order.originalOrderId || order.id);
    console.log('📋 KDS: Order object keys:', Object.keys(order));
    navigate('/menu-ordering-interface', {
      state: {
        orderId: order.originalOrderId || order.id,
        isEditMode: true
      }
    });
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4 font-heebo overflow-hidden" dir="rtl">
      <style>{kdsStyles}</style>

      {/* מסגרת מלאה (ללא הגבלת רוחב מלאכותית כדי למלא את האייפד) */}
      <div className="bg-slate-50 w-full h-full rounded-[24px] overflow-hidden shadow-2xl flex flex-col relative ring-4 ring-gray-800">
        <Header
          onRefresh={fetchOrders}
          lastUpdated={lastUpdated}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onOpenStaffMenu={() => setIsStaffModalOpen(true)}
          onUndoLastAction={handleUndoLastAction}
          canUndo={!!lastAction}
          currentUser={currentUser}
        />

        {viewMode === 'kds' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* חצי עליון: בטיפול (50%) */}
            <div className="flex-1 border-b-4 border-gray-200 relative bg-slate-100/50 flex flex-col min-h-0">
              <div className="absolute top-3 right-4 bg-white/90 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold text-slate-600 z-10 shadow-sm">
                בטיפול ({currentOrders.length})
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap p-6 pb-4 custom-scrollbar">
                <div className="flex h-full flex-row-reverse justify-end gap-4 items-stretch">
                  {currentOrders.map(order => (
                    <OrderCard
                      key={order.id} order={order}
                      onOrderStatusUpdate={updateOrderStatus}
                      onPaymentCollected={handlePaymentCollected}
                      onFireItems={handleFireItems}
                      onReadyItems={handleReadyItems}
                      onEditOrder={handleEditOrder}
                      onCancelOrder={handleCancelOrder}
                      onRefresh={fetchOrders}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* חצי תחתון: מוכן (50%) */}
            <div className="flex-1 relative bg-green-50/30 flex flex-col min-h-0">
              <div className="absolute top-3 right-4 bg-green-100 border border-green-200 px-3 py-1 rounded-full text-xs font-bold text-green-700 z-10 shadow-sm">
                מוכן למסירה ({completedOrders.length})
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap p-6 pb-4 custom-scrollbar">
                <div className="flex h-full flex-row-reverse justify-end gap-4 items-stretch">
                  {completedOrders.map(order => (
                    <OrderCard
                      key={order.id} order={order} isReady={true}
                      onOrderStatusUpdate={updateOrderStatus}
                      onPaymentCollected={handlePaymentCollected}
                      onEditOrder={handleEditOrder}
                      onCancelOrder={handleCancelOrder}
                      onRefresh={fetchOrders}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'tasks_prep' ? (
          renderTasksPrepView()
        ) : (
          <KDSInventoryScreen />
        )}

        {/* SMS Toast Notification */}
        {smsToast && (
          <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${smsToast.isError ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
            {smsToast.isError ? <AlertTriangle size={24} /> : <Check size={24} />}
            <span className="text-xl font-bold">{smsToast.message}</span>
          </div>
        )}

        {/* Error / Retry Modal (SMS or Network) */}
        {errorModal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden">
              <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4">
                <div className="bg-red-100 p-3 rounded-full text-red-600">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-red-900">{errorModal.title}</h3>
                  <p className="text-red-700 font-medium">{errorModal.message}</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-sm text-gray-600 dir-ltr">
                  {errorModal.details || 'Unknown Error'}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setErrorModal(null)}
                    className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold text-xl hover:bg-gray-300 transition"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={errorModal.onRetry}
                    disabled={isSendingSms}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold text-xl hover:bg-slate-800 transition flex items-center justify-center gap-2"
                  >
                    {isSendingSms ? (
                      <RefreshCw className="animate-spin" />
                    ) : (
                      <>
                        <RefreshCw />
                        {errorModal.retryLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Instruction Modal */}
        <CashPaymentModal
          isOpen={!!selectedOrderForPayment}
          onClose={() => setSelectedOrderForPayment(null)}
          orderId={selectedOrderForPayment?.originalOrderId || selectedOrderForPayment?.id}
          orderAmount={selectedOrderForPayment?.totalAmount || 0}
          customerName={selectedOrderForPayment?.customerName}
          onConfirmCash={handleConfirmPayment}
        />

        <StaffQuickAccessModal
          isOpen={isStaffModalOpen}
          onClose={() => setIsStaffModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default KdsScreen;