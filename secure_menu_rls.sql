-- SECURE RLS FOR MENU & INVENTORY
-- This script ensures strict isolation for secondary tables used in Menu Management

-- 1. Inventory Items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventory isolation" ON public.inventory_items;

CREATE POLICY "Inventory isolation" ON public.inventory_items
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
);


-- 2. Option Groups (Modifiers)
ALTER TABLE public.optiongroups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OptionGroups isolation" ON public.optiongroups;

CREATE POLICY "OptionGroups isolation" ON public.optiongroups
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
);

-- 3. Option Values (Choices inside groups)
ALTER TABLE public.optionvalues ENABLE ROW LEVEL SECURITY;
-- Note: OptionValues usually link to OptionGroups, but might have business_id too.
-- If they assume parent group security, fine. But strict RLS is better if business_id exists.
-- Assuming optionvalues has business_id:

DROP POLICY IF EXISTS "OptionValues isolation" ON public.optionvalues;

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optionvalues' AND column_name = 'business_id') THEN
        EXECUTE '
            CREATE POLICY "OptionValues isolation" ON public.optionvalues
            FOR ALL
            TO authenticated
            USING (
                business_id IN (
                    SELECT business_id FROM public.employees 
                    WHERE auth_user_id = auth.uid()
                )
            )
            WITH CHECK (
                business_id IN (
                    SELECT business_id FROM public.employees 
                    WHERE auth_user_id = auth.uid()
                )
            );
        ';
    END IF; 
END $$;


-- 4. Recipes & Ingredients
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipes isolation" ON public.recipes;

CREATE POLICY "Recipes isolation" ON public.recipes
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
);

-- 5. Helper: Ensure Authenticated User Can See Their OWN Employee Record
-- (Critical for the sub-queries above to work!)
DROP POLICY IF EXISTS "Read own employee record" ON public.employees;

CREATE POLICY "Read own employee record" ON public.employees
FOR SELECT
TO authenticated
USING (
    auth_user_id = auth.uid()
);
