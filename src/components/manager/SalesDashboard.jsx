import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar, BarChart3, PieChart, ChevronDown, ChevronUp, Package, X, Phone, User, Clock, Hash, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

const SalesDashboard = () => {
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
      const { data } = await supabase
        .from('orders')
        .select('created_at')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const uniqueDates = new Set();
        data.forEach(o => {
          const dateStr = new Date(o.created_at).toDateString();
          uniqueDates.add(dateStr);
        });
        const datesList = Array.from(uniqueDates);
        setActiveDates(datesList);

        const todayStr = new Date().toDateString();
        if (!datesList.includes(todayStr) && datesList.length > 0) {
          const mostRecent = new Date(datesList[0]);
          mostRecent.setHours(0, 0, 0, 0);
          setDateTuple([mostRecent.getTime(), 0]);
        }
      }
    };
    fetchActiveDates();
  }, []);

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

      if (now >= currentStart && now <= endOfWeek) {
        currentEnd.setTime(now.getTime());
      } else {
        currentEnd.setTime(endOfWeek.getTime());
      }

      previousStart.setTime(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
      const duration = currentEnd.getTime() - currentStart.getTime();
      previousEnd.setTime(previousStart.getTime() + duration);

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
    setSelectedGraphBar(null); // Reset filter on date change
    setError(null);
    try {
      const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(viewMode, selectedDate);

      const fetchPeriod = async (start, end) => {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, customer_phone, total_amount, created_at, order_items(quantity, price, menu_items(name, category, price))')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .neq('order_status', 'cancelled')
          .order('created_at', { ascending: false });

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
    fetchSalesData();
  }, [viewMode, selectedDate]);

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

  const percentageChange = useMemo(() => {
    if (previousStats.total === 0) return totalPeriodStats.total > 0 ? 100 : 0;
    return ((totalPeriodStats.total - previousStats.total) / previousStats.total) * 100;
  }, [totalPeriodStats, previousStats]);

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
      const buckets = {};
      currentSales.forEach(item => {
        const d = new Date(item.date);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        if (!buckets[key]) buckets[key] = 0;
        buckets[key] += (item.price * item.quantity);
      });
      return Object.entries(buckets).map(([name, amount]) => ({ name, key: name, amount }));
    }
  }, [currentSales, viewMode]);

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
        <div className="relative h-40 w-full">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={`${viewMode}-${dateMs}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset }) => {
                if (offset.x < -50) goToPreviousPeriod();
                else if (offset.x > 50 && !isNextDisabled()) goToNextPeriod();
              }}
              className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl shadow-lg flex flex-col justify-center px-4 cursor-grab active:cursor-grabbing overflow-hidden"
            >
              <div className="flex justify-between items-center w-full">
                <button onClick={goToPreviousPeriod} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"><ChevronRight size={24} /></button>
                <div className="text-center">
                  <div className="text-blue-100 text-sm font-medium opacity-90">{getPeriodLabel()}</div>
                  <div className="text-4xl font-black tracking-tight">{formatCurrency(totalPeriodStats.total)}</div>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-xs text-blue-100 opacity-75">{getComparisonLabel()}: {formatCurrency(previousStats.total)}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${percentageChange >= 0 ? 'bg-green-400/20 text-green-200' : 'bg-red-400/20 text-red-200'}`}>
                      {percentageChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {Math.abs(percentageChange).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <button onClick={goToNextPeriod} disabled={isNextDisabled()} className={`p-2 bg-white/10 hover:bg-white/20 rounded-full text-white ${isNextDisabled() ? 'opacity-30' : ''}`}><ChevronLeft size={24} /></button>
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
