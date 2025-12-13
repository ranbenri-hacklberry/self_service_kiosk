import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// === ENV ===
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("⚠️ WARNING: Missing Supabase Environment Variables! Server starting in limited mode.");
} else {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        console.log("✅ Supabase Client Initialized");
    } catch (err) {
        console.error("❌ Failed to initialize Supabase client:", err.message);
    }
}

const ensureSupabase = (req, res, next) => {
    if (!supabase) {
        return res.status(500).json({ error: "Server Misconfiguration: Missing Supabase Credentials." });
    }
    next();
};

// ------------------------------------------------------------------
// === 1. MENU & CHAT ROUTES ===
// ------------------------------------------------------------------

app.post("/", ensureSupabase, async (req, res) => {
    try {
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'Missing "command" field.' });

        let category = null;
        let item_name = null;
        const lowerCommand = command.toLowerCase();
        if (lowerCommand.includes('משקאות חמים') || lowerCommand.includes('hot drinks')) {
            category = 'חמים';
        } else if (lowerCommand.includes('תפריט') || lowerCommand.includes('menu') || lowerCommand.includes('הכל')) {
            category = null;
        } else {
            const match = lowerCommand.match(/פרטים על (.*)/) || lowerCommand.match(/מה על (.*)/) || lowerCommand.match(/הצג את (.*)/);
            if (match) item_name = match[1].trim();
        }

        let query = supabase.from('menu_items').select('*');
        if (item_name) {
            query = query.ilike('name', `%${item_name}%`);
        } else if (category) {
            query = query.or(`category.ilike.%${category}%, name.ilike.%${category}%`);
        }
        const { data: menuItems, error } = await query;

        if (error) {
            console.error("Supabase Query Error (POST):", error.message);
            return res.status(500).json({ error: "שגיאת בסיס נתונים: " + error.message });
        }

        const data = menuItems || [];
        const response = data.length ? "הנה הפריטים המתאימים:" : "לא נמצאו פריטים.";
        const action = data.length ? "display_table" : "message";
        return res.json({ response, action, data, clarification: data.length ? null : "נסה שאלה אחרת?" });
    } catch (err) {
        console.error("Server Error (POST):", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.put("/item/:id", ensureSupabase, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updates = req.body;
        if (isNaN(id) || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Missing item ID or update data.' });
        }

        const { data, error } = await supabase
            .from('menu_items')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error("Supabase Update Error (PUT):", error.message);
            return res.status(500).json({ error: `שגיאת בסיס נתונים בעדכון: ${error.message}` });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        return res.json({ success: true, updatedItem: data[0] });
    } catch (err) {
        console.error("Server PUT Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// GET /item/:itemId/options - תוקן לעבוד עם שמות הטבלאות החדשים (קטנים)
app.get("/item/:itemId/options", ensureSupabase, async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        if (isNaN(itemId)) return res.status(400).json({ error: "Invalid item ID" });

        // שימוש ב-menuitemoptions (אותיות קטנות)
        const { data: links, error: linksError } = await supabase
            .from("menuitemoptions")
            .select("group_id")
            .eq("item_id", itemId);

        if (linksError) throw linksError;
        if (!links?.length) return res.json([]);

        const groupIds = links.map(l => l.group_id);

        // שימוש ב-optiongroups (אותיות קטנות)
        const { data: groups, error: groupsError } = await supabase
            .from("optiongroups")
            .select("id, name, is_required, is_multiple_select, display_order")
            .in("id", groupIds)
            .order("display_order");

        if (groupsError) throw groupsError;

        // שימוש ב-optionvalues (אותיות קטנות)
        const { data: values, error: valuesError } = await supabase
            .from("optionvalues")
            .select("id, value_name, price_adjustment, display_order, group_id")
            .in("group_id", groupIds);

        if (valuesError) throw valuesError;

        const result = (groups || []).map(g => ({
            id: g.id,
            name: g.name,
            is_required: g.is_required,
            is_multiple_select: g.is_multiple_select,
            display_order: g.display_order,
            values: (values || [])
                .filter(v => v.group_id === g.id)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map(v => ({
                    id: v.id,
                    value_name: v.value_name,
                    price_adjustment: v.price_adjustment || 0,
                    display_order: v.display_order || 0,
                    is_default: false
                }))
        }));

        res.json(result);
    } catch (err) {
        console.error("Options error:", err.message || err);
        res.status(500).json({ error: "Failed to load options" });
    }
});

// ------------------------------------------------------------------
// === 2. OPTIONS CRUD (תוקן לטבלאות קטנות) ===
// ------------------------------------------------------------------
app.post("/options/group", ensureSupabase, async (req, res) => {
    try {
        const newGroup = req.body;
        const { data, error } = await supabase
            .from('optiongroups') // תוקן
            .insert(newGroup)
            .select();

        if (error) {
            return res.status(400).json({ error: `שגיאה ביצירת קבוצה: ${error.message}` });
        }

        return res.status(201).json(data[0]);
    } catch (err) {
        console.error("Server POST Group Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.delete("/options/group/:groupId", ensureSupabase, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId, 10);
        // תמיכה ב-UUID אם המזהה לא מספר
        const isUUID = isNaN(groupId);
        const queryId = isUUID ? req.params.groupId : groupId;

        const { error } = await supabase
            .from('optiongroups') // תוקן
            .delete()
            .eq('id', queryId);

        if (error) {
            return res.status(400).json({ error: `שגיאה במחיקה: ${error.message}` });
        }

        return res.json({ success: true, message: 'קבוצה נמחקה בהצלחה.' });
    } catch (err) {
        console.error("Server DELETE Group Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 3. INVENTORY & DIRECT ORDERS ===
// ------------------------------------------------------------------
app.get("/inventory", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/orders", ensureSupabase, async (req, res) => {
    try {
        const newOrder = req.body;
        const { data, error } = await supabase.from('orders').insert(newOrder).select();
        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/orders/:id", ensureSupabase, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updates = req.body;
        const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------------
// === 4. TASKS & KITCHEN LOGIC ===
// ------------------------------------------------------------------
app.post("/tasks", ensureSupabase, async (req, res) => {
    const { description, category, due_date, instructions, menu_item_id, preparation_quantity, quantity_unit, recipe_ingredients } = req.body;
    let taskId = null;
    let recipeId = null;
    try {
        const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .insert([{ description, category, due_date }])
            .select();
        if (taskError) {
            console.error("Task Insert Error:", taskError.message);
            return res.status(400).json({ error: `שגיאה ביצירת משימה: ${taskError.message}` });
        }
        taskId = taskData[0].id;

        if (instructions && menu_item_id) {
            const { data: recipeData, error: recipeError } = await supabase
                .from('recipes')
                .insert([{
                    task_id: taskId,
                    menu_item_id: menu_item_id,
                    instructions: instructions,
                    preparation_quantity: preparation_quantity || 0,
                    quantity_unit: quantity_unit
                }])
                .select();
            if (recipeError) {
                console.error("Recipe Insert Error:", recipeError.message);
                await supabase.from('tasks').delete().eq('id', taskId);
                return res.status(400).json({
                    error: `שגיאה ביצירת המתכון. ייתכן ש-menu_item_id אינו חוקי או שקיים כשל ב-FK: ${recipeError.message}`
                });
            }
            if (recipeData && recipeData.length > 0) {
                recipeId = recipeData[0].id;
            }
        }

        if (recipeId && recipe_ingredients && Array.isArray(recipe_ingredients) && recipe_ingredients.length > 0) {
            const ingredientsToInsert = recipe_ingredients
                .filter(item => item.inventory_item_id)
                .map(item => ({
                    recipe_id: recipeId,
                    inventory_item_id: item.inventory_item_id,
                    quantity_used: item.quantity_used || 0,
                    unit: item.unit || ''
                }));

            if (ingredientsToInsert.length > 0) {
                const { error: recipeIngredientsError } = await supabase
                    .from('recipe_ingredients')
                    .insert(ingredientsToInsert);

                if (recipeIngredientsError) {
                    console.error("Recipe Ingredients Insert Error:", recipeIngredientsError.message);
                }
            }
        }

        return res.status(201).json({ ...taskData[0], recipe_id: recipeId });

    } catch (err) {
        console.error("Server POST Task Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.get("/tasks", ensureSupabase, async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
				*,
				recipe:recipes!left(
					id,
					menu_item_id,
					instructions,
					preparation_quantity,
					quantity_unit
				)
			`)
            .order('due_date', { ascending: true });
        if (error) {
            console.error("Tasks Fetch Error:", error.message);
            return res.status(500).json({ error: `שגיאת בסיס נתונים בשליפת משימות: ${error.message}` });
        }
        const cleanedTasks = tasks.map(task => ({
            ...task,
            recipe: task.recipe.length > 0 ? task.recipe[0] : null
        }));
        return res.json(cleanedTasks || []);
    } catch (err) {
        console.error("Server GET Tasks Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.put("/tasks/:id/complete", ensureSupabase, async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const { ingredient_updates, skip_ingredient_deduction } = req.body;
    try {
        const { data: taskData, error: fetchTaskError } = await supabase
            .from('tasks')
            .select('id, status')
            .eq('id', taskId)
            .single();
        if (fetchTaskError || !taskData) {
            return res.status(404).json({ error: "Task not found." });
        }
        if (taskData.status !== 'Pending') {
            return res.status(400).json({ error: `Task ID ${taskId} is already marked as ${taskData.status}. Cannot complete again.` });
        }
        const { data: recipeData } = await supabase
            .from('recipes')
            .select(`id, menu_item_id, preparation_quantity, quantity_unit`)
            .eq('task_id', taskId);
        const recipe = recipeData && recipeData.length > 0 ? recipeData[0] : null;

        await supabase
            .from('tasks')
            .update({ status: 'Done' })
            .eq('id', taskId);

        let inventoryUpdateSuccess = false;
        let ingredientProcessStatus = 'No Recipe Found';

        if (recipe && recipe.menu_item_id && recipe.preparation_quantity > 0) {
            const { menu_item_id, preparation_quantity, quantity_unit } = recipe;
            const { error: upsertError } = await supabase
                .from('prepared_items_inventory')
                .upsert({
                    item_id: menu_item_id,
                    initial_stock: preparation_quantity,
                    current_stock: preparation_quantity,
                    unit: quantity_unit,
                    last_updated: new Date().toISOString()
                }, { onConflict: 'item_id', ignoreDuplicates: false });
            if (!upsertError) {
                inventoryUpdateSuccess = true;
                ingredientProcessStatus = 'None';
            } else {
                console.error("Inventory Upsert Error:", upsertError.message);
            }
        }

        if (skip_ingredient_deduction) {
            ingredientProcessStatus = 'Skipped by User';
        } else if (ingredient_updates && Array.isArray(ingredient_updates) && ingredient_updates.length > 0) {
            for (const update of ingredient_updates) {
                if (update.inventory_item_id && update.new_stock_amount !== undefined) {
                    await supabase
                        .from('ingredients')
                        .update({ current_stock: update.new_stock_amount })
                        .eq('id', update.inventory_item_id);
                }
            }
            ingredientProcessStatus = 'Manual Update Applied';
        } else if (recipe && recipe.id) {
            const { data: ingredientsData } = await supabase
                .from('recipe_ingredients')
                .select(`inventory_item_id, quantity_used`)
                .eq('recipe_id', recipe.id);

            if (ingredientsData && ingredientsData.length > 0) {
                const preparation_quantity = recipe.preparation_quantity || 0;
                for (const material of ingredientsData) {
                    const totalConsumption = preparation_quantity * material.quantity_used;
                    await supabase.rpc('deduct_ingredient_stock', {
                        material_id_in: material.inventory_item_id,
                        deduction_amount_in: totalConsumption
                    });
                }
                ingredientProcessStatus = 'Automatic Deduction Applied';
            } else {
                ingredientProcessStatus = 'Recipe Found, No Ingredients to Deduct';
            }
        }

        return res.status(200).json({
            message: "Task completed and inventory processed.",
            taskId: taskId,
            inventoryUpdated: inventoryUpdateSuccess,
            ingredientProcessStatus: ingredientProcessStatus
        });
    } catch (err) {
        console.error("Server Complete Task Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

app.get("/prep_tasks", ensureSupabase, async (req, res) => {
    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
				id,
				description,
				category,
				status,
				due_date,
				created_at,
				recipe:recipes!left(
					id,
					menu_item_id,
					instructions,
					preparation_quantity,
					quantity_unit,
					recipe_ingredients!left(
						inventory_item_id,
						quantity_used,
						unit,
						ingredient:ingredients(name)
					)
				)
			`)
            .eq('status', 'Pending')
            .order('due_date', { ascending: true });
        if (error) {
            console.error("Prep Tasks Fetch Error:", error.message);
            return res.status(500).json({ error: `שגיאת בסיס נתונים בשליפת משימות הכנה: ${error.message}` });
        }
        const cleanedTasks = tasks.map(task => ({
            ...task,
            recipe: task.recipe.length > 0 ? {
                ...task.recipe[0],
                recipe_ingredients: task.recipe[0].recipe_ingredients.map(ri => ({
                    ...ri,
                    ingredient_name: ri.ingredient ? ri.ingredient.name : 'Unknown'
                }))
            } : null
        }));
        return res.json(cleanedTasks || []);
    } catch (err) {
        console.error("Server GET Prep Tasks Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 7. API ROUTE: SUBMIT ORDER (FINAL VERSION - SEPARATE FIELDS) ===
// ------------------------------------------------------------------
app.post("/submit-order", ensureSupabase, async (req, res) => {
    try {
        const {
            p_customer_phone,
            p_customer_name,
            p_items,
            p_is_paid,
            p_customer_id,
            p_payment_method,
            p_refund,
            edit_mode,
            order_id,
            original_total,
            is_refund,
            p_cancelled_items
        } = req.body;

        console.log(`Processing order. Items: ${p_items?.length || 0}, Cancelled: ${p_cancelled_items?.length || 0}`);

        // פונקציית עזר לבדיקת UUID
        const isUUID = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

        // 1. הכנת פריטים: פיצול מוחלט בין עדכון להוספה
        const orderItems = p_items.map((item) => {
            const rawId = item.menu_item_id || item.item_id || item.id || item.menuItemId;
            const idString = String(rawId);

            // שדות נפרדים!
            let orderItemUUID = null;
            let menuItemIdInt = null;

            if (isUUID(idString)) {
                orderItemUUID = idString; // זהו עדכון פריט קיים
            } else {
                menuItemIdInt = parseInt(idString, 10); // זוהי הוספה חדשה
            }

            // נרמול מודים - תומך בכל הפורמטים של הפרונט
            const modsData = item.selectedOptions || item.selected_options || item.mods || [];

            return {
                order_item_id: orderItemUUID, // יהיה מלא רק בעדכון
                menu_item_id: menuItemIdInt,  // יהיה מלא רק בהוספה
                quantity: Number(item.quantity) || 1,
                mods: modsData,
                notes: item.notes || null,
                item_id: menuItemIdInt // Ensure compatibility with SQL which expects item_id
            };
        });

        const payload = {
            p_customer_phone,
            p_customer_name,
            p_items: orderItems, // המערך המתוקן עם השדות הנפרדים
            p_is_paid,
            p_customer_id: p_customer_id || null,
            p_payment_method: p_payment_method || null,
            p_refund: p_refund || false,
            edit_mode: edit_mode || false,
            order_id: order_id || null,
            original_total: original_total || null,
            is_refund: is_refund || false,
            p_cancelled_items: p_cancelled_items || [],
            p_final_total: req.body.p_final_total || null
        };

        const { data, error } = await supabase.rpc('submit_order_v2', payload);

        if (error) {
            console.error("Supabase RPC submit_order Error:", error.message);
            return res.status(400).json({ error: `שגיאה בעיבוד ההזמנה (SQL): ${error.message}` });
        }

        // --- Transaction Logging Logic ---
        // If there's a payment or refund involved, log it to order_transactions
        const transactionAmount = req.body.transaction_amount;

        if (transactionAmount && transactionAmount !== 0) {
            const transactionType = transactionAmount > 0 ? 'charge' : 'refund';
            const orderIdToLog = data?.order_id || order_id; // Use returned ID for new orders, or passed ID for edits

            if (orderIdToLog) {
                const { error: txError } = await supabase
                    .from('order_transactions')
                    .insert({
                        order_id: orderIdToLog,
                        amount: transactionAmount,
                        type: transactionType,
                        payment_method: p_payment_method || 'cash',
                        external_reference: null // Can be added later if needed
                    });

                if (txError) {
                    console.error("Failed to log transaction:", txError.message);
                    // We don't fail the request here, as the order itself was successful
                } else {
                    console.log(`✅ Transaction logged: ${transactionType} ${transactionAmount} for order ${orderIdToLog}`);
                }
            }
        }
        // ---------------------------------

        return res.status(200).json({
            message: "Order processed successfully",
            data: data
        });

    } catch (err) {
        console.error("Server Submit Order Error:", err);
        res.status(500).json({ error: `שגיאת שרת פנימית: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 8. API ROUTE: MENU ITEMS (Simple GET) ===
// ------------------------------------------------------------------
app.get("/menu-items", ensureSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error("Menu items fetch error:", error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json({ data: data || [] });
    } catch (err) {
        console.error("Server GET Menu Items Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 9. API ROUTE: LOYALTY ===
// ------------------------------------------------------------------
app.get("/loyalty", ensureSupabase, async (req, res) => {
    try {
        const { customerId } = req.query;
        if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

        const { data, error } = await supabase
            .from('customers')
            .select('loyalty_coffee_count')
            .eq('id', customerId)
            .single();

        if (error) return res.status(500).json({ error: error.message });

        res.status(200).json({ count: data?.loyalty_coffee_count ?? 0 });
    } catch (err) {
        console.error("Server GET Loyalty Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

app.post("/loyalty", ensureSupabase, async (req, res) => {
    try {
        const { customerId, orderId } = req.body;
        if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

        // Get current loyalty count
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('loyalty_coffee_count')
            .eq('id', customerId)
            .single();

        if (customerError) return res.status(500).json({ error: customerError.message });

        // Count coffee items in this order
        let coffeeCount = 0;
        if (orderId) {
            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('menu_item_id, quantity, menu_items(is_hot_drink, category)')
                .eq('order_id', orderId);

            if (!itemsError && orderItems) {
                orderItems.forEach(item => {
                    const menuItem = item.menu_items;
                    if (menuItem?.is_hot_drink) {
                        coffeeCount += item.quantity || 1;
                    }
                });
            }
        }

        // Default to 1 if no items found (fallback)
        if (coffeeCount === 0) coffeeCount = 1;

        const currentCount = customerData?.loyalty_coffee_count ?? 0;

        // Calculate free items earned
        const totalAfterPurchase = currentCount + coffeeCount;
        const freeItemsEarned = Math.floor(totalAfterPurchase / 10) - Math.floor(currentCount / 10);
        const isFree = freeItemsEarned > 0;

        // Only count PAID coffees
        const paidCoffeesCount = coffeeCount - freeItemsEarned;

        // CORRECT LOGIC: Reset based on TOTAL items processed
        const persistedCount = (currentCount + coffeeCount) % 10;

        const { error: updateError } = await supabase
            .from('customers')
            .update({ loyalty_coffee_count: persistedCount })
            .eq('id', customerId);

        if (updateError) return res.status(500).json({ error: updateError.message });

        res.status(200).json({
            success: true,
            newCount: persistedCount,
            isFree,
            displayedCount: persistedCount,
            coffeeCountAdded: paidCoffeesCount,
            freeItemsEarned
        });
    } catch (err) {
        console.error("Server POST Loyalty Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 10. API ROUTE: IMAGE GENERATION (AI) ===
// ------------------------------------------------------------------
app.post("/generate-image", ensureSupabase, async (req, res) => {
    try {
        const { prompt, style } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

        console.log(`🎨 Generating image for: "${prompt}" (Style: ${style})`);

        // Enhance prompt based on style
        let enhancedPrompt = prompt;
        if (style === 'realistic') enhancedPrompt += ", hyper realistic, 8k resolution, professional food photography, appetizing";
        if (style === 'appetizing') enhancedPrompt += ", delicious, mouth watering, golden lighting, detailed texture, 4k";
        if (style === 'studio') enhancedPrompt += ", studio lighting, white background, clean composition, product photography";
        if (style === 'artistic') enhancedPrompt += ", artistic style, painting, vibrant colors, creative";

        // Use Pollinations.ai for instant, free AI image generation (no key required for demo)
        // This validates the frontend flow immediately.
        // For production using Google Imagen, we would use vertex-ai or similar.
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologin=true`;

        // We return the URL directly. The frontend can display it.
        // Note: Pollinations generates on the fly.

        return res.json({
            success: true,
            imageUrl: imageUrl
        });

    } catch (err) {
        console.error("Server Generate Image Error:", err);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === 11. API ROUTE: CUSTOMER IDENTIFY AND GREET ===
// ------------------------------------------------------------------
app.post("/customers/identify-and-greet", ensureSupabase, async (req, res) => {
    try {
        const { phoneNumber, customerName } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Phone number is required.' });
        }

        // 1. Call Postgres Upsert RPC
        const { data, error } = await supabase.rpc('upsert_customer', {
            p_phone_number: phoneNumber,
            p_name: customerName || null
        });

        if (error) {
            console.error('Database RPC Error:', error);
            return res.status(500).json({ success: false, error: 'DB error', errorDetails: error.message });
        }

        const customer = data && data[0] ? data[0] : null;
        if (!customer) {
            return res.status(500).json({ success: false, error: 'Customer not returned' });
        }

        // Update name if provided and different
        if (customerName && customerName.trim()) {
            const { error: updateError } = await supabase
                .from('customers')
                .update({ name: customerName.trim() })
                .eq('phone_number', phoneNumber);

            if (!updateError) {
                customer.customer_name = customerName.trim();
            } else {
                console.error("Failed to update customer name:", updateError);
            }
        }

        return res.status(200).json({
            success: true,
            isNewCustomer: !customer.customer_name || customer.customer_name === '',
            customer: {
                id: customer.customer_id,
                name: customer.customer_name || 'אורח',
                phone: customer.phone,
                loyalty_coffee_count: customer.loyalty_coffee_count || 0
            }
        });

    } catch (err) {
        console.error("Server Identify-And-Greet Error:", err);
        res.status(500).json({ success: false, error: `Internal Server Error: ${err.message}` });
    }
});

// ------------------------------------------------------------------
// === CLOUD RUN PORT ===
// ------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
