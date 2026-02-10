/**
 * Audit Logging Service
 * Provides audit trail for SDK operations with rollback capability
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.LOCAL_SUPABASE_URL || process.env.VITE_LOCAL_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Default iCaffe Core app ID (will be fetched on first use)
let ICAFFE_CORE_APP_ID = null;

/**
 * Initialize - fetch the iCaffe Core app ID
 */
async function initialize() {
    if (ICAFFE_CORE_APP_ID) return ICAFFE_CORE_APP_ID;

    try {
        const { data, error } = await supabase
            .from('sdk_apps')
            .select('id')
            .eq('app_name', 'iCaffe Core')
            .single();

        if (error) throw error;
        ICAFFE_CORE_APP_ID = data.id;
        return ICAFFE_CORE_APP_ID;
    } catch (err) {
        console.error('Failed to fetch iCaffe Core app ID:', err);
        return null;
    }
}

/**
 * Log an SDK action
 * @param {Object} options
 * @param {string} options.employeeId - Employee who performed the action
 * @param {string} options.actionType - Type of action (FACE_ENROLL, FACE_VERIFY, etc.)
 * @param {string} options.tableName - Table affected (optional)
 * @param {Object} options.oldData - Data before change (optional)
 * @param {Object} options.newData - Data after change (optional)
 * @param {string} options.correlationId - Session/transaction ID (optional)
 * @param {string} options.ipAddress - Client IP (optional)
 * @param {string} options.userAgent - Client user agent (optional)
 * @returns {Promise<string>} Log ID
 */
export async function logAction({
    employeeId,
    actionType,
    tableName = null,
    oldData = null,
    newData = null,
    correlationId = null,
    ipAddress = null,
    userAgent = null
}) {
    try {
        // Ensure app ID is initialized
        const appId = await initialize();
        if (!appId) {
            console.warn('⚠️ Audit logging unavailable - app ID not found');
            return null;
        }

        const { data, error } = await supabase.rpc('log_sdk_action', {
            p_app_id: appId,
            p_employee_id: employeeId,
            p_action_type: actionType,
            p_table_name: tableName,
            p_old_data: oldData,
            p_new_data: newData,
            p_correlation_id: correlationId,
            p_ip_address: ipAddress,
            p_user_agent: userAgent
        });

        if (error) throw error;

        console.log(`📝 Audit log created: ${actionType} by ${employeeId}`);
        return data;

    } catch (err) {
        console.error('❌ Audit logging failed:', err);
        // Don't throw - audit failures shouldn't break operations
        return null;
    }
}

/**
 * Log face enrollment
 */
export async function logFaceEnrollment(employeeId, req) {
    return logAction({
        employeeId,
        actionType: 'FACE_ENROLL',
        tableName: 'employees',
        newData: {
            employee_id: employeeId,
            timestamp: new Date().toISOString()
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    });
}

/**
 * Log face verification attempt
 */
export async function logFaceVerification(employeeId, matched, similarity, req) {
    return logAction({
        employeeId: employeeId || 'unknown',
        actionType: 'FACE_VERIFY',
        newData: {
            matched,
            similarity,
            timestamp: new Date().toISOString()
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    });
}

/**
 * Log PIN verification attempt
 */
export async function logPinVerification(employeeId, valid, req) {
    return logAction({
        employeeId: employeeId || 'unknown',
        actionType: 'PIN_VERIFY',
        newData: {
            valid,
            timestamp: new Date().toISOString()
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    });
}

/**
 * Log clock-in event
 */
export async function logClockIn(employeeId, role, req) {
    return logAction({
        employeeId,
        actionType: 'CLOCK_IN',
        tableName: 'time_clock_events',
        newData: {
            employee_id: employeeId,
            role,
            timestamp: new Date().toISOString()
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    });
}

/**
 * Log clock-out event
 */
export async function logClockOut(employeeId, req) {
    return logAction({
        employeeId,
        actionType: 'CLOCK_OUT',
        tableName: 'time_clock_events',
        newData: {
            employee_id: employeeId,
            timestamp: new Date().toISOString()
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    });
}

/**
 * Log order verification with biometric
 */
export async function logOrderVerified(orderId, employeeId, confidence, req) {
    return logAction({
        employeeId,
        actionType: 'ORDER_VERIFIED',
        tableName: 'orders',
        recordId: orderId,
        newData: {
            order_id: orderId,
            cashier_id: employeeId,
            face_match_confidence: confidence,
            verified_at: new Date().toISOString()
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    });
}

/**
 * Rollback an SDK operation by correlation ID
 * ⚠️ Use with caution - this reverses database changes
 */
export async function rollbackOperation(correlationId) {
    try {
        const { data, error } = await supabase.rpc('rollback_sdk_operation', {
            p_correlation_id: correlationId
        });

        if (error) throw error;

        console.log(`🔄 Rollback completed: ${JSON.stringify(data)}`);
        return data;

    } catch (err) {
        console.error('❌ Rollback failed:', err);
        throw err;
    }
}

/**
 * Get audit logs for an employee
 */
export async function getEmployeeLogs(employeeId, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('sdk_audit_logs')
            .select('*')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;

    } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        throw err;
    }
}

export default {
    logAction,
    logFaceEnrollment,
    logFaceVerification,
    logPinVerification,
    logClockIn,
    logClockOut,
    rollbackOperation,
    getEmployeeLogs
};
