import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_KEY // Use Service Key for necessary write access
);

export default async function handler(req, res) {
    if (req?.method !== 'POST') {
        return res?.status(405)?.json({ error: 'Method Not Allowed' });
    }

    // Input parameters from the KDS tablet
    const { orderItemId, newStatus } = req?.body;

    const allowedStatuses = ['in_progress', 'ready', 'closed']; // 'closed' is for cleanup

    if (!orderItemId || !allowedStatuses?.includes(newStatus)) {
        return res?.status(400)?.json({ error: 'Invalid orderItemId or unsupported status.' });
    }

    // Optional: Implement status progression logic (e.g., prevent new -> ready)
    // For now, we rely on the client-side logic to ensure correct progression.
    try {
        // 1. Updating the item status in the order_items table
        const { error } = await supabase?.from('order_items')?.update({ 
                item_status: newStatus 
            })?.eq('id', orderItemId);

        if (error) {
            console.error('Database UPDATE Error:', error);
            return res?.status(500)?.json({ error: 'Failed to update item status.' });
        }

        // 2. Success response
        return res?.status(200)?.json({
            success: true,
            message: `Item ${orderItemId} status updated to ${newStatus}.`
        });
        
    } catch (e) {
        console.error('API Catch Error:', e);
        return res?.status(500)?.json({ error: 'Internal Server Error.' });
    }
}