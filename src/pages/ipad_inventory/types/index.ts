export interface InventoryItem {
    id: string;
    name: string;
    unit: string;
    current_stock: number;
    low_stock_alert: number;
    supplier_id: string | null;
    category?: string;
    catalog_item_id?: string | null;
    count_step?: number;
    weight_per_unit?: number;
    cost_per_unit?: number;
    min_order?: number;
    order_step?: number;
    last_counted_at?: string;
    last_counted_by?: string;
    last_counted_by_name?: string;
    location?: string;
}

export interface Supplier {
    id: string;
    name: string;
    delivery_days?: string;
    business_id?: string;
}

export interface IncomingOrder {
    id: string;
    created_at: string;
    supplier_name: string;
    items: any[];
}

export interface ReceivingSessionItem {
    id: string;
    name: string;
    unit: string;
    invoicedQty: number | null;
    orderedQty: number;
    actualQty: number;
    unitPrice: number;
    countStep: number;
    inventoryItemId: string | null;
    catalogItemId: string | null;
    isNew: boolean;
    matchedItem?: InventoryItem;
}

export interface ReceivingSession {
    items: ReceivingSessionItem[];
    orderId?: string | null;
    supplierId?: string | null;
    supplierName?: string;
    hasInvoice: boolean;
    totalInvoiced: number;
}
