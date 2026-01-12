import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Runs a complete End-to-End Health Check on the Ordering System
 * 1. Creates an Order via RPC
 * 2. Verifies Server State
 * 3. Updates Status
 * 4. Checks Sync Consistency & Loyalty
 * 5. Cleans up
 * @param {string} businessId 
 */
export const runSystemDiagnostics = async (businessId) => {
    const logs = [];
    const log = (msg) => logs.push({ time: new Date().toISOString(), msg });

    // Config for Test
    const TEST_PHONE = '0548888888';
    const TEST_NAME = 'DIAGNOSTIC TEST';

    try {
        log('🚀 Starting System Diagnostics...');

        // 0. Fetch a valid menu item
        const { data: menuItems, error: menuError } = await supabase
            .from('menu_items')
            .select('id, price, name')
            .eq('business_id', businessId)
            .limit(1);

        if (menuError || !menuItems || menuItems.length === 0) {
            log('❌ DIAGNOSTICS FAILED: Could not fetch a valid menu item for testing.');
            return { success: false, logs };
        }
        const testItem = menuItems[0];
        log(`🔹 Using Test Item: ${testItem.name} (ID: ${testItem.id})`);

        // 0b. Check Initial Loyalty Points
        log(`🔹 Checking initial points for ${TEST_PHONE}...`);
        const { data: initialPoints, error: pointsError } = await supabase.rpc('get_diagnostic_customer_points', {
            p_phone: TEST_PHONE,
            p_business_id: businessId
        });

        if (pointsError) {
            log(`⚠️ Loyalty Check Failed: ${pointsError.message}. Proceeding without loyalty check.`);
        } else {
            log(`💰 Initial Points: ${initialPoints}`);
        }

        // 1. Create Order (RPC)
        log('1️⃣ Creating Test Order (RPC: submit_order_v3)...');

        const { data: orderResult, error: createError } = await supabase.rpc('submit_order_v3', {
            p_business_id: businessId,
            p_final_total: testItem.price,
            p_order_type: 'dine_in',
            p_payment_method: 'cash',
            p_customer_name: TEST_NAME,
            p_customer_phone: TEST_PHONE,
            p_items: [
                {
                    item_id: testItem.id,
                    name: testItem.name,
                    price: testItem.price,
                    quantity: 1,
                    kds_routing_logic: 'MADE_TO_ORDER',
                    item_status: 'in_progress',
                    is_hot_drink: 'true' // Force loyalty point accrual (String format for safety)
                }
            ]
        });

        if (createError) {
            log(`❌ DIAGNOSTICS FAILED: Create Failed: ${createError.message}`);
            return { success: false, logs };
        }

        const orderId = orderResult.order_id;
        const orderNumber = orderResult.order_number;
        log(`✅ Order Created! ID: ${orderId}, Number: ${orderNumber}`);

        // 2. Verify Server State
        log('2️⃣ Verifying Server Persistence...');

        const { data: fetchOrder, error: fetchError } = await supabase.rpc('get_diagnostic_order', {
            p_order_id: orderId
        });

        if (fetchError || !fetchOrder) {
            log('❌ PERSISTENCE FAILURE: Order not found after creation.');
            return { success: false, logs };
        }

        if (fetchOrder.order_status !== 'in_progress') {
            log(`⚠️ STATUS MISMATCH: Expected 'in_progress', got '${fetchOrder.order_status}'`);
        } else {
            log('✅ Status Verification Passed: in_progress');
        }

        // 2b. Verify Loyalty Update
        if (!pointsError) {
            log('🔹 Verifying Loyalty Points Update...');
            const { data: finalPoints } = await supabase.rpc('get_diagnostic_customer_points', {
                p_phone: TEST_PHONE,
                p_business_id: businessId
            });

            // Expected increase: 1 point (quantity 1 * is_hot_drink true)
            if (finalPoints > initialPoints) {
                log(`✅ Loyalty Verified: Points increased from ${initialPoints} to ${finalPoints}`);
            } else {
                log(`⚠️ LOYALTY WARNING: Points did not increase. (Started: ${initialPoints}, Ended: ${finalPoints})`);
            }
        }

        // 2c. Direct Loyalty RPC Test (Debug Step)
        if (!pointsError) {
            log('🔹 Debug: Testing handle_loyalty_purchase directly (+1 point)...');
            const { data: loyaltyResult, error: loyaltyError } = await supabase.rpc('handle_loyalty_purchase', {
                p_phone: TEST_PHONE,
                p_items_count: 1,
                p_is_refund: false,
                p_business_id: businessId
            });

            if (loyaltyError) {
                log(`❌ Direct Loyalty RPC Failed: ${loyaltyError.message}`);
            } else {
                log(`✅ Direct Loyalty RPC Result: ${JSON.stringify(loyaltyResult)}`);
                // Check if it worked
                const { data: newPoints } = await supabase.rpc('get_diagnostic_customer_points', {
                    p_phone: TEST_PHONE,
                    p_business_id: businessId
                });
                log(`💰 Points after Direct Test: ${newPoints} (Should be +1 vs previous)`);
            }
        }

        // 3. Update Status
        log('3️⃣ Testing Update RPC (in_progress -> ready)...');
        const { error: updateError } = await supabase.rpc('update_order_status_v3', {
            p_order_id: orderId,
            p_new_status: 'ready', // CORRECTED PARAMETER NAME
            p_business_id: businessId
        });

        if (updateError) {
            log(`❌ UPDATE FAILED: ${updateError.message}`);
            return { success: false, logs };
        }

        // Verify Update
        const { data: updatedOrder, error: verifyError } = await supabase.rpc('get_diagnostic_order', {
            p_order_id: orderId
        });

        if (verifyError || !updatedOrder) {
            log('❌ VERIFY FAILED: Could not fetch order after update.');
            return { success: false, logs };
        }

        const allItemsReady = updatedOrder.order_items && updatedOrder.order_items.every(i => i.item_status === 'ready');

        if (updatedOrder.order_status === 'ready' && allItemsReady) {
            log('✅ Update Verified: Order and Items are READY.');
        } else {
            log(`❌ INCONSISTENCY DETECTED: Order is ${updatedOrder.order_status}, Items are ${JSON.stringify(updatedOrder.order_items ? updatedOrder.order_items.map(i => i.item_status) : 'Missing')}`);
        }

        // 4. Cleanup
        log('4️⃣ Cleaning up Test Data...');
        await supabase.from('orders').delete().eq('id', orderId); // Cascade deletes items
        log('✅ Cleanup Complete.');

        return { success: true, logs };

    } catch (err) {
        log(`🔥 CRITICAL ERROR: ${err.message}`);
        return { success: false, logs };
    }
};

