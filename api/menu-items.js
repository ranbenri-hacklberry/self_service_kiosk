const { supabase } = require('./_supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabase) {
    res.status(500).json({ error: 'Supabase client not configured' });
    return;
  }

  try {
    console.log('*** MENU-ITEMS API CALLED ***');
    console.log('Supabase client exists:', !!supabase);
    
    if (!supabase) {
      console.error('Supabase client is null/undefined');
      res.status(500).json({ error: 'Supabase client not configured' });
      return;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Menu items fetch error:', error);
      res.status(500).json({ error: error.message || 'Database query failed' });
      return;
    }

    console.log('Menu items fetched successfully:', data?.length || 0, 'items');
    res.status(200).json({ data: data || [] });
  } catch (err) {
    console.error('Unexpected menu fetch error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: err.message || 'Failed to load menu' });
  }
};

