import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import BusinessInfoBar from '../../components/BusinessInfoBar';
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

  /* New Scroll Controls - Compact & Prominent */
  .scroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 30;
    width: 40px;
    height: 50px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(8px);
    border: 2px solid rgba(0, 0, 0, 0.15);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border-radius: 10px;
  }
  
  .scroll-btn:hover {
    background: white;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.15);
    border-color: #3b82f6;
  }
  
  .scroll-btn:active {
    transform: translateY(-50%) scale(0.95);
  }
  
  .scroll-btn-right { right: 6px; }
  .scroll-btn-left { left: 6px; }
  .scroll-btn:disabled { opacity: 0; pointer-events: none; }
  
  .scroll-count {
    font-size: 13px;
    font-weight: 900;
    color: white;
    background: #3b82f6;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
    margin-bottom: 2px;
  }
  
  .scroll-arrows {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .scroll-btn-pulse {
    animation: btn-pulse 1.2s ease-in-out infinite;
    border-color: #3b82f6;
  }
  
  .scroll-btn-flash {
    animation: btn-flash 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  @keyframes btn-pulse {
    0%, 100% { 
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      transform: translateY(-50%) scale(1);
    }
    50% { 
      box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.25), 0 4px 10px rgba(0, 0, 0, 0.1);
      transform: translateY(-50%) scale(1.05);
    }
  }

  @keyframes btn-flash {
    0%, 50%, 100% { background: white; border-color: rgba(0, 0, 0, 0.15); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); }
    25%, 75% { background: #dbeafe; border-color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); }
  }

  .new-order-glow {
    border-radius: 12px;
    animation: glow-fade 3s forwards;
  }
  
  /* Orange glow for cards moving to "בטיפול" (active/in_progress) */
  .glow-active {
    border-radius: 12px;
    animation: glow-fade-orange 3s forwards;
  }
  
  /* Green glow for cards moving to "מוכן" (ready) */
  .glow-ready {
    border-radius: 12px;
    animation: glow-fade-green 3s forwards;
  }
  
  @keyframes glow-fade-orange {
    0% { box-shadow: 0 0 20px 8px rgba(251, 146, 60, 0.7); }
    100% { box-shadow: none; }
  }
  
  @keyframes glow-fade-green {
    0% { box-shadow: 0 0 20px 8px rgba(34, 197, 94, 0.7); }
    100% { box-shadow: none; }
  }
  
  @keyframes glow-fade {
    0% { box-shadow: 0 0 20px 8px rgba(59, 130, 246, 0.6); }
    100% { box-shadow: none; }
  }
`;

const KDSScrollContainer = ({
  children,
  title,
  orders = [],
  colorClass,
  badgeClass
}) => {
  const scrollRef = useRef(null);
  const [counts, setCounts] = useState({ left: 0, right: 0 });
  const [shouldPulseRight, setShouldPulseRight] = useState(false);
  const [shouldFlashLeft, setShouldFlashLeft] = useState(false);
  const pulseTimerRef = useRef(null);
  const prevLeftCountRef = useRef(0);

  const calculateCounts = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const items = container.querySelectorAll('.kds-card-item');

    let leftCount = 0;
    let rightCount = 0;

    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      // Safety margin of 10px
      if (rect.right < containerRect.left + 5) {
        leftCount++;
      } else if (rect.left > containerRect.right - 5) {
        rightCount++;
      }
    });

    // Trigger flash if left count increased
    if (leftCount > prevLeftCountRef.current) {
      setShouldFlashLeft(true);
      setTimeout(() => setShouldFlashLeft(false), 800);
    }
    prevLeftCountRef.current = leftCount;

    setCounts({ left: leftCount, right: rightCount });

    // Start pulse timer if there are items to the right (need to go back to start in RTL)
    // Only start if not already pulsing and no existing timer
    if (rightCount > 0 && !pulseTimerRef.current) {
      pulseTimerRef.current = setTimeout(() => {
        setShouldPulseRight(true);
        pulseTimerRef.current = null; // Clear ref but keep pulsing
      }, 3000);
    } else if (rightCount === 0) {
      // Back to start - stop pulsing and clear timer
      setShouldPulseRight(false);
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      calculateCounts();
      // Tech Fix: Clear pulse timer if user is manually scrolling
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };
    container.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver(calculateCounts);
    resizeObserver.observe(container);

    setTimeout(calculateCounts, 200);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [calculateCounts, orders.length]);

  const scrollToEdge = (edge) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;

    // TECH NOTE (RTL Behavior): 
    // In LTR: 0 is left, scrollWidth-clientWidth is right.
    // In RTL: 0 is right (start), -(scrollWidth-clientWidth) is left (end).
    // container.scrollTo handles these directions automatically when dir="rtl" is set.
    const target = edge === 'right' ? 0 : -(container.scrollWidth - container.clientWidth);

    container.scrollTo({
      left: target,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`flex-1 relative flex flex-col min-h-0 ${colorClass}`}>
      <div className={`absolute top-3 right-4 z-20 ${badgeClass} px-3 py-1 rounded-full text-xs font-bold shadow-sm`}>
        {title} ({orders.length})
      </div>

      {/* Back to start button (right in RTL) - pulses after 3 seconds */}
      <button
        onClick={() => scrollToEdge('right')}
        disabled={counts.right === 0}
        className={`scroll-btn scroll-btn-right group ${shouldPulseRight ? 'scroll-btn-pulse' : ''}`}
      >
        {counts.right > 0 && <span className="scroll-count">{counts.right}</span>}
        <div className="scroll-arrows flex items-center justify-center -space-x-1.5 rtl:space-x-reverse">
          <ChevronRight size={11} strokeWidth={2.5} className="text-blue-500/70" />
          <ChevronRight size={11} strokeWidth={2.5} className="text-blue-500/70" />
        </div>
      </button>

      {/* Scroll to end button (left in RTL) */}
      <button
        onClick={() => scrollToEdge('left')}
        disabled={counts.left === 0}
        className={`scroll-btn scroll-btn-left group ${shouldFlashLeft ? 'scroll-btn-flash' : ''}`}
      >
        {counts.left > 0 && <span className="scroll-count">{counts.left}</span>}
        <div className="scroll-arrows flex items-center justify-center -space-x-1.5 rtl:space-x-reverse">
          <ChevronLeft size={11} strokeWidth={2.5} className="text-blue-500/70" />
          <ChevronLeft size={11} strokeWidth={2.5} className="text-blue-500/70" />
        </div>
      </button>

      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap p-6 pb-4 custom-scrollbar scroll-smooth"
      >
        <div className="flex h-full flex-row justify-start gap-4 items-stretch">
          <AnimatePresence initial={false}>
            {children}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// --- רכיבים ---

// --- רכיבים ---

// --- רכיבים ---



// --- רכיבים ---

const Header = ({
  onRefresh, isLoading, lastUpdated, onUndoLastAction, canUndo,
  viewMode, setViewMode, selectedDate, setSelectedDate,
  showPending, setShowPending
}) => {
  const navigate = useNavigate();

  const handleNewOrder = () => {
    sessionStorage.setItem('order_origin', 'kds');
    // Navigate to menu with clear indicators
    navigate('/?from=kds&new=true');
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
    <div className="bg-white shadow-sm z-20 shrink-0 px-6 py-2 flex items-center border-b border-gray-200 font-heebo">
      {/* Right Side - Main Controls */}
      <div className="flex items-center gap-3 flex-1">
        {/* Home Button (Far Right) */}
        <button onClick={handleExit} className="p-2 text-gray-400 hover:text-red-500 hover:bg-neutral-100 rounded-xl transition">
          <House size={20} />
        </button>

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

        {/* Pending Orders Toggle */}
        <button
          onClick={() => setShowPending(!showPending)}
          className={`px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${showPending ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600'}`}
          title={showPending ? 'הסתר הזמנות ממתינות' : 'הצג הזמנות ממתינות (משלוחים)'}
        >
          <Package size={16} />
          {showPending ? 'ממתינות ✓' : 'ממתינות'}
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`p-2 rounded-xl transition ${isLoading ? 'text-blue-400 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
          title="רענן הזמנות"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Center - Clock & Connection Status */}
      <div className="flex items-center gap-3 px-4">
        <div className="text-lg font-black text-slate-700">
          {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <ConnectionStatusBar isIntegrated={true} />
      </div>

      {/* Left Side - Music + Actions */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        <MiniMusicPlayer />

        <div className="w-px h-6 bg-gray-200" />

        <button
          onClick={canUndo ? onUndoLastAction : undefined}
          disabled={!canUndo}
          className={`p-2 rounded-xl transition ${canUndo ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300'}`}
        >
          <RotateCcw size={18} />
        </button>

        {/* New Order Button (Far Left = Last in RTL) */}
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
    forceRefresh,
    fetchHistoryOrders,
    findNearestActiveDate,
    updateOrderStatus: updateOrderStatusBase,
    handleFireItems,
    handleReadyItems,
    handleToggleEarlyDelivered,
    handleUndoLastAction,
    handleConfirmPayment,
    handleCancelOrder
  } = useKDSData();

  const [newOrderIds, setNewOrderIds] = useState(new Set());
  // Toggle to show/hide pending orders (e.g., delivery orders awaiting acknowledgment)
  // Default: ON - show pending orders so staff can acknowledge them
  const [showPending, setShowPending] = useState(true);

  // Multi-step status update with potential popup
  const handleStatusUpdate = async (orderId, currentStatus) => {
    try {
      // Find the order details before it disappears from state
      const allActive = Array.isArray(currentOrders) ? currentOrders : [];
      const allReady = Array.isArray(completedOrders) ? completedOrders : [];
      const targetOrder = [...allActive, ...allReady].find(o => o.id === orderId);

      // Set last action ID for glow effect (new multi-ID support)
      setNewOrderIds(prev => {
        const next = new Set(prev);
        next.add(orderId);
        return next;
      });
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }, 3000);

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
    // 🚀 FORCE 'active' for new entries to KDS
    const isNavigationState = !!(location.state?.viewMode);
    if (isNavigationState) return location.state.viewMode;

    // Always default to active when entering fresh, but allow persistence IF the user is already on the page
    return 'active';
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

  // Keep editingOrder in sync with main orders list to reflect updates (like is_early_delivered)
  useEffect(() => {
    if (isEditModalOpen && editingOrder) {
      const allPossibleOrders = [...(currentOrders || []), ...(completedOrders || [])];
      // Note: editingOrder might be a specific stage, so we match by basic ID
      const baseId = (editingOrder.originalOrderId || editingOrder.id || '').toString().replace(/-stage-\d+/, '').replace('-ready', '');
      const updated = allPossibleOrders.find(o => {
        const oBaseId = (o.originalOrderId || o.id || '').toString().replace(/-stage-\d+/, '').replace('-ready', '');
        return oBaseId === baseId;
      });

      if (updated && JSON.stringify(updated) !== JSON.stringify(editingOrder)) {
        setEditingOrder(updated);
      }
    }
  }, [currentOrders, completedOrders, isEditModalOpen]);

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

  // Track new orders for glow effect
  const prevCurrentOrdersRef = useRef(currentOrders);
  useEffect(() => {
    if (currentOrders.length > prevCurrentOrdersRef.current.length) {
      const newOrders = currentOrders.filter(o => !prevCurrentOrdersRef.current.find(p => p.id === o.id));
      if (newOrders.length > 0) {
        // Support multiple new orders glowing at once
        const idsToAdd = newOrders.map(o => o.id);
        setNewOrderIds(prev => {
          const next = new Set(prev);
          idsToAdd.forEach(id => next.add(id));
          return next;
        });

        setTimeout(() => {
          setNewOrderIds(prev => {
            const next = new Set(prev);
            idsToAdd.forEach(id => next.delete(id));
            return next;
          });
        }, 3000);
      }
    }
    prevCurrentOrdersRef.current = currentOrders;
  }, [currentOrders]);


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
    // If in history mode, go directly to full edit
    if (viewMode === 'history') {
      const realOrderId = (order.originalOrderId || order.id || '').toString().replace(/-stage-\d+/, '').replace('-ready', '');
      console.log('🖊️ KDS History: Redirecting to full edit for:', realOrderId);
      navigate(`/?editOrderId=${realOrderId}&from=kds`, { replace: true });
      return;
    }

    // Open the quick view modal (View/Early Delivery)
    console.log('🖊️ KDS: Opening View Modal for Order:', order.id);
    setEditingOrder(order);
    setIsEditModalOpen(true);
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
          showPending={showPending}
          setShowPending={setShowPending}
        />

        {/* View Content */}
        <KDSErrorBoundary>
          {viewMode === 'active' ? (() => {
            // Filter pending orders based on toggle
            const filteredCurrentOrders = showPending
              ? currentOrders
              : currentOrders.filter(o => o.orderStatus !== 'pending');

            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                <KDSScrollContainer
                  title="בטיפול"
                  orders={filteredCurrentOrders}
                  colorClass="border-b-4 border-gray-200 bg-slate-100/50"
                  badgeClass="bg-white/90 border border-gray-200 text-slate-600"
                >
                  {filteredCurrentOrders.map(order => (
                    <motion.div
                      key={order.id}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        layout: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.2 }
                      }}
                      className="flex-shrink-0 kds-card-item"
                    >
                      <OrderCard
                        key={order.id} // RELIABLE STABLE KEY
                        order={order}
                        glowClass={newOrderIds.has(order.id) ? 'glow-active' : ''}
                        onOrderStatusUpdate={handleStatusUpdate}
                        onPaymentCollected={handlePaymentCollected}
                        onFireItems={handleFireItems}
                        onToggleEarlyDelivered={handleToggleEarlyDelivered}
                        onEditOrder={handleEditOrder}
                        onCancelOrder={handleCancelOrder}
                        onRefresh={forceRefresh}
                      />
                    </motion.div>
                  ))}
                </KDSScrollContainer>

                <KDSScrollContainer
                  title="מוכן למסירה"
                  orders={completedOrders}
                  colorClass="bg-green-50/30"
                  badgeClass="bg-green-100 border border-green-200 text-green-700"
                >
                  {completedOrders.map(order => (
                    <motion.div
                      key={order.id}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        layout: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.2 }
                      }}
                      className="flex-shrink-0 kds-card-item"
                    >
                      <OrderCard
                        key={order.id} // RELIABLE STABLE KEY
                        order={order} isReady={true}
                        glowClass={newOrderIds.has(order.id) ? 'glow-ready' : ''}
                        onOrderStatusUpdate={handleStatusUpdate}
                        onPaymentCollected={handlePaymentCollected}
                        onToggleEarlyDelivered={handleToggleEarlyDelivered}
                        onEditOrder={handleEditOrder}
                        onCancelOrder={handleCancelOrder}
                        onRefresh={forceRefresh}
                      />
                    </motion.div>
                  ))}
                </KDSScrollContainer>
              </div>
            );
          })() : (
            <div className="flex-1 relative bg-purple-50/30 flex flex-col min-h-0 pb-safe">
              {/* History List - Horizontal Scroll similar to active */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap p-2 pt-2 pb-2 custom-scrollbar">
                {isHistoryLoading ? (
                  <div className="h-full w-full flex items-center justify-center text-purple-400 gap-2">
                    <RefreshCw className="animate-spin" /> טוען היסטוריה...
                  </div>
                ) : (
                  <div className="flex h-full flex-row justify-start gap-1 items-stretch">
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
                          onToggleEarlyDelivered={handleToggleEarlyDelivered}
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
        </KDSErrorBoundary>


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
              // Switch back to active view as requested by user
              setViewMode('active');
              // Refresh orders to see the change if needed
              fetchOrders();
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
          onRefresh={forceRefresh}
        />
      </div>
    </div>
  );
};

export default KdsScreen;