/**
 * Simulates nightly traffic to populate history
 */
export const simulateNightlyTraffic = async (businessId, count = 10) => {
    const logs = [];
    const log = (msg) => logs.push(msg); // Simplified logging for UI loop

    try {
        // Fetch Menu Items
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('id, name, price')
            .eq('business_id', businessId);

        if (!menuItems?.length) {
            log('❌ No menu items found. Cannot simulate.');
            return { logs };
        }

        log(`🎰 Simulating ${count} orders using ${menuItems.length} menu items...`);

        for (let i = 0; i < count; i++) {
            // Build Random Order
            const numItems = Math.floor(Math.random() * 4) + 1;
            const orderItems = [];
            let total = 0;

            for (let j = 0; j < numItems; j++) {
                const item = menuItems[Math.floor(Math.random() * menuItems.length)];
                orderItems.push({
                    item_id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                    kds_routing_logic: 'MADE_TO_ORDER',
                    notes: Math.random() > 0.8 ? 'Extra spicy' : ''
                });
                total += item.price;
            }

            // Create Order
            const { data: orderResult, error: createError } = await supabase.rpc('submit_order_v3', {
                p_business_id: businessId,
                p_final_total: total,
                p_order_type: Math.random() > 0.7 ? 'take_away' : 'dine_in',
                p_payment_method: 'credit',
                p_is_paid: true,
                p_customer_name: `Sim Customer ${i + 1}`,
                p_customer_phone: `05000000${i}`,
                p_items: orderItems
            });

            if (createError) {
                log(`❌ Order ${i + 1} Failed: ${createError.message}`);
                continue;
            }

            log(`✅ Order ${i + 1}/${count} Created (ID: ${orderResult.order_number})`);

            // Randomly advance status
            setTimeout(async () => {
                await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderResult.order_id,
                    p_new_status: 'ready', // CORRECTED HERE TOO
                    p_business_id: businessId
                });
            }, 500);

            setTimeout(async () => {
                await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderResult.order_id,
                    p_new_status: 'completed', // CORRECTED HERE TOO
                    p_business_id: businessId
                });
            }, 1000);
        }

        log('🎉 Simulation Batch Sent!');
        return { success: true, logs };

    } catch (err) {
        log(`🔥 Sim Error: ${err.message}`);
        return { success: false, logs };
    }
};
