const { supabase } = require('./_supabase');
const { parseJsonBody } = require('./_utils');
const { URL } = require('url');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!supabase) {
    res.status(500).json({ error: 'Supabase client not configured' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const customerId = url.searchParams.get('customerId');
      if (!customerId) {
        res.status(400).json({ error: 'Missing customerId' });
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .select('loyalty_coffee_count')
        .eq('id', customerId)
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ count: data?.loyalty_coffee_count ?? 0 });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { customerId, orderId } = body || {};

      if (!customerId) {
        res.status(400).json({ error: 'Missing customerId' });
        return;
      }

      // Get current loyalty count
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('loyalty_coffee_count')
        .eq('id', customerId)
        .single();

      if (customerError) {
        res.status(500).json({ error: customerError.message });
        return;
      }

      // Count coffee items in this order
      let coffeeCount = 0;
      if (orderId) {
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('menu_item_id, quantity, menu_items(is_hot_drink, category)')
          .eq('order_id', orderId);

        if (!itemsError && orderItems) {
          orderItems.forEach(item => {
            const menuItem = item.menu_items;
            // Rely ONLY on is_hot_drink flag as configured in DB
            const isEligible = menuItem?.is_hot_drink;
            if (isEligible) {
              coffeeCount += item.quantity || 1;
            }
          });
        }
      }

      // If no items found, default to 1 (backward compatibility)
      if (coffeeCount === 0) {
        coffeeCount = 1;
      }

      const currentCount = customerData?.loyalty_coffee_count ?? 0;

      // Calculate how many free items were earned in this transaction
      const totalAfterPurchase = currentCount + coffeeCount;
      const freeItemsEarned = Math.floor(totalAfterPurchase / 10) - Math.floor(currentCount / 10);

      // Only count PAID coffees (total coffees minus free ones)
      const paidCoffeesCount = coffeeCount - freeItemsEarned;
      const newCount = currentCount + paidCoffeesCount;

      const isFree = freeItemsEarned > 0;

      // Reset count based on TOTAL items processed (current + new), not just paid ones
      // This ensures that when a free item is used (completing the cycle), we wrap around correctly.
      const persistedCount = (currentCount + coffeeCount) % 10;

      const { error: updateError } = await supabase
        .from('customers')
        .update({ loyalty_coffee_count: persistedCount })
        .eq('id', customerId);

      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }

      res.status(200).json({
        success: true,
        newCount: persistedCount,
        isFree,
        displayedCount: persistedCount,
        coffeeCountAdded: paidCoffeesCount,
        freeItemsEarned
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Loyalty endpoint error:', err);
    res.status(500).json({ error: err.message || 'Loyalty endpoint failure' });
  }
};

