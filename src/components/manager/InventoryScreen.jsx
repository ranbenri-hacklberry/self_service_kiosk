import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import InventoryItemCard from './InventoryItemCard';
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
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

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
      alert('שגיאה בטעינת הנתונים – בדוק חיבור');
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
      // alert('שגיאה בטעינת הזמנות שנשלחו'); // Optional: less critical
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

  // ... (Rest of logic: isDeliveryToday, supplierGroups, etc. - largely same but verify logic)

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

  // ...

  // (Skip logic blocks that don't need change until render)

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
    } catch (e) {
      console.error(e);
      alert('שגיאה בשמירה');
    }
    finally { setSaving(false); }
  };

  // ...

  // Render changes
  // Only replacing the relevant part of the logical setups + imports needs checking.

  // FIX: I need to replace from Line 12 to 113 to cover the Hooks and FetchData logic.

  // Let's do a targeted replacements.


  {/* TAB: CART */ }
  {
    activeTab === 'cart' && (
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
    )
  }

  {/* TAB: SENT ORDERS */ }
  {
    activeTab === 'sent_orders' && (
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
    )
  }
      </AnimatePresence >
    </div >
  );
};

export default InventoryScreen;
