import { OptionGroup } from '@/components/manager/types';
import { supabase } from '@/lib/supabase';
import { db } from '@/db/database';

const DEFAULT_API_BASE_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

const API_BASE_URL = (import.meta.env.VITE_MANAGER_API_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
};

const buildUrl = (path = '') => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path}`;
};

const handleJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json() as Promise<T>;
};

const categorizeGroup = (name?: string | null) => {
  if (!name) return 'general';
  const normalized = name.toLowerCase();
  if (normalized.includes('חלב') || normalized.includes('milk')) return 'milk';
  if (normalized.includes('קצף') || normalized.includes('foam')) return 'texture';
  if (normalized.includes('טמפרטורה') || normalized.includes('temperature')) return 'temperature';
  return 'general';
};

export const normalizeOptionGroups = (rawGroups: any[] = []): OptionGroup[] => {
  return rawGroups
    .filter(Boolean)
    .map((group) => {
      const values = Array.isArray(group?.values) ? group.values : [];
      return {
        id: String(group?.id ?? group?.group_id ?? crypto.randomUUID?.() ?? Date.now()),
        title: group?.title || group?.name || 'אפשרות',
        type: group?.is_multiple_select ? 'multi' : 'single',
        category: group?.category || categorizeGroup(group?.name),
        required: Boolean(group?.is_required ?? group?.required),
        is_required: Boolean(group?.is_required ?? group?.required),
        min_selection: Number(group?.min_selection ?? (Boolean(group?.is_required ?? group?.required) ? 1 : 0)),
        max_selection: Number(group?.max_selection ?? (group?.is_multiple_select ? 99 : 1)),
        description: group?.description ?? null,
        values: values
          .filter(Boolean)
          .map((value: any) => ({
            id: String(value?.id ?? value?.value_id ?? crypto.randomUUID?.() ?? Date.now()),
            name: value?.name || value?.value_name || 'בחירה',
            price: Number(value?.price ?? value?.price_adjustment ?? 0),
            priceAdjustment: Number(value?.price_adjustment ?? value?.price ?? 0),
            is_default: Boolean(value?.is_default),
            description: value?.description ?? null,
            metadata: value?.metadata ?? null,
          })),
      };
    });
};

export const fetchManagerMenuItems = async (command = 'תפריט', businessId?: string) => {
  const payload = {
    command,
    business_id: businessId
  };
  const response = await fetch(buildUrl('/'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const result = await handleJson<any>(response);
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.menuItems)) return result.menuItems;
  return [];
};

export const updateManagerMenuItem = async (id: string | number, updates: Record<string, any>) => {
  const response = await fetch(buildUrl(`/item/${id}`), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(updates),
  });
  const payload = await handleJson<{ updatedItem?: Record<string, any> }>(response);
  return payload?.updatedItem || updates;
};

const optionsCache: Record<string, OptionGroup[]> = {};

export const fetchManagerItemOptions = async (itemId: string | number, businessId?: string): Promise<OptionGroup[]> => {
  const cacheKey = `${businessId}_${itemId}`;
  if (optionsCache[cacheKey]) {
    console.log('⚡ Using Memory Cache for Options:', itemId);
    return optionsCache[cacheKey];
  }

  // Strategy 1: Try Local Dexie DB first (Fastest & Offline)
  try {
    const idStr = String(itemId);

    // 1. Get linked groups via menuitemoptions
    const links = await db.menuitemoptions.where('item_id').equals(idStr).toArray();
    const linkGroupIds = links.map(l => String(l.group_id));

    // 2. Get groups defined specifically for this item (menu_item_id)
    const specificGroups = await db.optiongroups.where('menu_item_id').equals(idStr).toArray();

    // 3. Combine Group IDs & Fetch missing groups
    const specificGroupIds = specificGroups.map(g => String(g.id));
    const allGroupIds = [...new Set([...linkGroupIds, ...specificGroupIds])];

    if (allGroupIds.length > 0) {
      // Fetch the actual group objects for the linked IDs
      // Note: anyOf is case-sensitive and type-sensitive in Dexie usually
      const linkedGroups = await db.optiongroups.where('id').anyOf(linkGroupIds).toArray();

      // Merge results (specificGroups already fetched)
      // Use a Map to deduplicate by ID
      const groupMap = new Map();
      [...linkedGroups, ...specificGroups].forEach(g => groupMap.set(String(g.id), g));
      const allGroups = Array.from(groupMap.values());

      // 4. Fetch values for all groups
      const groupsWithValues = await Promise.all(allGroups.map(async (group) => {
        const values = await db.optionvalues.where('group_id').equals(String(group.id)).toArray();
        return { ...group, values };
      }));

      if (groupsWithValues.length > 0) {
        console.log('💾 Loaded Options from Dexie Local DB:', groupsWithValues.length);
        const normalized = normalizeOptionGroups(groupsWithValues);
        optionsCache[cacheKey] = normalized;
        return normalized;
      }
    }
  } catch (err) {
    console.warn('⚠️ Dexie lookup failed, falling back to network:', err);
  }

  // Strategy 2: Fallback to Supabase Direct (if online)
  try {
    console.log('🌐 Fetching Options from Supabase...');
    const targetItemId = String(itemId);

    // 1. Get linked group IDs
    const { data: links } = await supabase
      .from('menuitemoptions')
      .select('group_id')
      .eq('item_id', targetItemId);

    const linkedIds = links?.map(l => l.group_id) || [];

    // 2. Fetch Groups (Linked + Private)
    // We want groups where id IN linkedIds OR menu_item_id == targetItemId
    let query = supabase
      .from('optiongroups')
      .select('*, values:optionvalues(*)'); // Join values

    if (linkedIds.length > 0) {
      query = query.or(`id.in.(${linkedIds.join(',')}),menu_item_id.eq.${targetItemId}`);
    } else {
      query = query.eq('menu_item_id', targetItemId);
    }

    const { data: rawGroups, error } = await query;

    if (!error && rawGroups) {
      const normalized = normalizeOptionGroups(rawGroups);
      optionsCache[cacheKey] = normalized;
      return normalized;
    }
  } catch (err) {
    console.error('❌ Supabase fetch failed:', err);
  }

  console.warn('⚠️ No options found (Local & Remote)');
  return [];
};

// Clear cache for a specific item or all items
export const clearOptionsCache = (itemId?: string | number) => {
  if (itemId) {
    delete optionsCache[String(itemId)];
  } else {
    Object.keys(optionsCache).forEach(key => delete optionsCache[key]);
  }
};

export const fetchInventoryItems = async (businessId: string) => {
  if (!businessId) throw new Error('businessId is required for inventory fetch');

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('business_id', businessId) // Crucial Multi-tenant filter
    .order('name');

  if (error) throw error;

  // Map DB fields to frontend expected fields if necessary
  return (data || []).map(item => ({
    ...item,
    par_level: item.low_stock_alert, // Map low_stock_alert to par_level
    sku: item.id?.toString() // Use ID as SKU for now since SKU column is missing
  }));
};

export const createManagerOrder = async (orderPayload: Record<string, any>) => {
  // Try to insert into supplier_orders table
  const { data, error } = await supabase
    .from('supplier_orders')
    .insert([orderPayload])
    .select();

  if (error) {
    console.error('Supabase createManagerOrder error:', error);
    // Fallback or re-throw? Let's rethrow so the UI knows.
    throw error;
  }
  return data?.[0];
};

export const updateManagerOrder = async (id: string | number, payload: Record<string, any>) => {
  const { data, error } = await supabase
    .from('supplier_orders')
    .update(payload)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data?.[0];
};

export const MANAGER_API_BASE = API_BASE_URL;

export const updateInventoryStock = async (itemId: string | number, newStock: number) => {
  // 'last_restoc_date' column was not found in schema scan, so we omit it.
  const { data } = await supabase
    .from('inventory_items')
    .update({ current_stock: newStock })
    .eq('id', itemId)
    .select();

  return data?.[0];
};

export const generateImageWithAI = async (prompt: string, style: string) => {
  const response = await fetch(buildUrl('/generate-image'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ prompt, style }),
  });
  return handleJson<{ imageUrl: string }>(response);
};
