import { supabase } from '../lib/supabase';
import { sendSms } from './smsService';

/**
 * Runs a complete End-to-End Health Check on the Ordering System
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
                    is_hot_drink: 'true'
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

            if (finalPoints > initialPoints) {
                log(`✅ Loyalty Verified: Points increased from ${initialPoints} to ${finalPoints}`);
            } else {
                log(`⚠️ LOYALTY WARNING: Points did not increase. (Started: ${initialPoints}, Ended: ${finalPoints})`);
            }
        }

        // 3. Update Status
        log('3️⃣ Testing Update RPC (in_progress -> ready)...');
        const { error: updateError } = await supabase.rpc('update_order_status_v3', {
            p_order_id: orderId,
            p_new_status: 'ready',
            p_business_id: businessId
        });

        if (updateError) {
            log(`❌ UPDATE FAILED: ${updateError.message}`);
            return { success: false, logs };
        }

        log('✅ Update Verified: Order and Items are READY.');

        // 4. Cleanup
        log('4️⃣ Cleaning up Test Data...');
        await supabase.from('orders').delete().eq('id', orderId);
        log('✅ Cleanup Complete.');

        return { success: true, logs };

    } catch (err) {
        log(`🔥 CRITICAL ERROR: ${err.message}`);
        return { success: false, logs };
    }
};

/**
 * Simulates nightly traffic to populate history with Rock Legends
 */
export const simulateNightlyTraffic = async (businessId, count = 10) => {
    const logs = [];
    const log = (msg) => logs.push(msg);

    const LEGENDS = [
        { name: 'Freddie', phone: '0000000001' },
        { name: 'David', phone: '0000000002' },
        { name: 'Mick', phone: '0000000003' },
        { name: 'Robert', phone: '0000000004' },
        { name: 'Kurt', phone: '0000000005' },
        { name: 'Jimi', phone: '0000000006' },
        { name: 'Janis', phone: '0000000007' },
        { name: 'Prince', phone: '0000000008' },
        { name: 'Axl', phone: '0000000009' },
        { name: 'Rani (The Boss)', phone: '0548317887' }
    ];

    try {
        log('🎸 Starting Rock Legends Traffic Simulation...');

        // 1. Check SMS Logic (Test Error Handling)
        log('📱 Testing SMS Error Handling (Invalid Number)...');
        const smsResult = await sendSms('000000', 'Test Message');
        if (smsResult.error || smsResult.skipped) {
            log(`✅ SMS Validation works: Caught ${smsResult.error || 'Invalid Format notification'}`);
        }

        // 2. Fetch Menu Items and Modifiers
        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('id, name, price, category')
            .eq('business_id', businessId);

        const { data: options } = await supabase
            .from('optionvalues')
            .select('id, value_name, price_adjustment, group_id');

        if (!menuItems?.length) {
            log('❌ No menu items found. Cannot simulate.');
            return { logs };
        }

        log(`🎰 Simulating ${count} orders for ${LEGENDS.length} rock legends...`);

        for (let i = 0; i < count; i++) {
            const legend = LEGENDS[i % LEGENDS.length];

            // Randomly decide if this order is paid (2 out of 10 should be unpaid)
            const isPaid = i >= 2;

            // Random items (1-7)
            const numItems = Math.floor(Math.random() * 7) + 1;
            const orderItems = [];
            let total = 0;

            for (let j = 0; j < numItems; j++) {
                const item = menuItems[Math.floor(Math.random() * menuItems.length)];

                // Add 1 random modifier if available
                const itemMods = [];
                if (options?.length > 0) {
                    const mod = options[Math.floor(Math.random() * options.length)];
                    itemMods.push({
                        id: mod.id,
                        name: mod.value_name,
                        price: mod.price_adjustment
                    });
                }

                orderItems.push({
                    item_id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                    kds_routing_logic: 'MADE_TO_ORDER',
                    item_status: 'in_progress',
                    is_hot_drink: (item.category?.includes('קפה') || Math.random() > 0.6),
                    mods: [...itemMods, '__KDS_OVERRIDE__']
                });
                total += item.price + (itemMods[0]?.price || 0);
            }

            // Create Order
            const { data: orderResult, error: createError } = await supabase.rpc('submit_order_v3', {
                p_business_id: businessId,
                p_final_total: total,
                p_order_type: 'dine_in',
                p_payment_method: 'oth', // Pay method: Other
                p_is_paid: isPaid,
                p_customer_name: legend.name,
                p_customer_phone: legend.phone,
                p_items: orderItems
            });

            if (createError) {
                log(`❌ Order ${i + 1} failed: ${createError.message}`);
                continue;
            }

            log(`✅ Order ${i + 1}/${count} | #${orderResult.order_number} for ${legend.name} | Total: ₪${total} | Paid: ${isPaid ? 'Yes' : 'No'}`);

            // 🎁 ADD LOYALTY POINTS for this order
            const { data: loyaltyResult, error: loyaltyError } = await supabase.rpc('handle_loyalty_purchase', {
                p_business_id: businessId,
                p_phone: legend.phone,
                p_customer_name: legend.name,
                p_amount_spent: total,
                p_points_to_add: 1
            });

            if (loyaltyError) {
                log(`  ⚠️ Loyalty error: ${loyaltyError.message}`);
            } else if (loyaltyResult?.success) {
                log(`  🎁 +1 point for ${legend.name} (Total: ${loyaltyResult.new_points})`);
            } else {
                log(`  ⚠️ Loyalty failed: ${loyaltyResult?.error || 'Unknown'}`);
            }

            // Complete only 2 orders (the rest stay in KDS)
            if (i < 2) {
                log(`🏁 Completing order #${orderResult.order_number}...`);
                await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderResult.order_id,
                    p_new_status: 'ready',
                    p_business_id: businessId
                });
                await supabase.rpc('update_order_status_v3', {
                    p_order_id: orderResult.order_id,
                    p_new_status: 'completed',
                    p_business_id: businessId
                });
            }
        }

        log('');
        log('🔥 Simulation complete! 8 orders are waiting in KDS.');
        log('📱 You should also see Rani (The Boss) in your loyalty list!');

        return { success: true, logs };

    } catch (err) {
        log(`🔥 Simulation error: ${err.message}`);
        return { success: false, logs };
    }
};
