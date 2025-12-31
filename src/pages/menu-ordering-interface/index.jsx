import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import MenuCategoryFilter from './components/MenuCategoryFilter';
import MenuGrid from './components/MenuGrid';
import SmartCart from './components/SmartCart';
import CheckoutButton from './components/CheckoutButton';
import PaymentSelectionModal from './components/PaymentSelectionModal';
import ModifierModal from './components/ModifierModal';
import SaladPrepDecision from './components/SaladPrepDecision';
import MTOQuickNotesModal from './components/MTOQuickNotesModal';
import OrderConfirmationModal from '@/components/ui/OrderConfirmationModal';
import CustomerInfoModal from '@/components/CustomerInfoModal';
import { addCoffeePurchase, getLoyaltyCount, handleLoyaltyAdjustment, getLoyaltyRedemptionForOrder } from "@/lib/loyalty";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import MiniMusicPlayer from '@/components/music/MiniMusicPlayer';
import Icon from '@/components/AppIcon';
// Custom hooks
import { useMenuItems, useLoyalty, useCart } from './hooks';

const ORDER_ORIGIN_STORAGE_KEY = 'order_origin';

const MenuOrderingInterface = () => {
  console.log('🚀 MenuOrderingInterface component rendering...');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  console.log('📍 Location state received:', location.state);

  // ===== Menu Items Hook (replaces local state + fetch logic) =====
  const {
    menuItems,
    menuLoading,
    error,
    activeCategory,
    filteredItems,
    groupedItems,
    handleCategoryChange,
    isFoodItem,
    fetchMenuItems
  } = useMenuItems('hot-drinks', currentUser?.business_id);

  // ===== Cart Hook (replaces cart state + cart functions) =====
  const {
    cartItems,
    cartHistory,
    cartTotal: hookCartTotal,
    activeItems,
    delayedItems,
    addItem: cartAddItem,
    removeItem: cartRemoveItem,
    toggleItemDelay: cartToggleDelay,
    clearCart: cartClearCart,
    setItems: cartSetItems,
    handleUndoCart: cartHandleUndo,
    updateCartWithHistory: cartUpdateWithHistory,
    normalizeSelectedOptions: cartNormalizeOptions,
    getCartItemSignature: cartGetSignature
  } = useCart([]);

  // ===== Local State =====
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [showSaladPrepModal, setShowSaladPrepModal] = useState(false);
  const [showMTONotesModal, setShowMTONotesModal] = useState(false);
  const [selectedItemForMod, setSelectedItemForMod] = useState(null);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderData, setEditingOrderData] = useState(null);
  const [currentCustomer, setCurrentCustomer] = useState(() => {
    const raw = localStorage.getItem('currentCustomer');
    return raw ? JSON.parse(raw) : null;
  });
  const [modifierOptionsCache, setModifierOptionsCache] = useState({}); // Cache for modifier options
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  const [customerInfoModalMode, setCustomerInfoModalMode] = useState('phone');
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // ===== Loyalty Hook (replaces loyalty state + fetch logic) =====
  const {
    loyaltyPoints,
    loyaltyFreeCoffees,
    loyaltyDiscount,
    loyaltyFreeItemsCount,
    adjustedLoyaltyPoints: hookAdjustedLoyaltyPoints, // From hook, used for SmartCart
    setLoyaltyDiscount,
    setLoyaltyFreeItemsCount,
    refreshLoyalty
  } = useLoyalty({
    currentCustomer,
    currentUser,
    cartItems,
    isEditMode,
    editingOrderData
  });

  // --- Edit Mode Logic ---
  const [isRestrictedMode, setIsRestrictedMode] = useState(false);

  // --- Soldier Discount State ---
  const [soldierDiscountEnabled, setSoldierDiscountEnabled] = useState(false);
  const [soldierDiscountId, setSoldierDiscountId] = useState(null); // UUID from discounts table

  // --- Edit Mode Logic ---
  useEffect(() => {
    console.log('🔄 MenuOrderingInterface mounted, location:', location);

    // Check URL params first (prio 1), then location.state (prio 2)
    const params = new URLSearchParams(location.search);
    const urlEditId = params.get('editOrderId');
    const stateEditId = location.state?.orderId;
    const targetOrderId = urlEditId || stateEditId;

    if (targetOrderId) {
      console.log('✏️ Entering Edit Mode for Order:', targetOrderId);
      setIsEditMode(true);
      sessionStorage.setItem(ORDER_ORIGIN_STORAGE_KEY, 'kds'); // Ensure return to KDS

      // Check for restricted mode flag in session storage
      // Default to NOT restricted (allow editing) unless explicitly set
      try {
        const storedEditDataRaw = sessionStorage.getItem('editOrderData');
        if (storedEditDataRaw) {
          const storedEditData = JSON.parse(storedEditDataRaw);
          // Verify ID matches (handle suffixes like '-ready' by comparing base IDs)
          const storedIdBase = String(storedEditData.id).replace(/-ready$/, '').replace(/-stage-\d+$/, '');
          const targetIdBase = String(targetOrderId).replace(/-ready$/, '').replace(/-stage-\d+$/, '');

          if (storedIdBase === targetIdBase) {
            if (storedEditData.restrictedMode) {
              console.log('🔒 Restricted Edit Mode Active (History - Paid Order)');
              setIsRestrictedMode(true);
            } else {
              console.log('✏️ Full Edit Mode Active (History - Unpaid Order)');
              setIsRestrictedMode(false);
            }
          } else {
            // ID mismatch - default to unrestricted
            console.log('⚠️ ID mismatch in editOrderData, defaulting to unrestricted');
            setIsRestrictedMode(false);
          }
        } else {
          // No editOrderData - default to unrestricted for edit mode
          console.log('⚠️ No editOrderData found, defaulting to unrestricted');
          setIsRestrictedMode(false);
        }
      } catch (e) {
        console.error('Error reading editOrderData:', e);
        setIsRestrictedMode(false); // Default to unrestricted on error
      }

      fetchOrderForEditing(targetOrderId);
    }
  }, [location.state, location.search]);

  // --- Restore Cart State after adding customer mid-order ---
  useEffect(() => {
    const pendingCartStateRaw = sessionStorage.getItem('pendingCartState');
    if (pendingCartStateRaw) {
      try {
        console.log('🔄 Restoring cart state after customer identification...');
        const pendingCartState = JSON.parse(pendingCartStateRaw);

        // Restore cart items
        if (pendingCartState.cartItems && pendingCartState.cartItems.length > 0) {
          cartSetItems(pendingCartState.cartItems);
          console.log('🛒 Restored cart items:', pendingCartState.cartItems.length);
        }

        // Restore modifier options cache
        // modifierOptionsCache restoration removed to ensure fresh prices

        // Restore edit mode if applicable
        if (pendingCartState.isEditMode && pendingCartState.editingOrderData) {
          setIsEditMode(true);
          setEditingOrderData(pendingCartState.editingOrderData);
        }

        // Clear the pending state
        sessionStorage.removeItem('pendingCartState');
        console.log('✅ Cart state restored successfully');

        // Update currentCustomer from localStorage (should be set by phone/name screens)
        const storedCustomer = localStorage.getItem('currentCustomer');
        if (storedCustomer) {
          const customer = JSON.parse(storedCustomer);
          setCurrentCustomer(customer);
          console.log('👤 Updated customer:', customer.name);
        }
      } catch (error) {
        console.error('❌ Error restoring cart state:', error);
        sessionStorage.removeItem('pendingCartState');
      }
    }

    // --- CLEANUP SCRIPT FOR DUPLICATE LINKS (ITEMS 7, 8, 9) ---
    const runCleanup = async () => {
      const targetIds = [7, 8, 9];
      console.log('🧹 RUNNING DUPLICATE CHECK & CLEANUP FOR:', targetIds);

      for (const itemId of targetIds) {
        // 1. Get groups that are OWNED by this item
        const { data: ownedGroups } = await supabase.from('optiongroups').select('id, name').eq('menu_item_id', itemId);

        if (ownedGroups && ownedGroups.length > 0) {
          for (const group of ownedGroups) {
            // 2. Check if this owned group is ALSO linked in menuitemoptions
            const { data: links } = await supabase.from('menuitemoptions')
              .select('group_id')
              .eq('item_id', itemId)
              .eq('group_id', group.id);

            if (links && links.length > 0) {
              console.log(`⚠️ Found DUPLICATE link for group "${group.name}" (ID: ${group.id}) on item ${itemId}. Removing link...`);
              // 3. Delete the redundant link
              await supabase.from('menuitemoptions')
                .delete()
                .eq('item_id', itemId)
                .eq('group_id', group.id);
              console.log('✅ Link removed. Now strictly private.');
            }
          }
        }
      }
      console.log('🏁 Cleanup finished.');
    };
    runCleanup();
    // -------------------------------------------------------------
  }, []);

  const fetchOrderForEditing = async (orderId) => {
    try {
      setIsLoading(true);

      // Validate orderId format
      console.log('🔍 Fetching order for editing, ID:', orderId, 'Type:', typeof orderId);

      if (!orderId || typeof orderId !== 'string') {
        console.error('❌ Invalid orderId:', orderId);
        throw new Error('מזהה הזמנה לא תקין');
      }

      // Clean orderId - remove any KDS suffix like "-ready" or "-stage-2"
      // Note: UUIDs contain hyphens like "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      // So we only remove known suffixes, not split by hyphen
      let cleanOrderId = orderId;
      if (orderId.endsWith('-ready')) {
        cleanOrderId = orderId.replace(/-ready$/, '');
      }
      // Also handle stage suffixes like "-stage-2-ready" or "-stage-2"
      cleanOrderId = cleanOrderId.replace(/-stage-\d+$/, '');
      console.log('🧹 Clean order ID:', cleanOrderId, '(original:', orderId, ')');

      // Use RPC function to bypass RLS (same approach as KDS)
      const { data: order, error } = await supabase
        .rpc('get_order_for_editing', { p_order_id: cleanOrderId });

      console.log('📊 RPC result - order:', order ? 'found' : 'null', 'error:', error);

      if (order?.order_items) {
        console.log('📦 Fetched Order Items from DB:', order.order_items.length);
        console.log('💰 Fetched Order Total:', order.total_amount);
        console.log('📦 Items details:', order.order_items.map(i => ({
          id: i.id,
          name: i.menu_items?.name,
          course_stage: i.course_stage,
          item_status: i.item_status
        })));
      }

      if (error) {
        console.error('❌ Supabase error fetching order:', error);
        throw error;
      }

      if (!order) {
        console.error('❌ Order not found for ID:', cleanOrderId, '(original:', orderId, ')');
        throw new Error(`הזמנה ${cleanOrderId} לא נמצאה`);
      }

      console.log('✅ Order fetched successfully:', order.id);

      // WORKAROUND: Fetch course_stage AND item_status directly from table because RPC likely misses it or returns stale data
      let itemsStageMap = {};
      let itemsStatusMap = {};

      try {
        const { data: rawItemsData } = await supabase
          .from('order_items')
          .select('id, course_stage, item_status')
          .eq('order_id', cleanOrderId);

        if (rawItemsData) {
          rawItemsData.forEach(item => {
            itemsStageMap[item.id] = item.course_stage;
            itemsStatusMap[item.id] = item.item_status;
          });
          console.log('Data fetched directly:', { stages: itemsStageMap, statuses: itemsStatusMap });
        }
      } catch (e) {
        console.error('Failed to fetch stages directly:', e);
      }

      // Merge stage info into RPC result
      if (order.order_items) {
        order.order_items.forEach(item => {
          if (itemsStageMap[item.id] !== undefined) {
            item.course_stage = itemsStageMap[item.id];
          }
          // Override status if we have fresh data
          if (itemsStatusMap[item.id] !== undefined) {
            item.item_status = itemsStatusMap[item.id];
          }
        });
      }

      // Set customer if exists
      if (order.customer_phone) {
        let customer = null;
        let customerError = null;

        // OFFLINE FALLBACK: Load customer from Dexie if offline
        if (!navigator.onLine) {
          try {
            const { db } = await import('../../db/database');
            const customers = await db.customers.where('phone').equals(order.customer_phone).toArray();
            if (customers.length === 0) {
              // Try phone_number field as well
              const byPhoneNumber = await db.customers.where('phone_number').equals(order.customer_phone).toArray();
              customer = byPhoneNumber[0] || null;
            } else {
              customer = customers[0];
            }
            console.log('📴 Customer loaded from Dexie:', customer?.name);
          } catch (e) {
            console.warn('Dexie customer lookup failed:', e);
          }
        } else {
          // ONLINE: Fetch from Supabase
          console.log('🌐 Online: Fetching customer from Supabase for phone:', order.customer_phone);
          const result = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', order.customer_phone) // Try phone_number first
            .maybeSingle();

          customer = result.data;
          customerError = result.error;

          if (!customer && !customerError) {
            // Try 'phone' column fallback
            const secondTry = await supabase
              .from('customers')
              .select('*')
              .eq('phone', order.customer_phone)
              .maybeSingle();
            customer = secondTry.data;
            customerError = secondTry.error;
          }

          // Cache to Dexie for offline
          if (customer) {
            try {
              const { db } = await import('../../db/database');
              await db.customers.put(customer);
              console.log('💾 Customer cached to Dexie:', customer.name);
            } catch (e) {
              // Ignore cache error
            }
          }
        }

        if (customerError) {
          console.warn('⚠️ Customer fetch warning:', customerError);
        }

        if (customer) {
          setCurrentCustomer(customer);
          localStorage.setItem('currentCustomer', JSON.stringify(customer));
          // NOTE: useLoyalty hook will automatically fetch loyalty when currentCustomer changes
          console.log('🎁 Customer loaded for edit mode, useLoyalty will fetch loyalty for phone:', customer.phone_number || customer.phone);
        } else {
          // Customer not in DB but we have name/phone from order - create a temporary customer object
          const tempCustomer = {
            name: order.customer_name,
            phone: order.customer_phone,
            isTemporary: true
          };
          setCurrentCustomer(tempCustomer);
          localStorage.setItem('currentCustomer', JSON.stringify(tempCustomer));
          console.log('👤 Using order customer data (not in DB):', tempCustomer);
        }
      } else if (order.customer_name) {
        // No phone but has name - use it
        const tempCustomer = {
          name: order.customer_name,
          phone: null,
          isAnonymous: true
        };
        setCurrentCustomer(tempCustomer);
        localStorage.setItem('currentCustomer', JSON.stringify(tempCustomer));
        console.log('👤 Using anonymous customer from order:', tempCustomer);
      }

      // Transform items to cart format, filtering out cancelled items
      const loadedCartItems = order.order_items
        .filter(item => item.item_status !== 'cancelled') // <--- CRITICAL FIX: Kill Zombie Items
        .map(item => {
          let selectedOptions = [];
          try {
            if (item.mods) {
              let parsedMods = item.mods;
              // נסה לפרסר אם זו מחרוזת
              if (typeof item.mods === 'string') {
                try {
                  parsedMods = JSON.parse(item.mods);
                } catch (e) {
                  // אם נכשל, אולי זה סתם טקסט? נבדוק שזה לא UUID
                  if (item.mods.length > 20 && item.mods.includes('-')) {
                    parsedMods = []; // זה כנראה זבל/UUID
                  } else {
                    parsedMods = { "note": item.mods }; // נניח שזו הערה
                  }
                }
              }

              // המרה למבנה של SmartCart
              if (Array.isArray(parsedMods)) {
                selectedOptions = parsedMods;
              } else if (typeof parsedMods === 'object' && parsedMods !== null) {
                selectedOptions = Object.entries(parsedMods).map(([key, value]) => ({
                  groupName: key,
                  valueName: value
                }));
              }
            }
          } catch (e) {
            console.error('Failed to parse mods:', e);
            selectedOptions = [];
          }

          return {
            id: item.id, // Use the UUID from order_items table (CRITICAL FIX)
            menu_item_id: item.menu_item_id, // Store the menu item ID separately
            uniqueId: item.id, // Keep original item ID for tracking
            name: item.menu_items.name,
            // CRITICAL FIX: Use the stored price from order_items (which includes modifiers)
            // instead of the base menu price. This prevents "double charging" when editing.
            price: item.price,
            basePrice: item.menu_items.price, // Keep base price for reference
            // We need to calculate the actual price including mods if possible, 
            // or trust the total from the DB item if we stored it? 
            // order_items usually doesn't store price per item unless we added it.
            // Let's assume base price for now + mods price if we can fetch it.
            // For simplicity in this iteration: use menu item price.
            quantity: item.quantity,
            image: item.menu_items.image_url,
            is_hot_drink: item.menu_items.is_hot_drink,
            selectedOptions: selectedOptions,
            notes: item.notes,
            isDelayed: item.course_stage === 2, // Restore the flag!
            originalStatus: item.item_status, // Keep track of backend status (e.g. in_progress)
            tempId: uuidv4() // Ensure stable ID for React keys
          };
        });

      // CRITICAL FIX: Distinguish between soldier discount and loyalty discount.
      // Fetch discount_amount directly if not in RPC
      let initialDiscountAmount = order.discount_amount || 0;
      if (initialDiscountAmount === 0 && order.id) {
        // We'll calculate it properly later, but for the immediate loyalty check 
        // we should try to get the baseline from the RPC or a quick sum
      }

      // Calculate the original cart total from items (before any loyalty discount)
      const originalCartTotal = loadedCartItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      // Determine how much of the difference is actually loyalty discount
      // Logic: (Items Total) - (Soldier Discount) - (Loyalty Discount) = (Final Total Paid)
      // So: (Loyalty Discount) = (Items Total) - (Soldier Discount) - (Final Total Paid)

      const soldierD = Number(order.discount_amount) || 0;
      const loyaltyDiscountApplied = Math.max(0, originalCartTotal - soldierD - order.total_amount);

      // Count how many hot drinks were in the order
      const hotDrinks = loadedCartItems.filter(item => item.is_hot_drink);

      // If there was a discount and hot drinks, calculate how many were free
      let originalRedeemedCount = 0;
      if (loyaltyDiscountApplied > 0 && hotDrinks.length > 0) {
        // Sort hot drinks by price to find the cheapest ones (those that would be free)
        const sortedDrinks = hotDrinks.sort((a, b) => a.price - b.price);
        let remainingDiscount = loyaltyDiscountApplied;

        for (const drink of sortedDrinks) {
          if (remainingDiscount >= drink.price) {
            originalRedeemedCount++;
            remainingDiscount -= drink.price;
          }
        }
      }

      console.log('🎁 Original Redeemed Count:', {
        originalCartTotal,
        orderTotalAmount: order.total_amount,
        loyaltyDiscountApplied,
        hotDrinksCount: hotDrinks.length,
        originalRedeemedCount
      });

      const editDataToSet = {
        orderId: order.id,
        orderNumber: order.order_number,
        originalTotal: order.total_amount, // Use actual paid amount (after discount) as baseline
        originalItems: loadedCartItems,
        isPaid: order.is_paid,
        originalOrderStatus: order.order_status, // Store original status
        originalRedeemedCount: originalRedeemedCount,
        originalLoyaltyDiscount: loyaltyDiscountApplied // Store the discount that was applied
      };

      console.log('💾 Setting editingOrderData:', editDataToSet);
      console.log('💰 Original Cart Total (from items):', originalCartTotal);
      console.log('💰 DB Total (may include discount):', order.total_amount);
      console.log('💰 Original Loyalty Discount Applied:', loyaltyDiscountApplied);

      setEditingOrderData(editDataToSet);
      cartSetItems(loadedCartItems);

      // Apply the original loyalty discount so the price stays consistent
      if (loyaltyDiscountApplied > 0) {
        setLoyaltyDiscount(loyaltyDiscountApplied);
        console.log('🎁 Applying original loyalty discount:', loyaltyDiscountApplied);
      }

      // CRITICAL: Restore soldier discount if one was applied to this order
      // First check RPC result, then fallback to direct query
      let discountId = order.discount_id;
      let discountAmount = order.discount_amount;

      // Fallback: If RPC doesn't return discount info, fetch directly
      if (discountId === undefined && discountAmount === undefined) {
        console.log('🔍 Discount info missing from RPC, fetching directly...');
        const { data: discountData } = await supabase
          .from('orders')
          .select('discount_id, discount_amount')
          .eq('id', order.id)
          .single();

        if (discountData) {
          discountId = discountData.discount_id;
          discountAmount = discountData.discount_amount;
          console.log('✅ Discount info fetched directly:', discountData);
        }
      }

      if (discountId || discountAmount > 0) {
        console.log('🎖️ Order has discount - restoring:', {
          discount_id: discountId,
          discount_amount: discountAmount
        });

        // Enable soldier discount and set the ID
        setSoldierDiscountEnabled(true);
        if (discountId) {
          setSoldierDiscountId(discountId);
        }
        console.log('🎖️ Soldier discount restored for editing');
      }

      // CRITICAL: After loading order, verify restriction based on actual payment status
      // We check both the RPC result AND do a direct fallback if needed
      let dbIsPaid = order.is_paid || order.isPaid;
      let dbStatus = order.order_status || order.orderStatus;

      // If RPC results are missing critical fields, fetch them directly
      if (dbIsPaid === undefined || dbStatus === undefined) {
        console.log('🔍 Critical fields missing from RPC, fetching directly from orders table...');
        const { data: directOrder } = await supabase
          .from('orders')
          .select('is_paid, order_status')
          .eq('id', cleanOrderId)
          .single();

        if (directOrder) {
          dbIsPaid = directOrder.is_paid;
          dbStatus = directOrder.order_status;
          console.log('✅ Direct fetch result:', { dbIsPaid, dbStatus });
        }
      }

      // Final decision on restriction:
      // - Cancelled orders are ALWAYS restricted
      // - Paid orders are NOW EDITABLE (can add new items)
      // - Unpaid orders (even in history) are EDITABLE
      const shouldBeRestricted = dbStatus === 'cancelled';

      console.log('🛡️ Final Restriction Decision:', {
        dbIsPaid,
        dbStatus,
        shouldBeRestricted,
        orderId: cleanOrderId
      });

      if (shouldBeRestricted) {
        console.log('🔒 Setting Restricted Mode (Cancelled)');
        setIsRestrictedMode(true);
      } else {
        console.log('✅ Setting Full Edit Mode (Active/History/Paid)');
        setIsRestrictedMode(false);
      }

    } catch (err) {
      console.error('Error fetching order for editing:', err);
      alert('שגיאה בטעינת ההזמנה לעריכה');
      const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
      const editDataRaw = sessionStorage.getItem('editOrderData');
      const editData = editDataRaw ? JSON.parse(editDataRaw) : null;
      if (origin === 'kds') {
        navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
      } else {
        navigate('/kds');
      }
    } finally {
      setIsLoading(false);
    }
  };
  // -----------------------

  // Unified helper to clear all order-related session data
  const clearOrderSessionState = () => {
    console.log('🧹 Clearing order session state (Cart & Customer)');
    cartClearCart();
    setCurrentCustomer(null);
    localStorage.removeItem('currentCustomer');
    sessionStorage.removeItem('editOrderData');
    sessionStorage.removeItem('pendingCartState');
    sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
    // Force a small delay to ensure React state updates if needed, though navigation usually handles it
  };

  const handleCloseConfirmation = () => {
    // Save confirmation data BEFORE clearing it
    const confirmationData = showConfirmationModal;
    const navigationFromConfirmation = confirmationData?.navigationTarget;

    setShowConfirmationModal(null);
    const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
    const editDataRaw = sessionStorage.getItem('editOrderData');
    const editData = editDataRaw ? JSON.parse(editDataRaw) : null;

    console.log('🔙 handleCloseConfirmation - origin:', origin, 'viewMode:', editData?.viewMode, 'navigationTarget:', navigationFromConfirmation);

    if (origin === 'kds') {
      console.log('✅ Navigating back to KDS');

      // Determine if changes were made (any ADD_ITEM or REMOVE_ITEM in cart history)
      const hadChanges = cartHistory.some(h =>
        h.type === 'ADD_ITEM' ||
        h.type === 'REMOVE_ITEM' ||
        h.type === 'UPDATE_ITEM'
      );

      // Priority: use navigationTarget from confirmation if available
      // Otherwise, use returnToActiveOnChange logic
      let targetView = 'active';
      if (navigationFromConfirmation) {
        targetView = navigationFromConfirmation;
        console.log(`📋 Using navigationTarget from confirmation: ${targetView}`);
      } else if (editData?.returnToActiveOnChange) {
        targetView = hadChanges ? 'active' : 'history';
        console.log(`📋 From history: hadChanges=${hadChanges}, returning to ${targetView}`);
      } else {
        targetView = editData?.viewMode || 'active';
      }

      clearOrderSessionState();
      navigate('/kds', { state: { viewMode: targetView } });
      return;
    }

    console.log('📞 Starting new order');
    clearOrderSessionState();
    // Stay on menu ordering interface for new order
    window.location.reload();
  };

  // Handle back button from header
  const handleBack = () => {
    const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
    const editDataRaw = sessionStorage.getItem('editOrderData');
    const editData = editDataRaw ? JSON.parse(editDataRaw) : null;

    // Check if we have customer info but no items
    const hasCustomerInfo = currentCustomer?.name && !['הזמנה מהירה', 'אורח', 'אורח/ת', 'אורח כללי', 'אורח אנונימי'].includes(currentCustomer?.name);
    const hasItems = cartItems.length > 0;

    // Determine if there are unsaved changes
    // In edit mode, we check cartHistory. In new order mode, we check if cart or customer is present.
    const hasChanges = isEditMode ? cartHistory.length > 0 : (hasItems || hasCustomerInfo);

    if (hasChanges) {
      console.log('⚠️ Unsaved changes detected, showing exit confirmation');
      setShowExitConfirmModal(true);
      return;
    }

    // NO CHANGES - Still needs careful cleanup before navigating
    console.log('🔙 Header Back clicked (No changes) - Cleaning up and returning');
    clearOrderSessionState();

    if (origin === 'kds') {
      navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
    } else {
      navigate('/mode-selection');
    }
  };

  // Use cart hook utilities for normalization and signature
  const normalizeSelectedOptions = cartNormalizeOptions;
  const getCartItemSignature = cartGetSignature;

  // תיקון סופי: ה-backend מצפה למערך של value_id (מספרים), לא אובייקטים
  const prepareItemsForBackend = (cartItems, originalItems = [], isEditMode = false) => {
    const currentIds = new Set(cartItems.map(item => item.signature || item.id));

    const activeItems = cartItems.map(item => {
      // Check if this item has a UUID (existing item) vs a temporary ID (new item)
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const itemUniqueId = item.uniqueId || item.id;

      return {
        item_id: item.menu_item_id || item.id,
        quantity: item.quantity || 1,
        price: item.price,
        selected_options: Array.isArray(item.selectedOptions)
          ? item.selectedOptions
            .filter(opt => opt?.valueId && !opt.valueName?.includes('רגיל'))
            .map(opt => Number(opt.valueId))
          : [],
        notes: item.notes || null,
        course_stage: item.isDelayed ? 2 : 1,
        // CRITICAL: Include order_item_id to signal UPDATE vs INSERT
        order_item_id: (itemUniqueId && isUUID(itemUniqueId)) ? itemUniqueId : null
      };
    });

    if (isEditMode) {
      const cancelledItems = (originalItems || [])
        .filter(orig => !currentIds.has(orig.signature || orig.id))
        .map(orig => ({
          item_id: orig.id,
          quantity: 0,
          price: orig.price,
          selected_options: [],
          notes: null,
          is_cancelled: true
        }));

      return [...activeItems, ...cancelledItems];
    }

    return activeItems;
  };

  // --- הוסר: calculateBasePrice - לא נדרש יותר, המודאל מחשב את המחיר הכולל ---

  // NOTE: fetchMenuItems, isFoodItem, getCategoryId עברו ל-useMenuItems hook

  // Function to calculate item price with mods
  const calculateItemPriceWithMods = (item, menuItem) => {
    let basePrice = item.price || menuItem?.price || 0;
    const selectedOptions = item.selectedOptions || item.mods || [];

    // If selectedOptions is an array with mod objects
    if (Array.isArray(selectedOptions)) {
      selectedOptions.forEach(mod => {
        if (mod && typeof mod === 'object') {
          const priceAdjustment = mod.priceAdjustment || mod.price || 0;
          basePrice += Number(priceAdjustment);
        }
      });
    }

    return basePrice;
  };

  // Check for edit mode on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editOrderId = urlParams.get('editOrderId');

    // Safety Check: Redirect if ID is explicitly "undefined" string
    if (editOrderId === 'undefined' || editOrderId === 'null') {
      console.error('❌ Detected invalid editOrderId in URL:', editOrderId);
      navigate(currentUser?.business_id ? '/kds' : '/'); // Fallback logic
      return;
    }

    if (editOrderId) {
      const editData = sessionStorage.getItem('editOrderData');
      if (editData) {
        try {
          const parsedData = JSON.parse(editData);

          if (!parsedData || !parsedData.id || parsedData.id === 'undefined') {
            console.error('❌ Computed invalid order data from session:', parsedData);
            sessionStorage.removeItem('editOrderData');
            alert('נתוני הזמנה לא תקינים. חוזר למסך ראשי.');
            navigate('/kds', { state: { viewMode: parsedData?.viewMode || 'active' } });
            return;
          }

          console.log('✅ Loaded Edit Order Data Validated:', parsedData.id);
          setIsEditMode(true);
          setEditingOrderData(parsedData);

          // Load the existing order items into cart with correct prices
          const orderItems = parsedData.items?.map(item => {
            // Find the corresponding menu item to get base price
            const menuItem = menuItems.find(menu => menu.id === item.menuItemId || menu.id === item.id);
            const calculatedPrice = calculateItemPriceWithMods(item, menuItem);

            // Convert mods (JSON string or object) to selectedOptions format
            let selectedOptions = item.selectedOptions || [];
            if (!selectedOptions.length && item.mods) {
              try {
                // If mods is a string, parse it
                const parsedMods = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;

                // If parsedMods is an array of value IDs, convert to selectedOptions format
                if (Array.isArray(parsedMods)) {
                  selectedOptions = parsedMods
                    .filter(id => id !== null && id !== undefined)
                    .map(valueId => ({
                      valueId: Number(valueId),
                      valueName: '', // Will be filled when needed
                      groupId: null,
                      priceAdjustment: 0
                    }));
                } else if (typeof parsedMods === 'object') {
                  // If it's an object, convert to array format
                  selectedOptions = Object.entries(parsedMods)
                    .filter(([key, value]) => value !== null && value !== undefined && value !== 0)
                    .map(([key, value]) => ({
                      valueId: Number(value),
                      valueName: '',
                      groupId: null,
                      priceAdjustment: 0
                    }));
                }
              } catch (e) {
                console.error('Error parsing mods:', e);
                selectedOptions = [];
              }
            }

            console.log(`📦 Loading item for edit: ${item.name} `, {
              menuItemId: item.menuItemId,
              id: item.id,
              mods: item.mods,
              selectedOptions: selectedOptions
            });

            return {
              ...item,
              // Ensure menuItemId is preserved (INTEGER, not UUID)
              menuItemId: item.menuItemId || item.menu_item_id || (menuItem?.id),
              id: item.id, // Keep the UUID for cart item identification
              // Convert mods back to selectedOptions format
              selectedOptions: selectedOptions,
              // Ensure correct price calculation
              price: calculatedPrice,
              originalPrice: calculatedPrice,
              tempId: item.tempId || uuidv4() // Ensure stable ID for React keys
            };
          }) || [];

          cartSetItems(orderItems);

          // Set customer data
          if (parsedData.customerName) {
            const customerData = {
              name: parsedData.customerName,
              phone: parsedData.customerPhone,
              isAnonymous: !parsedData.customerPhone
            };
            setCurrentCustomer(customerData);
            localStorage.setItem('currentCustomer', JSON.stringify(customerData));
          }

          // Clear the sessionStorage data
          sessionStorage.removeItem('editOrderData');
        } catch (error) {
          console.error('Error loading edit order data:', error);
        }
      }
    }
  }, []);

  // NOTE: filteredItems, groupedItems, handleCategoryChange מגיעים כעת מ-useMenuItems hook

  const itemRequiresModifierModal = () => true;

  // Helper to update cart with history tracking
  // Use cart hook functions for history tracking
  const updateCartWithHistory = cartUpdateWithHistory;
  const handleUndoCart = cartHandleUndo;

  // Handle adding item to cart
  const handleAddToCart = (item) => {
    if (isRestrictedMode) {
      console.log('🚫 Adding items disabled in Restricted Mode');
      // Optional: Add toast notification here
      return;
    }

    const normalizedOptions = normalizeSelectedOptions(item?.selectedOptions || []);

    // Determine if we should open the Modifier Modal
    // Open for:
    // 1. Items with KDS routing logic (Salads, etc.)
    // 2. Items that require modifiers (Coffee with milk options)
    // 3. Food items that might need notes (Sandwiches, Toast, Pizza) even if no options

    const kdsLogic = item?.kds_routing_logic;
    const isFood = isFoodItem(item);

    const shouldOpenModal =
      kdsLogic ||
      itemRequiresModifierModal(item) ||
      isFood;

    if (shouldOpenModal) {
      setSelectedItemForMod({
        ...item,
        selectedOptions: normalizedOptions
      });
      setEditingCartItem(null);
      // Use the standard ModifierModal for everything
      setShowModifierModal(true);
      return;
    }

    updateCartWithHistory((prevItems) => {
      const candidateItem = {
        ...item,
        selectedOptions: normalizedOptions,
        quantity: 1,
        signature: getCartItemSignature({ ...item, selectedOptions: normalizedOptions }),
        // Generate unique ID to prevent grouping and allow individual status control
        tempId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isDelayed: false
      };

      // Always add as new item (no grouping)
      return [...prevItems, candidateItem];
    });
  };

  const handleAddItemWithModifiers = (modifiedItem) => {
    console.log('🛒 handleAddItemWithModifiers called:', {
      modifiedItem_keys: Object.keys(modifiedItem || {}),
      modifiedItem_id: modifiedItem?.id,
      originalItem: selectedItemForMod
    });

    setShowModifierModal(false);

    // **תיקון: שמור את selectedItemForMod לפני שמאפסים אותו**
    const originalItem = selectedItemForMod;
    setSelectedItemForMod(null);

    const normalizedOptions = normalizeSelectedOptions(modifiedItem?.selectedOptions || []);

    console.log('🥗 Checking Salad Prep Options:', normalizedOptions);

    // Check for KDS routing logic (Salad Prep)
    let kdsOverride = false;

    // Check if 'prep' option was selected (from our injected extraGroups)
    // We need to look at the raw selectedOptions from ModifierModal before normalization if possible,
    // or check normalizedOptions if they contain the ID 'prep'.
    // Since normalizedOptions might be complex, let's check modifiedItem.selectedOptions directly first.

    // Filter out the internal 'prep'/'ready' options so they don't appear as regular modifiers
    const finalOptions = normalizedOptions.filter(opt => {
      // Check both ID and potentially value if structure differs
      // ModifierModal returns objects with valueId
      const id = String(opt.valueId || opt.id || opt);

      if (id === 'prep') {
        kdsOverride = true;
        return false; // Don't include in final modifiers list
      }
      if (id === 'ready') {
        return false; // Don't include in final modifiers list
      }
      return true;
    });

    console.log('🥗 KDS Override Result:', kdsOverride);

    // Also check if custom_note was added directly (MTO logic)
    // ModifierModal adds notes to the item root usually, or as a modifier?
    // ModifierModal adds 'orderNote' to the item object itself usually.

    const candidateItem = {
      ...modifiedItem,
      selectedOptions: finalOptions,
      mods: {
        ...(modifiedItem.mods || {}),
        kds_override: kdsOverride
      },
      // Preserve the original menu_item_id (numeric ID from database)
      // Preserve the original menu_item_id (numeric ID from database)
      menu_item_id: originalItem?.id || modifiedItem?.id
    };
    const itemSignature = getCartItemSignature(candidateItem);

    updateCartWithHistory((prevItems = []) => {
      // If editing an existing item
      if (editingCartItem) {
        return prevItems.map((cartItem) => {
          // Match logic: Use tempId if available, otherwise fallback to strict signature/id match
          const isMatch = cartItem.tempId
            ? cartItem.tempId === editingCartItem.tempId
            : (cartItem.id === editingCartItem.id &&
              (cartItem.signature || getCartItemSignature(cartItem)) === (editingCartItem.signature || getCartItemSignature(editingCartItem)));

          if (isMatch) {
            return {
              ...candidateItem,
              quantity: cartItem.quantity, // Keep quantity
              signature: itemSignature,
              basePrice: originalItem?.basePrice || originalItem?.price || candidateItem.price,
              originalPrice: originalItem?.originalPrice || originalItem?.price || candidateItem.price,
              tempId: cartItem.tempId || `cart-${Date.now()}`, // Ensure ID
              isDelayed: cartItem.isDelayed
            };
          }
          return cartItem;
        });
      }

      // If adding new item - ALWAYS APPEND (No grouping)
      return [
        ...prevItems,
        {
          ...candidateItem,
          quantity: 1,
          signature: itemSignature,
          basePrice: originalItem?.basePrice || originalItem?.price || candidateItem.price,
          originalPrice: originalItem?.originalPrice || originalItem?.price || candidateItem.price,
          tempId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isDelayed: false
        }
      ];
    });

    setEditingCartItem(null);
  };

  // Handler for Salad Prep Decision
  const handleSaladPrepSubmit = (mods) => {
    setShowSaladPrepModal(false);
    const originalItem = selectedItemForMod;
    setSelectedItemForMod(null);

    const normalizedOptions = normalizeSelectedOptions(originalItem?.selectedOptions || []);

    // Add custom_note as a modifier if provided
    const modifiers = { ...mods };
    const modifierArray = [];

    if (modifiers.custom_note) {
      modifierArray.push({ name: modifiers.custom_note, price: 0 });
    }

    const candidateItem = {
      ...originalItem,
      selectedOptions: [...normalizedOptions, ...modifierArray],
      kds_override: modifiers.kds_override || false,
      menu_item_id: originalItem?.id
    };

    const itemSignature = getCartItemSignature(candidateItem);

    updateCartWithHistory((prevItems = []) => {
      return [
        ...prevItems,
        {
          ...candidateItem,
          quantity: 1,
          signature: itemSignature,
          basePrice: originalItem?.basePrice || originalItem?.price || candidateItem.price,
          originalPrice: originalItem?.originalPrice || originalItem?.price || candidateItem.price,
          tempId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isDelayed: false
        }
      ];
    });
  };

  // Handler for MTO Quick Notes
  const handleMTONotesSubmit = (mods) => {
    setShowMTONotesModal(false);
    const originalItem = selectedItemForMod;
    setSelectedItemForMod(null);

    const normalizedOptions = normalizeSelectedOptions(originalItem?.selectedOptions || []);

    // Add custom_note as a modifier if provided
    const modifierArray = [];
    if (mods.custom_note) {
      modifierArray.push({ name: mods.custom_note, price: 0 });
    }

    const candidateItem = {
      ...originalItem,
      selectedOptions: [...normalizedOptions, ...modifierArray],
      menu_item_id: originalItem?.id
    };

    const itemSignature = getCartItemSignature(candidateItem);

    updateCartWithHistory((prevItems = []) => {
      return [
        ...prevItems,
        {
          ...candidateItem,
          quantity: 1,
          signature: itemSignature,
          basePrice: originalItem?.basePrice || originalItem?.price || candidateItem.price,
          originalPrice: originalItem?.originalPrice || originalItem?.price || candidateItem.price,
          tempId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isDelayed: false
        }
      ];
    });
  };

  const handleEditCartItem = (cartItem) => {
    console.log('✏️ handleEditCartItem called with:', cartItem);

    if (!cartItem) {
      console.warn('⚠️ No cart item provided to edit');
      return;
    }

    console.log('✏️ Setting up edit for item:', {
      name: cartItem.name,
      menu_item_id: cartItem.menu_item_id,
      selectedOptions: cartItem.selectedOptions
    });

    setEditingCartItem(cartItem);
    setSelectedItemForMod({
      ...cartItem,
      // השתמש במחיר המקורי (ללא תוספות) אם קיים, אחרת במחיר הנוכחי
      price: cartItem.originalPrice || cartItem.basePrice || cartItem.price
    });
    setShowModifierModal(true);
  };

  // Handle toggling delay status for cart item - use hook function
  const handleToggleDelay = (itemId, itemSignature, tempId) => {
    cartToggleDelay(itemId, itemSignature, tempId);
  };

  // Handle removing item from cart
  const handleRemoveItem = (itemId, itemSignature, tempId) => {
    console.log('🗑️ Removing item:', { itemId, itemSignature, tempId, cartItems: cartItems.length });

    updateCartWithHistory((prevItems) => {
      if (!prevItems || prevItems.length === 0) {
        console.log('🛒 Cart is already empty');
        return prevItems;
      }

      const newItems = prevItems?.filter((item) => {
        // Match by tempId if available (Primary method)
        if (tempId && item.tempId === tempId) {
          console.log('🗑️ Matched by tempId, removing:', item.name);
          return false;
        }

        // Legacy matching logic below...
        if (!tempId) {
          const currentSignature = item?.signature || getCartItemSignature(item);

          // Priority 1: Match by signature (most reliable identifier)
          if (itemSignature && currentSignature === itemSignature) {
            console.log('🗑️ Matched by signature, removing:', item.name || item.id);
            return false; // Remove this item
          }

          // Priority 2: Match by ID + signature (if both provided)
          if (itemId && itemSignature) {
            const idMatch = String(item?.id) === String(itemId) ||
              String(item?.menu_item_id) === String(itemId) ||
              String(item?.tempId) === String(itemId);
            if (idMatch && currentSignature === itemSignature) {
              console.log('🗑️ Matched by ID and signature, removing:', item.name || item.id);
              return false;
            }
          }

          // Priority 3: Match by ID only (if no signature provided)
          if (itemId && !itemSignature) {
            const idMatch = String(item?.id) === String(itemId) ||
              String(item?.menu_item_id) === String(itemId) ||
              String(item?.tempId) === String(itemId);
            if (idMatch) {
              console.log('🗑️ Matched by ID only, removing:', item.name || item.id);
              return false;
            }
          }
        }

        // Keep this item
        return true;
      });

      console.log('🛒 Cart after removal:', { before: prevItems.length, after: newItems.length });
      return newItems || [];
    });
  };

  // Handle clearing entire cart - use hook function
  const handleClearCart = () => {
    console.log('🧹 Clearing cart');
    cartClearCart();
  };

  // Use cart total from hook (or local useMemo if more customization needed)
  const cartTotal = hookCartTotal;

  // Use adjustedLoyaltyPoints from hook (no local calculation needed)
  const adjustedLoyaltyPoints = hookAdjustedLoyaltyPoints;

  // Calculate Loyalty Discount
  useEffect(() => {
    console.log('🔄 Loyalty useEffect triggered:', {
      hasCustomer: !!currentCustomer,
      isEditMode,
      hasEditData: !!editingOrderData,
      loyaltyPoints,
      cartItemsCount: cartItems.length
    });

    const isAnonymous = !currentCustomer ||
      String(currentCustomer.name).includes('אורח אנונימי') ||
      currentCustomer.name === 'אורח' ||
      currentCustomer.name === 'אורח/ת' ||
      currentCustomer.name === 'הזמנה מהירה';

    if (!currentCustomer || isAnonymous) {
      setLoyaltyDiscount(0);
      setLoyaltyFreeItemsCount(0);
      return;
    }

    // Guard: In edit mode, wait for editingOrderData to be loaded before calculating
    // to avoid "jumping" numbers (double counting)
    if (isEditMode && !editingOrderData) {
      return;
    }

    // In Edit Mode: Check if cart is unchanged from original
    // If unchanged, preserve the original discount instead of recalculating
    if (isEditMode && editingOrderData?.isPaid && editingOrderData?.originalLoyaltyDiscount > 0) {
      const originalItemIds = new Set(
        editingOrderData.originalItems?.map(i => i.menu_item_id || i.id) || []
      );
      const currentItemIds = new Set(
        cartItems.map(i => i.menu_item_id || i.id)
      );

      // Check if items are the same (simple check by comparing sets)
      const originalCount = editingOrderData.originalItems?.reduce((sum, i) => sum + (i.quantity || 1), 0) || 0;
      const currentCount = cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

      if (originalItemIds.size === currentItemIds.size && originalCount === currentCount) {
        // Cart unchanged - preserve original discount
        if (loyaltyDiscount !== editingOrderData.originalLoyaltyDiscount) {
          console.log('🎁 Preserving original loyalty discount:', editingOrderData.originalLoyaltyDiscount);
          setLoyaltyDiscount(editingOrderData.originalLoyaltyDiscount);
        }
        return;
      }
    }

    // Note: In Edit Mode, we still calculate discounts based on:
    // - adjustedLoyaltyPoints (which accounts for original order's coffees)
    // - Current cart items (which may include new items)

    // Use the pre-calculated adjusted value (accounts for Edit Mode)
    const startCount = adjustedLoyaltyPoints;

    // Debug log for edit mode
    if (isEditMode && editingOrderData) {
      console.log('🔍 Loyalty Debug (Edit Mode):', {
        isEditMode,
        isPaid: editingOrderData.isPaid,
        rawLoyaltyBalance: loyaltyPoints,
        adjustedLoyaltyPoints,
        startCountUsed: startCount
      });
    }

    // Create a flat list of all coffee items in cart (expanding quantities)
    const coffeeItems = [];

    cartItems.forEach(item => {
      // Check if item is a coffee/drink eligible for loyalty
      // We use ONLY the is_hot_drink flag from DB as requested
      const isCoffee = item.is_hot_drink;

      if (isCoffee) {
        for (let i = 0; i < item.quantity; i++) {
          // We store the full price of this specific item (including modifiers)
          coffeeItems.push({ price: item.price });
        }
      }
    });

    const cartCoffeeCount = coffeeItems.length;

    // *** CRITICAL: No coffee items = no discount ***
    if (cartCoffeeCount === 0) {
      setLoyaltyDiscount(0);
      setLoyaltyFreeItemsCount(0);
      return;
    }

    // ============================================
    // SIMPLE LOYALTY CALCULATION - NO CREDITS!
    // ============================================
    // Rule: Buy 9, get 10th free (immediately, not saved)
    // Points: 0-9, resets to 0 when reaching 10
    // ============================================

    // Get starting points (adjusted for edit mode)
    const startPoints = adjustedLoyaltyPoints;

    // Simple simulation: for each coffee, add point. On 10, it's free.
    let simPoints = startPoints;
    let freeCount = 0;

    for (let i = 0; i < cartCoffeeCount; i++) {
      simPoints++;
      if (simPoints >= 10) {
        // 10th coffee is FREE!
        freeCount++;
        simPoints = 0; // Reset for next cycle
      }
    }

    const freeItemsCount = freeCount;

    console.log('💰 Loyalty Calculation (Simple):', {
      startPoints,
      cartCoffeeCount,
      freeItemsCount,
      finalSimPoints: simPoints
    });

    let discount = 0;

    if (freeItemsCount > 0 && coffeeItems.length > 0) {
      // Sort cart items by price (ascending) to discount the cheapest ones first
      // as per business rule: "אם יש יותר מקפה אחד באותה קנייה אז הזול מבינהם"
      coffeeItems.sort((a, b) => a.price - b.price);

      // Take the cheapest 'freeItemsCount' items (but not more than what's in cart)
      const itemsToDiscount = Math.min(freeItemsCount, coffeeItems.length);
      for (let i = 0; i < itemsToDiscount; i++) {
        discount += coffeeItems[i].price;
      }

      console.log('🎁 Applying discount:', {
        freeItemsCount,
        itemsToDiscount,
        discountedItems: coffeeItems.slice(0, itemsToDiscount).map(c => c.price),
        totalDiscount: discount
      });
      setLoyaltyDiscount(discount);
      setLoyaltyFreeItemsCount(freeItemsCount);
    } else {
      // RESET: If no free items, ensure discount is 0
      setLoyaltyDiscount(0);
      setLoyaltyFreeItemsCount(0);
    }
  }, [cartItems, currentCustomer, loyaltyPoints, loyaltyFreeCoffees, isEditMode, editingOrderData, adjustedLoyaltyPoints]);

  // Calculate soldier discount amount
  const soldierDiscountAmount = useMemo(() => {
    if (!soldierDiscountEnabled) return 0;
    // 10% of cart total - keep decimals (agorot) for accurate display
    return cartTotal * 0.10;
  }, [cartTotal, soldierDiscountEnabled]);

  // Calculate finalTotal with useMemo to react to loyaltyDiscount and soldier discount changes
  const finalTotal = useMemo(() => {
    const total = Math.max(0, cartTotal - loyaltyDiscount - soldierDiscountAmount);
    // Keep decimals (agorot) for accurate display
    console.log('💵 Final Total:', { cartTotal, loyaltyDiscount, soldierDiscountAmount, finalTotal: total });
    return total;
  }, [cartTotal, loyaltyDiscount, soldierDiscountAmount]);

  // Toggle soldier discount handler
  const handleToggleSoldierDiscount = async () => {
    if (!soldierDiscountEnabled) {
      // Enable - try to fetch discount ID from DB (optional)
      try {
        // First try: look for discount with customer_types containing 'soldier' for this business
        const { data } = await supabase
          .from('discounts')
          .select('id')
          .contains('customer_types', ['soldier'])
          .eq('is_active', true)
          .eq('business_id', currentUser?.business_id)
          .limit(1);

        if (data && data.length > 0) {
          setSoldierDiscountId(data[0].id);
          console.log('🎖️ Soldier discount enabled from DB:', data[0].id);
        } else {
          // Fallback: find any discount with "חייל" in name for this business
          const { data: fallback } = await supabase
            .from('discounts')
            .select('id')
            .ilike('name', '%חייל%')
            .eq('is_active', true)
            .eq('business_id', currentUser?.business_id)
            .limit(1);

          if (fallback && fallback.length > 0) {
            setSoldierDiscountId(fallback[0].id);
            console.log('🎖️ Soldier discount enabled (fallback):', fallback[0].id);
          } else {
            // No DB record - that's OK, we calculate 10% inline
            console.log('🎖️ Soldier discount enabled (no DB record, using 10% inline)');
          }
        }
      } catch (err) {
        console.error('Failed to fetch soldier discount:', err);
        // Continue anyway - we calculate discount inline
      }
      // Always enable the discount toggle
      setSoldierDiscountEnabled(true);
    } else {
      // Disable
      setSoldierDiscountEnabled(false);
      setSoldierDiscountId(null);
    }
  };

  // Updated handleInitiatePayment to show payment modal
  const handleInitiatePayment = async () => {
    // ⛔ CRITICAL: Block all processing if cart is empty and not in edit mode
    if ((!cartItems || cartItems.length === 0) && !isEditMode) {
      console.error('❌ BLOCKED: handleInitiatePayment called with empty cart!');
      return;
    }

    // 1. Check for Cancel Order (Edit Mode + Unpaid + Empty Cart)
    const isCancelOrder = isEditMode && editingOrderData && !editingOrderData.isPaid && cartItems.length === 0;

    if (isCancelOrder) {
      const orderId = editingOrderData?.orderId;
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        console.error('❌ Cannot cancel order: Invalid ID', orderId);
        alert('שגיאה: מספר הזמנה לא תקין. אנא חזור למסך המטבח.');
        const editDataRaw = sessionStorage.getItem('editOrderData');
        const editData = editDataRaw ? JSON.parse(editDataRaw) : null;
        navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
        return;
      }

      if (window.confirm('האם אתה בטוח שברצונך לבטל את ההזמנה? פעולה זו תמחק את ההזמנה לצמיתות.')) {
        try {
          setIsProcessingOrder(true);

          // Attempt Secure Delete RPC first (Better for permissions/integrity)
          const { error: rpcError } = await supabase.rpc('delete_order_secure', { p_order_id: orderId });

          if (rpcError) {
            console.warn('⚠️ Secure Delete RPC failed/missing, trying direct delete:', rpcError);
            // Fallback: Direct Delete
            const { error: deleteError } = await supabase
              .from('orders')
              .delete()
              .eq('id', orderId);

            if (deleteError) throw deleteError;
          }

          console.log('✅ Order cancelled/deleted successfully');
          handleCloseConfirmation(); // Clears cart and navigates back
        } catch (err) {
          console.error('❌ Failed to cancel order:', err);
          alert('שגיאה בביטול ההזמנה: ' + (err.message || 'Unknown error'));
          setIsProcessingOrder(false);
        }
      }
      return;
    }

    if (isEditMode) {
      const originalTotal = editingOrderData?.originalTotal || 0;
      const priceDifference = finalTotal - originalTotal;

      // אם אין שינוי במחיר ואין הוספת פריטים חדשים, בצע עדכון ישיר ללא מודאל תשלום ובלי הודעת אישור
      const hasAddedItems = cartHistory.some(h => h.type === 'ADD_ITEM');

      if (Math.abs(priceDifference) === 0 && !hasAddedItems) {
        console.log('✏️ No price change and no new items, updating directly (skip confirmation)...');
        handlePaymentSelect({
          paymentMethod: editingOrderData?.paymentMethod || 'cash',
          is_paid: editingOrderData?.isPaid,
          skipConfirmation: true  // דלג על הודעת "תודה על ההזמנה"
        });
        return;
      }
    }

    const originalTotalForRefund = editingOrderData?.originalTotal || 0;
    const isRefund = isEditMode && editingOrderData?.isPaid && (finalTotal < originalTotalForRefund);
    const isUnpaidUpdate = isEditMode && !editingOrderData?.isPaid; // Allow update for unpaid orders

    // Allow if refund OR unpaid update, even if cart is empty or total is 0
    // But if cart is empty and unpaid, we handled it above (Cancel).
    // If cart is NOT empty but unpaid, we allow.
    if ((cartItems?.length === 0 && !isRefund) || (finalTotal <= 0 && !isRefund && !isUnpaidUpdate && loyaltyDiscount === 0)) {
      if (!isUnpaidUpdate) return;
    }
    setShowPaymentModal(true);
  };

  // Handler for adding customer details mid-order
  const handleAddCustomerDetails = (mode = 'phone-then-name') => {
    console.log('👤 Opening customer info modal with mode:', mode);
    setCustomerInfoModalMode(mode);
    setShowCustomerInfoModal(true);
  };

  // Handle payment selection and order creation
  const handlePaymentSelect = async (orderData) => {
    console.log('🚀 ========== START handlePaymentSelect ==========');
    console.log('📦 Order Data:', orderData);
    console.log('🛒 Cart Items:', cartItems);
    console.log('💰 Cart Total:', cartTotal);
    console.log('✏️ Is Edit Mode:', isEditMode);
    console.log('📋 Editing Order Data:', editingOrderData);

    // ⛔ CRITICAL GUARD: Prevent empty orders from being created
    if (!cartItems || cartItems.length === 0) {
      // Only allow empty cart in edit mode when cancelling an order
      if (!isEditMode) {
        console.error('❌ BLOCKED: Attempted to create order with empty cart!');
        alert('לא ניתן ליצור הזמנה ריקה');
        return;
      }
      // In edit mode with empty cart - this is a cancel operation, handled separately
      console.log('⚠️ Edit mode with empty cart - assuming cancel operation');
    }

    try {
      setIsProcessingOrder(true);
      setShowPaymentModal(false);

      // חישוב נכון של isRefund לפי הסכום המקורי שנשמר ב-editingOrderData - מועבר לראש הפונקציה
      const originalTotalForRefund = editingOrderData?.originalTotal || 0;
      const isRefund = isEditMode && editingOrderData?.isPaid && (finalTotal < originalTotalForRefund);

      console.log('💵 Refund Calculation:');
      console.log('  - Original Total:', originalTotalForRefund);
      console.log('  - Current Total:', cartTotal);
      console.log('  - Is Refund:', isRefund);

      const customerDataString = localStorage.getItem('currentCustomer');
      const customerData = customerDataString ? JSON.parse(customerDataString) : {};

      // Check if ID is a temporary local ID - if so, treat as null for backend
      let rawCustomerId = customerData?.id;
      if (typeof rawCustomerId === 'string' && rawCustomerId.startsWith('local-')) {
        console.log('⚠️ Found local customer ID, treating as null for backend:', rawCustomerId);
        rawCustomerId = null;
      }

      // לקוחות אנונימיים מקבלים undefined במקום מזהה אנונימי
      const customerId = customerData?.isAnonymous ? undefined : (rawCustomerId || null);
      // לקוחות אנונימיים מקבלים שם גנרי בשרת לשמירת פרטיות - בוטל, שומרים את השם שהוזן
      let customerNameForOrder = orderData?.customer_name || customerData?.name || null;
      // if (customerData?.isAnonymous) {
      //   customerNameForOrder = 'אורח אנונימי'; 
      // }

      // תיקון: וידוא שלוקחים את המספר האמיתי מה-localStorage אם הוא קיים,
      // ומתעלמים מערכים פיקטיביים כמו "null" (string) או undefined.
      let realPhone = null;
      if (customerData?.phone && customerData.phone.length >= 9) {
        realPhone = customerData.phone;
      } else if (orderData?.customer_phone && orderData.customer_phone.length >= 9) {
        realPhone = orderData.customer_phone;
      } else if (currentCustomer?.phone && currentCustomer.phone.length >= 9) {
        realPhone = currentCustomer.phone;
      }

      const popupPhone = realPhone;

      if (!customerNameForOrder && realPhone) {
        customerNameForOrder = `אורח(${realPhone})`;
      } else if (!customerNameForOrder) {
        customerNameForOrder = null;
      }

      let preparedItems = [];
      let cancelledItems = [];

      // Debug: בדיקת selectedOptions לפני המרה
      console.log('🔍 Cart items before preparation:', cartItems.map(item => ({
        id: item.id,
        name: item.name,
        selectedOptions: item.selectedOptions,
        selectedOptions_type: Array.isArray(item.selectedOptions) ? 'array' : typeof item.selectedOptions
      })));

      if (isEditMode && editingOrderData?.originalItems) {
        const currentOrderItemIds = new Set(cartItems.map(item => item.id).filter(Boolean));

        cancelledItems = editingOrderData.originalItems.filter(originalItem =>
          !currentOrderItemIds.has(originalItem.id)
        );

        console.log("Cancelled items to send:", cancelledItems.length);

        // פריטים פעילים - שליחת UUIDs כ-strings
        preparedItems = cartItems.map(item => {
          const options = Array.isArray(item.selectedOptions)
            ? item.selectedOptions
              .filter(opt => {
                console.log('🔍 Filtering option:', opt);
                // FIX: Allow strings (loaded from DB) to pass!
                if (typeof opt === 'string') return true;
                return opt?.valueId && !opt.valueName?.includes('רגיל');
              })
              .map(opt => {
                // Use Name for KDS display, not UUID
                // Handle case where opt is already a string (from DB load)
                if (typeof opt === 'string') return opt;
                console.log('🔍 Keeping option Name:', opt.valueName);
                return opt.valueName || opt.name;
              })
            : [];


          // Extract valid menu_item_id (skip local- temporary IDs)
          let itemId = item.menu_item_id || item.id;
          // If ID is a temporary local ID, try to find the real menu_item_id
          if (typeof itemId === 'string' && itemId.startsWith('local-')) {
            console.error('⚠️ Found local ID in edit mode, item missing menu_item_id:', item);
            throw new Error(`Invalid item ID: ${item.name} has temporary ID but no menu_item_id`);
          }

          console.log('🔍 Item ID extraction:', {
            name: item.name,
            menu_item_id: item.menu_item_id,
            id: item.id,
            final_item_id: itemId
          });

          // Check if item.id is a valid UUID (existing item) or a temporary ID (new item)
          // Simple UUID regex check
          const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

          const orderItemId = isUUID(item.id) ? item.id : null;

          // CRITICAL FIX: Preserve status if item is already ready or completed
          // to prevent overwriting KDS work while editing.
          let finalStatus = item.originalStatus || (item.isDelayed ? 'pending' : 'in_progress');

          // Only force 'in_progress' for new items or items that were modified 
          // (if we want to be safe, but for now let's just preserve 'ready' and 'completed')
          if (item.originalStatus === 'ready' || item.originalStatus === 'completed' || item.originalStatus === 'cancelled') {
            finalStatus = item.originalStatus;
          } else if (item.isDelayed) {
            finalStatus = (item.originalStatus === 'in_progress' ? 'in_progress' : 'pending');
          } else if (!item.originalStatus) {
            finalStatus = 'in_progress';
          }

          console.log('🛡️ Save Status Check:', {
            name: item.name,
            isDelayed: item.isDelayed,
            originalStatus: item.originalStatus,
            finalStatus
          });

          // Calculate discount per item if soldier discount is enabled
          const itemPrice = item.price || item.unit_price;
          const discountPercent = soldierDiscountEnabled ? 0.10 : 0;
          const discountForItem = Math.floor(itemPrice * discountPercent * 100) / 100;
          const finalPricePerItem = itemPrice - discountForItem;

          return {
            item_id: itemId, // menu_item_id (integer)
            order_item_id: orderItemId, // UUID for existing item, null for new items
            quantity: item.quantity,
            price: itemPrice,
            final_price: finalPricePerItem,
            discount_applied: discountForItem,
            selected_options: options,
            mods: [
              ...options,
              ...((item.kds_override || item.mods?.kds_override) ? ['__KDS_OVERRIDE__'] : []),
              ...((item.custom_note || item.mods?.custom_note) ? [`__NOTE__:${item.custom_note || item.mods.custom_note}`] : [])
            ],
            notes: item.notes || null,
            item_status: finalStatus,
            course_stage: item.isDelayed ? 2 : 1
          };
        });

        // DO NOT add cancelled items to preparedItems (p_items).
        // They are sent separately in p_cancelled_items.
        // Adding them here caused them to be UPDATED with quantity 0 instead of CANCELLED status.

      } else {
        // מצב רגיל - שליחת UUIDs כ-strings
        preparedItems = cartItems.map(item => {
          const options = Array.isArray(item.selectedOptions)
            ? item.selectedOptions
              .filter(opt => {
                // Filter out invalid/empty options
                if (!opt) return false;
                if (typeof opt === 'string') return opt.trim().length > 0;
                // Filter out 'regular' options that shouldn't be saved
                return opt.valueId && !opt.valueName?.includes('רגיל');
              })
              .map(opt => {
                // Ensure we ONLY return a string
                if (typeof opt === 'string') return opt;
                // Extract name safely
                return String(opt.valueName || opt.name || '');
              })
              .filter(s => s.length > 0) // Final check for empty strings
            : [];


          // Extract valid menu_item_id (must be integer, not UUID)
          let itemId = item.menu_item_id;

          // Validate that we have a proper menu_item_id
          if (!itemId || typeof itemId === 'string') {
            console.error('⚠️ Invalid menu_item_id for item:', item);
            throw new Error(`Invalid item: ${item.name} has no valid menu_item_id (got: ${itemId})`);
          }

          console.log('🔍 Item ID extraction:', {
            name: item.name,
            menu_item_id: item.menu_item_id,
            id: item.id,
            final_item_id: itemId
          });

          // Calculate discount per item if soldier discount is enabled
          const itemPrice = item.price || item.unit_price;
          const discountPercent = soldierDiscountEnabled ? 0.10 : 0;
          const discountForItem = Math.floor(itemPrice * discountPercent * 100) / 100;
          const finalPricePerItem = itemPrice - discountForItem;

          return {
            item_id: itemId,
            quantity: item.quantity,
            price: itemPrice,
            final_price: finalPricePerItem,
            discount_applied: discountForItem,
            selected_options: options,
            mods: [
              ...options,
              ...((item.kds_override || item.mods?.kds_override) ? ['__KDS_OVERRIDE__'] : []),
              ...((item.custom_note || item.mods?.custom_note) ? [`__NOTE__:${item.custom_note || item.mods.custom_note}`] : [])
            ],
            notes: item.notes || null,
            item_status: item.isDelayed ? 'pending' : 'in_progress',
            course_stage: item.isDelayed ? 2 : 1
          };
        });
        cancelledItems = [];   // לא רלוונטי
      }
      console.log('📝 Prepared Items for Backend:', preparedItems);

      // Generate unique identifier for guests without phone
      // אבל אם יש מספר טלפון אמיתי (realPhone), השתמש בו!
      const guestPhone = realPhone || `GUEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `;

      // Calculate transaction amount (delta)
      let transactionAmount = 0;
      if (isEditMode && editingOrderData) {
        transactionAmount = cartTotal - editingOrderData.originalTotal;
      }

      // Calculate original coffee count for loyalty delta logic
      let originalCoffeeCount = 0;
      if (isEditMode && editingOrderData?.originalItems) {
        originalCoffeeCount = editingOrderData.originalItems
          .filter(i => i.is_hot_drink)
          .reduce((sum, i) => sum + i.quantity, 0);
        console.log('☕ Original Coffee Count calculated:', originalCoffeeCount);
      }

      // Build payload matching submit_order_v3 function signature exactly
      const client = supabase;
      const orderPayload = {
        p_customer_phone: guestPhone,
        p_customer_name: customerNameForOrder || 'אורח אנונימי',
        p_items: preparedItems,
        p_is_paid: orderData?.is_paid || false,
        p_customer_id: customerId || null,
        p_payment_method: orderData?.payment_method || null,
        p_refund: isRefund,
        p_refund_amount: isRefund ? Number(originalTotalForRefund - finalTotal) : 0,
        p_refund_method: isRefund ? (orderData?.payment_method || editingOrderData?.paymentMethod) : null,
        p_edit_mode: isEditMode || false,
        p_order_id: isEditMode ? editingOrderData.orderId : null,
        p_original_total: isEditMode ? Number(editingOrderData.originalTotal) : 0,
        p_cancelled_items: isEditMode && cancelledItems.length > 0 ? cancelledItems.map(i => ({ id: i.id })) : [],
        p_final_total: Number((orderData?.total_amount !== undefined) ? orderData.total_amount : finalTotal),
        p_original_coffee_count: Number(originalCoffeeCount),
        p_is_quick_order: !!currentCustomer?.isQuickOrder && !realPhone,
        // Soldier discount takes priority, then orderData discount
        p_discount_id: soldierDiscountEnabled ? soldierDiscountId : (orderData?.discount_id || null),
        p_discount_amount: Number(soldierDiscountEnabled ? soldierDiscountAmount : (orderData?.discount_amount || 0)),
        p_business_id: currentUser?.business_id || null
      };

      console.log('📤 Sending Order Payload:', JSON.stringify(orderPayload, null, 2));
      console.log('💰 p_final_total sent:', orderPayload.p_final_total); // <--- בדיקה קריטית
      console.log('  - Items count:', orderPayload.p_items?.length || 0);
      console.log('  - Cancelled items count:', orderPayload.p_cancelled_items?.length || 0);
      console.log('  - Edit mode:', orderPayload.edit_mode || false);
      console.log('  - Order ID:', orderPayload.order_id || 'N/A');


      console.log('📤 Calling submit_order_v3 with payload');
      console.log('🔍 User Context for RPC:', {
        phone: currentUser?.whatsapp_phone,
        isDemo: currentUser?.whatsapp_phone === '0500000000' || currentUser?.whatsapp_phone === '0501111111'
      });

      // OFFLINE-FIRST: Check if we're online before attempting to submit
      let orderResult = null;
      let orderError = null;
      const isOnline = navigator.onLine;

      if (isOnline) {
        // Online: Submit to Supabase normally
        const response = await supabase.rpc('submit_order_v3', orderPayload);
        orderResult = response.data;
        orderError = response.error;

        // Note: We don't cache to Dexie here - the sync service will handle it
        // This prevents duplicate items when editing orders
      } else {
        // OFFLINE: Save locally and queue for sync
        console.log('📴 Offline: Saving order locally...');

        try {
          const { db } = await import('../../db/database');
          const { queueAction } = await import('../../services/offlineQueue');

          // Generate local order ID (proper UUID!) and number
          const localOrderId = uuidv4();
          const localOrderNumber = `L${Date.now().toString().slice(-6)}`;

          // Save order to local Dexie database
          // IMPORTANT: Use 'in_progress' so order appears in KDS immediately
          const localOrder = {
            id: localOrderId,
            order_number: localOrderNumber,
            business_id: currentUser?.business_id,
            customer_id: orderPayload.p_customer_id,
            customer_name: orderPayload.p_customer_name,
            customer_phone: orderPayload.p_customer_phone,
            order_status: 'in_progress', // Shows in KDS immediately
            is_paid: orderPayload.p_is_paid,
            total_amount: orderPayload.p_final_total,
            discount_id: orderPayload.p_discount_id,
            discount_amount: orderPayload.p_discount_amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_offline: true, // Flag for offline orders
            pending_sync: true // Flag to track sync status
          };
          await db.orders.put(localOrder);

          // Save order items locally
          for (const item of preparedItems) {
            await db.order_items.put({
              id: uuidv4(), // Use proper UUID
              order_id: localOrderId,
              menu_item_id: item.item_id,
              quantity: item.quantity,
              price: item.price,
              mods: item.mods,
              notes: item.notes,
              item_status: item.item_status || 'in_progress', // Shows in KDS
              course_stage: item.course_stage || 1,
              created_at: new Date().toISOString()
            });
          }

          // Queue for later sync
          await queueAction('CREATE_ORDER', {
            ...orderPayload,
            localOrderId: localOrderId
          });

          // Return as if it succeeded
          orderResult = {
            order_id: localOrderId,
            order_number: localOrderNumber,
            offline: true
          };

          console.log('✅ Order saved locally:', localOrderId);
        } catch (offlineErr) {
          console.error('❌ Failed to save order offline:', offlineErr);
          orderError = { message: 'לא ניתן לשמור הזמנה אופליין. נסה שוב.' };
        }
      }

      if (orderError) {
        console.error('❌ Error creating/updating order:', orderError);
        alert(`שגיאה ביצירת ההזמנה: ${orderError.message || 'שגיאה לא ידועה'}`);
        setIsProcessingOrder(false);
        return;
      }

      const orderId = orderResult?.order_id;

      // Only reset order_status to 'in_progress' if we ACTUALLY added new items
      // This prevents completed orders from appearing in active KDS when just editing details
      if (isEditMode && orderId && editingOrderData?.originalOrderStatus === 'completed') {
        // Check if any NEW items were added (items without an existing order_item_id)
        const hasNewItems = cartItems.some(item => !item.id || item.id.toString().includes('temp'));

        if (hasNewItems) {
          console.log('🔄 New items added to completed order. Resetting status to in_progress...');
          const { error: statusError } = await supabase
            .from('orders')
            .update({ order_status: 'in_progress', updated_at: new Date().toISOString() })
            .eq('id', orderId);

          if (statusError) {
            console.error('Failed to reset order status:', statusError);
          } else {
            console.log('✅ Order status reset to in_progress');
          }
        } else {
          console.log('📝 Editing completed order (no new items) - keeping completed status');
        }
      }
      const orderNumber = orderResult?.order_number;
      console.log('✅ Order created/updated successfully!');
      console.log('  - Order ID:', orderId);
      console.log('  - Order Number:', orderNumber);

      // Clear cart
      cartClearCart();

      let updatedCustomer = {
        ...currentCustomer,
        id: customerId,
        phone: orderData?.customer_phone || currentCustomer?.phone || '',
        name: customerNameForOrder || currentCustomer?.name || null
      };
      // Use the live loyaltyPoints state instead of potentially stale customer data
      // Only show loyalty points if we have a real customer phone
      let loyaltyPointsForConfirmation = realPhone ? (loyaltyPoints ?? 0) : null;

      // Safety check: If count is 0 but we have a customer, try to fetch fresh count
      if (loyaltyPointsForConfirmation === 0 && customerId && realPhone) {
        try {
          console.log('🔄 Loyalty count is 0, fetching fresh count for confirmation modal...');
          const freshCount = await getLoyaltyCount(realPhone, currentUser);
          if (typeof freshCount === 'number') {
            loyaltyPointsForConfirmation = freshCount;
            console.log('✅ Fetched fresh loyalty count:', freshCount);
          }
        } catch (e) {
          console.error('⚠️ Failed to fetch fresh loyalty count:', e);
        }
      }
      let loyaltyRewardEarned = false;

      // Calculate payment status for confirmation modal
      const paymentStatus = isRefund ? 'זיכוי' : (orderData?.is_paid ? 'שולם' : 'טרם שולם');
      const refundAmount = isRefund ? Math.abs(cartTotal - originalTotalForRefund) : 0;

      console.log('📋 Confirmation Modal Data:');
      console.log('  - Order ID:', orderId);
      console.log('  - Order Number:', orderNumber);
      console.log('  - Customer Name:', customerNameForOrder || 'אורח');
      console.log('  - Payment Status:', paymentStatus);
      console.log('  - Total:', cartTotal);
      console.log('  - Is Refund:', isRefund);
      console.log('  - Refund Amount:', refundAmount);

      // אם זו עריכה ללא שינויים, דלג על הודעת האישור וחזור ל-KDS
      if (orderData?.skipConfirmation) {
        console.log('⏭️ Skipping confirmation modal (edit with no changes)');
        const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
        const editDataRaw = sessionStorage.getItem('editOrderData');
        const editData = editDataRaw ? JSON.parse(editDataRaw) : null;

        clearOrderSessionState();

        if (origin === 'kds') {
          // Even if we skip confirmation, if objects were changed (e.g. status) we might want active,
          // but usually skipConfirmation means no real preparation changes.
          // Let's check if items were ADDED just in case.
          const itemsAdded = cartHistory.some(h => h.type === 'ADD_ITEM');
          const targetView = itemsAdded ? 'active' : (editData?.viewMode || 'active');

          navigate('/kds', { state: { viewMode: targetView } });
        } else {
          window.location.reload();
        }
        return;
      }

      // Log full cart history for debugging
      console.log('📜 Full Cart History:', cartHistory);

      // Determine correct post-edit navigation
      // If we added items OR it's a new order -> Active Tab
      // If we refunded items -> Active Tab (to see the changes) or History? 
      // User requested: "Added dishes or refunded dishes -> Active Screen"
      // "No changes -> History Screen"

      const itemsAdded = cartHistory.some(h => h.type === 'ADD_ITEM');
      const itemsRefunded = cartHistory.some(h => h.type === 'REMOVE_ITEM' || h.type === 'DECREASE_QUANTITY');
      // Recalculate price difference inside this scope to avoid ReferenceError
      const originalTotal = isEditMode ? (editingOrderData?.originalTotal || 0) : 0;
      // Note: cartTotal is passed as 'amountToPay' in some contexts, but here 'cartTotal' variable from state is correct?
      // Wait, 'cartTotal' in handlePaymentSelect might be closure captured or passed in? 
      // Looking at usage, 'cartTotal' state variable is used.
      const priceDifference = cartTotal - originalTotal;

      const hasChanges = itemsAdded || itemsRefunded || isRefund || (isEditMode && Math.abs(priceDifference) > 0.01);

      console.log('🧭 Navigation Decision:', {
        itemsAdded,
        itemsRefunded,
        isRefund,
        priceDifference,
        hasChanges
      });

      // Show confirmation modal immediately
      const isAdditionalCharge = isEditMode && editingOrderData?.isPaid && priceDifference > 0;

      // Calculate what to show in the modal - use finalTotal which includes discounts
      let displayTotal = finalTotal; // Default for new orders (includes soldier discount)

      if (isEditMode && editingOrderData?.isPaid) {
        if (isRefund) {
          displayTotal = refundAmount; // Show amount returned
        } else if (isAdditionalCharge) {
          // For additional charge, calculate difference with discounts
          displayTotal = finalTotal - originalTotal; // Show EXTRA amount paid
        } else {
          // If paid and no difference (just notes change?), show 0 or full?
          // Usually implies no charge.
          displayTotal = 0;
        }
      }

      setShowConfirmationModal({
        orderId,
        orderNumber: orderNumber || (typeof orderId === 'string' ? orderId.slice(0, 8) : ''),
        customerName: customerNameForOrder || 'אורח',
        loyaltyCoffeeCount: loyaltyPointsForConfirmation,
        loyaltyRewardEarned: false,
        paymentStatus: isAdditionalCharge ? 'תוספת לתשלום' : (isRefund ? 'זיכוי' : paymentStatus),
        paymentMethod: orderData?.payment_method,
        total: displayTotal,
        subtotal: cartTotal,
        soldierDiscountAmount: soldierDiscountAmount,
        loyaltyDiscount: loyaltyDiscount,
        isRefund,
        refundAmount,
        isPaid: orderData?.is_paid ?? true,
        isEdit: isEditMode,
        // Pass info for navigation after close
        navigationTarget: hasChanges ? 'active' : 'history'
      });

      // Background fetch order number
      if (!orderNumber && orderId) {
        supabase
          .from('orders')
          .select('order_number')
          .eq('id', orderId)
          .single()
          .then(({ data: fullOrder }) => {
            if (fullOrder?.order_number) {
              setShowConfirmationModal(prev => prev ? { ...prev, orderNumber: fullOrder.order_number } : null);
            }
          });
      }

      // Process loyalty in background
      if (realPhone) {
        const processLoyalty = async () => {
          const { points: freshPoints } = await getLoyaltyCount(realPhone, currentUser);
          const currentCoffeeCount = cartItems.reduce((sum, item) => item.is_hot_drink ? sum + (item.quantity || 1) : sum, 0);
          const currentRedeemedCount = loyaltyFreeItemsCount;

          if (isEditMode && editingOrderData?.originalItems) {
            const originalCoffeeCount = editingOrderData.originalItems.reduce((sum, item) => item.is_hot_drink ? sum + (item.quantity || 1) : sum, 0);
            const originalRedeemedCount = editingOrderData.originalRedeemedCount || 0;
            const pointsDelta = (currentCoffeeCount - currentRedeemedCount) - (originalCoffeeCount - originalRedeemedCount);
            const redeemedDelta = currentRedeemedCount - originalRedeemedCount;
            return await handleLoyaltyAdjustment(realPhone, orderId, pointsDelta, currentUser, redeemedDelta);
          } else {
            const creditsUsedFromDB = Math.min(loyaltyFreeCoffees, currentRedeemedCount);
            return await addCoffeePurchase(realPhone, orderId, currentCoffeeCount, currentUser, creditsUsedFromDB);
          }
        };

        processLoyalty().then(loyaltyResult => {
          if (loyaltyResult?.success) {
            const newBalance = loyaltyResult?.newCount ?? loyaltyPointsForConfirmation;
            let displayCount = newBalance % 10;
            if (newBalance > 0 && newBalance % 10 === 0) displayCount = 10;
            const earned = (displayCount === 10);

            const updatedCustomerFinal = { ...updatedCustomer, loyalty_coffee_count: newBalance };
            localStorage.setItem('currentCustomer', JSON.stringify(updatedCustomerFinal));
            setCurrentCustomer(updatedCustomerFinal);

            setShowConfirmationModal(prev => prev ? {
              ...prev,
              loyaltyCoffeeCount: newBalance,
              loyaltyRewardEarned: earned
            } : null);
          }
        }).catch(e => console.error('Loyalty background error:', e));
      } else {
        localStorage.setItem('currentCustomer', JSON.stringify(updatedCustomer));
        setCurrentCustomer(updatedCustomer);
      }

      setIsProcessingOrder(false);
    } catch (err) {
      console.error('❌ Error in handlePaymentSelect:', err);
      alert(`שגיאה בעיבוד ההזמנה: ${err.message}`);
      setIsProcessingOrder(false);
    }
  };

  // ... (שאר הקוד נשאר כפי שהוא, כולל ה-return JSX)

  if (menuLoading) {
    return (
      <div className="min-h-screen bg-gray-50 font-heebo" dir="rtl">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-600">טוען תפריט...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 font-heebo" dir="rtl">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-lg font-medium text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchMenuItems}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-bold"
            >
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-heebo" dir="rtl">

      {/* Top Navigation Bar */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">

        {/* Right Side Group (RTL): Home/Back Button + Sync */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 w-10 h-10 rounded-xl transition-all"
            title={sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY) === 'kds' ? "חזרה ל-KDS" : "חזרה לדף הבית"}
          >
            <Icon
              name={sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY) === 'kds' ? "ChevronRight" : "Home"}
              size={20}
            />
          </button>

          {/* Sync Button */}
          <button
            onClick={async (e) => {
              console.log('🔄 Sync button clicked!');
              const btn = e.currentTarget;
              btn.classList.add('animate-spin');
              btn.disabled = true;

              try {
                console.log('📥 Starting sync...');
                const { initialLoad } = await import('../../services/syncService');
                const result = await initialLoad(currentUser?.business_id);
                console.log('✅ Sync result:', result);
                alert('✅ סנכרון הושלם! רענן את הדף.');
              } catch (err) {
                console.error('❌ Sync error:', err);
                alert('❌ שגיאה בסנכרון: ' + err.message);
              } finally {
                btn.classList.remove('animate-spin');
                btn.disabled = false;
              }
            }}
            className="flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-10 h-10 rounded-xl transition-all disabled:opacity-50"
            title="סנכרון נתונים"
          >
            <Icon name="RefreshCw" size={18} />
          </button>
        </div>

        {/* Center: Mini Player & Connection Group */}
        <div className="flex items-center gap-3 bg-slate-50 p-1 px-2 rounded-2xl border border-slate-200">
          <MiniMusicPlayer />
          <ConnectionStatusBar isIntegrated={true} />
        </div>

        {/* Left Side Group (RTL): Logo or Title */}
        <div className="text-xl font-black text-slate-800 tracking-tight">
          iCaffe Kiosk
        </div>
      </div>

      {/* Customer Info Modal */}
      <CustomerInfoModal
        isOpen={showCustomerInfoModal}
        onClose={() => setShowCustomerInfoModal(false)}
        mode={customerInfoModalMode}
        currentCustomer={currentCustomer}
        onCustomerUpdate={(updatedCustomer) => {
          setCurrentCustomer(updatedCustomer);
          localStorage.setItem('currentCustomer', JSON.stringify(updatedCustomer));
          setShowCustomerInfoModal(false);
          refreshLoyalty(); // Refresh loyalty after customer update
        }}
        orderId={isEditMode && editingOrderData?.id ? String(editingOrderData.id).replace(/-ready$/, '').replace(/-stage-\d+$/, '') : null}
      />

      {/* Main Content - Menu (Right) and Cart (Left) */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">

        {/* Menu Panel - First in DOM = Right in RTL */}
        <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
          {/* Category Filter - Fixed at top */}
          <div className="shrink-0 z-20 relative">
            <MenuCategoryFilter
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>

          {/* Menu Grid - Scrollable Area */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${isRestrictedMode ? 'opacity-50 pointer-events-none' : ''}`}>
            <MenuGrid
              items={filteredItems}
              groupedItems={groupedItems}
              onAddToCart={handleAddToCart}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Cart Panel - Second in DOM = Left in RTL */}
        <div className="lg:w-96 lg:border-r border-gray-200 bg-white shadow-sm z-10">
          <div className="sticky top-16 h-[calc(100vh-64px)] flex flex-col">
            <SmartCart
              cartItems={cartItems}
              onRemoveItem={handleRemoveItem}
              onUndoCart={handleUndoCart}
              onEditItem={handleEditCartItem}
              onInitiatePayment={handleInitiatePayment}
              onToggleDelay={handleToggleDelay}
              onAddCustomerDetails={handleAddCustomerDetails}
              orderNumber={isEditMode && editingOrderData?.orderNumber ? editingOrderData.orderNumber : null}
              isEditMode={isEditMode}
              editingOrderData={editingOrderData}
              disabled={isProcessingOrder}
              customerName={currentCustomer?.name}
              customerPhone={currentCustomer?.phone}
              className="h-full flex flex-col"
              loyaltyDiscount={loyaltyDiscount}
              loyaltyPoints={adjustedLoyaltyPoints}
              loyaltyFreeCoffees={loyaltyFreeCoffees}
              finalTotal={finalTotal}
              cartHistory={cartHistory}
              isRestrictedMode={isRestrictedMode}
              soldierDiscountEnabled={soldierDiscountEnabled}
              onToggleSoldierDiscount={handleToggleSoldierDiscount}
              soldierDiscountAmount={soldierDiscountAmount}
            />
          </div>
        </div>

      </div>

      {/* Mobile Cart Summary (visible on smaller screens) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <CheckoutButton
          cartTotal={finalTotal}
          originalTotal={cartTotal}
          loyaltyDiscount={loyaltyDiscount}
          cartItems={cartItems}
          onInitiatePayment={handleInitiatePayment}
          disabled={isProcessingOrder}
          isEditMode={isEditMode}
          editingOrderData={editingOrderData}
        />
      </div>

      {/* Modifier Modal - Used for ALL items now */}
      {selectedItemForMod && (
        <ModifierModal
          isOpen={showModifierModal}
          selectedItem={selectedItemForMod}
          onClose={() => {
            setShowModifierModal(false);
            setSelectedItemForMod(null);
          }}
          onAddItem={handleAddItemWithModifiers}
          // Caching disabled to fix price sync issues
          // optionsCache={modifierOptionsCache}
          // onCacheUpdate={setModifierOptionsCache}
          // Prevent auto-add for food items OR items with allow_notes enabled so user can add notes
          allowAutoAdd={!isFoodItem(selectedItemForMod) && selectedItemForMod?.allow_notes === false}
          // Inject extra options for Salads (CONDITIONAL logic)
          extraGroups={
            selectedItemForMod?.kds_routing_logic === 'CONDITIONAL'
              ? [{
                id: 'kds_routing',
                name: 'אופן הכנה',
                is_required: true,
                is_multiple_select: false,
                values: [
                  { id: 'ready', name: 'קיבל מוכן (מהמדף)', priceAdjustment: 0 },
                  { id: 'prep', name: 'דורש הכנה (הכן עכשיו)', priceAdjustment: 0 }
                ]
              }]
              : []
          }
        />
      )}

      {/* Payment Selection Modal */}
      {(() => {
        const originalTotal = editingOrderData?.originalTotal || 0;
        const priceDifference = finalTotal - originalTotal;
        const isAdditionalCharge = isEditMode && editingOrderData?.isPaid && priceDifference > 0;
        // If it's an additional charge, user pays the difference. Otherwise (new order or refund), total is finalTotal.
        // For refund, amountToPay is irrelevant/zero usually, but let's keep logic clean.
        const amountToPay = isAdditionalCharge ? priceDifference : finalTotal;

        return (
          <PaymentSelectionModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            onPaymentSelect={handlePaymentSelect}
            cartTotal={amountToPay}
            subtotal={cartTotal}
            loyaltyDiscount={loyaltyDiscount}
            soldierDiscountAmount={soldierDiscountAmount}
            cartItems={cartItems}
            isRefund={isEditMode && editingOrderData?.isPaid && priceDifference < 0}
            refundAmount={Math.abs(priceDifference)}
            originalPaymentMethod={editingOrderData?.paymentMethod}
            businessId={currentUser?.business_id}
          />
        );
      })()}

      <OrderConfirmationModal
        isOpen={!!showConfirmationModal}
        orderDetails={showConfirmationModal}
        onStartNewOrder={handleCloseConfirmation}
      />

      {/* Exit Confirmation Modal */}
      {showExitConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
          onClick={() => setShowExitConfirmModal(false)}
          dir="rtl"
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                <Icon name="AlertCircle" size={32} className="text-orange-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900">יציאה ללא שמירה?</h2>
              <p className="text-gray-500 font-medium mt-2">
                ישנם שינויים שלא נשמרו בהזמנה
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-center text-gray-600 font-medium">
                האם לצאת ולבטל את השינויים שבוצעו?
              </p>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl font-bold text-lg hover:bg-gray-300 transition"
              >
                המשך בעבודה
              </button>
              <button
                onClick={() => {
                  clearOrderSessionState();
                  setShowExitConfirmModal(false);

                  const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
                  if (origin === 'kds') {
                    const editDataRaw = sessionStorage.getItem('editOrderData');
                    const editData = editDataRaw ? JSON.parse(editDataRaw) : null;
                    navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
                  } else {
                    navigate('/mode-selection');
                  }
                }}
                className="flex-1 py-4 bg-orange-500 text-white rounded-xl font-bold text-lg hover:bg-orange-600 transition"
              >
                צא ללא שמירה
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Version Number */}
      <div className="fixed bottom-1 left-2 text-[10px] text-gray-400 font-mono z-50 pointer-events-none opacity-50">
        v2.5
      </div>

    </div>
  );
};

export default MenuOrderingInterface;
