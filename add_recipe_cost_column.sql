-- Add cost_per_unit column to recipe_ingredients table
-- This allows storing the cost at the recipe level, avoiding RLS issues on inventory_items

ALTER TABLE public.recipe_ingredients 
ADD COLUMN IF NOT EXISTS cost_per_unit numeric DEFAULT 0;

-- Comment explaining the column
COMMENT ON COLUMN public.recipe_ingredients.cost_per_unit IS 'Cost per unit for this ingredient in this recipe. Stored here to avoid RLS issues with inventory_items table.';
