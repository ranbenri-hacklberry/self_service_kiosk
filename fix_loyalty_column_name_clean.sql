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

CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    points integer;
    free_coffees_count integer;
BEGIN
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
