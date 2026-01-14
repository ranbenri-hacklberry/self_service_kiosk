import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar, BarChart3, PieChart, ChevronDown, ChevronUp, Package, X, Phone, User, Clock, Hash, Receipt, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

const SalesDashboard = () => {
  const { currentUser, isAuthenticated } = useAuth();

  console.log('🔍 SalesDashboard Debug:', {
    currentUser,
    isAuthenticated,
    user: currentUser,
    userProfile: currentUser?.user_metadata
  });

  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [currentSales, setCurrentSales] = useState([]); // Data for current period (Flattened Items)
  const [currentRawOrders, setCurrentRawOrders] = useState([]); // Raw Orders for Orders List
  const [previousSales, setPreviousSales] = useState([]); // Data for comparison period
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Navigation State
  const [[dateMs, direction], setDateTuple] = useState([new Date().setHours(0, 0, 0, 0), 0]);
  const selectedDate = useMemo(() => new Date(dateMs), [dateMs]);

  // Active Dates Cache
  const [activeDates, setActiveDates] = useState([]);

  // Graph Selection State (for filtering the list)
  const [selectedGraphBar, setSelectedGraphBar] = useState(null); // { key: string|int, type: 'hour'|'day' }

  // Category Accordion State
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Orders List Accordion State
  const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());

  // Helper to format currency
  const formatCurrency = (amount) => `₪${amount.toFixed(0)}`;

  const toggleCategory = (cat) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(cat)) newSet.delete(cat);
    else newSet.add(cat);
    setExpandedCategories(newSet);
  };

  const toggleOrder = (orderId) => {
    const newSet = new Set(expandedOrderIds);
    if (newSet.has(orderId)) newSet.delete(orderId);
    else newSet.add(orderId);
    setExpandedOrderIds(newSet);
  };

  // Fetch Active Dates on Mount
  useEffect(() => {
    const fetchActiveDates = async () => {
      try {
        const { data, error } = await supabase.rpc('get_active_sales_dates', {
          p_business_id: currentUser?.business_id
        });

        if (error) throw error;

        if (data && data.length > 0) {
          // RPC returns array of ISO date strings (YYYY-MM-DD)
          // We need to convert them to .toDateString() format to match existing navigation logic
          const datesList = data.map(d => new Date(d).toDateString());
          setActiveDates(datesList);

          const todayStr = new Date().toDateString();
          if (!datesList.includes(todayStr) && datesList.length > 0) {
            const mostRecent = new Date(datesList[0]);
            mostRecent.setHours(0, 0, 0, 0);
            setDateTuple([mostRecent.getTime(), 0]);
          }
        }
      } catch (e) {
        console.error('Error fetching active dates:', e);
      }
    };
    fetchActiveDates();
  }, [currentUser?.business_id]);

  // Navigation Logic
  const getDateRanges = (mode, date) => {
    const now = new Date();
    const currentStart = new Date(date);
    const currentEnd = new Date(date);
    const previousStart = new Date(date);
    const previousEnd = new Date(date);

    if (mode === 'daily') {
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setHours(23, 59, 59, 999);
      previousStart.setTime(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
      previousEnd.setTime(currentEnd.getTime() - (7 * 24 * 60 * 60 * 1000));
    } else if (mode === 'weekly') {
      const day = currentStart.getDay();
      currentStart.setDate(currentStart.getDate() - day);
      currentStart.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(currentStart);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // ALWAYS fetch the full week for calculation purposes
      currentEnd.setTime(endOfWeek.getTime());

      // Previous week logic
      previousStart.setTime(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
      previousEnd.setTime(currentEnd.getTime() - (7 * 24 * 60 * 60 * 1000));

    } else if (mode === 'monthly') {
      currentStart.setDate(1);
      currentStart.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(currentStart);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      if (now >= currentStart && now <= endOfMonth) {
        currentEnd.setTime(now.getTime());
      } else {
        currentEnd.setTime(endOfMonth.getTime());
      }

      previousStart.setMonth(previousStart.getMonth() - 1);

      const isPartial = currentEnd < endOfMonth;
      if (isPartial) {
        previousEnd.setTime(previousStart.getTime());
        previousEnd.setDate(currentEnd.getDate());
        previousEnd.setHours(currentEnd.getHours(), currentEnd.getMinutes(), currentEnd.getSeconds());
      } else {
        previousEnd.setMonth(previousEnd.getMonth() + 1);
        previousEnd.setDate(0);
        previousEnd.setHours(23, 59, 59, 999);
      }
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  };

  const fetchSalesData = async () => {
    setLoading(true);
    setSelectedGraphBar(null);
    setError(null);

    try {
      const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(viewMode, selectedDate);

      const fetchPeriod = async (start, end) => {
        console.log('🔍 Calling get_sales_data RPC:', {
          business_id: currentUser?.business_id,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          user: currentUser
        });

        // Use RPC function to bypass RLS
        const { data, error } = await supabase.rpc('get_sales_data', {
          p_business_id: currentUser?.business_id,
          p_start_date: start.toISOString(),
          p_end_date: end.toISOString()
        });

        if (error) throw error;

        const flattened = [];
        data?.forEach(order => {
          order.order_items?.forEach(item => {
            if (item.menu_items) {
              flattened.push({
                quantity: item.quantity || 0,
                price: item.price || 0,
                category: item.menu_items.category || 'אחר',
                name: item.menu_items.name || 'לא ידוע',
                date: order.created_at
              });
            }
          });
        });

        return { flattened, raw: data };
      };

      const [curr, prev] = await Promise.all([
        fetchPeriod(currentStart, currentEnd),
        fetchPeriod(previousStart, previousEnd)
      ]);

      setCurrentSales(curr.flattened);
      setCurrentRawOrders(curr.raw);
      setPreviousSales(prev.flattened); // We only start flattened for prev comparison for now

    } catch (err) {
      console.error('Error fetching sales:', err);
      setError('שגיאה בטעינת נתוני מכירות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.business_id) {
      fetchSalesData();
    }
  }, [viewMode, selectedDate, currentUser?.business_id]);

  // Aggregation Helpers
  const aggregate = (data) => {
    const total = data.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deepStats = data.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = { totalAmount: 0, totalCount: 0, items: {} };
      }
      acc[item.category].totalAmount += (item.price * item.quantity);
      acc[item.category].totalCount += item.quantity;
      if (!acc[item.category].items[item.name]) {
        acc[item.category].items[item.name] = { count: 0, total: 0 };
      }
      acc[item.category].items[item.name].count += item.quantity;
      acc[item.category].items[item.name].total += (item.price * item.quantity);
      return acc;
    }, {});
    return { total, deepStats };
  };

  // Filtered Sales Logic (Interactive Graph)
  const isExcluded = (dateStr) => {
    if (!selectedGraphBar) return false;
    const d = new Date(dateStr);
    if (viewMode === 'daily') {
      return d.getHours() !== selectedGraphBar.key;
    } else {
      // Compare D/M key
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      return key !== selectedGraphBar.key;
    }
  };

  const displayedSales = useMemo(() => {
    if (!selectedGraphBar) return currentSales;
    return currentSales.filter(item => !isExcluded(item.date));
  }, [currentSales, selectedGraphBar, viewMode]);

  const displayedOrders = useMemo(() => {
    if (!selectedGraphBar) return currentRawOrders;
    return currentRawOrders.filter(order => !isExcluded(order.created_at));
  }, [currentRawOrders, selectedGraphBar, viewMode]);

  const currentStats = useMemo(() => aggregate(displayedSales), [displayedSales]);
  const totalPeriodStats = useMemo(() => aggregate(currentSales), [currentSales]);
  const previousStats = useMemo(() => aggregate(previousSales), [previousSales]);

  // Calculate Percentage Change
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const percentageChange = useMemo(() => {
    return calculateChange(totalPeriodStats.total, previousStats.total);
  }, [totalPeriodStats, previousStats]);

  /**
   * SPLIT STATS - "Apples to Apples" Comparison Logic
   * 
   * Business Problem: When comparing weekly/monthly sales, a simple comparison
   * is unfair. Example: It's Wednesday noon, and we compare to last full week.
   * Last week had 7 days, this week has only 2.5 days = misleading comparison!
   * 
   * Solution: We calculate TWO metrics:
   * 1. PARTIAL (Cumulative): Sales up to the same day/hour as "now"
   *    - If today is Wed 12:00, we compare:
   *      This week: Sun-Wed 12:00 vs Last week: Sun-Wed 12:00
   *    - This gives a FAIR "apples to apples" comparison.
   * 
   * 2. FULL: Total sales for the entire period.
   *    - For current period: Shows "in progress" indicator.
   *    - For past periods: Shows final total.
   * 
   * The "offset" calculation converts a date to "minutes since period start"
   * to enable comparing the same relative point in different periods.
   */
  const splitStats = useMemo(() => {
    if (viewMode !== 'weekly' && viewMode !== 'monthly') return null;

    const now = new Date();

    if (viewMode === 'weekly') {
      // Calculate offset in minutes from Sunday 00:00 (start of week)
      // Formula: (dayOfWeek * 24 * 60) + (hours * 60) + minutes
      const getWeekOffset = (d) => {
        const date = new Date(d);
        return (date.getDay() * 24 * 60) + (date.getHours() * 60) + date.getMinutes();
      };
      const currentOffset = getWeekOffset(now);
      // Filter items that occurred before "now" relative to their week start
      const isPartial = (item) => getWeekOffset(item.date) <= currentOffset;

      const partialCurrent = currentSales.filter(isPartial);
      const partialPrevious = previousSales.filter(isPartial);

      return {
        partial: {
          total: aggregate(partialCurrent).total,
          prev: aggregate(partialPrevious).total,
          change: calculateChange(aggregate(partialCurrent).total, aggregate(partialPrevious).total)
        },
        full: {
          total: totalPeriodStats.total,
          prev: previousStats.total,
          change: calculateChange(totalPeriodStats.total, previousStats.total)
        }
      };
    } else {
      // Monthly: Calculate offset in minutes from 1st of month 00:00
      // Formula: (dayOfMonth * 24 * 60) + (hours * 60) + minutes
      const getMonthOffset = (d) => {
        const date = new Date(d);
        return (date.getDate() * 24 * 60) + (date.getHours() * 60) + date.getMinutes();
      };
      const currentOffset = getMonthOffset(now);
      const isPartial = (item) => getMonthOffset(item.date) <= currentOffset;

      const partialCurrent = currentSales.filter(isPartial);
      const partialPrevious = previousSales.filter(isPartial);

      return {
        partial: {
          total: aggregate(partialCurrent).total,
          prev: aggregate(partialPrevious).total,
          change: calculateChange(aggregate(partialCurrent).total, aggregate(partialPrevious).total)
        },
        full: {
          total: totalPeriodStats.total,
          prev: previousStats.total,
          change: calculateChange(totalPeriodStats.total, previousStats.total)
        }
      };
    }
  }, [viewMode, currentSales, previousSales, totalPeriodStats, previousStats]);

  // Graph Data Preparation
  const graphData = useMemo(() => {
    if (viewMode === 'daily') {
      const hoursMap = new Map();
      currentSales.forEach(item => {
        const h = new Date(item.date).getHours();
        const currentVal = hoursMap.get(h) || 0;
        hoursMap.set(h, currentVal + (item.price * item.quantity));
      });

      if (hoursMap.size === 0) return [];

      let minHour = 23;
      let maxHour = 0;
      for (let h of hoursMap.keys()) {
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }
      minHour = Math.max(0, minHour - 1);
      maxHour = Math.min(23, maxHour + 1);

      const result = [];
      for (let i = minHour; i <= maxHour; i++) {
        result.push({
          name: `${i}:00`,
          key: i,
          amount: hoursMap.get(i) || 0
        });
      }
      return result;

    } else {
      // Weekly/Monthly: Show all days in the range
      const buckets = {};

      // Create buckets for data
      currentSales.forEach(item => {
        const d = new Date(item.date);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        if (!buckets[key]) buckets[key] = 0;
        buckets[key] += (item.price * item.quantity);
      });

      const result = [];
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      let rangeStart, rangeEnd;

      if (viewMode === 'weekly') {
        rangeStart = new Date(selectedDate);
        rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
        rangeStart.setHours(0, 0, 0, 0);

        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 6);
        rangeEnd.setHours(23, 59, 59, 999);
      } else {
        // Monthly logic
        rangeStart = new Date(selectedDate);
        rangeStart.setDate(1);
        rangeStart.setHours(0, 0, 0, 0);

        rangeEnd = new Date(rangeStart);
        rangeEnd.setMonth(rangeEnd.getMonth() + 1);
        rangeEnd.setDate(0); // Last day of the month
        rangeEnd.setHours(23, 59, 59, 999);

        // If the selected month is the current month, limit end date to 'now'
        if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
          rangeEnd = new Date(now);
        }
      }

      let currentDay = new Date(rangeStart);

      while (currentDay <= rangeEnd) {
        const key = `${currentDay.getDate()}/${currentDay.getMonth() + 1}`;
        const displayName = viewMode === 'monthly' ? `${currentDay.getDate()}` : key;
        result.push({
          name: displayName,
          key: key,
          amount: buckets[key] || 0
        });
        currentDay = new Date(currentDay.getTime() + dayMs);
      }

      return result;
    }
  }, [currentSales, viewMode, selectedDate]);

  // Navigation (Unchanged Logic - Copied for context)
  const goToPreviousPeriod = () => {
    let nextDate = new Date(selectedDate);
    if (viewMode === 'daily' && activeDates.length > 0) {
      const currentStr = selectedDate.toDateString();
      const currentIndex = activeDates.indexOf(currentStr);
      if (currentIndex < activeDates.length - 1 && currentIndex !== -1) nextDate = new Date(activeDates[currentIndex + 1]);
      else if (currentIndex === -1) {
        const targetIndex = activeDates.findIndex(d => new Date(d) < selectedDate);
        if (targetIndex !== -1) nextDate = new Date(activeDates[targetIndex]);
        else nextDate.setDate(nextDate.getDate() - 1);
      } else nextDate.setDate(nextDate.getDate() - 1);
    } else {
      if (viewMode === 'daily') nextDate.setDate(nextDate.getDate() - 1);
      else if (viewMode === 'weekly') nextDate.setDate(nextDate.getDate() - 7);
      else if (viewMode === 'monthly') nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setDateTuple([nextDate.getTime(), -1]);
  };

  const goToNextPeriod = () => {
    let nextDate = new Date(selectedDate);
    if (viewMode === 'daily' && activeDates.length > 0) {
      const currentStr = selectedDate.toDateString();
      const currentIndex = activeDates.indexOf(currentStr);
      if (currentIndex > 0) nextDate = new Date(activeDates[currentIndex - 1]);
      else if (currentIndex === -1) {
        const reversed = [...activeDates].reverse();
        const target = reversed.find(d => new Date(d) > selectedDate);
        if (target) nextDate = new Date(target);
        else nextDate.setDate(nextDate.getDate() + 1);
      } else nextDate.setDate(nextDate.getDate() + 1);
    } else {
      if (viewMode === 'daily') nextDate.setDate(nextDate.getDate() + 1);
      else if (viewMode === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (viewMode === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    }
    if (nextDate <= new Date() || (viewMode === 'monthly' && nextDate.getMonth() === new Date().getMonth() && nextDate.getFullYear() === new Date().getFullYear()) || (viewMode === 'weekly' && nextDate.getTime() <= new Date().getTime() + 7 * 24 * 60 * 60 * 1000)) {
      setDateTuple([nextDate.getTime(), 1]);
    }
  };

  const isNextDisabled = () => {
    const now = new Date();
    if (viewMode === 'daily') return selectedDate.toDateString() === now.toDateString();
    if (viewMode === 'weekly') {
      const startOfCurrentWeek = new Date(now);
      startOfCurrentWeek.setDate(now.getDate() - now.getDay());
      return selectedDate >= startOfCurrentWeek;
    }
    if (viewMode === 'monthly') return selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
    return false;
  };

  const getPeriodLabel = () => {
    const date = selectedDate;
    if (viewMode === 'daily') return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    return date.toLocaleDateString('he-IL');
  };

  const getComparisonLabel = () => {
    if (viewMode === 'daily') {
      const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      return `מול יום ${days[selectedDate.getDay()]} שעבר`;
    }
    return 'מול תקופה קודמת';
  }

  // Helper: Get descriptive label for partial comparison
  const getPartialLabel = () => {
    const now = new Date();
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (viewMode === 'weekly') {
      if (isNextDisabled()) {
        return `עד היום בשעה ${timeStr}`;
      } else {
        return `עד יום ${days[now.getDay()]} ${timeStr}`;
      }
    } else if (viewMode === 'monthly') {
      if (isNextDisabled()) {
        return `עד ה-${now.getDate()} בשעה ${timeStr}`;
      } else {
        return `עד ה-${now.getDate()} בחודש`;
      }
    }
    return '';
  };

  // Helper: Get period date range label
  const getPeriodRangeLabel = () => {
    const formatDate = (date) => `${date.getDate()}/${date.getMonth() + 1}`;
    const d = new Date(selectedDate);

    if (viewMode === 'weekly') {
      if (isNextDisabled()) return 'השבוע הנוכחי';
      const start = new Date(d); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 6);

      // Check if it's last week
      const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const startOfLastWeek = new Date(oneWeekAgo); startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay()); startOfLastWeek.setHours(0, 0, 0, 0);
      if (start.getTime() === startOfLastWeek.getTime()) {
        return `שבוע שעבר (${formatDate(start)} - ${formatDate(end)})`;
      }
      return `${formatDate(start)} - ${formatDate(end)}`;
    } else if (viewMode === 'monthly') {
      if (isNextDisabled()) return selectedDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      // Check if it's last month
      const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
      if (d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()) {
        return `חודש שעבר (${d.toLocaleDateString('he-IL', { month: 'long' })})`;
      }
      return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    }
    return '';
  };

  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? -500 : 500, opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit: (direction) => ({ zIndex: 0, x: direction < 0 ? -500 : 500, opacity: 0 })
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-4 pb-20 p-4">
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex justify-center sticky top-0 z-10">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full max-w-md">
          {[
            { id: 'daily', label: 'יומי', icon: Calendar },
            { id: 'weekly', label: 'שבועי', icon: BarChart3 },
            { id: 'monthly', label: 'חודשי', icon: PieChart }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setViewMode(tab.id);
                setDateTuple([new Date().getTime(), 0]);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Main Stats Card */}
        <div className="relative h-44 w-full">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={`${viewMode}-${dateMs}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "tween", duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.3 }
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset }) => {
                if (offset.x < -50) goToPreviousPeriod();
                else if (offset.x > 50 && !isNextDisabled()) goToNextPeriod();
              }}
              className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl shadow-lg flex flex-col justify-center px-4 cursor-grab active:cursor-grabbing overflow-hidden"
            >
              <div className="flex justify-between items-center w-full relative z-10 h-full py-3">
                <button
                  onClick={goToPreviousPeriod}
                  aria-label="תקופה קודמת"
                  className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white absolute right-1 top-1/2 -translate-y-1/2 transition-colors"
                >
                  <ChevronRight size={24} />
                </button>

                <div className="flex-1 flex items-center justify-center px-8 h-full">
                  {(viewMode === 'weekly' || viewMode === 'monthly') && splitStats ? (
                    <div className="flex flex-col w-full h-full">
                      <div className="flex w-full flex-1 divide-x divide-white/20 divide-x-reverse min-h-0">
                        {/* Right Side: Partial (Cumulative Comparison) */}
                        <div className="flex-1 flex flex-col items-center justify-center px-2">
                          {/* Row 1: Title with Info Tooltip */}
                          <div className="text-blue-200 text-[10px] font-bold uppercase tracking-wider h-4 flex items-center gap-1">
                            <span>מצטבר</span>
                            <span
                              title="השוואה הוגנת: משווה מכירות עד אותו יום ושעה בתקופה הקודמת"
                              className="cursor-help opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <Info size={10} />
                            </span>
                          </div>
                          {/* Row 2: Amount (Same height on both sides) */}
                          <div className="text-3xl font-black h-10 flex items-center">{formatCurrency(splitStats.partial.total)}</div>
                          {/* Row 3: Subtitle */}
                          <div className="text-[9px] text-blue-200/80 h-4 flex items-center">{getPartialLabel()}</div>
                          {/* Row 4: Badge */}
                          <div className="h-5 flex items-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${splitStats.partial.change >= 0 ? 'bg-green-400/20 text-green-200' : 'bg-red-400/20 text-red-200'}`}>
                              {splitStats.partial.change >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                              {Math.abs(splitStats.partial.change).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Left Side: Full Period */}
                        <div className="flex-1 flex flex-col items-center justify-center px-2">
                          {/* Row 1: Title */}
                          <div className="text-blue-200 text-[10px] font-bold uppercase tracking-wider h-4 flex items-center">{viewMode === 'weekly' ? 'סה״כ שבועי' : 'סה״כ חודשי'}</div>
                          {/* Row 2: Amount (Same height on both sides) */}
                          <div className="text-3xl font-black h-10 flex items-center">{formatCurrency(splitStats.full.total)}</div>
                          {/* Row 3: Subtitle (empty placeholder for alignment) */}
                          <div className="text-[9px] text-blue-200/80 h-4 flex items-center opacity-0">-</div>
                          {/* Row 4: Badge */}
                          <div className="h-5 flex items-center">
                            {isNextDisabled() ? (
                              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">בתהליך</span>
                            ) : (
                              <span className="text-[10px] text-blue-200/80">סופי</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Date Range Label */}
                      <div className="border-t border-white/10 mt-2 pt-1.5 text-center">
                        <span className="text-[10px] text-blue-100 font-medium">{getPeriodRangeLabel()}</span>
                      </div>
                    </div>
                  ) : (
                    // Default Single View (Daily only)
                    <div className="text-center">
                      <div className="text-blue-100 text-sm font-medium opacity-90">{getPeriodLabel()}</div>
                      <div className="text-4xl font-black tracking-tight mt-2">{formatCurrency(totalPeriodStats.total)}</div>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-xs text-blue-100 opacity-75">{getComparisonLabel()}: {formatCurrency(previousStats.total)}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${percentageChange >= 0 ? 'bg-green-400/20 text-green-200' : 'bg-red-400/20 text-red-200'}`}>
                          {percentageChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {Math.abs(percentageChange).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={goToNextPeriod}
                  disabled={isNextDisabled()}
                  aria-label="תקופה הבאה"
                  className={`p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white absolute left-1 top-1/2 -translate-y-1/2 transition-colors ${isNextDisabled() ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <ChevronLeft size={24} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sales Graph - Interactive */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <h3 className="font-bold text-gray-800 mb-1 text-sm px-2 flex justify-between items-center h-6">
            <span className="flex items-center gap-2">
              {selectedGraphBar ? (
                <button
                  onClick={() => setSelectedGraphBar(null)}
                  className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-xs transition-colors hover:bg-blue-100"
                >
                  <X size={12} />
                  חזור לסיכום יומי
                </button>
              ) : (
                <span>{viewMode === 'daily' ? 'מכירות לפי שעות (פעילות)' : 'מכירות לפי ימים'}</span>
              )}
            </span>
            <BarChart3 size={16} className="text-blue-500" />
          </h3>
          <div className="flex-1 w-full min-h-0 text-xs mt-1">
            {graphData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center border-2 border-dashed border-gray-100 rounded-lg">אין נתונים להצגה</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={val => `₪${val}`}
                  />
                  <Bar
                    dataKey="amount"
                    radius={[3, 3, 0, 0]}
                    onClick={(data) => {
                      if (selectedGraphBar?.key === data.key) setSelectedGraphBar(null);
                      else setSelectedGraphBar({ key: data.key, type: viewMode === 'daily' ? 'hour' : 'day' });
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {graphData.map((entry, index) => (
                      <Cell
                        key={`graph-cell-${entry.key || index}`}
                        fill={selectedGraphBar?.key === entry.key ? '#2563eb' : (selectedGraphBar ? '#dbeafe' : '#60a5fa')}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Preparation Time Chart - Shows average prep time per hour/day */}
      {displayedOrders.length > 0 && (() => {
        // Calculate average prep time per bucket (hour for daily, day for weekly/monthly)
        const prepTimeByBucket = new Map();
        displayedOrders.forEach(order => {
          const start = new Date(order.created_at).getTime();
          const end = order.ready_at
            ? new Date(order.ready_at).getTime()
            : order.updated_at
              ? new Date(order.updated_at).getTime()
              : null;
          if (!end || isNaN(start)) return;
          const mins = Math.max(0, Math.floor((end - start) / 60000));
          if (mins > 120) return; // Skip outliers

          // Bucket key depends on view mode
          let bucketKey;
          if (viewMode === 'daily') {
            bucketKey = new Date(order.created_at).getHours();
          } else {
            const d = new Date(order.created_at);
            bucketKey = `${d.getDate()}/${d.getMonth() + 1}`;
          }

          if (!prepTimeByBucket.has(bucketKey)) {
            prepTimeByBucket.set(bucketKey, { total: 0, count: 0 });
          }
          prepTimeByBucket.get(bucketKey).total += mins;
          prepTimeByBucket.get(bucketKey).count += 1;
        });

        // Build chart data matching the same buckets as graphData
        const prepChartData = graphData.map(g => {
          const bucketData = prepTimeByBucket.get(g.key);
          const avgMins = bucketData && bucketData.count > 0
            ? Math.round(bucketData.total / bucketData.count)
            : 0;
          return {
            name: g.name,
            key: g.key,
            avgMins,
            orderCount: bucketData?.count || 0
          };
        });

        // Calculate overall average
        const allTimes = displayedOrders.map(order => {
          const start = new Date(order.created_at).getTime();
          const end = order.ready_at
            ? new Date(order.ready_at).getTime()
            : order.updated_at
              ? new Date(order.updated_at).getTime()
              : null;
          if (!end || isNaN(start)) return null;
          return Math.max(0, Math.floor((end - start) / 60000));
        }).filter(t => t !== null && t < 120);

        const overallAvg = allTimes.length > 0
          ? (allTimes.reduce((a, b) => a + b, 0) / allTimes.length).toFixed(1)
          : '-';

        const periodLabel = viewMode === 'daily' ? 'לפי שעות' : 'לפי ימים';
        const avgLabel = viewMode === 'daily' ? 'ממוצע יומי' : viewMode === 'weekly' ? 'ממוצע שבועי' : 'ממוצע חודשי';

        return (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-1 text-sm px-2 flex justify-between items-center h-6">
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-purple-500" />
                זמן הכנה ממוצע {periodLabel} (דקות)
              </span>
              <span className="text-xs text-gray-500 font-normal">
                {avgLabel}: {overallAvg} דק׳
              </span>
            </h3>
            <div className="h-28 w-full text-xs mt-1">
              {prepChartData.every(d => d.avgMins === 0) ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center border-2 border-dashed border-gray-100 rounded-lg">אין נתוני זמן הכנה</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={val => `${val}`}
                      domain={[0, 'auto']}
                    />
                    <Bar
                      dataKey="avgMins"
                      radius={[3, 3, 0, 0]}
                    >
                      {prepChartData.map((entry, index) => {
                        // Color based on avg time (user-defined thresholds)
                        let color = '#4ade80'; // green - up to 10 min
                        if (entry.avgMins >= 25) color = '#f87171'; // red - 25+ min
                        else if (entry.avgMins >= 20) color = '#fb923c'; // orange - 20-24 min
                        else if (entry.avgMins >= 15) color = '#facc15'; // yellow - 15-19 min
                        else if (entry.avgMins > 10) color = '#a3e635'; // light green - 10-14 min
                        return <Cell key={`prep-cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legend */}
            <div className="flex justify-center gap-3 mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400"></span> עד 10</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-400"></span> 15</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400"></span> 20</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400"></span> 25+</span>
            </div>
          </div>
        );
      })()}

      {/* Detailed Category Breakdown */}
      <div className="space-y-3">
        <h3 className="font-black text-lg text-gray-800 px-1 flex justify-between items-end">
          <span>פירוט לפי קטגוריות</span>
          {selectedGraphBar && (
            <span className="text-sm font-normal text-blue-600">
              סינון: {selectedGraphBar.type === 'hour' ? `${selectedGraphBar.key}:00` : selectedGraphBar.key}
            </span>
          )}
        </h3>
        {Object.entries(currentStats.deepStats).length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            {selectedGraphBar ? 'אין מכירות בשעה/יום שנבחרו' : 'אין נתוני מכירות לתקופה זו'}
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            key={`categories-${viewMode}-${dateMs}`}
          >
            {Object.entries(currentStats.deepStats)
              .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
              .map(([category, stats]) => {
                const isExpanded = expandedCategories.has(category);
                return (
                  <motion.div
                    key={category}
                    variants={itemVariants}
                    layout
                    className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-gray-300"
                  >
                    <div
                      onClick={() => toggleCategory(category)}
                      className={`p-4 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-gray-50' : 'bg-white'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Package size={18} /></span>
                        <div>
                          <h4 className="font-bold text-gray-900 text-base">{category}</h4>
                          <span className="text-xs text-gray-500">{stats.totalCount} פריטים נמכרו</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-blue-600 text-lg">{formatCurrency(stats.totalAmount)}</span>
                        {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-100 bg-white overflow-hidden"
                        >
                          <table className="w-full text-right">
                            <thead className="bg-gray-50/50 text-gray-400 text-xs uppercase font-medium">
                              <tr>
                                <th className="py-3 px-4 font-medium text-right">שם הפריט</th>
                                <th className="py-3 px-4 font-medium text-center">כמות</th>
                                <th className="py-3 px-4 font-medium text-left">סה״כ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                              {Object.entries(stats.items)
                                .sort(([, a], [, b]) => b.count - a.count)
                                .map(([itemName, itemStats]) => (
                                  <tr key={itemName} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-3 px-4 font-bold text-gray-700 text-right">{itemName}</td>
                                    <td className="py-3 px-4 text-center font-mono bg-gray-50 mx-2 rounded">{itemStats.count}</td>
                                    <td className="py-3 px-4 text-left font-medium text-gray-900">{formatCurrency(itemStats.total)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
          </motion.div>
        )}
      </div>

      {/* NEW: Orders List */}
      <div className="space-y-3 pt-6 border-t border-gray-200">
        <h3 className="font-black text-xl text-gray-800 px-1">רשימת הזמנות</h3>
        <div className="space-y-2">
          {displayedOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400 italic">לא נמצאו הזמנות</div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              key={`orders-${viewMode}-${dateMs}`}
              className="space-y-2"
            >
              {displayedOrders.map(order => {
                const isExpanded = expandedOrderIds.has(order.id);
                const timeStr = new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                const orderNum = order.order_number || order.id.toString().slice(-4);

                return (
                  <motion.div
                    key={order.id}
                    variants={itemVariants}
                    layout
                    className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-gray-300"
                  >
                    <div
                      onClick={() => toggleOrder(order.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-blue-50' : 'bg-white'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-12 h-10 bg-gray-100 rounded-lg text-gray-600">
                          <Clock size={12} className="mb-0.5 opacity-70" />
                          <span className="font-bold font-mono text-xs">{timeStr}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-gray-900 text-base">{order.customer_name || 'לקוח מזדמן'}</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Hash size={10} /> הזמנה {orderNum}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">{formatCurrency(order.total_amount || 0)}</span>
                        {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-gray-50 border-t border-gray-100"
                        >
                          <div className="p-4 space-y-4">
                            {/* Order Items */}
                            <div className="space-y-2">
                              {order.order_items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-gray-700 border-b border-gray-200 pb-2 last:border-0">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono font-bold">{item.quantity}x</span>
                                    <span>{item.menu_items?.name || 'פריט לא ידוע'}</span>
                                  </div>
                                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>

                            {/* Action Buttons */}
                            {order.customer_phone && (
                              <div className="flex justify-start pt-2">
                                <a
                                  href={`tel:${order.customer_phone}`}
                                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors active:scale-95"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone size={16} />
                                  צור קשר ({order.customer_phone})
                                </a>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

    </div>
  );
};

export default SalesDashboard;
