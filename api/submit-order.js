const { supabase } = require('./_supabase');
const { parseJsonBody } = require('./_utils');

const normalizeItemId = (item = {}) =>
  item?.item_id ??
  item?.menu_item_id ??
  item?.menuItemId ??
  item?.id ??
  item?.menuItemID ??
  null;

const parseModsValue = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return [];
};

const extractMods = (item = {}) => {
  const candidates = [
    item.selected_options,
    item.selectedOptions,
    item.selected_options_ids,
    item.selectedOptionsIds,
    item.mods,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      const parsed = parseModsValue(candidate);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
      if (typeof parsed === 'string' && parsed.trim() !== '') {
        return parsed;
      }
    }
  }

  return [];
};

// פונקציית עזר לבדיקת UUID (כמו בבקאנד)
const isUUID = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

const normalizeItemsForRpc = (items = []) =>
  items.map((item = {}, index) => {
    const rawId = normalizeItemId(item);

    if (!rawId) {
      throw new Error(`Missing item_id for item at index ${index}`);
    }

    // נרמול מודים - תומך בכל הפורמטים
    const modsPayload = extractMods(item);

    return {
      item_id: rawId,  // שלח את ה-ID כמו שהוא (UUID או int)
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      mods: modsPayload,
      item_status: item.item_status || null,
      notes: item.notes || null,
      course_stage: item.course_stage || 1,
    };
  });

const normalizeCancelledItems = (items = []) =>
  items
    .map((item = {}, index) => {
      const itemId = normalizeItemId(item);
      if (!itemId) {
        console.warn(`Skipping cancelled item without id at index ${index}`);
        return null;
      }
      return {
        item_id: itemId,
        quantity: Number(item.quantity) || 1,
      };
    })
    .filter(Boolean);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabase) {
    res.status(500).json({ error: 'Supabase client not configured' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const {
      p_customer_phone,
      p_customer_name,
      p_items,
      p_is_paid,
      p_customer_id,
      p_payment_method,
      p_refund,
      edit_mode,
      order_id,
      original_total,
      is_refund,
      p_cancelled_items,
      is_quick_order,
    } = body || {};

    // --- Demo User Detection ---
    // Check if user is a demo user (by phone number)
    // Demo Admin: 0500000000, Demo Staff: 0501111111
    const isDemoUser = p_customer_phone === '0500000000' || p_customer_phone === '0501111111';

    // Select the correct client/schema
    const client = isDemoUser ? supabase.schema('demo') : supabase;

    console.log('🔍 submit-order: Schema selection:', {
      phone: p_customer_phone,
      isDemoUser,
      schema: isDemoUser ? 'demo' : 'public'
    });

    if (!Array.isArray(p_items) || p_items.length === 0) {
      res.status(400).json({ error: 'Missing order items' });
      return;
    }

    let normalizedItems;
    let normalizedCancelledItems;

    try {
      normalizedItems = normalizeItemsForRpc(p_items);
      normalizedCancelledItems = Array.isArray(p_cancelled_items)
        ? normalizeCancelledItems(p_cancelled_items)
        : [];
    } catch (normalizeError) {
      console.error('Failed to normalize items for submit_order RPC:', normalizeError);
      res.status(400).json({ error: normalizeError.message });
      return;
    }

    const payload = {
      p_customer_phone: p_customer_phone || null,
      p_customer_name: p_customer_name || null,
      p_items: normalizedItems,
      p_is_paid: Boolean(p_is_paid),
      p_customer_id: p_customer_id || null,
      p_payment_method: p_payment_method || null,
      p_refund: Boolean(p_refund),
      edit_mode: Boolean(edit_mode),
      order_id: order_id || null,
      original_total: original_total || null,
      is_refund: Boolean(is_refund),
      p_cancelled_items: normalizedCancelledItems,
      p_final_total: null, // Let DB calculate or pass if needed
      p_original_coffee_count: null, // Let DB calculate
      p_is_quick_order: Boolean(is_quick_order),
    };

    console.log('📤 Calling submit_order_v2 RPC', {
      schema: isDemoUser ? 'demo' : 'public',
      edit_mode: payload.edit_mode,
      order_id: payload.order_id,
      items: normalizedItems.length,
      cancelled: normalizedCancelledItems.length,
    });

    // Use submit_order_v2 for both schemas (assuming it exists in public too)
    const { data, error } = await client.rpc('submit_order_v2', payload);

    if (error) {
      console.error('Supabase RPC submit_order_v2 Error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      res.status(400).json({ error: `שגיאה בעיבוד ההזמנה (SQL): ${error.message}` });
      return;
    }

    console.log('✅ RPC submit_order_v2 success:', JSON.stringify(data, null, 2));

    // Update order status to 'in_progress' for new orders (not edits)
    if (!payload.edit_mode && data?.order_id) {
      const { error: updateError } = await client
        .from('orders')
        .update({ order_status: 'in_progress' })
        .eq('id', data.order_id);

      if (updateError) {
        console.error('Failed to update order status to in_progress:', updateError);
        // Don't fail the request, just log the error
      }
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Unexpected submit-order error:', err);
    res.status(500).json({ error: err.message || 'Failed to process order' });
  }
};

