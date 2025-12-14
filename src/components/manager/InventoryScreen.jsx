import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
// Component Import potentially needed if separated, but assuming inline or standard components
// import InventoryItemCard from './InventoryItemCard'; // Not used in this version, simplified list
import { Search, Truck, Plus, X, ArrowRight, Package, Save, ClipboardList, ShoppingCart, Send, Copy, Check } from 'lucide-react';

/**
 * ⚠️ אזהרה - אין לשנות את העיצוב של קומפוננטה זו ללא אישור מפורש מהמשתמש!
 * WARNING - Do not change the design of this component without explicit user approval!
 */

const InventoryScreen = () => {
  const { currentUser } = useAuth();
  // Top Tabs: 'counts' | 'cart' | 'sent_orders'
  const [activeTab, setActiveTab] = useState('counts');

  // Navigation within Counts: 'suppliers' | 'items' | 'create'
  const [currentView, setCurrentView] = useState('suppliers');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New Item Form State
  const [newItemForm, setNewItemForm] = useState({ name: '', unit: 'יח׳', supplier_id: null, current_stock: 0, low_stock_alert: 5 });
  const [saving, setSaving] = useState(false);

  // Draft Orders State: { [itemId]: { qty, item, supplierId, supplierName } }
  const [draftOrders, setDraftOrders] = useState({});

  // Sent Orders State
  const [sentOrders, setSentOrders] = useState([]);

  // Review Mode State (for finishing order)
  const [reviewSupplierId, setReviewSupplierId] = useState(null);

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
      // alert('שגיאה בטעינת הנתונים – בדוק חיבור');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.business_id]);

  const fetchSentOrders = useCallback(async () => {
    if (!currentUser?.business_id) return;
    try {
      const { data, error } = await supabase
        .from('supplier_orders')
        .select(`*, supplier:suppliers(name), order_items:supplier_order_items(quantity, ordered_quantity_units, inventory_item_id)`)
        .eq('business_id', currentUser.business_id)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(order => ({
        id: order.id,
        created_at: order.created_at,
        supplier_name: order.supplier?.name || 'ספק כללי',
        items: order.order_items?.map(oi => {
          const localItem = items.find(i => i.id === oi.inventory_item_id);
          return { name: localItem?.name || `פריט #${oi.inventory_item_id}`, qty: oi.quantity || oi.ordered_quantity_units, unit: localItem?.unit || 'יח׳' };
        }) || []
      }));
      setSentOrders(formatted);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser?.business_id, items]);

  useEffect(() => {
    fetchData();
    const savedDraft = localStorage.getItem('inventory_draft_orders');
    if (savedDraft) {
      try { setDraftOrders(JSON.parse(savedDraft)); } catch (e) { }
    }
  }, [fetchData]);

  // Separate effect for sent orders as it depends on items
  useEffect(() => {
    if (items.length > 0) {
      fetchSentOrders();
    }
  }, [items, fetchSentOrders]);

  useEffect(() => {
    localStorage.setItem('inventory_draft_orders', JSON.stringify(draftOrders));
  }, [draftOrders]);

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

    // Filter matching search
    const filteredGroups = search && !selectedSupplier
      ? groupsArray.filter(g => g.supplier.name.toLowerCase().includes(search.toLowerCase()))
      : groupsArray;

    return filteredGroups
      .filter(g => g.count > 0 || (search && g.supplier.name.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        return a.supplier.name.localeCompare(b.supplier.name);
      });
  }, [items, suppliers, search, selectedSupplier]);

  const draftGroups = useMemo(() => {
    const groups = {};
    Object.values(draftOrders).forEach(item => {
      const sId = item.supplierId || 'uncategorized';
      if (!groups[sId]) {
        groups[sId] = { supplierId: sId, supplierName: item.supplierName, items: [] };
      }
      groups[sId].items.push(item);
    });
    return Object.values(groups);
  }, [draftOrders]);

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

  const startReview = (group) => {
    // Logic for review modal or similar
    alert('Review feature coming soon for ' + group.supplierName);
  };

  const markOrderReceived = async (orderId) => {
    // Logic
    console.log('Marking received', orderId);
  };

  const handleSaveNewItem = async () => {
    if (!newItemForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...newItemForm,
        supplier_id: (!newItemForm.supplier_id || newItemForm.supplier_id === 'uncategorized') ? null : newItemForm.supplier_id,
        business_id: currentUser.business_id
      };
      const { error } = await supabase.from('inventory_items').insert(payload);
      if (error) throw error;

      await fetchData();
      setCurrentView(selectedSupplier ? 'items' : 'suppliers');
      setNewItemForm({ name: '', unit: 'יח׳', supplier_id: null, current_stock: 0, low_stock_alert: 5 });
    } catch (e) {
      console.error(e);
      alert('שגיאה בשמירה');
    }
    finally { setSaving(false); }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 font-heebo" dir="rtl">
      {/* Header & Tabs */}
      <div className="bg-white shadow-sm z-10">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800">ניהול מלאי והזמנות</h2>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('counts')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'counts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>ספירה והזמנה</button>
            <button onClick={() => setActiveTab('cart')} className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'cart' ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              <ShoppingCart size={16} />
              עגלה ({Object.keys(draftOrders).length})
            </button>
            <button onClick={() => setActiveTab('sent_orders')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'sent_orders' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>הזמנות שנשלחו</button>
          </div>
        </div>

        {/* Sub-Header for Counts */}
        {activeTab === 'counts' && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4 overflow-x-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש ספק או פריט..."
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:border-blue-500 outline-none text-sm"
              />
            </div>
            <button onClick={() => setCurrentView('create')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm whitespace-nowrap">
              <Plus size={16} /> פריט חדש
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'counts' && (
            <motion.div
              key="counts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {supplierGroups.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>לא נמצאו פריטים</p>
                </div>
              ) : (
                supplierGroups.map(group => (
                  <div key={group.supplier.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center cursor-pointer" onClick={() => setSelectedSupplier(selectedSupplier === group.supplier.id ? null : group.supplier.id)}>
                      <div className="flex items-center gap-3">
                        <Truck size={18} className={group.isToday ? 'text-green-600' : 'text-gray-400'} />
                        <h3 className="font-bold text-gray-800">{group.supplier.name}</h3>
                        {group.isToday && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">אספקה היום</span>}
                      </div>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">{group.count} פריטים</span>
                    </div>

                    {/* Expanded Items */}
                    {(selectedSupplier === group.supplier.id || search) && (
                      <div className="p-2 space-y-2 bg-slate-50/50">
                        {items.filter(i => (i.supplier_id || 'uncategorized') === group.supplier.id)
                          .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
                          .map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 hover:border-blue-300 transition-colors flex justify-between items-center shadow-sm">
                              <div>
                                <h4 className="font-bold text-slate-700 text-sm">{item.name}</h4>
                                <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                  <span>מלאי: {item.current_stock} {item.unit}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                                <button
                                  onClick={() => handleOrderChange(item.id, (draftOrders[item.id]?.qty || 0) - 1, item)}
                                  className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-red-500 font-bold"
                                >-</button>
                                <span className="w-8 text-center font-mono font-bold text-slate-800">{draftOrders[item.id]?.qty || 0}</span>
                                <button
                                  onClick={() => handleOrderChange(item.id, (draftOrders[item.id]?.qty || 0) + 1, item)}
                                  className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-green-600 font-bold"
                                >+</button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'cart' && (
            <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="p-4">
              {draftGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400"><ShoppingCart size={48} className="mb-4 text-gray-200" /><h3 className="text-lg font-bold text-gray-500">העגלה ריקה</h3><p className="text-sm">עבור ללשונית "ספירה" והוסף פריטים להזמנה</p></div>
              ) : (
                <div className="space-y-4">
                  {draftGroups.map(group => (
                    <div key={group.supplierId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center"><h3 className="font-black text-gray-800 flex items-center gap-2"><Truck size={18} className="text-blue-500" />{group.supplierName}</h3><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{group.items.length} פריטים</span></div>
                      <div className="p-4">
                        <div className="space-y-3 mb-4">{group.items.map((item, idx) => (<div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-gray-100 pb-2 last:border-0"><span className="text-gray-800 font-medium">{item.itemName}</span><div className="flex items-center gap-3"><span className="font-mono bg-gray-100 px-2 rounded text-gray-600">{item.qty} {item.unit}</span><button onClick={() => handleOrderChange(item.itemId, 0)} className="text-red-400 hover:text-red-600"><X size={14} /></button></div></div>))}</div>
                        <button onClick={() => startReview(group)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98]"><Check size={18} />סיום הזמנה ויצירת הודעה</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'sent_orders' && (
            <motion.div key="sent_orders" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="p-4">
              {sentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400"><Truck size={48} className="mb-4 text-gray-200" /><h3 className="text-lg font-bold text-gray-500">אין הזמנות פתוחות</h3><p className="text-sm">הזמנות שנשלחו לספק וטרם התקבלו יופיעו כאן</p></div>
              ) : (
                <div className="space-y-4">
                  {sentOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex justify-between items-center"><div><h3 className="font-black text-gray-800 text-sm">{order.supplier_name}</h3><span className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('he-IL')}</span></div><span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">נשלח • ממתין</span></div>
                      <div className="p-4"><ul className="space-y-2 mb-4">{order.items.map((it, idx) => (<li key={idx} className="text-sm flex justify-between text-gray-700 border-b border-gray-50 pb-1 last:border-0"><span>{it.name}</span><span className="font-mono bg-gray-100 px-1 rounded">{it.qty} {it.unit}</span></li>))}</ul><button onClick={() => markOrderReceived(order.id)} className="w-full py-2 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Check size={16} /> סמן שהסחורה התקבלה</button></div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InventoryScreen;
