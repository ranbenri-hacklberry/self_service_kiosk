-- Update Cold Coffee Drinks to be counted as Hot Drinks for Loyalty
-- This script updates 'is_hot_drink' to TRUE for 'קפה קר' in both public and demo schemas.

-- 1. Update Public Schema
UPDATE public.menu_items
SET is_hot_drink = true
WHERE name = 'קפה קר';

-- 2. Update Demo Schema
UPDATE demo.menu_items
SET is_hot_drink = true
WHERE name = 'קפה קר';

-- Verification Query (optional, for manual check)
-- SELECT name, is_hot_drink FROM public.menu_items WHERE name = 'קפה קר';
