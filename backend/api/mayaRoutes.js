/**
 * Maya API Routes
 */
import express from 'express';
import crypto from 'crypto';
import {
    chatWithMaya,
    askMaya,
    askMayaMarketing,
    detectSpecialOrder,
    checkHealth
} from '../services/mayaService.js';
import { createClient } from '@supabase/supabase-js';
import {
    logFaceEnrollment,
    logFaceVerification,
    logPinVerification,
    logClockIn,
    logClockOut,
    logOrderVerified
} from '../services/auditService.js';

const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.LOCAL_SUPABASE_URL || process.env.VITE_LOCAL_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🛡️ Biometric Security Transformation (Permutation + Inversion Mask) derived from master key
// This protects against template inversion attacks while preserving Cosine Similarity.
const SCRAMBLE_KEY = process.env.BIOMETRIC_SCRAMBLE_KEY;

/**
 * Deterministically generates permutation and mask from the master key
 */
function getTransformationConfig(key) {
    if (!key) return { permutation: null, mask: null };

    // Create a seed from the key
    const seed = crypto.createHash('sha256').update(key).digest();

    // Simple LCG-like or hash-based PRNG to get 128 indices and 128 bits
    const permutation = Array.from({ length: 128 }, (_, i) => i);
    const mask = new Array(128);

    // Deterministic Fisher-Yates shuffle
    let currentHash = seed;
    for (let i = 127; i > 0; i--) {
        // Refresh hash every few iterations to keep entropy flowing if needed, 
        // but for 128 elements, one SHA256 is plenty if we sub-slice or re-hash
        currentHash = crypto.createHash('sha256').update(currentHash).digest();
        const j = currentHash.readUInt32BE(0) % (i + 1);
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    // Deterministic Mask (1 or -1)
    currentHash = crypto.createHash('sha256').update(seed).update('mask').digest();
    for (let i = 0; i < 128; i++) {
        if (i % 32 === 0) {
            currentHash = crypto.createHash('sha256').update(currentHash).digest();
        }
        const byteIdx = Math.floor((i % 32) / 8);
        const bitIdx = i % 8;
        const bit = (currentHash[byteIdx] >> bitIdx) & 1;
        mask[i] = bit === 1 ? 1 : -1;
    }

    return { permutation, mask };
}

const { permutation: VECTOR_PERMUTATION, mask: VECTOR_MASK } = getTransformationConfig(SCRAMBLE_KEY);

function secureTransform(embedding) {
    if (!VECTOR_PERMUTATION || !VECTOR_MASK || !embedding || embedding.length !== 128) {
        console.warn('⚠️ Biometric security transformation not applied (missing key or invalid embedding)');
        return embedding;
    }

    // 1. Invert based on secret mask
    const inverted = embedding.map((val, i) => val * VECTOR_MASK[i]);

    // 2. Permute based on secret order
    const secured = new Array(128);
    for (let i = 0; i < 128; i++) {
        secured[i] = inverted[VECTOR_PERMUTATION[i]];
    }
    return secured;
}

// Force reload schema cache on startup (if possible)
// This fixes "Could not find column" errors after migrations
(async () => {
    try {
        await supabase.rpc('run_sql', { query_text: 'NOTIFY pgrst, "reload schema";' });
        console.log('🔄 Triggered PostgREST schema reload');
    } catch (e) {
        // Ignore error
    }
})();

// Health check
router.get('/health', async (req, res) => {
    try {
        const health = await checkHealth();
        res.json(health);
    } catch (err) {
        res.status(500).json({ healthy: false, error: err.message });
    }
});

// Chat with Maya (with history)
router.post('/chat', async (req, res) => {
    try {
        const { messages, businessId, provider, employeeId } = req.body;

        if (!businessId) {
            return res.status(400).json({ error: 'businessId required (נדרש)' });
        }

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages must be an array (חייב להיות מערך)' });
        }

        // 🔒 Fetch employee for access control
        let employee = null;
        if (employeeId) {
            const { data } = await supabase
                .from('employees')
                .select('id, name, access_level, is_super_admin')
                .eq('id', employeeId)
                .single();
            if (data) {
                employee = {
                    id: data.id,
                    name: data.name,
                    accessLevel: data.access_level,
                    isSuperAdmin: data.is_super_admin
                };
            }
        }

        const response = await chatWithMaya(messages, businessId, provider || 'local', employee);
        res.json({ response, provider: provider || 'local', timestamp: new Date().toISOString() });

    } catch (err) {
        console.error('Maya chat error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Quick ask (single question)
router.post('/ask', async (req, res) => {
    try {
        const { prompt, businessId, provider } = req.body;

        if (!businessId || !prompt) {
            return res.status(400).json({ error: 'businessId and prompt required' });
        }

        const response = await askMaya(prompt, businessId, provider || 'local');
        res.json({ response });

    } catch (err) {
        console.error('Maya ask error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Marketing text (no order context - focused on copywriting)
router.post('/marketing', async (req, res) => {
    try {
        const { prompt, businessId } = req.body;

        if (!businessId || !prompt) {
            return res.status(400).json({ error: 'businessId and prompt required' });
        }

        const response = await askMayaMarketing(prompt, businessId);
        res.json({ response });

    } catch (err) {
        console.error('Maya marketing error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Detect special order (called by order webhook)
router.post('/detect-order', async (req, res) => {
    try {
        const { order, businessId } = req.body;

        if (!order || !businessId) {
            return res.status(400).json({ error: 'order and businessId required' });
        }

        const result = await detectSpecialOrder(order, businessId);
        res.json(result);

    } catch (err) {
        console.error('Maya detect error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Face Recognition Routes (Phase 2)
// ============================================

/**
 * POST /api/maya/verify-face
 * Verify employee identity using face embedding
 */
router.post('/verify-face', async (req, res) => {
    try {
        const { embedding, threshold = 0.4, businessId } = req.body;

        // Validate embedding
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
            return res.status(400).json({
                error: 'Invalid embedding. Must be array of 128 float values.'
            });
        }

        // 🛡️ Apply Biometric Security Transformation before processing
        const securedEmbedding = secureTransform(embedding);

        // Convert array to Postgres vector format: "[0.1,0.2,...]"
        const vectorString = `[${securedEmbedding.join(',')}]`;

        // Call Supabase RPC function with explicit parameter types
        const { data, error } = await supabase.rpc('match_employee_face', {
            embedding: vectorString,
            match_threshold: Number(threshold),
            match_count: 5
        });

        if (error) {
            console.error('Face matching error:', error);
            return res.status(500).json({ error: error.message });
        }

        // Filter by business_id if provided
        let matches = data || [];
        if (businessId) {
            matches = matches.filter(m => m.business_id === businessId);
        }

        if (matches.length === 0) {
            // 📝 Audit log: Failed verification
            await logFaceVerification(null, false, 0, req);

            return res.status(404).json({
                matched: false,
                message: 'No matching employee found',
                threshold
            });
        }

        // Return best match
        const bestMatch = matches[0];

        // 📝 Audit log: Successful face verification
        await logFaceVerification(bestMatch.id, true, bestMatch.similarity, req);

        res.json({
            matched: true,
            employee: {
                id: bestMatch.id,
                name: bestMatch.name,
                accessLevel: bestMatch.access_level,
                isSuperAdmin: bestMatch.is_super_admin,
                businessId: bestMatch.business_id
            },
            similarity: bestMatch.similarity,
            confidence: (bestMatch.similarity * 100).toFixed(2) + '%',
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Verify face error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/enroll-face
 * Enroll or update employee face embedding (Securely peppered)
 */
router.post('/enroll-face', async (req, res) => {
    try {
        const { employeeId, embedding, businessId } = req.body;

        if (!employeeId || !embedding || !Array.isArray(embedding) || embedding.length !== 128) {
            return res.status(400).json({ error: 'employeeId and 128-dim embedding required' });
        }

        // 🛡️ Apply Biometric Security Transformation before saving
        const securedEmbedding = secureTransform(embedding);

        // Update employee in database
        const { data, error } = await supabase
            .from('employees')
            .update({ face_embedding: `[${securedEmbedding.join(',')}]` })
            .eq('id', employeeId)
            .select()
            .single();

        if (error) {
            console.error('Face enrollment error:', error);
            return res.status(500).json({ error: error.message });
        }

        // 📝 Audit log: Enrollment
        await logFaceEnrollment(employeeId, req);

        res.json({
            success: true,
            message: `Face enrolled successfully for ${data.name}`,
            employeeId: data.id
        });

    } catch (err) {
        console.error('Enroll face error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/verify-pin
 * Verify employee identity using 4-digit PIN (fallback)
 */
router.post('/verify-pin', async (req, res) => {
    try {
        const { pin, businessId } = req.body;

        if (!pin || pin.length !== 4) {
            return res.status(400).json({
                error: 'Invalid PIN. Must be 4 digits.'
            });
        }

        // Call Supabase RPC function
        const { data, error } = await supabase.rpc('verify_employee_pin', {
            p_pin: pin,
            p_business_id: businessId || null
        });

        if (error) {
            console.error('PIN verification error:', error);
            return res.status(500).json({ error: error.message });
        }

        if (!data || data.length === 0) {
            // 📝 Audit log: Failed PIN
            await logPinVerification(null, false, req);

            return res.status(401).json({
                valid: false,
                message: 'Invalid PIN'
            });
        }

        const employee = data[0];

        // 📝 Audit log: Successful PIN verification
        await logPinVerification(employee.employee_id, true, req);

        res.json({
            valid: true,
            employee: {
                id: employee.employee_id,
                name: employee.name,
                accessLevel: employee.access_level,
                isSuperAdmin: employee.is_super_admin,
                businessId: employee.business_id
            },
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Verify PIN error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/check-clocked-in
 * Check if employee is currently clocked in
 */
router.post('/check-clocked-in', async (req, res) => {
    try {
        const { employeeId } = req.body;

        if (!employeeId) {
            return res.status(400).json({
                error: 'employeeId required'
            });
        }

        // Get today's start time (midnight)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Query latest time clock event for today
        const { data, error } = await supabase
            .from('time_clock_events')
            .select('event_type, assigned_role, event_time')
            .eq('employee_id', employeeId)
            .gte('event_time', todayStart.toISOString())
            .order('event_time', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Clock-in check error:', error);
            return res.status(500).json({ error: error.message });
        }

        const latestEvent = data && data.length > 0 ? data[0] : null;
        const isClockedIn = latestEvent?.event_type === 'clock_in';

        res.json({
            isClockedIn,
            lastEvent: latestEvent,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Check clocked-in error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/enroll-face
 * Enroll/update employee face embedding (admin only)
 */
router.post('/enroll-face', async (req, res) => {
    try {
        const { employeeId, embedding } = req.body;

        if (!employeeId) {
            return res.status(400).json({
                error: 'employeeId required'
            });
        }

        if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
            return res.status(400).json({
                error: 'Invalid embedding. Must be array of 128 float values.'
            });
        }

        // Convert array to Postgres vector format
        const vectorString = `[${embedding.join(',')}]`;

        // Call Supabase RPC to update
        const { data, error } = await supabase.rpc('update_employee_face', {
            p_employee_id: employeeId,
            p_embedding: vectorString
        });

        if (error) {
            console.error('Face enrollment error:', error);
            return res.status(500).json({ error: error.message });
        }

        // 📝 Audit log: Face enrollment
        await logFaceEnrollment(employeeId, req);

        res.json({
            success: data.success,
            message: data.message,
            employeeId: data.employee_id,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Enroll face error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/update-pin
 * Update employee PIN securely (hashes it)
 */
router.post('/update-pin', async (req, res) => {
    try {
        const { employeeId, pinCode } = req.body;

        if (!employeeId || !pinCode) {
            return res.status(400).json({
                error: 'employeeId and pinCode required'
            });
        }

        if (pinCode.length < 4 || pinCode.length > 6) {
            return res.status(400).json({
                error: 'PIN must be 4-6 digits'
            });
        }

        // Call Supabase RPC to update PIN (handles hashing)
        const { data, error } = await supabase.rpc('update_employee_pin', {
            p_employee_id: employeeId,
            p_pin_code: pinCode
        });

        if (error) {
            console.error('Update PIN error:', error);
            // Fallback: If RPC missing, try direct update with plain text (NOT RECOMMENDED for prod but handles dev)
            // Or better, return error so we know to fix DB.
            return res.status(500).json({ error: error.message });
        }

        res.json({
            success: true,
            message: 'PIN updated successfully'
        });

    } catch (err) {
        console.error('Update PIN error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Clock-In/Out Routes (Phase 4)
// ============================================

/**
 * POST /api/maya/clock-in
 * Clock in employee for shift with assigned role
 */
router.post('/clock-in', async (req, res) => {
    try {
        const { employeeId, assignedRole, location, businessId } = req.body;

        if (!employeeId || !assignedRole) {
            return res.status(400).json({
                error: 'employeeId and assignedRole required'
            });
        }

        // Get today's start time (midnight)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Check if already clocked in today
        const { data: existingEvents, error: checkError } = await supabase
            .from('time_clock_events')
            .select('event_type, event_time')
            .eq('employee_id', employeeId)
            .gte('event_time', todayStart.toISOString())
            .order('event_time', { ascending: false })
            .limit(1);

        if (checkError) {
            console.error('Clock-in check error:', checkError);
            return res.status(500).json({ error: checkError.message });
        }

        const latestEvent = existingEvents && existingEvents.length > 0 ? existingEvents[0] : null;

        if (latestEvent?.event_type === 'clock_in') {
            return res.status(400).json({
                error: 'Already clocked in',
                lastClockIn: latestEvent.event_time
            });
        }

        // 🛡️ Resolve Business ID (Required for insert)
        let finalBusinessId = businessId;
        if (!finalBusinessId) {
            const { data: emp, error: empErr } = await supabase
                .from('employees')
                .select('business_id')
                .eq('id', employeeId)
                .single();

            if (!empErr && emp) {
                finalBusinessId = emp.business_id;
            }
        }

        // Create clock-in via RPC, which handles schema complexities and 'notes' column
        let newEvent = null;

        const { data: rpcData, error: rpcError } = await supabase.rpc('clock_in_employee', {
            p_employee_id: employeeId,
            p_business_id: finalBusinessId,
            p_role: assignedRole, // Using p_role (RPC now supports both)
            p_location: location || 'Unknown'
        });

        if (rpcError) {
            console.error('❌ Clock-in RPC failed:', rpcError);
            return res.status(500).json({ error: `Clock-in failed: ${rpcError.message}` });
        }

        if (rpcData && rpcData.error) {
            console.error('❌ Clock-in Logic error:', rpcData.error);
            return res.status(500).json({ error: `Database error: ${rpcData.error}` });
        }

        newEvent = rpcData;

        // 📝 Audit log: Clock-in
        await logClockIn(employeeId, assignedRole, req);

        res.json({
            success: true,
            eventId: newEvent.id,
            eventTime: newEvent.event_time,
            // Fallback to 'notes' or the input 'assignedRole' since DB column might not exist
            assignedRole: newEvent.assigned_role || newEvent.notes || assignedRole,
            location: newEvent.location,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Clock-in error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/clock-out
 * Clock out employee from shift
 */
router.post('/clock-out', async (req, res) => {
    try {
        const { employeeId, location } = req.body;

        if (!employeeId) {
            return res.status(400).json({
                error: 'employeeId required'
            });
        }

        // Get today's start time (midnight)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Check if clocked in
        const { data: existingEvents, error: checkError } = await supabase
            .from('time_clock_events')
            .select('event_type, event_time, assigned_role')
            .eq('employee_id', employeeId)
            .gte('event_time', todayStart.toISOString())
            .order('event_time', { ascending: false })
            .limit(1);

        if (checkError) {
            console.error('Clock-out check error:', checkError);
            return res.status(500).json({ error: checkError.message });
        }

        const latestEvent = existingEvents && existingEvents.length > 0 ? existingEvents[0] : null;

        if (!latestEvent || latestEvent.event_type !== 'clock_in') {
            return res.status(400).json({
                error: 'Not currently clocked in'
            });
        }

        // Create clock-out event
        const { data, error } = await supabase
            .from('time_clock_events')
            .insert({
                employee_id: employeeId,
                event_type: 'clock_out',
                assigned_role: latestEvent.assigned_role, // Keep same role
                location: location || 'Unknown',
                event_time: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Clock-out insert error:', error);
            return res.status(500).json({ error: error.message });
        }

        // Calculate shift duration
        const clockInTime = new Date(latestEvent.event_time);
        const clockOutTime = new Date(data.event_time);
        const durationMinutes = Math.floor((clockOutTime - clockInTime) / 1000 / 60);

        // 📝 Audit log: Clock-out
        await logClockOut(employeeId, req);

        res.json({
            success: true,
            eventId: data.id,
            eventTime: data.event_time,
            clockInTime: latestEvent.event_time,
            durationMinutes,
            assignedRole: data.assigned_role,
            location: data.location,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Clock-out error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/maya/last-role
 * Get employee's last used role for smart recommendation
 */
router.get('/last-role', async (req, res) => {
    try {
        const { employeeId } = req.query;

        if (!employeeId) {
            return res.status(400).json({
                error: 'employeeId required'
            });
        }

        // Get most recent clock-in event
        const { data, error } = await supabase
            .from('time_clock_events')
            .select('assigned_role, event_time')
            .eq('employee_id', employeeId)
            .eq('event_type', 'clock_in')
            .order('event_time', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Last role query error:', error);
            return res.status(500).json({ error: error.message });
        }

        const lastEvent = data && data.length > 0 ? data[0] : null;

        res.json({
            lastRole: lastEvent?.assigned_role || null,
            lastClockIn: lastEvent?.event_time || null,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Last role error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/maya/verify-and-log-order
 * Quick biometric verification for POS orders (Zero-friction accountability)
 *
 * Flow:
 * 1. QuickFaceLog captures 1-2 frames -> embedding
 * 2. This endpoint verifies face -> identifies cashier
 * 3. Saves order with cashier_id + face_match_confidence
 * 4. Audit logs as ORDER_VERIFIED
 */
router.post('/verify-and-log-order', async (req, res) => {
    try {
        const { orderData, embedding, businessId } = req.body;

        if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
            return res.status(400).json({
                error: 'Invalid embedding. Must be array of 128 float values.'
            });
        }

        if (!orderData) {
            return res.status(400).json({
                error: 'orderData required'
            });
        }

        // 1. Verify face embedding (identify cashier)
        const securedEmbedding = secureTransform(embedding);
        const vectorString = `[${securedEmbedding.join(',')}]`;

        const { data: matches, error: matchError } = await supabase.rpc('match_employee_face', {
            embedding: vectorString,
            match_threshold: 0.35,
            match_count: 1
        });

        if (matchError) {
            console.error('Face matching error:', matchError);
            return res.status(500).json({ error: matchError.message });
        }

        // Filter by business_id if provided
        let cashier = null;
        if (matches && matches.length > 0) {
            const bestMatch = businessId
                ? matches.find(m => m.business_id === businessId)
                : matches[0];

            if (bestMatch) {
                cashier = {
                    id: bestMatch.id,
                    name: bestMatch.name,
                    accessLevel: bestMatch.access_level,
                    confidence: bestMatch.similarity
                };
            }
        }

        if (!cashier) {
            return res.status(404).json({
                success: false,
                error: 'No matching cashier found',
                message: 'Face verification failed - please use PIN fallback'
            });
        }

        // 2. Save order with cashier identification
        const orderToSave = {
            ...orderData,
            cashier_id: cashier.id,
            cashier_name: cashier.name,
            face_match_confidence: cashier.confidence,
            biometric_verified: true,
            verified_at: new Date().toISOString(),
            business_id: businessId || orderData.business_id
        };

        const { data: savedOrder, error: orderError } = await supabase
            .from('orders')
            .insert(orderToSave)
            .select()
            .single();

        if (orderError) {
            console.error('Order save error:', orderError);
            return res.status(500).json({ error: orderError.message });
        }

        // 3. Audit log: ORDER_VERIFIED
        await logOrderVerified(savedOrder.id, cashier.id, cashier.confidence, req);

        // 4. Return success with cashier info
        res.json({
            success: true,
            order: savedOrder,
            cashier: {
                id: cashier.id,
                name: cashier.name,
                confidence: cashier.confidence
            },
            message: `Order verified by ${cashier.name}`,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Verify and log order error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
