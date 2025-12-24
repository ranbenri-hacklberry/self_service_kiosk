# Database Update: confirm_order_payment Function

## Required Action
Run the following SQL in the **Supabase SQL Editor** to enable payment method selection when confirming payments from the KDS.

## SQL Script

```sql
-- Drop existing function if it exists (to handle parameter changes)
DROP FUNCTION IF EXISTS public.confirm_order_payment(uuid);
DROP FUNCTION IF EXISTS public.confirm_order_payment(uuid, text);

-- Create updated function with payment_method support
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
    p_order_id uuid,
    p_payment_method text DEFAULT 'cash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_order_exists boolean;
BEGIN
    -- Check if order exists
    SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
    
    IF NOT v_order_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found'
        );
    END IF;

    -- Update the order to mark as paid with payment method
    UPDATE orders
    SET 
        is_paid = true,
        payment_method = p_payment_method,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payment_method', p_payment_method
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.confirm_order_payment IS 'Confirms payment for an order, setting is_paid=true and recording the payment method. Bypasses RLS for KDS use.';
```

## What This Does

1. **Adds payment_method parameter** - Allows specifying how the customer paid (cash, credit_card, gift_card, oth)
2. **Updates the order** - Sets `is_paid = true` and records the `payment_method`
3. **Bypasses RLS** - Uses SECURITY DEFINER to work from the KDS without authentication issues

## After Running

The KDS will be able to:
- Show payment method selection (מזומן/אשראי/שובר/ע״ח הבית)
- Record the payment method when marking orders as paid
- Display the correct payment method in order history
