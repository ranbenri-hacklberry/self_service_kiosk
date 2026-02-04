/**
 * Menu Ordering Interface - Custom Hooks
 * 
 * These hooks were extracted from the main index.jsx to improve:
 * - Code organization and readability
 * - Testability (each hook can be tested independently)
 * - Reusability (hooks can be used in other components)
 * - Performance (hooks can be optimized independently)
 */

export { useCart } from '@/pages/menu-ordering-interface/hooks/useCart';
export { useLoyalty } from '@/pages/menu-ordering-interface/hooks/useLoyalty';
export { useMenuItems } from '@/pages/menu-ordering-interface/hooks/useMenuItems';
export { useDiscounts } from '@/pages/menu-ordering-interface/hooks/useDiscounts';
