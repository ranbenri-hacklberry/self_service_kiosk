const { supabase } = require('../_supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!supabase) {
    console.error('❌ Supabase client not configured');
    console.error('Environment check:', {
      hasViteUrl: !!process.env.VITE_SUPABASE_URL,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasNextPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY
    });
    return res.status(500).json({ 
      error: 'Supabase client not configured',
      isFullyAvailable: false
    });
  }

  try {
    const { menuItemId } = req.query || {};

    if (!menuItemId) {
      return res.status(400).json({ 
        error: 'Menu item ID is required',
        isFullyAvailable: false
      });
    }

    console.log(`🔍 Checking inventory for menuItemId: ${menuItemId}`);

    // Get the menu item details
    const menuItemIdNum = parseInt(menuItemId, 10);
    if (isNaN(menuItemIdNum)) {
      return res.status(400).json({ 
        error: 'Invalid menu item ID',
        isFullyAvailable: false
      });
    }

    const { data: menuItem, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, is_ready_made')
      .eq('id', menuItemIdNum)
      .single();

    if (menuError) {
      console.error('❌ Menu item query error:', menuError);
      return res.status(500).json({ 
        error: `Database error: ${menuError.message}`,
        isFullyAvailable: false
      });
    }

    if (!menuItem) {
      return res.status(404).json({ 
        error: 'Menu item not found',
        isFullyAvailable: false
      });
    }

    // If item is ready-made (no preparation needed), it's always available
    if (menuItem?.is_ready_made) {
      return res.status(200).json({
        isFullyAvailable: true,
        menuItemName: menuItem?.name,
        missingIngredients: []
      });
    }

    // Get recipe ingredients for this menu item
    const { data: recipeIngredients, error: recipeError } = await supabase
      .from('recipes')
      .select(`
        quantity,
        ingredients (
          id,
          name,
          current_stock,
          unit
        )
      `)
      .eq('menu_item_id', menuItemIdNum);

    if (recipeError) {
      console.error('❌ Recipe query error:', recipeError);
      // If recipe doesn't exist, assume item is available (might be a simple item)
      return res.status(200).json({
        isFullyAvailable: true,
        menuItemName: menuItem?.name,
        missingIngredients: [],
        note: 'No recipe found, assuming available'
      });
    }

    // If no recipe found, assume it's available (might be a simple item)
    if (!recipeIngredients || recipeIngredients.length === 0) {
      return res.status(200).json({
        isFullyAvailable: true,
        menuItemName: menuItem?.name,
        missingIngredients: []
      });
    }

    // Check availability of each ingredient
    const missingIngredients = [];
    let isFullyAvailable = true;

    for (const recipe of recipeIngredients) {
      const ingredient = recipe?.ingredients;
      
      // Handle case where ingredient might be null or not loaded
      if (!ingredient) {
        console.warn('⚠️ Recipe ingredient not found for recipe:', recipe);
        continue;
      }

      const requiredQuantity = recipe?.quantity || 0;
      const availableStock = ingredient?.current_stock || 0;

      if (availableStock < requiredQuantity) {
        isFullyAvailable = false;
        missingIngredients.push({
          name: ingredient?.name || 'Unknown',
          required: requiredQuantity,
          available: availableStock,
          shortage: requiredQuantity - availableStock,
          unit: ingredient?.unit || ''
        });
      }
    }

    return res.status(200).json({
      isFullyAvailable,
      menuItemName: menuItem?.name,
      missingIngredients,
      totalIngredientsChecked: recipeIngredients.length
    });

  } catch (error) {
    console.error('❌ Inventory check error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: `Internal Server Error: ${error.message}`,
      isFullyAvailable: false,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

