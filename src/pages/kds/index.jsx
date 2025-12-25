import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Package, Plus, RotateCcw,
  Clock, CreditCard, ChefHat, CheckCircle, List,
  Check, AlertTriangle, X, RefreshCw, Flame, Edit, ChevronRight, House,
  Calendar, ChevronLeft, History
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendSms } from '../../services/smsService';
import KDSPaymentModal from './components/KDSPaymentModal';
import HistoryInfoModal from './components/HistoryInfoModal';
import StaffQuickAccessModal from '../../components/StaffQuickAccessModal';
import { useAuth } from '../../context/AuthContext';
import { isDrink, isHotDrink, sortItems, groupOrderItems } from '../../utils/kdsUtils';
import OrderCard from './components/OrderCard';
import OrderEditModal from './components/OrderEditModal';
import DateScroller from './components/DateScroller';
import MiniMusicPlayer from '../../components/music/MiniMusicPlayer';
import ConnectionStatusBar from '../../components/ConnectionStatusBar';
import { useKDSData } from './hooks/useKDSData';

// Simple Error Boundary for KDS
class KDSErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('KDS Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4 font-heebo">
          <div className="bg-slate-50 w-full max-w-md rounded-[24px] overflow-hidden shadow-2xl flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle size={48} className="text-red-500 mb-4" />
            <h2 className="text-2xl font-black text-slate-800 mb-2">שגיאה במסך מטבח</h2>
            <p className="text-slate-600 mb-6">אירעה שגיאה בלתי צפויה. אנא רענן את הדף.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
            >
              רענן דף
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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

// --- רכיבים ---



// --- רכיבים ---

const Header = ({
  onRefresh, isLoading, lastUpdated, onUndoLastAction, canUndo,
  viewMode, setViewMode, selectedDate, setSelectedDate
}) => {
  const navigate = useNavigate();

  const handleNewOrder = () => {
    sessionStorage.setItem('order_origin', 'kds');
    navigate('/menu-ordering-interface');
  };

  const handleExit = () => {
    navigate('/mode-selection');
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="bg-white shadow-sm z-20 shrink-0 px-6 py-2 flex justify-between items-center border-b border-gray-200 font-heebo">
      <div className="flex items-center gap-4">
        {/* Home Button (Far Right) */}
        <button onClick={handleExit} className="p-2 text-gray-400 hover:text-red-500 hover:bg-neutral-100 rounded-xl transition mr-[-8px]">
          <House size={20} />
        </button>

        {/* Title */}
        <h1 className="text-xl font-black text-slate-800">
          מסך מטבח
        </h1>

        {/* View Mode Toggle */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => setViewMode('active')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'active' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid size={16} /> פעיל
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'history' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <History size={16} /> היסטוריה
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`p-2 rounded-xl transition ${isLoading ? 'text-blue-400 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
          title="רענן הזמנות"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>

        {/* Mini Music Player Group */}
        <div className="flex items-center gap-2 bg-slate-50/50 p-1 rounded-2xl border border-slate-100">
          <MiniMusicPlayer />
          <ConnectionStatusBar isIntegrated={true} />
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
    fetchHistoryOrders,
    findNearestActiveDate,
    updateOrderStatus: updateOrderStatusBase,
    handleFireItems,
    handleReadyItems,
    handleUndoLastAction,
    handleConfirmPayment,
    handleCancelOrder
  } = useKDSData();

  // Multi-step status update with potential popup
  const handleStatusUpdate = async (orderId, currentStatus) => {
    try {
      // Find the order details before it disappears from state
      const allActive = Array.isArray(currentOrders) ? currentOrders : [];
      const allReady = Array.isArray(completedOrders) ? completedOrders : [];
      const targetOrder = [...allActive, ...allReady].find(o => o.id === orderId);

      // Execute the update
      await updateOrderStatusBase(orderId, currentStatus);

      // If we just delivered (moved from ready to completed) an UNPAID order, show info popup
      if (currentStatus === 'ready' && targetOrder && !targetOrder.isPaid) {
        setHistoryInfoModal({
          isOpen: true,
          orderNumber: targetOrder.orderNumber
        });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const location = useLocation();
  // State persistence: Load from localStorage or defaults
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('kds_viewMode');
    return saved || location.state?.viewMode || 'active';
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem('kds_selectedDate');
    if (saved) {
      try {
        const d = new Date(saved);
        if (!isNaN(d.getTime())) return d;
      } catch (e) { /* fallback */ }
    }
    return new Date();
  });

  const [historyOrders, setHistoryOrders] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const navigate = useNavigate();

  // History Info Modal (shown when unpaid order is moved to history)
  const [historyInfoModal, setHistoryInfoModal] = useState({ isOpen: false, orderNumber: null });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('kds_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('kds_selectedDate', selectedDate.toISOString());
  }, [selectedDate]);

  // Debounced Refresh to prevent race conditions
  const refreshTimeoutRef = React.useRef(null);
  const refreshControllerRef = React.useRef(null);

  const handleRefresh = useCallback(async () => {
    if (refreshTimeoutRef.current) return; // Already debouncing

    console.log('🔄 Manual refresh triggered');

    // Abort previous manual fetch if still running
    if (refreshControllerRef.current) {
      refreshControllerRef.current.abort();
    }
    refreshControllerRef.current = new AbortController();

    try {
      await Promise.all([
        fetchOrders(refreshControllerRef.current.signal),
        viewMode === 'history' ? setHistoryRefreshTrigger(prev => prev + 1) : Promise.resolve()
      ]);
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Refresh failed:', err);
    } finally {
      // Debounce: prevent another refresh for 1 second
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
      }, 1000);
    }
  }, [fetchOrders, viewMode]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (refreshControllerRef.current) refreshControllerRef.current.abort();
    };
  }, []);

  // Manual refresh trigger for history
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);


  // Load History Effect with AbortController
  useEffect(() => {
    if (viewMode === 'history') {
      const controller = new AbortController();
      const loadHistory = async () => {
        setIsHistoryLoading(true);
        try {
          // Pass signal to hook
          const data = await fetchHistoryOrders(selectedDate, controller.signal);
          if (!controller.signal.aborted) {
            // If data is empty, try to find the nearest date with orders
            if ((!data || data.length === 0)) {
              const nearestDate = await findNearestActiveDate(selectedDate);
              if (nearestDate && !controller.signal.aborted) {
                console.log('📅 jumping back to nearest date with orders:', nearestDate);
                setSelectedDate(nearestDate);
                return; // Effect will re-run with new selectedDate
              }
            }
            setHistoryOrders(data || []);
          }
        } catch (err) {
          if (err.name !== 'AbortError') console.error("History load error", err);
        } finally {
          if (!controller.signal.aborted) setIsHistoryLoading(false);
        }
      };

      loadHistory();

      return () => {
        controller.abort();
      };
    }
  }, [viewMode, selectedDate, fetchHistoryOrders, findNearestActiveDate, historyRefreshTrigger]);


  const handlePaymentCollected = (order, fromHistory = false) => {
    setSelectedOrderForPayment({ ...order, _fromHistory: fromHistory });
  };

  const handleEditOrder = (order) => {
    // handleEditOrder ALWAYS opens the edit/view screen
    // Payment modal is opened separately via onPaymentCollected (the cash register button)

    // READY ORDERS: Open the edit modal
    const isReady = order.type === 'ready' || order.orderStatus === 'ready';
    if (isReady) {
      console.log('🖊️ KDS: Opening Edit Modal for Ready Order:', order.id);
      setEditingOrder(order);
      setIsEditModalOpen(true);
      return;
    }

    // HISTORY/COMPLETED ORDERS: Navigate to restricted edit screen
    const isRestricted = viewMode === 'history' || order.order_status === 'completed' || order.order_status === 'cancelled';

    if (isRestricted) {
      console.log('🖊️ KDS: Navigating to RESTRICTED edit order (History):', order.id);
      // Save minimal data to session storage to pass context
      const editData = {
        id: order.id,
        orderNumber: order.orderNumber,
        restrictedMode: true,
        viewMode: viewMode
      };
      sessionStorage.setItem('editOrderData', JSON.stringify(editData));
      sessionStorage.setItem('order_origin', 'kds');
      // Navigate directly to cart
      navigate(`/menu-ordering-interface?editOrderId=${order.id}`, {
        state: { orderId: order.id, viewMode: viewMode }
      });
    } else {
      console.log('🖊️ KDS: Opening Edit Modal for Active Order:', order.id);
      setEditingOrder(order);
      setIsEditModalOpen(true);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingOrder(null);
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4 font-heebo overflow-hidden" dir="rtl">
      <style>{kdsStyles}</style>

      {/* מסגרת מלאה */}
      <div className="bg-slate-50 w-full h-full rounded-[24px] overflow-hidden shadow-2xl flex flex-col relative ring-4 ring-gray-800">
        <Header
          onRefresh={handleRefresh}
          isLoading={isLoading || isHistoryLoading}
          lastUpdated={lastUpdated}
          onUndoLastAction={handleUndoLastAction}
          canUndo={!!lastAction}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />

        {/* View Content */}
        {viewMode === 'active' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* חצי עליון: בטיפול (50%) */}
            <div className="flex-1 border-b-4 border-gray-200 relative bg-slate-100/50 flex flex-col min-h-0">
              <div className="absolute top-3 right-4 bg-white/90 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold text-slate-600 z-10 shadow-sm">
                בטיפול ({currentOrders.length})
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap p-6 pb-4 custom-scrollbar">
                <div className="flex h-full flex-row justify-start gap-4 items-stretch">
                  {currentOrders.map(order => (
                    <OrderCard
                      key={order.id} order={order}
                      onOrderStatusUpdate={handleStatusUpdate}
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
                <div className="flex h-full flex-row justify-start gap-4 items-stretch">
                  {completedOrders.map(order => (
                    <OrderCard
                      key={order.id} order={order} isReady={true}
                      onOrderStatusUpdate={handleStatusUpdate}
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
        ) : (
          <div className="flex-1 relative bg-purple-50/30 flex flex-col min-h-0 pb-safe">
            {/* History Toolbar / Badge */}
            <div className="absolute top-3 right-4 bg-purple-100 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold text-purple-700 z-10 shadow-sm flex items-center gap-2">
              <History size={12} />
              היסטוריית הזמנות ({historyOrders.length})
            </div>

            {/* History List - Horizontal Scroll similar to active */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap p-6 pb-20 custom-scrollbar">
              {isHistoryLoading ? (
                <div className="h-full w-full flex items-center justify-center text-purple-400 gap-2">
                  <RefreshCw className="animate-spin" /> טוען היסטוריה...
                </div>
              ) : (
                <div className="flex h-full flex-row justify-start gap-4 items-stretch">
                  {historyOrders.length === 0 ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 opacity-60 ml-20">
                      <History size={48} className="mb-2" />
                      <p>אין הזמנות לתאריך זה</p>
                    </div>
                  ) : (
                    historyOrders.map(order => (
                      <OrderCard
                        key={`${order.id}-${order.created_at || order.timestamp}-${selectedDate.toISOString().split('T')[0]}`} // Robust Unique Mapping Key
                        order={order}
                        isHistory={true} // New Prop
                        isReady={order.order_status === 'completed'} // Reuse styling
                        onOrderStatusUpdate={() => { }} // No Action
                        onPaymentCollected={(o) => handlePaymentCollected(o, true)} // From history
                        onFireItems={() => { }} // No Action
                        onReadyItems={() => { }} // No Action
                        onEditOrder={handleEditOrder} // Allow Edit (Restricted)
                        onCancelOrder={() => { }} // No Action
                        onRefresh={() => { }}
                      />
                    ))
                  )}

                </div>
              )}
            </div>

            {/* New Animated Date Scroller */}
            <div className={isHistoryLoading ? 'pointer-events-none opacity-50' : ''}>
              <DateScroller selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </div>
          </div>
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

        {/* Payment Selection Modal */}
        <KDSPaymentModal
          isOpen={!!selectedOrderForPayment}
          onClose={(closeInfo) => {
            // ALWAYS reset carefully to avoid "ghost" state
            setSelectedOrderForPayment(null);

            // If unpaid order was moved to history, show the info popup
            if (closeInfo?.showHistoryInfo) {
              setHistoryInfoModal({ isOpen: true, orderNumber: closeInfo.orderNumber });
            }
          }}
          order={selectedOrderForPayment}
          isFromHistory={selectedOrderForPayment?._fromHistory || false}
          onConfirmPayment={async (orderId, paymentMethod) => {
            try {
              await handleConfirmPayment(orderId, paymentMethod);
              setSelectedOrderForPayment(null);
              // Refresh history if in history mode
              if (viewMode === 'history') {
                setHistoryRefreshTrigger(prev => prev + 1);
              }
            } catch (err) {
              // error is handled inside handleConfirmPayment (modal)
            }
          }}
          onMoveToHistory={async (orderId) => {
            try {
              // Move to history (completed) without payment
              await updateOrderStatusBase(orderId, 'completed');
              await fetchOrders();
              // Note: onClose will be called by the modal after this, resetting selectedOrderForPayment
            } catch (err) {
              console.error('Failed to move to history:', err);
            }
          }}
        />

        {/* History Info Modal - shown when unpaid order is moved to history */}
        <HistoryInfoModal
          isOpen={historyInfoModal.isOpen}
          onClose={() => setHistoryInfoModal({ isOpen: false, orderNumber: null })}
          orderNumber={historyInfoModal.orderNumber}
        />

        <OrderEditModal
          isOpen={isEditModalOpen}
          order={editingOrder}
          onClose={handleCloseEditModal}
          onRefresh={() => fetchOrders()}
        />
      </div>
    </div>
  );
};

export default KdsScreen;