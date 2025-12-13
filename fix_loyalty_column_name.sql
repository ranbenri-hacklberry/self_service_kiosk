-- Fix Column Name Mismatch in demo.get_loyalty_balance
-- The error "column phone_number does not exist" indicates that the function is trying to use 'phone_number'
-- but the table likely has 'customer_phone' (or vice versa, but based on previous checks it's customer_phone).

-- We will update the function to use 'customer_phone' explicitly.

CREATE OR REPLACE FUNCTION demo.get_loyalty_balance(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $function$
DECLARE
    points integer;
    free_coffees_count integer;
BEGIN
    -- Use customer_phone as confirmed by previous schema inspection
    SELECT points_balance, free_coffees
    INTO points, free_coffees_count
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
END;
$function$;

-- Also verify public function just in case
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    points integer;
    free_coffees_count integer;
BEGIN
    -- Use customer_phone as confirmed by previous schema inspection
    SELECT points_balance, free_coffees
    INTO points, free_coffees_count
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
END;
$function$;
