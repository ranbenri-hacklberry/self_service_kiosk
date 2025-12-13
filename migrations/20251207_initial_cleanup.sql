-- ============================================
-- Migration: Initial Cleanup
-- Date: 2025-12-07
-- Applied to: Production ✅
-- ============================================

-- Add delivery_days to suppliers
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS delivery_days TEXT;

-- Drop unused tables
DROP TABLE IF EXISTS coffee_loyalty CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS kitchentasks CASCADE;
DROP TABLE IF EXISTS supplier_delivery_schedule CASCADE;
