import { OptionGroup } from '@/components/manager/types';
import { supabase } from '@/lib/supabase';

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
        description: group?.description ?? null,
        values: values
          .filter(Boolean)
          .map((value) => ({
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

export const fetchManagerMenuItems = async (command = 'תפריט') => {
  const payload = { command };
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

export const fetchManagerItemOptions = async (itemId: string | number): Promise<OptionGroup[]> => {
  const cacheKey = String(itemId);
  if (optionsCache[cacheKey]) {
    return optionsCache[cacheKey];
  }

  const response = await fetch(buildUrl(`/item/${itemId}/options`));
  const rawGroups = await handleJson<any[]>(response);
  const normalized = normalizeOptionGroups(rawGroups);

  optionsCache[cacheKey] = normalized;
  return normalized;
};

// Clear options cache (useful after editing)
export const clearOptionsCache = (itemId?: string | number) => {
  if (itemId) {
    delete optionsCache[String(itemId)];
  } else {
    Object.keys(optionsCache).forEach(key => delete optionsCache[key]);
  }
};

export const fetchInventoryItems = async () => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
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
  const { data, error } = await supabase
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
