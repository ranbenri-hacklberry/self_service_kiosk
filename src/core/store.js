
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';

export const useStore = create((set, get) => ({
    // --- User State ---
    currentUser: null,
    login: async (pin) => {
        try {
            // 1. Special Admin / Support PIN '000000' => iCaffe Context
            if (pin === '000000') {
                console.log('🚀 Logging in as iCaffe Admin...');
                let icaffeBiz = null;

                if (navigator.onLine) {
                    // Try to find the real 'icaffe' business
                    const { data } = await supabase.from('businesses')
                        .select('id, name')
                        .ilike('name', 'icaffe')
                        .maybeSingle(); // Use maybeSingle to avoid error if not found
                    icaffeBiz = data;
                }

                // Create a master session
                const masterUser = {
                    id: 'icaffe-master-user',
                    name: 'iCaffe Support',
                    pin_code: '000000',
                    role: 'owner',
                    business_id: icaffeBiz?.id || 'icaffe-demo-id',
                    business_name: icaffeBiz?.name || 'iCaffe HQ',
                    access_level: 'Owner'
                };

                set({ currentUser: masterUser });
                return true;
            }

            // 2. Standard Employee Login (Prioritize Online to ensure correct business_id)
            let user = await db.employees.where('pin_code').equals(pin).first();

            if (navigator.onLine) {
                const { data, error } = await supabase.from('employees').select('*').eq('pin_code', pin).maybeSingle();
                if (data && !error) {
                    console.log('🌍 Found user online:', data);
                    // Update local cache
                    const existing = await db.employees.where('pin_code').equals(pin).first();
                    if (!existing) {
                        await db.employees.add(data);
                    } else {
                        // Update existing if needed, e.g. business_id changed
                        if (existing.business_id !== data.business_id) {
                            await db.employees.update(existing.id, data);
                        }
                    }
                    user = data;
                }
            }

            // 3. Fallback to Demo ONLY if no user found and pin is 1234
            if (!user && pin === '1234') {
                console.log('🌱 Seeding demo user for pin: 1234');
                user = {
                    id: crypto.randomUUID(),
                    name: 'Demo Admin',
                    pin_code: '1234',
                    role: 'admin',
                    business_id: 'lite-demo-business',
                    access_level: 'Owner'
                };
            }

            if (user) {
                // Fetch Business Name if we have an ID
                if (user.business_id && navigator.onLine) {
                    try {
                        const { data } = await supabase.from('businesses').select('name').eq('id', user.business_id).single();
                        if (data) user.business_name = data.name;
                    } catch (err) { console.error("Failed to fetch business name", err); }
                }

                set({ currentUser: user });
                return true;
            }
            return false;
        } catch (e) {
            console.error("Login failed", e);
            return false;
        }
    },
    logout: () => set({ currentUser: null }),

    // --- Menu State ---
    menuItems: [],
    fetchMenu: async () => {
        const { currentUser } = get();
        try {
            // 1. Sync from Supabase if online and user exists
            if (navigator.onLine && currentUser?.business_id && currentUser?.id !== 'icaffe-master-user') {
                const { data, error } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('business_id', currentUser.business_id)
                    .eq('is_active', true);

                if (!error && data) {
                    await db.menu_items.bulkPut(data);
                }
            }

            // 2. Load from Dexie
            let items = [];
            if (currentUser?.business_id) {
                items = await db.menu_items.where('business_id').equals(currentUser.business_id).toArray();
            } else {
                items = await db.menu_items.toArray();
            }

            // 3. Fallback to demo if absolutely nothing
            if (items.length === 0) {
                console.log('🌱 Seeding demo menu...');
                const demoItems = [
                    { id: crypto.randomUUID(), name: 'הפוך גדול', price: 14, category: 'coffee' },
                    { id: crypto.randomUUID(), name: 'אספרסו', price: 9, category: 'coffee' },
                    { id: crypto.randomUUID(), name: 'קרואסון חמאה', price: 16, category: 'pastry' },
                    { id: crypto.randomUUID(), name: 'כריך אבוקדו', price: 32, category: 'food' },
                ];
                // Only seed if we really have no context, prevents pollution
                if (!currentUser?.business_id) {
                    await db.menu_items.bulkAdd(demoItems);
                    set({ menuItems: demoItems });
                    return;
                }
            }

            set({ menuItems: items });

        } catch (e) { console.error("Fetch Menu Error", e); }
    },

    // --- Cart State ---
    cart: [],
    addToCart: (item) => set((state) => ({ cart: [...state.cart, { ...item, internalId: crypto.randomUUID() }] })),
    removeFromCart: (internalId) => set((state) => ({ cart: state.cart.filter(i => i.internalId !== internalId) })),
    clearCart: () => set({ cart: [] }),

    // --- KDS State ---
    activeOrders: [],
    focusedKDSIndex: 0,
    setFocusedKDSIndex: (index) => set({ focusedKDSIndex: index }),

    fetchBusinessDetails: async (businessId) => {
        if (!businessId) return;
        try {
            const { data } = await supabase.from('businesses').select('name').eq('id', businessId).single();
            if (data) {
                set(state => ({ currentUser: { ...state.currentUser, business_name: data.name } }));
            }
        } catch (e) { console.error('Error fetching business details', e); }
    },

    fetchKDSOrders: async () => {
        const { currentUser } = get();
        try {
            // 1. Sync Live Data (if online)
            if (navigator.onLine && currentUser?.business_id) {
                const today = new Date();
                today.setHours(5, 0, 0, 0);
                if (new Date() < today) today.setDate(today.getDate() - 1);

                const { data, error } = await supabase.rpc('get_kds_orders', {
                    p_date: today.toISOString(),
                    p_business_id: currentUser.business_id
                });

                if (!error && data) {
                    // Ensure menu items are loaded for name lookup
                    let currentMenuItems = get().menuItems;
                    if (currentMenuItems.length === 0) {
                        await get().fetchMenu();
                        currentMenuItems = get().menuItems;
                    }

                    for (const order of data) {
                        // Only update or add if newer? For Lite, just overwrite for simplicity or use Dexie's put
                        await db.orders.put({
                            ...order,
                            pending_sync: false
                        });
                        if (order.items_detail) {
                            for (const item of order.items_detail) {
                                // Ensure item has a name by looking it up
                                let finalItem = { ...item, order_id: order.id };

                                // 1. Try to get name from the nested RPC object (priority)
                                if (item.menu_items && item.menu_items.name) {
                                    finalItem.name = item.menu_items.name;
                                }

                                // 2. Fallback to local menu lookup if still missing
                                if (!finalItem.name && finalItem.menu_item_id) {
                                    const menuItem = currentMenuItems.find(m => m.id === finalItem.menu_item_id);
                                    if (menuItem) {
                                        finalItem.name = menuItem.name;
                                    }
                                }
                                await db.order_items.put(finalItem);
                            }
                        }
                    }
                }
            }

            // 2. Read from Dexie
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            let query = db.orders
                .where('created_at')
                .above(twentyFourHoursAgo)
                .filter(order => {
                    const s = order.order_status || order.status;
                    return s !== 'completed' && s !== 'cancelled';
                });

            const orders = await query.toArray();
            const orderIds = orders.map(o => o.id);
            const items = await db.order_items.where('order_id').anyOf(orderIds).toArray();

            const fullOrders = orders.map(order => ({
                ...order,
                items: items.filter(i => i.order_id === order.id)
            })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            set({ activeOrders: fullOrders });
        } catch (e) {
            console.error("KDS Fetch Error", e);
        }
    },

    // NEW: Mark as Completed (Delivered)
    markOrderCompleted: async (orderId) => {
        const updateData = { order_status: 'completed', updated_at: new Date().toISOString() };
        await db.orders.update(orderId, updateData);

        if (navigator.onLine) {
            const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
            if (error) console.error("Failed to sync completion", error);
        }

        // Cleanup items to completed too
        const items = await db.order_items.where('order_id').equals(orderId).toArray();
        await Promise.all(items.map(i => db.order_items.update(i.id, { item_status: 'completed' })));

        get().fetchKDSOrders();
    },

    // NEW: Undo Ready -> In Progress
    undoReady: async (orderId) => {
        const updateData = { order_status: 'in_progress', updated_at: new Date().toISOString() };
        await db.orders.update(orderId, updateData);

        if (navigator.onLine) {
            const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
            if (error) console.error("Failed to sync undo", error);
        }

        get().fetchKDSOrders();
    },

    // Existing: Pending -> Ready
    markOrderReady: async (orderId) => {
        const updateData = { order_status: 'ready', updated_at: new Date().toISOString() };
        await db.orders.update(orderId, updateData);

        if (navigator.onLine) {
            const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
            if (error) console.error("Failed to sync ready", error);
        }

        get().fetchKDSOrders();
    },

    // NEW: Toggle Specific Item Status (Partial Serving)
    updateItemServedStatus: async (itemId, isServed) => {
        const status = isServed ? 'completed' : 'in_progress';
        const updateData = {
            item_status: status,
            served_at: isServed ? new Date().toISOString() : null
        };

        await db.order_items.update(itemId, updateData);

        if (navigator.onLine) {
            const { error } = await supabase.from('order_items').update(updateData).eq('id', itemId);
            if (error) console.error("Failed to sync item status", error);
        }

        get().fetchKDSOrders();
    },

    // --- Ordering Logic ---
    submitOrder: async (options = {}) => {
        const { currentUser, cart } = get();
        if (!currentUser) return { success: false, error: "No user" };

        const paymentMethod = options.paymentMethod || 'cash';
        const customerName = options.customerName || null;
        const phoneRaw = options.phoneNumber || '';
        // Basic sanitization
        const customerPhone = phoneRaw.replace(/\D/g, '');

        const isPaid = true;
        const newOrder = {
            id: crypto.randomUUID(),
            order_number: Math.floor(100 + Math.random() * 900),
            business_id: currentUser.business_id,
            created_at: new Date().toISOString(),
            order_status: 'in_progress',
            status: 'in_progress',
            is_paid: isPaid,
            payment_method: paymentMethod,
            total_amount: cart.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0),
            pending_sync: true,
            customer_name: customerName, // Save locally
            customer_phone: customerPhone // Save locally
        };

        try {
            await db.orders.add(newOrder);
            const itemsToSave = cart.map(item => ({
                id: crypto.randomUUID(),
                order_id: newOrder.id,
                menu_item_id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1,
                item_status: 'in_progress',
                mods: item.selectedOptions || item.mods || []
            }));
            await db.order_items.bulkAdd(itemsToSave);
            set({ cart: [] });

            // 🔥 Force Refresh KDS State immediately
            get().fetchKDSOrders();

            let smsResult = null;

            if (navigator.onLine) {
                // 1. Submit Order via RPC
                const { error } = await supabase.rpc('submit_order_v3', {
                    p_items: cart.map(i => ({
                        menu_item_id: i.id,
                        quantity: i.quantity || 1,
                        mods: (i.selectedOptions || i.mods || []).map(m => m.valueId ? m.valueId : m.text || m)
                    })),
                    p_payment_method: paymentMethod,
                    p_is_paid: isPaid,
                    p_order_id: newOrder.id,
                    p_business_id: currentUser.business_id
                });

                if (!error) {
                    await db.orders.update(newOrder.id, { pending_sync: false });

                    // 2. Update Customer Details (if provided)
                    if (customerName || customerPhone) {
                        try {
                            await supabase.from('orders').update({
                                customer_name: customerName,
                                customer_phone: customerPhone
                            }).eq('id', newOrder.id);
                        } catch (updateErr) {
                            console.error("Failed to update extra details", updateErr);
                        }
                    }

                    // 3. Send SMS (if phone provided)
                    if (customerPhone) {
                        try {
                            // Attempt to use Edge Function
                            const { data: funcData, error: funcError } = await supabase.functions.invoke('send-sms', {
                                body: {
                                    phone: customerPhone,
                                    message: `היי ${customerName || ''}, הזמנתך #${newOrder.order_number} התקבלה ב-iCaffe בהצלחה!`.trim(),
                                    businessId: currentUser.business_id
                                }
                            });

                            if (funcError) {
                                console.error("SMS Function Error:", funcError);
                                smsResult = `❌ שגיאת SMS: ${funcError.message}`;
                            } else {
                                smsResult = `✅ SMS נשלח ללקוח`;
                            }
                        } catch (smsErr) {
                            console.error("SMS Call Failed:", smsErr);
                            smsResult = `❌ כשל בשליחת SMS`;
                        }
                    }
                } else {
                    // RPC Error
                    console.error("RPC Error", error);
                    return { success: false, error: error.message };
                }
            }

            return { success: true, smsResult };
        } catch (e) {
            console.error("Submit Order Failed", e);
            return { success: false, error: e.message };
        }
    }
}));
