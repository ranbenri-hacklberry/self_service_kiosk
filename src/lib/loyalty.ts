import { getSupabase } from './supabase';

/**
 * Get loyalty balance for a customer
 * @param {string | null} customerPhone 
 * @param {object} user - Current logged in user (for schema context)
 * @returns {Promise<{points: number, freeCoffees: number}>}
 */
export async function getLoyaltyCount(customerPhone, user) {
  if (!customerPhone) return { points: 0, freeCoffees: 0 };

  const cleanPhone = customerPhone.replace(/\D/g, '');
  const businessId = user?.business_id;

  if (!businessId) {
    console.warn('⚠️ [Loyalty] Missing businessId in context');
    return { points: 0, freeCoffees: 0 };
  }

  try {
    const client = getSupabase(user);

    console.log(`🔍 [Loyalty] Fetching EXACT for: ${cleanPhone} in biz: ${businessId}`);

    // Call our NEW, non-conflicting RPC
    const { data, error } = await client.rpc('get_exact_loyalty_balance', {
      p_phone: cleanPhone,
      p_business_id: businessId
    });

    if (error) {
      console.warn(`⚠️ [Loyalty] RPC failed, falling back:`, error.message);

      const { data: directData, error: directError } = await client
        .from('loyalty_cards')
        .select('points_balance, free_coffees')
        .eq('customer_phone', cleanPhone)
        .eq('business_id', businessId)
        .maybeSingle();

      if (directError) throw directError;

      return {
        points: directData?.points_balance ?? 0,
        freeCoffees: directData?.free_coffees ?? 0
      };
    }

    // RPC returns TABLE, so data is an array
    const result = (Array.isArray(data) && data.length > 0) ? data[0] : (data || {});

    console.log(`✅ [Loyalty] Result for ${cleanPhone}:`, result);

    return {
      points: result.points ?? 0,
      freeCoffees: result.free_coffees ?? 0
    };
  } catch (error) {
    console.error('❌ [Loyalty] Failed to fetch count:', error);
    return { points: 0, freeCoffees: 0 };
  }
}

/**
 * Add points for a purchase
 * @param {string | null} customerPhone 
 * @param {string} orderId 
 * @param {number} itemsCount 
 * @param {object} user - Current logged in user (for schema context)
 * @param {number} redeemedCount - Number of free coffees redeemed
 * @returns {Promise<{success: boolean, newCount: number, addedPoints: number}>}
 */
export async function addCoffeePurchase(customerPhone, orderId, itemsCount = 1, user, redeemedCount = 0) {
  if (!customerPhone) {
    return { success: false, newCount: 0, addedPoints: 0 };
  }

  try {
    const client = getSupabase(user);
    const { data, error } = await client.rpc('handle_loyalty_purchase', {
      p_phone: customerPhone,
      p_order_id: orderId,
      p_items_count: itemsCount,
      p_redeemed_count: redeemedCount
    });

    if (error) throw error;

    return {
      success: data.success,
      newCount: data.new_balance,
      addedPoints: data.added_points
    };
  } catch (error) {
    console.error('Failed to update loyalty:', error);
    return { success: false, newCount: 0, addedPoints: 0 };
  }
}

/**
 * Handle loyalty adjustment for edit mode
 * @param {string} customerPhone 
 * @param {string} orderId 
 * @param {number} pointsDelta 
 * @param {object} user 
 * @param {number} redeemedDelta 
 * @returns {Promise<{success: boolean, newCount: number, addedPoints: number}>}
 */
export async function handleLoyaltyAdjustment(customerPhone, orderId, pointsDelta, user, redeemedDelta = 0) {
  if (!customerPhone) {
    return { success: false, newCount: 0, addedPoints: 0 };
  }

  try {
    const client = getSupabase(user);
    const { data, error } = await client.rpc('handle_loyalty_adjustment', {
      phone_number: customerPhone,
      order_id: orderId,
      points_delta: pointsDelta,
      current_user_id: null, // We don't have user ID in frontend context
      redeemed_delta: redeemedDelta
    });

    if (error) throw error;

    return {
      success: data?.success ?? false,
      newCount: data?.newPoints ?? 0,
      newFreeCoffees: data?.newFreeCoffees ?? 0
    };
  } catch (error) {
    console.error('Failed to adjust loyalty:', error);
    return { success: false, newCount: 0, addedPoints: 0 };
  }
}

/**
 * Get the number of coffees redeemed in a specific order
 * @param {string} orderId 
 * @param {object} user 
 * @returns {Promise<number>}
 */
export async function getLoyaltyRedemptionForOrder(orderId, user) {
  if (!orderId) return 0;

  try {
    const client = getSupabase(user);
    const { data, error } = await client
      .from('loyalty_transactions')
      .select('change_amount')
      .eq('order_id', orderId)
      .eq('transaction_type', 'redemption');

    if (error) throw error;

    // Sum up all redemptions (they are negative numbers, so we take abs)
    const totalPointsRedeemed = data.reduce((sum, tx) => sum + Math.abs(tx.change_amount), 0);
    return Math.floor(totalPointsRedeemed / 10);
  } catch (error) {
    console.error('Failed to fetch loyalty redemption:', error);
    return 0;
  }
}
