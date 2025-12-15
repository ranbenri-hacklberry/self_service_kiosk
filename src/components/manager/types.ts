export interface OptionValue {
  id: string;
  name: string;
  price?: number | null;
  priceAdjustment?: number | null;
  is_default?: boolean;
  description?: string | null;
  metadata?: Record<string, any> | null;
  displayOrder?: number | null;
}

export interface OptionGroup {
  id: string;
  title: string;
  type?: 'single' | 'multi' | string;
  category?: string;
  required?: boolean;
  description?: string | null;
  metadata?: Record<string, any> | null;
  values: OptionValue[];
}

export interface SelectedOption {
  groupId: string;
  groupName: string;
  valueId: string;
  valueName: string;
  priceAdjustment: number;
}

export interface MenuItem {
  id: string | number;
  name: string;
  price: number;
  category?: string;
  image_url?: string;
  [key: string]: any;
}

export interface OrderItem extends MenuItem {
  tempId: string;
  quantity: number;
  selectedOptions: SelectedOption[];
  totalPrice: number;
}

// Explicit type exports for JSX files
export type { OptionGroup, OrderItem, SelectedOption, OptionValue, MenuItem };
