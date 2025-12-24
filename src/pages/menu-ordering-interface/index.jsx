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
      try {
        const storedEditDataRaw = sessionStorage.getItem('editOrderData');
        if (storedEditDataRaw) {
          const storedEditData = JSON.parse(storedEditDataRaw);
          // Verify ID matches
          if (String(storedEditData.id) === String(targetOrderId)) {
            if (storedEditData.restrictedMode) {
              console.log('🔒 Restricted Edit Mode Active (History)');
              setIsRestrictedMode(true);
            }
          }
        }
      } catch (e) {
        console.error('Error reading editOrderData:', e);
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
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', order.customer_phone)
          .maybeSingle(); // Changed from .single() to avoid PGRST116

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

      // Calculate the original cart total from items (before any loyalty discount)
      const originalCartTotal = loadedCartItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      // Calculate originalRedeemedCount from the discount that was applied
      // If originalCartTotal > order.total_amount, it means there was a loyalty discount
      const loyaltyDiscountApplied = Math.max(0, originalCartTotal - order.total_amount);

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

  const handleCloseConfirmation = () => {
    setShowConfirmationModal(null);
    cartClearCart();
    const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
    const editDataRaw = sessionStorage.getItem('editOrderData');
    const editData = editDataRaw ? JSON.parse(editDataRaw) : null;

    console.log('🔙 handleCloseConfirmation - origin:', origin, 'viewMode:', editData?.viewMode);

    if (origin === 'kds') {
      console.log('✅ Navigating back to KDS');
      sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
      // After a successful update with changes, we return to the Active tab
      // as the order likely needs attention (or simply as requested by the user).
      navigate('/kds', { state: { viewMode: 'active' } });
      return;
    }
    console.log('📞 Navigating to phone input');
    navigate('/customer-phone-input-screen');
  };

  // Handle back button from header
  const handleBack = () => {
    const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
    const editDataRaw = sessionStorage.getItem('editOrderData');
    const editData = editDataRaw ? JSON.parse(editDataRaw) : null;

    if (origin === 'kds') {
      console.log('🔙 Header Back clicked - returning to KDS:', editData?.viewMode);
      // If we clicked back without "saving" (closing confirmation), 
      // we strictly follow the origin viewMode.
      navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
      sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
      return;
    }

    // Default behavior
    navigate(-1);
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

    if (!currentCustomer) {
      setLoyaltyDiscount(0);
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
    }
  }, [cartItems, currentCustomer, loyaltyPoints, loyaltyFreeCoffees, isEditMode, editingOrderData, adjustedLoyaltyPoints]);

  // Calculate finalTotal with useMemo to react to loyaltyDiscount changes
  const finalTotal = useMemo(() => {
    const total = Math.max(0, cartTotal - loyaltyDiscount);
    console.log('💵 Final Total:', { cartTotal, loyaltyDiscount, finalTotal: total });
    return total;
  }, [cartTotal, loyaltyDiscount]);

  // Updated handleInitiatePayment to show payment modal
  const handleInitiatePayment = async () => {
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

      // אם אין שינוי במחיר, בצע עדכון ישיר ללא מודאל תשלום ובלי הודעת אישור
      if (Math.abs(priceDifference) === 0) {
        console.log('✏️ No price change, updating directly (skip confirmation)...');
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
        customerNameForOrder = 'אורח כללי';
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

          return {
            item_id: itemId, // menu_item_id (integer)
            order_item_id: orderItemId, // UUID for existing item, null for new items
            quantity: item.quantity,
            price: item.price || item.unit_price,
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

          return {
            item_id: itemId,
            quantity: item.quantity,
            price: item.price || item.unit_price,
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

      // Build payload matching submit_order_v2 function signature exactly
      const client = supabase;
      const orderPayload = {
        p_customer_phone: guestPhone,
        p_customer_name: customerNameForOrder || 'אורח אנונימי',
        p_items: preparedItems,
        p_is_paid: orderData?.is_paid || false,
        p_customer_id: customerId || null,
        p_payment_method: orderData?.payment_method || null,
        p_refund: isRefund,
        edit_mode: isEditMode || false,
        order_id: isEditMode ? editingOrderData.orderId : null,
        original_total: isEditMode ? editingOrderData.originalTotal : null,
        p_cancelled_items: isEditMode && cancelledItems.length > 0 ? cancelledItems.map(i => ({ id: i.id })) : [],
        p_final_total: (orderData?.total_amount !== undefined) ? orderData.total_amount : finalTotal,
        p_original_coffee_count: originalCoffeeCount,
        p_is_quick_order: !!currentCustomer?.isQuickOrder && !realPhone,
        p_discount_id: orderData?.discount_id || null,
        p_discount_amount: orderData?.discount_amount || 0,
        p_business_id: currentUser?.business_id || null
      };

      console.log('📤 Sending Order Payload:', JSON.stringify(orderPayload, null, 2));
      console.log('💰 p_final_total sent:', orderPayload.p_final_total); // <--- בדיקה קריטית
      console.log('  - Items count:', orderPayload.p_items?.length || 0);
      console.log('  - Cancelled items count:', orderPayload.p_cancelled_items?.length || 0);
      console.log('  - Edit mode:', orderPayload.edit_mode || false);
      console.log('  - Order ID:', orderPayload.order_id || 'N/A');


      console.log('📤 Calling submit_order_v2 with payload');
      console.log('🔍 User Context for RPC:', {
        phone: currentUser?.whatsapp_phone,
        isDemo: currentUser?.whatsapp_phone === '0500000000' || currentUser?.whatsapp_phone === '0501111111'
      });

      // Use static supabase client to prevent schema context issues

      const { data: orderResult, error: orderError } = await supabase.rpc('submit_order_v2', orderPayload);

      if (orderError) {
        console.error('❌ Error creating/updating order:', orderError);
        alert(`שגיאה ביצירת ההזמנה: ${orderError.message || 'שגיאה לא ידועה'}`);
        setIsProcessingOrder(false);
        return;
      }

      const orderId = orderResult?.order_id;
      const orderNumber = orderResult?.order_number;
      console.log('✅ Order created/updated successfully!');
      console.log('  - Order ID:', orderId);
      console.log('  - Order Number:', orderNumber);

      // Don't clear cart yet - wait for confirmation modal to close
      // setCartItems([]);

      let updatedCustomer = {
        ...currentCustomer,
        id: customerId,
        phone: orderData?.customer_phone || currentCustomer?.phone || '',
        name: customerNameForOrder || currentCustomer?.name || null
      };
      // Use the live loyaltyPoints state instead of potentially stale customer data
      let loyaltyPointsForConfirmation = loyaltyPoints ?? 0;

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
        cartClearCart();
        const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
        if (origin === 'kds') {
          sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
          const editDataRaw = sessionStorage.getItem('editOrderData');
          const editData = editDataRaw ? JSON.parse(editDataRaw) : null;
          navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
        }
        return;
      }

      // אם בחרו "תשלום אחר כך" (is_paid = false), דלג על מודאל אישור וחזור ל-KDS
      if (orderData?.is_paid === false) {
        console.log('⏭️ Skipping confirmation modal (pay later selected)');
        cartClearCart();
        const origin = sessionStorage.getItem(ORDER_ORIGIN_STORAGE_KEY);
        if (origin === 'kds') {
          sessionStorage.removeItem(ORDER_ORIGIN_STORAGE_KEY);
          const editDataRaw = sessionStorage.getItem('editOrderData');
          const editData = editDataRaw ? JSON.parse(editDataRaw) : null;
          navigate('/kds', { state: { viewMode: editData?.viewMode || 'active' } });
        } else {
          navigate('/customer-phone-input-screen');
        }
        return;
      }

      // Show confirmation modal immediately (with orderId as fallback for order_number)
      // In edit mode with paid orders, show only the additional charge, not full total
      const isAdditionalCharge = isEditMode && editingOrderData?.isPaid && !isRefund;
      const displayTotal = isAdditionalCharge
        ? (cartTotal - (editingOrderData?.originalTotal || 0))
        : cartTotal;

      setShowConfirmationModal({
        orderId,
        orderNumber: orderNumber || orderId?.slice(0, 8), // Use API response or fallback to short ID
        customerName: customerNameForOrder || 'אורח',
        loyaltyCoffeeCount: loyaltyPointsForConfirmation,
        loyaltyRewardEarned,
        paymentStatus: isAdditionalCharge ? 'תוספת לתשלום' : paymentStatus,
        paymentMethod: orderData?.payment_method,
        total: displayTotal,
        isRefund,
        refundAmount
      });

      // Fetch order_number in background if not provided by API
      if (!orderNumber && orderId) {
        supabase
          .from('orders')
          .select('order_number')
          .eq('id', orderId)
          .single()
          .then(({ data: fullOrder }) => {
            if (fullOrder?.order_number) {
              console.log('🔢 Fetched Order Number in background:', fullOrder.order_number);
              // Update modal with real order number
              setShowConfirmationModal(prev => prev ? { ...prev, orderNumber: fullOrder.order_number } : null);
            }
          })
          .catch(e => console.error('Failed to fetch order number:', e));
      }

      // Process loyalty in background (don't block UI)
      // FIX: Use realPhone (the phone number) instead of customerId (the UUID)
      if (realPhone) {
        console.log('🎁 Processing loyalty for phone:', realPhone);

        const processLoyalty = async () => {
          if (!realPhone) {
            console.log('🚫 No realPhone – skipping loyalty processing');
            return;
          }

          console.log('🎁 ========== processLoyalty START ==========');
          console.log('📞 Phone:', realPhone);
          console.log('🆔 Order ID:', orderId);
          console.log('✏️ Is Edit Mode:', isEditMode);

          // Fetch fresh loyalty state
          const { points: freshPoints, freeCoffees: freshFreeCoffees } = await getLoyaltyCount(realPhone, currentUser);

          console.log('💳 Fresh Loyalty State:', { freshPoints, freshFreeCoffees });

          // Total coffees in cart
          const currentCoffeeCount = cartItems.reduce((sum, item) =>
            item.is_hot_drink ? sum + (item.quantity || 1) : sum, 0);

          // Use the pre-calculated freeItemsCount from the simulation
          // This includes: existing DB credits + newly earned credits (reaching 10)
          const currentRedeemedCount = loyaltyFreeItemsCount;

          console.log('📊 Loyalty Calculation:', {
            currentCoffeeCount,
            loyaltyFreeItemsCount,
            currentRedeemedCount
          });

          // Points are earned on PAID coffees only
          const currentPaidCount = Math.max(0, currentCoffeeCount - currentRedeemedCount);

          if (isEditMode && editingOrderData?.originalItems) {
            // --- EDIT MODE ---
            const originalCoffeeCount = editingOrderData.originalItems.reduce((sum, item) =>
              item.is_hot_drink ? sum + (item.quantity || 1) : sum, 0);
            const originalRedeemedCount = editingOrderData.originalRedeemedCount || 0;
            const originalPaidCount = originalCoffeeCount - originalRedeemedCount;

            const pointsDelta = currentPaidCount - originalPaidCount;
            const redeemedDelta = currentRedeemedCount - originalRedeemedCount;

            console.log('🔥 LOYALTY ADJUSTMENT (Credit System)', {
              currentCoffeeCount,
              currentRedeemedCount,
              currentPaidCount,
              originalCoffeeCount,
              originalRedeemedCount,
              originalPaidCount,
              pointsDelta,
              redeemedDelta
            });

            const result = await handleLoyaltyAdjustment(realPhone, orderId, pointsDelta, currentUser, redeemedDelta);
            console.log('📥 handleLoyaltyAdjustment result:', result);
            return result;
          } else {
            // --- NEW ORDER ---
            console.log('LOYALTY NEW PURCHASE (Credit System)', {
              currentCoffeeCount,
              currentRedeemedCount,
              currentPaidCount,
              itemsToEarnPoints: currentCoffeeCount // ALL coffees count toward loyalty
            });

            // Pass ALL coffees (currentCoffeeCount) to advance points correctly
            // Even the free 10th coffee counts - it's what resets the counter!
            // currentRedeemedCount tells RPC how many credits were from DB (not from reaching 10)
            const creditsUsedFromDB = Math.min(loyaltyFreeCoffees, currentRedeemedCount);
            const result = await addCoffeePurchase(realPhone, orderId, currentCoffeeCount, currentUser, creditsUsedFromDB);
            console.log('📥 addCoffeePurchase result:', result);
            return result;
          }
        };

        processLoyalty().then(loyaltyResult => {
          console.log('🎁 Loyalty Result:', loyaltyResult);

          if (loyaltyResult?.success) {
            // Get the actual new balance from server
            const newBalance = loyaltyResult?.newCount ?? loyaltyPointsForConfirmation;

            // Calculate display count (modulo 10, but show 10 if exactly divisible)
            let displayCount = newBalance % 10;
            if (newBalance > 0 && newBalance % 10 === 0) {
              displayCount = 10;
            }

            // Check if user reached 10 points (free coffee earned)
            loyaltyRewardEarned = (displayCount === 10);

            updatedCustomer = {
              ...updatedCustomer,
              loyalty_coffee_count: newBalance
            };

            // Use newBalance for confirmation modal, not displayCount!
            loyaltyPointsForConfirmation = newBalance;

            localStorage.setItem('currentCustomer', JSON.stringify(updatedCustomer));
            setCurrentCustomer(updatedCustomer);
            // NOTE: Don't call setLoyaltyPoints here - the useLoyalty hook manages this
            // and will refresh on next customer change or order

            console.log('🎁 Loyalty Update:', {
              newBalance,
              displayCount,
              loyaltyRewardEarned,
              loyaltyPointsForConfirmation
            });

            // Update the already open modal with the fresh loyalty data
            setShowConfirmationModal(prev => {
              if (!prev) return null;
              return {
                ...prev,
                loyaltyCoffeeCount: newBalance, // Use full balance, not display count
                loyaltyRewardEarned: loyaltyRewardEarned
              };
            });
          }
        }).catch(err => {
          console.error('Error processing loyalty:', err);
        });
      } else {
        localStorage.setItem('currentCustomer', JSON.stringify(updatedCustomer));
        setCurrentCustomer(updatedCustomer);
      }

      console.log('✅ ========== END handlePaymentSelect (SUCCESS) ==========');

    } catch (err) {
      console.error('❌ ========== ERROR in handlePaymentSelect ==========');
      console.error('  - Error Type:', err?.constructor?.name);
      console.error('  - Error Message:', err?.message);
      console.error('  - Error Stack:', err?.stack);
      console.error('  - Full Error:', err);
      console.error('❌ ========== END ERROR ==========');
      alert(`שגיאה בעיבוד ההזמנה: ${err?.message || 'שגיאה לא ידועה'} `);
    } finally {
      setIsProcessingOrder(false);
      console.log('🏁 handlePaymentSelect finished (finally block)');
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

        {/* Right Side Group (RTL): Back Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-xl transition-all font-bold"
          >
            <Icon name="ArrowRight" size={20} />
            <span>חזור</span>
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
        orderId={null}
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
            cartItems={cartItems}
            isRefund={isEditMode && editingOrderData?.isPaid && priceDifference < 0}
            refundAmount={Math.abs(priceDifference)}
            businessId={currentUser?.business_id}
          />
        );
      })()}

      <OrderConfirmationModal
        isOpen={!!showConfirmationModal}
        orderDetails={showConfirmationModal}
        onStartNewOrder={handleCloseConfirmation}
      />

    </div>
  );
};

export default MenuOrderingInterface;
