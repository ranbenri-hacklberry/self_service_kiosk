-- RPC: Handle Employee Login
-- Validates phone (whatsapp_phone) and PIN (pin_code)
CREATE OR REPLACE FUNCTION public.handle_employee_login(
    p_phone TEXT,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_employee RECORD;
BEGIN
    -- Find employee by whatsapp_phone (case insensitive just in case)
    SELECT * INTO v_employee
    FROM public.employees
    WHERE whatsapp_phone = p_phone;

    IF v_employee IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Employee not found');
    END IF;

    -- Validate PIN
    IF v_employee.pin_code != p_pin THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid PIN');
    END IF;

    -- Return success with employee details
    RETURN jsonb_build_object(
        'success', true,
        'employee', jsonb_build_object(
            'id', v_employee.id,
            'name', v_employee.name,
            'role', v_employee.access_level, -- Mapping access_level to role
            'is_admin', v_employee.is_admin
        )
    );
END;
$$;

-- RPC: Handle Clock Event
-- Inserts a new event into time_clock_events
CREATE OR REPLACE FUNCTION public.handle_clock_event(
    p_employee_id UUID,
    p_event_type TEXT -- 'clock_in' or 'clock_out'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_event RECORD;
BEGIN
    -- Check the last event for this employee to prevent double clock-in/out
    SELECT * INTO v_last_event
    FROM public.time_clock_events
    WHERE employee_id = p_employee_id
    ORDER BY event_time DESC
    LIMIT 1;

    -- Logic check: Can't clock in if already in, can't clock out if already out
    IF p_event_type = 'clock_in' AND v_last_event.event_type = 'clock_in' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already clocked in');
    END IF;

    IF p_event_type = 'clock_out' AND (v_last_event IS NULL OR v_last_event.event_type = 'clock_out') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not clocked in');
    END IF;

    -- Insert new event
    INSERT INTO public.time_clock_events (employee_id, event_type, event_time)
    VALUES (p_employee_id, p_event_type, NOW());

    RETURN jsonb_build_object('success', true, 'status', p_event_type);
END;
$$;

-- RPC: Get Employee Shift Status
-- Returns current status based on last event
CREATE OR REPLACE FUNCTION public.get_employee_shift_status(
    p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_event RECORD;
BEGIN
    SELECT * INTO v_last_event
    FROM public.time_clock_events
    WHERE employee_id = p_employee_id
    ORDER BY event_time DESC
    LIMIT 1;

    IF v_last_event IS NULL OR v_last_event.event_type = 'clock_out' THEN
        RETURN jsonb_build_object('is_clocked_in', false);
    ELSE
        RETURN jsonb_build_object(
            'is_clocked_in', true,
            'clock_in_time', v_last_event.event_time
        );
    END IF;
END;
$$;

-- Update Demo Data
-- Ensure we have at least one admin and one staff with known credentials
-- Using ON CONFLICT to avoid errors if they exist, but updating fields to ensure they work
INSERT INTO public.employees (name, whatsapp_phone, pin_code, access_level, is_admin, created_at)
VALUES 
    ('Demo Admin', '0500000000', '1234', 'admin', true, NOW()),
    ('Demo Staff', '0501111111', '0000', 'staff', false, NOW())
ON CONFLICT (whatsapp_phone) 
DO UPDATE SET 
    pin_code = EXCLUDED.pin_code,
    access_level = EXCLUDED.access_level,
    is_admin = EXCLUDED.is_admin;
