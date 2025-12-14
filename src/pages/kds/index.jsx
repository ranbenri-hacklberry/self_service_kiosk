import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Package, Plus, RotateCcw,
  Clock, CreditCard, ChefHat, CheckCircle, List,
  Check, AlertTriangle, X, RefreshCw, Flame, Edit
} from 'lucide-react';
import { supabase, getSupabase } from '../../lib/supabase';
import { sendSms } from '../../services/smsService';
import CashPaymentModal from './components/CashPaymentModal';
import StaffQuickAccessModal from '../../components/StaffQuickAccessModal';
import { useAuth } from '../../context/AuthContext';
import { isDrink, isHotDrink, sortItems, groupOrderItems } from '../../utils/kdsUtils';
import OrderCard from './components/OrderCard';
import { useKDSData } from './hooks/useKDSData';

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

const Header = ({ onRefresh, lastUpdated, viewMode, setViewMode, onOpenStaffMenu, onUndoLastAction, canUndo, currentUser }) => {
  const navigate = useNavigate();

  const handleNewOrder = () => {
    sessionStorage.setItem('order_origin', 'kds');
    navigate('/customer-phone-input-screen?from=kds');
  };

  // טאבים מעודכנים
  const tabs = [
    { id: 'kds', label: 'מסך מטבח', icon: LayoutGrid },
    { id: 'orders_inventory', label: 'מלאי והזמנות', icon: Package },
    { id: 'tasks_prep', label: 'משימות והכנות', icon: List },
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md h-16 flex justify-between items-center px-4 border-b border-gray-200 font-heebo shrink-0 z-20 shadow-sm">
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg transition-all duration-200 ${viewMode === tab.id
              ? 'bg-white text-slate-900 shadow-sm font-black ring-1 ring-black/5'
              : 'text-gray-500 hover:text-gray-700 font-medium'
              } `}
          >
            <tab.icon size={18} strokeWidth={viewMode === tab.id ? 2.5 : 2} />
            <span className="text-base">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end text-gray-500 hidden md:flex cursor-pointer" onClick={onRefresh}>
          {currentUser && (
            <span className="text-xs font-bold text-gray-400 mb-0.5 max-w-[120px] truncate" dir="rtl">
              {currentUser.name}
            </span>
          )}
          <span className="text-xl font-black leading-none tracking-tight text-slate-700">
            {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-1 hidden md:block"></div>

        <div className="flex items-center gap-3">
          <button
            onClick={canUndo ? onUndoLastAction : undefined}
            disabled={!canUndo}
            className={`flex flex-col items-center justify-center w-20 h-12 rounded-xl transition border shadow-sm ${canUndo
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100 active:scale-95 cursor-pointer'
              : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-60'
              }`}
          >
            <RotateCcw size={20} strokeWidth={2.5} />
            <span className="text-[10px] font-bold mt-0.5">ביטול פעולה</span>
          </button>

          <button
            onClick={onOpenStaffMenu}
            className="flex flex-col items-center justify-center w-12 h-12 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition border border-gray-200 shadow-sm"
          >
            <ChefHat size={20} strokeWidth={2.5} />
          </button>

          <button
            onClick={handleNewOrder}
            className="flex items-center gap-2 px-5 h-12 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shadow-md active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            <span className="text-lg font-bold">הזמנה</span>
          </button>
        </div>
      </div>
    </header>
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
    handleConfirmPayment
  } = useKDSData();

  const [viewMode, setViewMode] = useState('kds'); // 'kds' | 'orders_inventory' | 'tasks_prep'
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // States for tasks and inventory views
  const [tasksSubTab, setTasksSubTab] = useState('prep'); // 'opening' | 'prep' | 'closing'
  const [inventorySubTab, setInventorySubTab] = useState('counts'); // 'counts' | 'orders'
  const [openingTasks, setOpeningTasks] = useState([]);
  const [prepBatches, setPrepBatches] = useState([]);
  const [closingTasks, setClosingTasks] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [inventoryCounts, setInventoryCounts] = useState([]);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const navigate = useNavigate();

  const handlePaymentCollected = (order) => {
    setSelectedOrderForPayment(order);
  };


  // Fetch kitchen tasks and prep batches from API
  const fetchOpeningTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const tasks = await response.json();

      // Filter opening tasks
      const openingTasks = tasks.filter(task =>
        task.status === 'Pending' &&
        (task.description?.includes('פתיחה') || task.category?.includes('opening'))
      );

      setOpeningTasks(openingTasks || []);
    } catch (err) {
      console.error('Error fetching opening tasks:', err);
      setOpeningTasks([]);
    }
  };

  const fetchPrepBatches = async () => {
    try {
      const response = await fetch(`${API_URL}/prep_tasks`);
      if (!response.ok) throw new Error('Failed to fetch prep tasks');
      const tasks = await response.json();

      // Transform tasks to prep batches format
      const prepBatches = tasks
        .filter(task => task.recipe && task.recipe.preparation_quantity > 0)
        .map(task => ({
          id: task.id,
          recipe_id: task.recipe?.id,
          quantity: task.recipe?.preparation_quantity || 1,
          status: 'pending',
          recipes: {
            name: task.description,
            instructions: task.recipe?.instructions
          }
        }));

      setPrepBatches(prepBatches || []);
    } catch (err) {
      console.error('Error fetching prep batches:', err);
      setPrepBatches([]);
    }
  };

  const fetchClosingTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const tasks = await response.json();

      // Filter closing tasks
      const closingTasks = tasks.filter(task =>
        task.status === 'Pending' &&
        (task.description?.includes('סגירה') || task.category?.includes('closing'))
      );

      setClosingTasks(closingTasks || []);
    } catch (err) {
      console.error('Error fetching closing tasks:', err);
      setClosingTasks([]);
    }
  };

  const fetchSupplierOrders = async () => {
    try {
      // Note: Backend doesn't have supplier orders endpoint yet
      // Using Supabase directly for now
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('supplier_orders')
        .select('*, suppliers(name)')
        .in('delivery_status', ['pending', 'arrived'])
        .or(`expected_delivery_date.eq.${today},expected_delivery_date.eq.${tomorrow}`)
        .order('expected_delivery_date', { ascending: true });

      if (error) throw error;
      setSupplierOrders(data || []);
    } catch (err) {
      console.error('Error fetching supplier orders:', err);
      setSupplierOrders([]);
    }
  };

  const fetchInventoryCounts = async () => {
    try {
      const response = await fetch(`${API_URL}/inventory`);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setInventoryCounts(data || []);
    } catch (err) {
      console.error('Error fetching inventory counts:', err);
      setInventoryCounts([]);
    }
  };

  const completeKitchenTask = async (taskId) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip_ingredient_deduction: true })
      });

      if (!response.ok) throw new Error('Failed to complete task');

      // Refresh tasks
      await fetchOpeningTasks();
      await fetchClosingTasks();
    } catch (err) {
      console.error('Error completing kitchen task:', err);
      alert('שגיאה בסימון המשימה כבוצעה');
    }
  };

  const completePrepBatch = async (taskId, recipeId, quantity) => {
    try {
      // Complete the task via API (this will update inventory automatically)
      const response = await fetch(`${API_URL}/tasks/${taskId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skip_ingredient_deduction: false // Let backend handle ingredient deduction
        })
      });

      if (!response.ok) throw new Error('Failed to complete prep batch');

      // Refresh prep batches and inventory
      await fetchPrepBatches();
      await fetchInventoryCounts();
    } catch (err) {
      console.error('Error completing prep batch:', err);
      alert('שגיאה בסימון ההכנה כבוצעה');
    }
  };

  // Update current hour every minute
  useEffect(() => {
    const updateHour = () => {
      setCurrentHour(new Date().getHours());
    };
    updateHour();
    const interval = setInterval(updateHour, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Load data based on viewMode
  useEffect(() => {
    if (viewMode === 'tasks_prep') {
      if (currentHour >= 8) {
        fetchOpeningTasks();
      }
      fetchPrepBatches();
      if (currentHour >= 16) {
        fetchClosingTasks();
      }
    } else if (viewMode === 'orders_inventory') {
      if (inventorySubTab === 'counts') {
        fetchInventoryCounts();
      } else {
        fetchSupplierOrders();
      }
    }
  }, [viewMode, inventorySubTab, currentHour]);

  // Render tasks/prep view
  const renderTasksPrepView = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tasks Sub-tabs */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          {currentHour >= 8 && openingTasks.length > 0 && (
            <button
              onClick={() => setTasksSubTab('opening')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tasksSubTab === 'opening' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
            >
              פתיחה
            </button>
          )}
          <button
            onClick={() => setTasksSubTab('prep')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tasksSubTab === 'prep' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
          >
            הכנות
          </button>
          {currentHour >= 16 && (
            <button
              onClick={() => closingTasks.length === 0 && setTasksSubTab('closing')}
              disabled={closingTasks.length > 0}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tasksSubTab === 'closing' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                } ${closingTasks.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              סגירה {closingTasks.length > 0 && '🔒'}
            </button>
          )}
        </div>
      </div>

      {/* Tasks Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tasksSubTab === 'opening' && (
          <div className="space-y-3">
            {openingTasks.length === 0 ? (
              <p className="text-gray-500 text-center">אין משימות פתיחה ממתינות</p>
            ) : (
              openingTasks.map(task => (
                <div key={task.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">{task.description || task.name}</span>
                  <button
                    onClick={() => completeKitchenTask(task.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    בוצע
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tasksSubTab === 'prep' && (
          <div className="space-y-3">
            {prepBatches.length === 0 ? (
              <p className="text-gray-500 text-center">אין הכנות ממתינות</p>
            ) : (
              prepBatches.map(batch => (
                <div key={batch.id} className="bg-blue-50 p-4 rounded-xl">
                  <h4 className="font-bold text-lg mb-2">
                    {batch.recipes?.name || 'הכנה'} ×{batch.quantity || 1}
                  </h4>
                  {batch.recipes?.instructions && (
                    <p className="text-sm text-gray-600 mb-3">{batch.recipes.instructions}</p>
                  )}
                  <button
                    onClick={() => completePrepBatch(batch.id, batch.recipe_id, batch.quantity || 1)}
                    className="bg-green-600 text-white w-full py-2 rounded-lg hover:bg-green-700"
                  >
                    הוסף למלאי
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tasksSubTab === 'closing' && (
          <div className="space-y-3">
            {closingTasks.length === 0 ? (
              <p className="text-gray-500 text-center">אין משימות סגירה ממתינות</p>
            ) : (
              closingTasks.map(task => (
                <div key={task.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">{task.description || task.name}</span>
                  <button
                    onClick={() => completeKitchenTask(task.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    בוצע
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render inventory/orders view
  const renderInventoryOrdersView = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Inventory Sub-tabs */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInventorySubTab('counts')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${inventorySubTab === 'counts' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
          >
            ספירות מלאי
          </button>
          <button
            onClick={() => setInventorySubTab('orders')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${inventorySubTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
          >
            הזמנות ממתינות
          </button>
        </div>
      </div>

      {/* Inventory Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {inventorySubTab === 'counts' && (
          <div className="space-y-3">
            {inventoryCounts.length === 0 ? (
              <p className="text-gray-500 text-center">אין פריטים במלאי</p>
            ) : (
              inventoryCounts.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold">פריט #{item.item_id}</h4>
                      <p className="text-sm text-gray-600">
                        מלאי נוכחי: <span className="font-semibold">{item.current_stock || 0}</span>
                      </p>
                      {item.initial_stock && (
                        <p className="text-xs text-gray-500">
                          מלאי התחלתי: {item.initial_stock}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {inventorySubTab === 'orders' && (
          <div className="space-y-3">
            {supplierOrders.length === 0 ? (
              <p className="text-gray-500 text-center">אין הזמנות ספקים ממתינות</p>
            ) : (
              supplierOrders.map(order => (
                <div key={order.id} className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="font-semibold text-lg mb-2">
                    {order.suppliers?.name || 'ספק'}
                  </div>
                  {order.expected_delivery_date && (
                    <div className="text-sm text-gray-600 mb-2">
                      צפויה: {new Date(order.expected_delivery_date).toLocaleDateString('he-IL')}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    סטטוס: {order.delivery_status === 'arrived' ? 'הגיעה' : 'ממתינה'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  const handleEditOrder = (order) => {
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
          renderInventoryOrdersView()
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
          orderId={selectedOrderForPayment?.id}
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