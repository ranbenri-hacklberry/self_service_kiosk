-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    pin_code TEXT NOT NULL, -- Storing plain text for pilot simplicity as requested
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create time_logs table
CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id),
    clock_in TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clock_out TIMESTAMP WITH TIME ZONE,
    shift_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_phone ON public.employees(phone);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee_date ON public.time_logs(employee_id, shift_date);

-- RPC: Handle Employee Auth
CREATE OR REPLACE FUNCTION public.handle_employee_auth(
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
    SELECT * INTO v_employee
    FROM public.employees
    WHERE phone = p_phone AND is_active = true;

    IF v_employee IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Employee not found');
    END IF;

    IF v_employee.pin_code != p_pin THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid PIN');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'employee', jsonb_build_object(
            'id', v_employee.id,
            'name', v_employee.name,
            'role', v_employee.role
        )
    );
END;
$$;

-- RPC: Handle Clock In/Out
CREATE OR REPLACE FUNCTION public.handle_clock_in_out(
    p_employee_id UUID,
    p_action TEXT -- 'in' or 'out'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_log RECORD;
BEGIN
    -- Check for open shift
    SELECT * INTO v_last_log
    FROM public.time_logs
    WHERE employee_id = p_employee_id AND clock_out IS NULL
    ORDER BY clock_in DESC
    LIMIT 1;

    IF p_action = 'in' THEN
        IF v_last_log IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Already clocked in');
        END IF;

        INSERT INTO public.time_logs (employee_id, clock_in, shift_date)
        VALUES (p_employee_id, NOW(), CURRENT_DATE);

        RETURN jsonb_build_object('success', true, 'status', 'clocked_in');
    
    ELSIF p_action = 'out' THEN
        IF v_last_log IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'Not clocked in');
        END IF;

        UPDATE public.time_logs
        SET clock_out = NOW()
        WHERE id = v_last_log.id;

        RETURN jsonb_build_object('success', true, 'status', 'clocked_out');
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Invalid action');
END;
$$;

-- Insert Demo Data (if not exists)
INSERT INTO public.employees (name, phone, pin_code, role)
VALUES 
    ('Admin User', '0500000000', '1234', 'admin'),
    ('Staff Member', '0501111111', '0000', 'staff')
ON CONFLICT (phone) DO NOTHING;
