// /api/customers/identify-and-greet.js

import { createClient } from '@supabase/supabase-js';

// התיקון הקריטי: בדיקה לפני אתחול (Initialization)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("Environment Variables Missing! Cannot initialize Supabase client.");
    // ייתכן שהקריסה מתרחשת כאן.
}

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_KEY 
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
    res?.setHeader('Content-Type', 'application/json'); 
    res?.setHeader('Cache-Control', 'no-store');
    
    // אם המשתנים חסרים, אפשר להחזיר שגיאה מפורשת כאן
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return res?.status(500)?.json({ 
            success: false, 
            error: 'Configuration Error: Supabase keys are missing in the Rocket environment.' 
        });
    }
    
    if (req?.method !== 'POST') {
        return res?.status(405)?.json({ success: false, error: 'Method Not Allowed' });
    }

    // התיקון הקריטי: קריאת ה-Body כ-Stream והמרתו ל-JSON
    let body;
    try {
        const chunks = [];
        for await (const chunk of req) {
            chunks?.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawBody = Buffer.concat(chunks)?.toString('utf8');
        body = JSON.parse(rawBody);
        if (!body || typeof body !== 'object') {
            throw new Error('Invalid or missing request body after manual parsing.');
        }
    } catch (e) {
        // אם ה-JSON לא תקין או שהקריאה נכשלה (וזה כנראה מה שקורה!)
        console.error('Manual Body Parsing Failed:', e);
        return res?.status(400)?.json({ success: false, error: 'Failed to read request data format.' });
    }

    // נמשיך עם body המפורסר
    const { phoneNumber, customerName } = body; 
    
    if (!phoneNumber) {
        return res?.status(400)?.json({ success: false, error: 'Phone number is required.' });
    }

    try {
        // 1. קריאה לפונקציית ה-Postgres Upsert
        const { data, error } = await supabase?.rpc('upsert_customer', {
            p_phone_number: phoneNumber,
            p_name: customerName || null 
        });

        console.log('מה שקיבלתי מ-Supabase:', data);
        console.log('מה Supabase:', data);

        if (error) {
            console.error('Database RPC Error:', error);
            return res?.status(500)?.json({ success: false, error: 'DB error', errorDetails: error?.message });
        }

        const customer = data && data[0] ? data[0] : null;
        if (!customer) {
            return res?.status(500)?.json({ success: false, error: 'Customer not returned' });
        }

        if (customerName?.trim()) {
            const { error: updateError } = await supabase
                .from('customers')
                .update({ name: customerName.trim() })
                .eq('phone_number', phoneNumber);
            if (!updateError) customer.customer_name = customerName.trim();
        }

        return res.status(200).json({
            success: true,
            isNewCustomer: !customer?.customer_name || customer?.customer_name === '',
            customer: {
                id: customer?.customer_id,
                name: customer?.customer_name || 'אורח',
                phone: customer?.phone,
                loyalty_coffee_count: customer?.loyalty_coffee_count || 0
            }
        });
        
    } catch (e) {
        console.error('API Catch Error (Final):', e);
        return res?.status(500)?.json({ success: false, error: 'Internal Server Error.' });
    }
}