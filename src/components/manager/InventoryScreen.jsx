import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import InventoryItemCard from './InventoryItemCard';
import { Search, Truck, Plus, X, ArrowRight, Package, ShoppingCart, Check, ChevronLeft, ChevronRight, Settings, PlusCircle, Save } from 'lucide-react';
import ConfirmationModal from '../ui/ConfirmationModal';

/**
 * Inventory Manager Screen
 * Refactored to restore original flow:
 * 1. Suppliers List (Screen 1)
 * 2. Click Supplier -> Slide to Items List (Screen 2)
 * 3. Back Button returns to Suppliers
 */

const InventoryScreen = () => {
  const { currentUser } = useAuth();
  // Top Tabs: 'counts' | 'cart' | 'sent_orders'
  const [activeTab, setActiveTab] = useState('counts');

  // Navigation within Counts: 'suppliers' | 'items' | 'create'
  // 'suppliers' is the main list. 'items' is the detail view of a specific supplier.
  const [currentView, setCurrentView] = useState('suppliers');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New Item Form State (for 'create' view if needed later, simplified for now)
  // const [newItemForm, setNewItemForm] = useState({ name: '', unit: 'יח׳', supplier_id: null, current_stock: 0, low_stock_alert: 5 });

  // Draft Orders State
  const [draftOrders, setDraftOrders] = useState({});

  // Sent Orders State
  const [sentOrders, setSentOrders] = useState([]);

  // Success Modal State
  const [successData, setSuccessData] = useState(null);

  // Modals State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierDays, setNewSupplierDays] = useState([]); // Array of integers 0-6 (Sun-Fri)
  const [newItemData, setNewItemData] = useState({
    name: '',
    unit: 'יח׳', // or 'ק״ג'
    cost_per_unit: 0,
    count_step: 1,
    unit_weight_grams: 0,
    min_order: 1,
    order_step: 1
  });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'info'
  });

  const [isCopied, setIsCopied] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentUser?.business_id) return;
    setLoading(true);
    try {
      const { data: suppliersData, error: supError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', currentUser.business_id)
        .order('name');
      if (supError) throw supError;
      setSuppliers(suppliersData || []);

      const { data: itemsData, error: itemError } = await supabase
        .from('inventory_items')
        .select(`*, supplier:suppliers(*)`)
        .eq('business_id', currentUser.business_id)
        .order('name')
        .range(0, 2000);
      if (itemError) throw itemError;
      setItems(itemsData || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.business_id]);

  const fetchSentOrders = useCallback(async () => {
    if (!currentUser?.business_id) return;
    try {
      // Use RPC to bypass potential RLS issues
      const { data, error } = await supabase
        .rpc('get_my_supplier_orders', { p_business_id: currentUser.business_id });

      if (error) throw error;

      const formatted = (data || [])
        .filter(order => order.status !== 'received' && order.delivery_status !== 'arrived')
        .map(order => ({
          id: order.id,
          created_at: order.created_at,
          supplier_name: order.supplier_name || 'ספק כללי',
          items: order.items || []
        }));
      setSentOrders(formatted);
    } catch (e) {
      console.error('Error fetching sent orders:', e);
    }
  }, [currentUser?.business_id]);

  useEffect(() => {
    fetchData();
    if (currentUser?.business_id) {
      const savedDraft = localStorage.getItem(`inventory_draft_${currentUser.business_id}`);
      if (savedDraft) {
        try { setDraftOrders(JSON.parse(savedDraft)); } catch (e) { }
      }
    }
  }, [fetchData, currentUser?.business_id]);

  useEffect(() => {
    if (items.length > 0) fetchSentOrders();
  }, [items, fetchSentOrders]);

  useEffect(() => {
    if (currentUser?.business_id) {
      localStorage.setItem(`inventory_draft_${currentUser.business_id}`, JSON.stringify(draftOrders));
    }
  }, [draftOrders, currentUser?.business_id]);

  const isDeliveryToday = (supplier) => {
    if (!supplier || !supplier.delivery_days) return false;
    const todayIndex = new Date().getDay();
    const days = String(supplier.delivery_days).split(',').map(d => parseInt(d.trim()));
    return days.includes(todayIndex);
  };

  const supplierGroups = useMemo(() => {
    const groups = {};
    suppliers.forEach(s => { groups[s.id] = { supplier: s, count: 0, isToday: isDeliveryToday(s) }; });
    groups['uncategorized'] = { supplier: { id: 'uncategorized', name: 'כללי / ללא ספק' }, count: 0, isToday: false };
    items.forEach(item => {
      const supId = item.supplier_id || 'uncategorized';
      if (groups[supId]) groups[supId].count++;
      else if (groups['uncategorized']) groups['uncategorized'].count++;
    });

    const groupsArray = Object.values(groups);
    // Filter matching search ONLY if searching for supplier name
    // (Item search is handled inside the item view now, or we can filter groups if we want to search broadly)
    // For now, let's keep it simple: Filter groups by supplier name OR if they have matching items.

    return groupsArray
      .filter(g => g.count > 0 || (search && g.supplier.name.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        return a.supplier.name.localeCompare(b.supplier.name);
      });
  }, [items, suppliers, search]);

  const handleOrderChange = (itemId, qty, item = null) => {
    setDraftOrders(prev => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = {
          itemId,
          qty,
          item: item || (next[itemId] ? next[itemId].item : null),
          itemName: item?.name || next[itemId]?.itemName,
          unit: item?.unit || next[itemId]?.unit,
          supplierId: item?.supplier_id || next[itemId]?.supplierId,
          supplierName: item?.supplier?.name || next[itemId]?.supplierName
        };
      }
      return next;
    });
  };

  const handleStockUpdate = async (itemId, newStock) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ current_stock: newStock, last_updated: new Date() })
        .eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, current_stock: newStock } : i));
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleFinishOrder = async (group) => {
    if (!currentUser?.business_id) return;
    setLoading(true);
    try {
      // 1. Create Order via RPC (Secure)
      // We pass the items array directly to the server function to handle the transaction
      const { data: orderData, error: orderError } = await supabase
        .rpc('create_supplier_order', {
          p_business_id: currentUser.business_id,
          p_supplier_id: group.supplierId !== 'uncategorized' ? group.supplierId : null,
          p_items: group.items
        });

      if (orderError) throw orderError;

      // 3. Generate Message Text
      const orderText = `*הזמנה חדשה - ${currentUser.business_name || 'שפת מדבר'}*\n` +
        `ספק: ${group.supplierName}\n` +
        `תאריך: ${new Date().toLocaleDateString('he-IL')}\n` +
        `----------------\n` +
        group.items.map(i => `- ${i.itemName}: ${i.qty} ${i.unit}`).join('\n') +
        `\n----------------\nתודה!`;

      // 4. Open Success Modal (to allow manual copy with user gesture)
      setSuccessData({
        text: orderText,
        supplierName: group.supplierName,
        items: group.items
      });

      // 5. Clear Draft for this supplier
      setDraftOrders(prev => {
        const next = { ...prev };
        group.items.forEach(item => delete next[item.itemId]);
        return next;
      });

      // 6. Refresh (background)
      fetchSentOrders();

    } catch (err) {
      console.error('Error creating order:', err);
      // alert('שגיאה ביצירת הזמנה: ' + (err.message || err)); 
      // User requested no ugly popups, but error needs feedback. 
      // We will leave error alert for safety, or log it. 
      // Let's use a console error and maybe a minimal inline error if we had one.
      // For now, I'll keep the alert ONLY on error because silent failure is worse.
      alert('תקלה ביצירת ההזמנה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemUpdate = async (itemId, updateData) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('inventory_items')
        .update({
          name: updateData.name,
          unit: updateData.unit,
          cost_per_unit: updateData.cost_per_unit,
          count_step: updateData.count_step,
          unit_weight_grams: updateData.unit_weight_grams,
          min_order: updateData.min_order,
          order_step: updateData.order_step,
          updated_at: new Date()
        })
        .eq('id', itemId);

      if (error) throw error;

      // Refresh items
      await fetchItems();

      // Show success message
      setConfirmModal({
        isOpen: true,
        title: 'הצלחה!',
        message: 'פרטי הפריט עודכנו בהצלחה',
        variant: 'success',
        confirmText: 'אישור',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });

    } catch (err) {
      console.error('Error updating item:', err);
      setConfirmModal({
        isOpen: true,
        title: 'שגיאה',
        message: 'לא הצלחנו לעדכן את פרטי הפריט. אנא נסה שוב.',
        variant: 'danger',
        confirmText: 'אישור',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndFinish = async () => {
    if (!successData) return;
    try {
      await navigator.clipboard.writeText(successData.text);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
        setSuccessData(null);
        setActiveTab('sent_orders');
      }, 1500);
    } catch (err) {
      console.error(err);
      prompt("העתק את ההודעה:", successData.text);
      setSuccessData(null);
      setActiveTab('sent_orders');
    }
  };

  const markOrderReceived = (orderId) => {
    setConfirmModal({
      isOpen: true,
      title: 'אישור קבלת סחורה',
      message: 'האם אתה בטוח שכל הסחורה בהזמנה זו התקבלה? הפעולה תעדכן את סטטוס ההזמנה.',
      variant: 'success',
      confirmText: 'אשר קבלה',
      onConfirm: () => executeMarkOrderReceived(orderId)
    });
  };

  const executeMarkOrderReceived = async (orderId) => {
    try {
      const { error } = await supabase.rpc('close_supplier_order', { p_order_id: orderId });
      if (error) throw error;

      // Optimistic Update: Remove from list immediately
      setSentOrders(prev => prev.filter(o => o.id !== orderId));

      await fetchSentOrders();
      await fetchData();
    } catch (err) {
      console.error('Error receiving order:', err);
      alert('שגיאה בעדכון ההזמנה');
    }
  };

  // --- NAVIGATION HELPERS ---
  const selectSupplier = (supplierId) => {
    setSelectedSupplier(supplierId);
    setCurrentView('items');
    setSearch(''); // Clear search when entering specific supplier? Or keep it? User preference usually clear.
  };

  const goBackToSuppliers = () => {
    setCurrentView('suppliers');
    setSelectedSupplier(null);
    setSearch('');
  };

  const itemsForSelectedSupplier = useMemo(() => {
    if (!selectedSupplier) return [];
    return items.filter(i => (i.supplier_id || 'uncategorized') === selectedSupplier)
      .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, selectedSupplier, search]);

  const activeSupplierName = useMemo(() => {
    if (!selectedSupplier) return '';
    if (selectedSupplier === 'uncategorized') return 'כללי / ללא ספק';
    const s = suppliers.find(s => s.id === selectedSupplier);
    return s ? s.name : '';
  }, [selectedSupplier, suppliers]);

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const { error } = await supabase.from('suppliers').insert([{
        name: newSupplierName,
        delivery_days: newSupplierDays.join(','),
        business_id: currentUser.business_id
      }]);
      if (error) throw error;
      setShowSupplierModal(false);
      setNewSupplierName('');
      setNewSupplierDays([]);
      fetchData();
    } catch (e) { console.error(e); alert('שגיאה ביצירת ספק'); }
  };

  const handleAddItem = async () => {
    if (!newItemData.name.trim()) return;
    try {
      // Map frontend data to DB columns
      const dbItem = {
        name: newItemData.name,
        unit: newItemData.unit, // 'יח׳' or 'ק"ג'
        cost_per_unit: newItemData.cost_per_unit,
        supplier_id: selectedSupplier === 'uncategorized' ? null : selectedSupplier,
        business_id: currentUser.business_id,
        current_stock: 0, // Default for new items
        count_step: newItemData.count_step,
        unit_weight_grams: newItemData.unit === 'יח׳' ? newItemData.unit_weight_grams : null, // Only if type is unit
        case_quantity: newItemData.case_quantity, // This field is not in newItemData state, but was in instruction. Keeping it for now.
        min_order: newItemData.min_order,
        order_step: newItemData.order_step,
        item_type: newItemData.unit === 'יח׳' ? 'unit' : 'weight' // 'unit' or 'weight'
      };

      const { error } = await supabase.from('inventory_items').insert([dbItem]);

      if (error) {
        console.error("Error inserting new item:", error);
        alert('שגיאה ביצירת פריט: ' + error.message);
      } else {
        setShowItemModal(false);
        setNewItemData({
          name: '',
          unit: 'יח׳',
          unit_weight_grams: 0,
          case_quantity: 1, // Defaulting this as it's not in the form yet
          count_step: 1,
          cost_per_unit: 0,
          min_order: 1,
          order_step: 1
        });
        fetchData();
      }
    } catch (e) { console.error(e); alert('שגיאה ביצירת פריט'); }
  };


  const toggleDay = (dayIndex) => {
    setNewSupplierDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

  return (
    <div className="h-full flex flex-col bg-gray-50 font-heebo pt-4" dir="rtl">

      {/* --- HEADER (Light, Blue Buttons, Centered Tabs) --- */}
      <div className="bg-white shrink-0 z-20 shadow-sm border-b border-gray-100 mt-0 pb-2">
        <div className="px-4 py-3 flex justify-between items-center relative">

          {/* Right Spacer (No Add Buttons here anymore) */}
          <div className="w-1/4"></div>

          {/* Centered Tabs - Match SalesDashboard Style */}
          <div className="absolute left-1/2 -translate-x-1/2 flex bg-gray-100 p-1 rounded-xl w-full max-w-sm">
            <button onClick={() => setActiveTab('counts')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'counts' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              ספירה
            </button>
            <button onClick={() => setActiveTab('cart')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'cart' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              עגלה
              {Object.keys(draftOrders).length > 0 && <span className={`text-[10px] px-1.5 rounded-full ${activeTab === 'cart' ? 'bg-blue-100 text-blue-600' : 'bg-gray-300 text-gray-600'}`}>{Object.keys(draftOrders).length}</span>}
            </button>
            <button onClick={() => setActiveTab('sent_orders')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'sent_orders' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              נשלחו
            </button>
          </div>

          {/* Right Spacer / Actions */}
          <div className="w-1/4 flex justify-end">
            {/* Empty for balance or could put user profile/settings */}
          </div>
        </div>

        {/* --- SUB-HEADER: Title & Add Action (New Row) --- */}
        {activeTab === 'counts' && currentView === 'suppliers' && (
          <div className="px-4 py-2 flex justify-end max-w-4xl mx-auto w-full">
            <button onClick={() => setShowSupplierModal(true)} className="bg-blue-600 text-white rounded-xl px-4 py-2 font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center gap-2">
              <PlusCircle size={20} />
              <span>ספק חדש</span>
            </button>
          </div>
        )}

        {/* --- SUB-HEADER: Items View (Back & Add) --- */}
        {activeTab === 'counts' && currentView === 'items' && (
          <div className="px-4 py-2 flex items-center justify-between max-w-4xl mx-auto w-full">
            <button onClick={goBackToSuppliers} className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition-colors">
              <ChevronRight size={20} />
              <span>{activeSupplierName}</span>
            </button>
            <button onClick={() => setShowItemModal(true)} className="bg-blue-600 text-white rounded-xl px-4 py-2 font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center gap-2">
              <PlusCircle size={20} />
              <span>פריט חדש</span>
            </button>
          </div>
        )}
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-hidden relative bg-gray-50">
        <AnimatePresence mode="wait">

          {/* --- COUNTS TAB --- */}
          {activeTab === 'counts' && (
            currentView === 'suppliers' ? (
              /* SCREEN 1: SUPPLIERS LIST */
              <motion.div
                key="suppliers-list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto p-4"
              >
                <div className="flex flex-col gap-3 max-w-3xl mx-auto pb-20 pt-4 px-4">
                  {/* Supplier List - Single Column, MenuManagerCard Style (Horizontal, h-[88px]) */}
                  {supplierGroups.map(group => (
                    <div
                      key={group.supplier.id}
                      onClick={() => selectSupplier(group.supplier.id)}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 pr-2 flex items-center gap-3 relative transition-all cursor-pointer group h-[88px] hover:shadow-md hover:border-blue-200 hover:bg-blue-50/50"
                    >
                      {/* Image Section (Right in RTL) */}
                      <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center ${group.isToday ? 'bg-green-100/50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        <Truck size={24} className="opacity-80" />
                        {group.isToday && (
                          <div className="absolute top-0 right-0 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-lg shadow-sm">
                            היום
                          </div>
                        )}
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 flex flex-col justify-center min-w-0 h-full py-1">
                        <h3 className="font-bold text-gray-800 text-base leading-tight truncate mb-1 group-hover:text-blue-700 transition-colors">
                          {group.supplier.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            {group.count} פריטים
                          </span>
                        </div>
                      </div>

                      {/* Action Section (Left in RTL) */}
                      <div className="pl-2 flex-shrink-0 flex flex-col justify-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-blue-500 transition-colors shadow-sm">
                          <ChevronLeft size={18} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* SCREEN 2: ITEMS LIST (Selected Supplier) */
              <motion.div
                key="items-list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto p-4"
              >
                <div className="space-y-3 max-w-lg mx-auto pb-20">
                  {itemsForSelectedSupplier.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      <p>לא נמצאו פריטים עבור ספק זה</p>
                      <button onClick={() => setShowItemModal(true)} className="mt-4 text-blue-600 font-bold hover:underline">הוסף פריט ראשון</button>
                    </div>
                  ) : (
                    itemsForSelectedSupplier.map(item => (
                      <InventoryItemCard
                        key={item.id}
                        item={item}
                        draftOrderQty={draftOrders[item.id]?.qty || 0}
                        onStockChange={handleStockUpdate}
                        onOrderChange={(itemId, val) => handleOrderChange(itemId, val, item)}
                        onItemUpdate={handleItemUpdate}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )
          )}

          {/* --- CART TAB --- */}
          {activeTab === 'cart' && (
            <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="p-4 h-full overflow-y-auto">
              {/* Existing Cart Logic */}
              <div className="max-w-2xl mx-auto space-y-4">
                {Object.keys(draftOrders).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <ShoppingCart size={48} className="mb-4 text-gray-200" />
                    <h3 className="text-lg font-bold text-gray-500">העגלה ריקה</h3>
                    <p className="text-sm">עבור ללשונית "ספירה" והוסף פריטים להזמנה</p>
                  </div>
                ) : (
                  (() => {
                    const groups = {};
                    Object.values(draftOrders).forEach(item => {
                      const sId = item.supplierId || 'uncategorized';
                      if (!groups[sId]) groups[sId] = { supplierId: sId, supplierName: item.supplierName, items: [] };
                      groups[sId].items.push(item);
                    });
                    return Object.values(groups);
                  })().map(group => (
                    <div key={group.supplierId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-black text-gray-800 flex items-center gap-2">
                          <Truck size={18} className="text-blue-500" />
                          {group.supplierName}
                        </h3>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {group.items.length} פריטים
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3 mb-4">
                          {group.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-gray-100 pb-2 last:border-0">
                              <span className="text-gray-800 font-medium">{item.itemName}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono bg-gray-100 px-2 rounded text-gray-600">
                                  {item.qty} {item.unit}
                                </span>
                                <button onClick={() => handleOrderChange(item.itemId, 0)} className="text-red-400 hover:text-red-600">
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleFinishOrder(group)}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98]"
                        >
                          <Check size={18} /> סיום הזמנה ויצירת הודעה
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* --- SENT ORDERS TAB --- */}
          {activeTab === 'sent_orders' && (
            <motion.div key="sent_orders" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="p-4 h-full overflow-y-auto">
              <div className="max-w-2xl mx-auto space-y-4">
                {sentOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400"><Truck size={48} className="mb-4 text-gray-200" /><h3 className="text-lg font-bold text-gray-500">אין הזמנות פתוחות</h3><p className="text-sm">הזמנות שנשלחו לספק וטרם התקבלו יופיעו כאן</p></div>
                ) : (
                  sentOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex justify-between items-center"><div><h3 className="font-black text-gray-800 text-sm">{order.supplier_name}</h3><span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('he-IL')}</span></div><span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">נשלח • ממתין</span></div>
                      <div className="p-4"><ul className="space-y-2 mb-4">{order.items.map((it, idx) => (<li key={idx} className="text-sm flex justify-between text-gray-700 border-b border-gray-50 pb-1 last:border-0"><span>{it.name}</span><span className="font-mono bg-gray-100 px-1 rounded">{it.qty} {it.unit}</span></li>))}</ul><button onClick={() => markOrderReceived(order.id)} className="w-full py-2 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Check size={16} /> סמן שהסחורה התקבלה</button></div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- ADD SUPPLIER MODAL --- */}
      <AnimatePresence>
        {showSupplierModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setShowSupplierModal(false)} className="fixed inset-0 bg-black z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-2xl p-6 min-h-[50vh]">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-black text-slate-800 mb-6">הוספת ספק חדש</h3>
              <div className="space-y-6 max-w-lg mx-auto">
                <div>
                  <label className="text-sm font-bold text-slate-500 mb-1 block">שם הספק</label>
                  <input type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 outline-none font-bold text-lg" placeholder="שם העסק..." />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-500 mb-2 block">ימי חלוקה קבועים</label>
                  <div className="flex justify-between gap-2">
                    {DAYS.map((day, idx) => {
                      const isSelected = newSupplierDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleDay(idx)}
                          className={`flex-1 aspect-square rounded-xl font-black text-lg transition-all flex items-center justify-center border-2 ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">מסייע בסידור ימי ההזמנה</p>
                </div>

                <button onClick={handleAddSupplier} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg mt-4 hover:bg-slate-800 shadow-xl">שמור והוסף ספק</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- ADD ITEM MODAL (Revamped) --- */}
      <AnimatePresence>
        {showItemModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setShowItemModal(false)} className="fixed inset-0 bg-black z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-2xl p-0 min-h-[70vh] flex flex-col max-h-[90vh]">

              {/* Modal Header */}
              <div className="p-6 pb-6 bg-white rounded-t-3xl border-b border-gray-50 shrink-0 relative">
                <button
                  onClick={() => setShowItemModal(false)}
                  className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-800 text-center">הוספת פריט חדש</h3>
                <p className="text-sm text-gray-400 text-center font-bold mt-1">{activeSupplierName || 'ללא ספק משויך'}</p>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* 1. Basic Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-slate-500 mb-1 block">שם הפריט</label>
                    <input
                      type="text"
                      value={newItemData.name}
                      onChange={e => setNewItemData({ ...newItemData, name: e.target.value })}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-blue-500 outline-none font-bold text-xl text-center"
                      placeholder="שם הפריט..."
                    />
                  </div>

                  {/* Type Selector (Tabs) */}
                  <div className="bg-gray-100 p-1.5 rounded-2xl flex">
                    <button
                      onClick={() => setNewItemData({ ...newItemData, unit: 'יח׳', count_step: 1, min_order: 1, order_step: 1 })}
                      className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${newItemData.unit === 'יח׳' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      פריט בודד (יח׳)
                    </button>
                    <button
                      onClick={() => setNewItemData({ ...newItemData, unit: 'ק״ג', count_step: 0.01, min_order: 0.01, order_step: 0.01 })}
                      className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${newItemData.unit === 'ק״ג' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      משקל (ק״ג)
                    </button>
                  </div>
                </div>

                {/* 2. Configuration Pickers */}
                <div className="space-y-3">

                  {/* Unit Weight (Only if Units) - e.g. "Pack of Cookies (200g)" */}
                  {newItemData.unit === 'יח׳' && (
                    <NumberPicker
                      label="משקל יחידה (גרם)"
                      value={newItemData.unit_weight_grams || 0}
                      onChange={v => setNewItemData({ ...newItemData, unit_weight_grams: v })}
                      unit="גרם"
                      stepSmall={10}
                      stepLarge={100}
                    />
                  )}

                  {/* Count Step - Hidden for single units (always 1) */}
                  {newItemData.unit !== 'יח׳' && (
                    <NumberPicker
                      label="קפיצות ספירה"
                      value={newItemData.count_step}
                      onChange={v => setNewItemData({ ...newItemData, count_step: v })}
                      unit={newItemData.unit === 'ק״ג' ? 'גרם' : newItemData.unit}
                      stepSmall={newItemData.unit === 'ק״ג' ? 0.01 : 1}
                      stepLarge={newItemData.unit === 'ק״ג' ? 0.1 : 10}
                      format={v => newItemData.unit === 'ק״ג' ? (v * 1000).toFixed(0) : v}
                    />
                  )}

                  {/* Min Order */}
                  <NumberPicker
                    label="מינימום להזמנה"
                    value={newItemData.min_order}
                    onChange={v => setNewItemData({ ...newItemData, min_order: v })}
                    unit={newItemData.unit === 'ק״ג' ? 'גרם' : newItemData.unit}
                    stepSmall={newItemData.unit === 'ק״ג' ? 0.1 : 1}
                    stepLarge={newItemData.unit === 'ק״ג' ? 1 : 10}
                    format={v => newItemData.unit === 'ק״ג' ? (v * 1000).toFixed(0) : v}
                  />

                  {/* Order Step */}
                  <NumberPicker
                    label="קפיצות הזמנה"
                    value={newItemData.order_step}
                    onChange={v => setNewItemData({ ...newItemData, order_step: v })}
                    unit={newItemData.unit === 'ק״ג' ? 'גרם' : newItemData.unit}
                    stepSmall={newItemData.unit === 'ק״ג' ? 0.01 : 1}
                    stepLarge={newItemData.unit === 'ק״ג' ? 0.1 : 10}
                    format={v => newItemData.unit === 'ק״ג' ? (v * 1000).toFixed(0) : v}
                  />

                  {/* Cost Picker */}
                  <NumberPicker
                    label={`עלות ל${newItemData.unit === 'ק״ג' ? 'ק״ג' : 'יחידה'} (₪)`}
                    value={newItemData.cost_per_unit || 0}
                    onChange={v => setNewItemData({ ...newItemData, cost_per_unit: v })}
                    unit="₪"
                    stepSmall={1}
                    stepLarge={10}
                    format={v => v.toFixed(2)}
                  />
                </div>

                <div className="h-10"></div> {/* Bottom Spacer */}
              </div>

              {/* Fixed Footer Action */}
              <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                <button onClick={handleAddItem} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-all">
                  שמור והוסף למלאי
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- SUCCESS / COPY MODAL --- */}
      <AnimatePresence>
        {successData && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setSuccessData(null)} className="fixed inset-0 bg-black z-50" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto flex flex-col max-h-[80vh]">
                <div className="p-6 bg-green-50/50 border-b border-green-100 text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">ההזמנה נוצרה בהצלחה!</h3>
                  <p className="text-sm text-gray-500 font-bold mt-1">שלח את ההודעה לספק בוואטסאפ</p>
                </div>

                <div className="p-4 bg-slate-50 overflow-hidden flex-1 relative group">
                  <textarea
                    readOnly
                    value={successData.text}
                    className="w-full h-full min-h-[12rem] p-4 bg-white border border-gray-200 rounded-xl text-sm font-mono text-gray-600 focus:outline-none resize-none"
                  />
                </div>

                <div className="p-4 border-t border-gray-100 bg-white grid grid-cols-1 gap-3">
                  <button onClick={handleCopyAndFinish} className={`py-4 ${isCopied ? 'bg-green-700' : 'bg-green-600'} text-white rounded-xl font-bold text-lg shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2`}>
                    {isCopied ? (
                      <>
                        <Check size={24} />
                        <span>הועתק!</span>
                      </>
                    ) : (
                      <span>העתק וסגור</span>
                    )}
                  </button>
                  <button onClick={() => setSuccessData(null)} className="py-4 text-gray-400 font-bold text-sm hover:text-gray-600">
                    סגור ללא העתקה
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
        cancelText={confirmModal.cancelText}
      />
    </div>
  );
};

// --- Helper Component: Double Stepper Picker (Single Row) ---
const NumberPicker = ({ value, onChange, label, unit = '', stepSmall = 1, stepLarge = 10, format = (v) => v, min = 0 }) => {
  const handleChange = (delta) => {
    const next = Math.max(min, value + delta);
    // Fix float precision issues
    onChange(Number(next.toFixed(3)));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm flex items-center justify-between gap-2 h-16">
      {/* Label */}
      <label className="text-xs font-black text-gray-500 shrink-0 w-20 leading-3 whitespace-normal text-right pl-1 flex items-center h-full">
        {label}
      </label>

      <div className="flex items-center gap-2 flex-1 justify-end h-full">
        {/* Decrease (Horizontal Row) */}
        <div className="flex gap-1 h-full items-center">
          <button onClick={() => handleChange(-stepLarge)} className="w-10 h-10 bg-red-50 text-red-600 rounded-lg font-bold text-xs flex items-center justify-center hover:bg-red-100 transition-colors active:scale-95 leading-none">-{stepLarge < 1 && unit === 'גרם' ? stepLarge * 1000 : stepLarge}</button>
          <button onClick={() => handleChange(-stepSmall)} className="w-10 h-10 bg-gray-50 text-gray-600 rounded-lg font-bold text-sm flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-95 leading-none">-{stepSmall < 1 && unit === 'גרם' ? stepSmall * 1000 : stepSmall}</button>
        </div>

        {/* Value */}
        <div className="min-w-[4rem] text-center flex flex-col justify-center">
          <div className="text-xl font-black text-slate-800 tracking-tight leading-none">{format(value)}</div>
          {unit && <div className="text-[10px] font-bold text-gray-400 mt-0.5">{unit}</div>}
        </div>

        {/* Increase (Horizontal Row) */}
        <div className="flex gap-1 h-full items-center">
          <button onClick={() => handleChange(stepSmall)} className="w-10 h-10 bg-gray-50 text-gray-600 rounded-lg font-bold text-sm flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-95 leading-none">+{stepSmall < 1 && unit === 'גרם' ? stepSmall * 1000 : stepSmall}</button>
          <button onClick={() => handleChange(stepLarge)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs flex items-center justify-center hover:bg-blue-100 transition-colors active:scale-95 leading-none mb-0">+{stepLarge < 1 && unit === 'גרם' ? stepLarge * 1000 : stepLarge}</button>
        </div>
      </div>
    </div>
  );
};

export default InventoryScreen;
