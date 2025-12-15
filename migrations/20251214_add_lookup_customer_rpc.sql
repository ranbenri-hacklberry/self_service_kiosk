-- ADD CUSTOMER LOOKUP RPC
-- Replaces external Cloud Function for identifying customers.

CREATE OR REPLACE FUNCTION lookup_customer(
    p_phone TEXT,
    p_business_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer RECORD;
    v_business_id UUID := p_business_id;
    v_user_id UUID := auth.uid();
BEGIN
    -- 1. If business_id not provided, try to find it via Auth User
    IF v_business_id IS NULL AND v_user_id IS NOT NULL THEN
        SELECT business_id INTO v_business_id
        FROM employees
        WHERE auth_user_id = v_user_id
        LIMIT 1;
    END IF;

    -- 2. Find customer
    SELECT * INTO v_customer
    FROM customers
    WHERE phone_number = p_phone
    -- Ideally filter by business_id if we have it, to prevent cross-tenant leaks.
    -- If p_business_id IS provided, use it.
    AND (v_business_id IS NULL OR business_id = v_business_id)
    LIMIT 1;

    IF v_customer IS NOT NULL THEN
        RETURN json_build_object(
            'success', true,
            'isNewCustomer', false,
            'customer', row_to_json(v_customer),
            'message', 'נמצא לקוח קיים'
        );
    ELSE
        RETURN json_build_object(
            'success', true,
            'isNewCustomer', true,
            'message', 'לקוח חדש'
        );
    END IF;
END;
$$;
