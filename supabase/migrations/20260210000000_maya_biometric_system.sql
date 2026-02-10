-- Migration: Maya Biometric Authentication System
-- Date: 2026-02-10
-- Description: Add biometric authentication, face embeddings, and time clock system
-- ============================================
-- 1. Update employees table for biometric data
-- ============================================
-- Change face_embedding from vector(512) to vector(128) for FaceAPI.js compatibility
ALTER TABLE employees
ALTER COLUMN face_embedding TYPE vector(128) USING face_embedding::vector(128);
-- Add pin_hash column if it doesn't exist
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'employees'
        AND column_name = 'pin_hash'
) THEN
ALTER TABLE employees
ADD COLUMN pin_hash text;
END IF;
END $$;
-- Recreate the face embedding index for 128 dimensions
DROP INDEX IF EXISTS employees_face_embedding_idx;
CREATE INDEX employees_face_embedding_idx ON employees USING ivfflat (face_embedding vector_cosine_ops) WITH (lists = '100');
-- ============================================
-- 2. Update time_clock_events table
-- ============================================
-- Add missing columns to time_clock_events
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'time_clock_events'
        AND column_name = 'assigned_role'
) THEN
ALTER TABLE time_clock_events
ADD COLUMN assigned_role text;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'time_clock_events'
        AND column_name = 'location'
) THEN
ALTER TABLE time_clock_events
ADD COLUMN location text;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'time_clock_events'
        AND column_name = 'notes'
) THEN
ALTER TABLE time_clock_events
ADD COLUMN notes text;
END IF;
END $$;
-- ============================================
-- 3. Face Recognition Functions
-- ============================================
-- Function: match_employee_face
-- Matches a face embedding against stored employee faces
CREATE OR REPLACE FUNCTION match_employee_face(
        embedding vector(128),
        match_threshold double precision DEFAULT 0.4,
        match_count integer DEFAULT 1
    ) RETURNS TABLE (
        id uuid,
        name text,
        access_level text,
        is_super_admin boolean,
        business_id uuid,
        similarity double precision
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT e.id,
    e.name,
    e.access_level,
    e.is_super_admin,
    e.business_id,
    1 - (e.face_embedding <=> embedding) as similarity
FROM employees e
WHERE e.face_embedding IS NOT NULL
    AND 1 - (e.face_embedding <=> embedding) > match_threshold
ORDER BY e.face_embedding <=> embedding
LIMIT match_count;
END;
$$;
-- Function: update_employee_face
-- Updates an employee's face embedding
CREATE OR REPLACE FUNCTION update_employee_face(
        p_employee_id uuid,
        p_embedding vector(128)
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
UPDATE employees
SET face_embedding = p_embedding
WHERE id = p_employee_id
RETURNING jsonb_build_object(
        'id',
        id,
        'name',
        name,
        'success',
        true
    ) INTO v_result;
IF v_result IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
END IF;
RETURN v_result;
END;
$$;
-- ============================================
-- 4. PIN Verification Functions
-- ============================================
-- Function: verify_employee_pin
-- Verifies employee PIN for authentication fallback
CREATE OR REPLACE FUNCTION verify_employee_pin(p_pin text, p_business_id uuid) RETURNS TABLE (
        id uuid,
        name text,
        access_level text,
        is_super_admin boolean,
        business_id uuid
    ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT e.id,
    e.name,
    e.access_level,
    e.is_super_admin,
    e.business_id
FROM employees e
WHERE e.pin_code = p_pin
    AND (
        p_business_id IS NULL
        OR e.business_id = p_business_id
    );
END;
$$;
-- ============================================
-- 5. Clock In/Out Functions
-- ============================================
-- Function: clock_in_employee
-- Records employee clock-in event
CREATE OR REPLACE FUNCTION clock_in_employee(
        p_business_id uuid,
        p_employee_id uuid,
        p_location text,
        p_role text
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_new_id uuid;
v_time timestamptz;
BEGIN
INSERT INTO time_clock_events (
        employee_id,
        business_id,
        event_type,
        assigned_role,
        notes,
        location,
        event_time
    )
VALUES (
        p_employee_id,
        p_business_id,
        'clock_in',
        p_role,
        'Role: ' || p_role,
        p_location,
        NOW()
    )
RETURNING id,
    event_time INTO v_new_id,
    v_time;
RETURN jsonb_build_object(
    'id',
    v_new_id,
    'event_time',
    v_time,
    'assigned_role',
    p_role,
    'notes',
    'Role: ' || p_role,
    'location',
    p_location
);
EXCEPTION
WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
-- ============================================
-- 6. Grant Permissions
-- ============================================
-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION match_employee_face(vector, double precision, integer) TO anon,
    authenticated,
    service_role,
    postgres;
GRANT EXECUTE ON FUNCTION update_employee_face(uuid, vector) TO anon,
    authenticated,
    service_role,
    postgres;
GRANT EXECUTE ON FUNCTION verify_employee_pin(text, uuid) TO anon,
    authenticated,
    service_role,
    postgres;
GRANT EXECUTE ON FUNCTION clock_in_employee(uuid, uuid, text, text) TO anon,
    authenticated,
    service_role,
    postgres;
-- ============================================
-- 7. Comments
-- ============================================
COMMENT ON FUNCTION match_employee_face IS 'Matches face embedding against stored employee faces using cosine similarity';
COMMENT ON FUNCTION update_employee_face IS 'Updates employee face embedding for biometric authentication';
COMMENT ON FUNCTION verify_employee_pin IS 'Verifies employee PIN as fallback authentication method';
COMMENT ON FUNCTION clock_in_employee IS 'Records employee clock-in event with role and location';
COMMENT ON COLUMN employees.face_embedding IS 'FaceAPI.js 128-dimensional face descriptor for biometric authentication';
COMMENT ON COLUMN employees.pin_hash IS 'Hashed PIN for fallback authentication';
COMMENT ON COLUMN time_clock_events.assigned_role IS 'Role assigned to employee during this shift';
COMMENT ON COLUMN time_clock_events.location IS 'Physical location where clock event occurred';
COMMENT ON COLUMN time_clock_events.notes IS 'Additional notes about the clock event';