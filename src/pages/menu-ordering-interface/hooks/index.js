/**
 * Menu Ordering Interface - Custom Hooks
 * 
 * These hooks were extracted from the main index.jsx to improve:
 * - Code organization and readability
 * - Testability (each hook can be tested independently)
 * - Reusability (hooks can be used in other components)
 * - Performance (hooks can be optimized independently)
 */

export { useCart } from './useCart';
export { useLoyalty } from './useLoyalty';
export { useMenuItems } from './useMenuItems';
export { useDiscounts } from './useDiscounts';
