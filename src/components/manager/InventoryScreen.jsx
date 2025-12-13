import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import InventoryItemCard from './InventoryItemCard';
import { Search, Truck, Plus, X, ArrowRight, Package, Save, ClipboardList, ShoppingCart, Send, Copy, Check } from 'lucide-react';

/**
 * ⚠️ אזהרה - אין לשנות את העיצוב של קומפוננטה זו ללא אישור מפורש מהמשתמש!
 * WARNING - Do not change the design of this component without explicit user approval!
 */

const InventoryScreen = () => {
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
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
    const savedDraft = localStorage.getItem('inventory_draft_orders');
    if (savedDraft) {
      try { setDraftOrders(JSON.parse(savedDraft)); } catch (e) { }
    }
    fetchSentOrders();
  }, []);

  useEffect(() => {
    localStorage.setItem('inventory_draft_orders', JSON.stringify(draftOrders));
  }, [draftOrders]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: suppliersData } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers(suppliersData || []);

      const { data: itemsData } = await supabase
        .from('inventory_items')
        .select(`*, supplier:suppliers(*)`)
        .order('name')
        .range(0, 2000);
      setItems(itemsData || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentOrders = async () => {
    try {
      const { data } = await supabase
        .from('supplier_orders')
        .select(`*, supplier:suppliers(name), order_items:supplier_order_items(quantity, ordered_quantity_units, inventory_item_id)`)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });
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
    } catch (e) { console.error(e); }
  };

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
    return Object.values(groups).filter(g => g.count > 0).sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      return a.supplier.name.localeCompare(b.supplier.name);
    });
  }, [items, suppliers]);

  const currentItems = useMemo(() => {
    if (!selectedSupplier) return [];
    return items.filter(item => {
      const supId = item.supplier_id || 'uncategorized';
      const matchSupplier = supId === selectedSupplier.id;
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchSupplier && matchSearch;
    });
  }, [items, selectedSupplier, search]);

  const draftGroups = useMemo(() => {
    const groups = {};
    Object.values(draftOrders).forEach(draft => {
      const sId = draft.supplierId || 'uncategorized';
      const sName = draft.supplierName || 'כללי';
      if (!groups[sId]) groups[sId] = { supplierId: sId, supplierName: sName, items: [] };
      groups[sId].items.push(draft);
    });
    return Object.values(groups);
  }, [draftOrders]);

  const handleStockChange = async (itemId, newStock) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, current_stock: newStock, last_counted_at: new Date().toISOString() } : i));
    await supabase.from('inventory_items').update({ current_stock: newStock, last_counted_at: new Date().toISOString() }).eq('id', itemId);
  };

  const handleOrderChange = (itemId, qty) => {
    setDraftOrders(prev => {
      const next = { ...prev };
      if (qty <= 0) { delete next[itemId]; }
      else {
        const item = items.find(i => i.id === itemId);
        let supId = item?.supplier_id || 'uncategorized';
        let supName = suppliers.find(s => s.id === supId)?.name || 'כללי';
        next[itemId] = { itemId, qty, itemName: item?.name, unit: item?.unit, supplierId: supId, supplierName: supName };
      }
      return next;
    });
  };

  const handleSelectSupplier = (supplier) => { setSelectedSupplier(supplier); setCurrentView('items'); setSearch(''); };
  const handleBack = () => { setCurrentView('suppliers'); setSelectedSupplier(null); setSearch(''); };
  const handleAddNew = () => { setNewItemForm({ name: '', unit: 'יח׳', supplier_id: selectedSupplier?.id || null, current_stock: 0, low_stock_alert: 5 }); setCurrentView('create'); };

  const handleSaveNewItem = async () => {
    if (!newItemForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...newItemForm, supplier_id: newItemForm.supplier_id === 'uncategorized' ? null : newItemForm.supplier_id };
      await supabase.from('inventory_items').insert(payload);
      await fetchData();
      setCurrentView(selectedSupplier ? 'items' : 'suppliers');
    } catch (e) { alert('שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  const startReview = (group) => {
    let text = `היי ${group.supplierName}, הזמנה מ [שם העסק]:\n`;
    group.items.forEach(i => { text += `- ${i.itemName}: ${i.qty} ${i.unit || 'יח׳'}\n`; });
    text += `\nתודה!`;
    setGeneratedText(text);
    setReviewSupplierId(group.supplierId);
  };

  const markAsSent = async () => {
    const itemsToSave = Object.values(draftOrders).filter(d => d.supplierId === reviewSupplierId).map(d => ({ itemId: d.itemId, qty: d.qty }));
    if (!itemsToSave.length) return;
    const realSupplierId = typeof reviewSupplierId === 'number' ? reviewSupplierId : null;
    try {
      const { data: orderData } = await supabase.from('supplier_orders').insert({ supplier_id: realSupplierId, status: 'sent', created_at: new Date().toISOString() }).select().single();
      const orderItemsPayload = itemsToSave.map(it => ({ supplier_order_id: orderData.id, inventory_item_id: it.itemId, ordered_quantity_units: it.qty, quantity: it.qty }));
      await supabase.from('supplier_order_items').insert(orderItemsPayload);
      setDraftOrders(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { if (next[k].supplierId === reviewSupplierId) delete next[k]; }); return next; });
      fetchSentOrders();
    } catch (e) { alert('שגיאה: ' + e.message); }
    setReviewSupplierId(null);
  };

  const markOrderReceived = async (orderId) => { await supabase.from('supplier_orders').update({ status: 'received' }).eq('id', orderId); fetchSentOrders(); };

  const tabClass = (tabName) => `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tabName ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`;

  // ============== REVIEW MODAL ==============
  if (reviewSupplierId) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2"><Send size={20} /> אישור ושליחת הזמנה</h3>
            <button onClick={() => setReviewSupplierId(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">ההודעה מוכנה לשליחה. העתק אותה ושלח לספק בווטסאפ/מייל, ואז סמן כ"נשלח".</p>
            <div className="relative">
              <textarea value={generatedText} readOnly className="w-full h-48 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono resize-none" />
              <button onClick={() => { navigator.clipboard.writeText(generatedText); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={`absolute top-2 left-2 border shadow-sm p-2 rounded-lg ${copied ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setReviewSupplierId(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl border">חזור לעריכה</button>
              <button onClick={markAsSent} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 flex items-center justify-center gap-2"><Check size={18} />סמן שנשלח</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============== CREATE VIEW ==============
  if (activeTab === 'counts' && currentView === 'create') {
    return (
      <div className="min-h-screen bg-gray-50 font-heebo" dir="rtl">
        <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <button onClick={() => setCurrentView(selectedSupplier ? 'items' : 'suppliers')} className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200"><ArrowRight size={22} /></button>
            <h2 className="flex-1 text-center text-xl font-black text-slate-800">פריט מלאי חדש</h2>
            <button onClick={handleSaveNewItem} disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"><Save size={18} /> שמור</button>
          </div>
        </div>
        <div className="max-w-lg mx-auto p-4 space-y-6 pt-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
            <div><label className="block text-xs font-bold text-gray-500 mb-1.5">שם הפריט</label><input type="text" value={newItemForm.name} onChange={e => setNewItemForm({ ...newItemForm, name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500" placeholder="לדוגמה: חלב 3%" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5">יחידת מידה</label><select value={newItemForm.unit} onChange={e => setNewItemForm({ ...newItemForm, unit: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none"><option value="יח׳">יחידות</option><option value="kg">ק"ג</option><option value="gr">גרם</option><option value="l">ליטר</option><option value="ml">מ"ל</option></select></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5">ספק</label><select value={newItemForm.supplier_id || ''} onChange={e => setNewItemForm({ ...newItemForm, supplier_id: e.target.value || null })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none"><option value="">ללא ספק</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5">מלאי נוכחי</label><input type="number" value={newItemForm.current_stock} onChange={e => setNewItemForm({ ...newItemForm, current_stock: Number(e.target.value) })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none text-center" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5">התראה במלאי נמוך</label><input type="number" value={newItemForm.low_stock_alert} onChange={e => setNewItemForm({ ...newItemForm, low_stock_alert: Number(e.target.value) })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none text-center" /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============== MAIN LAYOUT ==============
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-heebo" dir="rtl">
      {/* Top Tabs - Always Visible */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => { setActiveTab('counts'); setCurrentView('suppliers'); setSelectedSupplier(null); }} className={tabClass('counts')}>
            <ClipboardList size={16} /> ספירה
          </button>
          <button onClick={() => setActiveTab('cart')} className={tabClass('cart')}>
            <ShoppingCart size={16} /> עגלה
            {Object.keys(draftOrders).length > 0 && <span className="mr-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{Object.keys(draftOrders).length}</span>}
          </button>
          <button onClick={() => { setActiveTab('sent_orders'); fetchSentOrders(); }} className={tabClass('sent_orders')}>
            <Truck size={16} /> נשלח
            {sentOrders.length > 0 && <span className="mr-1 bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{sentOrders.length}</span>}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB: COUNTS */}
        {activeTab === 'counts' && (
          <motion.div key="counts" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            {/* ITEMS VIEW */}
            {currentView === 'items' && selectedSupplier ? (
              <>
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                  <button onClick={handleBack} className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 group"><ArrowRight size={22} className="group-hover:-translate-x-1 transition-transform" /></button>
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`חיפוש ב${selectedSupplier.name}...`} className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-4 py-3 shadow-sm focus:border-blue-500 outline-none font-bold text-sm" />
                    {search && <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 bg-gray-100 rounded-full text-gray-400"><X size={14} /></button>}
                  </div>
                  <button onClick={handleAddNew} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95"><Plus size={22} strokeWidth={3} /></button>
                </div>
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
                  <Truck size={18} className="text-blue-600" /><span className="font-black text-blue-800">{selectedSupplier.name}</span>
                  {isDeliveryToday(selectedSupplier) && <span className="bg-amber-400 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-black mr-auto">יום אספקה!</span>}
                  <span className="text-xs text-blue-600 font-bold mr-auto">{currentItems.length} פריטים</span>
                </div>
                <div className="p-4">
                  {currentItems.length === 0 ? <div className="text-center py-10 text-gray-400">לא נמצאו פריטים</div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentItems.map(item => (
                        <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                          <InventoryItemCard item={item} onStockChange={handleStockChange} onOrderChange={handleOrderChange} draftOrderQty={draftOrders[item.id]?.qty || 0} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* SUPPLIERS VIEW */
              <>
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש ספק..." className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-4 py-3 shadow-sm focus:border-blue-500 outline-none font-bold text-sm" />
                    {search && <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 bg-gray-100 rounded-full text-gray-400"><X size={14} /></button>}
                  </div>
                  <button onClick={handleAddNew} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95"><Plus size={22} strokeWidth={3} /></button>
                </div>
                <div className="p-4">
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
                      {supplierGroups.filter(g => !search || g.supplier.name.toLowerCase().includes(search.toLowerCase())).map(group => (
                        <button key={group.supplier.id} onClick={() => handleSelectSupplier(group.supplier)} className={`bg-white rounded-xl shadow-sm border p-3 flex items-center gap-3 text-right transition-all cursor-pointer group hover:shadow-md hover:border-blue-200 active:scale-[0.98] ${group.isToday ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}>
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 ${group.isToday ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-50'}`}><Truck size={26} strokeWidth={1.5} /></div>
                          <div className="flex-1 flex flex-col justify-center min-w-0 py-1"><h3 className="font-bold text-gray-800 text-sm leading-tight truncate">{group.supplier.name}</h3><div className="flex items-center gap-2 mt-1"><span className="text-xs text-blue-600 font-bold">{group.count} פריטים</span>{group.isToday && <span className="bg-amber-400 text-amber-900 text-[9px] px-1.5 py-0.5 rounded-full font-black">היום!</span>}</div></div>
                          <Package size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* TAB: CART */}
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

        {/* TAB: SENT ORDERS */}
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
  );
};

export default InventoryScreen;
