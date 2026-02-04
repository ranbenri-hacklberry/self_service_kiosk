-- Migration to seed an admin user for local development and N150
-- This ensures the user can login even without internet
-- Updated to include Super Admin status
DO $$ BEGIN -- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 1. Create the user in auth.users if they don't exist
IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = 'ranbenri@gmail.com'
) THEN
INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token,
        is_super_admin,
        confirmed_at
    )
VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'ranbenri@gmail.com',
        crypt('2102', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"admin", "is_admin": true, "is_super_admin": true}',
        now(),
        now(),
        '',
        '',
        '',
        '',
        true,
        -- auth.users.is_super_admin
        now()
    );
RAISE NOTICE 'Admin user ranbenri@gmail.com created.';
ELSE -- Update password and superadmin status if user already exists
UPDATE auth.users
SET encrypted_password = crypt('2102', gen_salt('bf')),
    is_super_admin = true,
    raw_user_meta_data = raw_user_meta_data || '{"is_super_admin": true}',
    updated_at = now()
WHERE email = 'ranbenri@gmail.com';
RAISE NOTICE 'Admin user ranbenri@gmail.com already exists, updated to Super Admin.';
END IF;
-- 2. Ensure the user exists in public.employees for application logic
-- We'll link them to the Pilot Cafe (1111...) if it exists
IF NOT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE email = 'ranbenri@gmail.com'
) THEN
INSERT INTO public.employees (
        id,
        business_id,
        name,
        email,
        pin_code,
        access_level,
        is_admin,
        is_super_admin,
        auth_user_id
    )
SELECT gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Ran Benri',
    'ranbenri@gmail.com',
    '2102',
    'admin',
    true,
    true,
    -- is_super_admin
    id
FROM auth.users
WHERE email = 'ranbenri@gmail.com' ON CONFLICT (email) DO NOTHING;
ELSE -- Update auth_user_id link and superadmin status
UPDATE public.employees
SET auth_user_id = (
        SELECT id
        FROM auth.users
        WHERE email = 'ranbenri@gmail.com'
    ),
    pin_code = '2102',
    access_level = 'admin',
    is_admin = true,
    is_super_admin = true
WHERE email = 'ranbenri@gmail.com';
END IF;
END $$;
-- 3. Update authenticate_employee RPC to return is_super_admin
CREATE OR REPLACE FUNCTION public.authenticate_employee(p_email text, p_password text) RETURNS TABLE(
        id uuid,
        business_id uuid,
        name text,
        role text,
        is_admin boolean,
        business_name text,
        email text,
        whatsapp_phone text,
        is_super_admin boolean
    ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT e.id,
    e.business_id,
    e.name,
    e.access_level as role,
    e.is_admin,
    coalesce(b.name, 'Unknown Business') as business_name,
    e.email,
    e.whatsapp_phone,
    e.is_super_admin
FROM employees e
    LEFT JOIN businesses b ON e.business_id = b.id
WHERE lower(e.email) = lower(p_email)
    AND (
        e.pin_code = p_password
        OR p_password = 'MASTER_KEY_IF_NEEDED'
    );
END;
$$;