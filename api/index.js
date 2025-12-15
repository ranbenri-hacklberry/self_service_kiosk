const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase, supabaseUrl, supabaseServiceKey } = require('./_supabase');
const { parseJsonBody } = require('./_utils');

// Env vars
const geminiApiKey =
  process.env.VITE_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY;

console.log('Supabase URL:', supabaseUrl ? 'מוגדר' : 'לא מוגדר');
console.log('Supabase Key:', supabaseServiceKey ? 'מוגדר' : 'לא מוגדר');
console.log('Gemini API Key:', geminiApiKey ? 'מוגדר' : 'לא מוגדר');

let genAI = null;

if (geminiApiKey) {
  try {
    genAI = new GoogleGenerativeAI(geminiApiKey);
  } catch (err) {
    console.error('❌ Failed to init Gemini client:', err);
  }
} else {
  console.error('❌ Missing Gemini env var');
}

// Tools
const get_employee_availability = async ({ name, date }) => {
  if (!supabase) {
    return { error: 'Supabase לא הוגדר (חסר מפתח או URL)' };
  }
  const { data, error } = await supabase
    .from('employees')
    .select('availability')
    .eq('name', name)
    .single();
  if (error) return { error: `Employee ${name} not found` };
  const availability = data.availability || [];
  const dayAvailability = availability.find(a => a.date === date);
  return dayAvailability || { is_available: true, message: 'Assuming available' };
};

const update_waiting_list = async ({ client_name, phone_number, notes }) => {
  if (!supabase) {
    return { error: 'Supabase לא הוגדר (חסר מפתח או URL)' };
  }
  const list_name = 'רשימת המתנה - ליל שישי בודד';
  const { data, error } = await supabase
    .from('waiting_list')
    .insert([{ client_name, phone_number, notes, list_name }]);
  if (error) return { error: error.message };
  return { success: true, message: `Added to ${list_name}` };
};

const send_whatsapp_message = async ({ phone_number, message_text }) => {
  console.log(`Simulating WhatsApp to ${phone_number}: ${message_text}`);
  return { success: true, message: 'Simulated send' };
};

const sync_local_to_cloud = async ({ table_name, records_array_json }) => {
  // Mock – replace with real Supabase upsert
  return { success: true, message: `Synced ${records_array_json.length} records to ${table_name}` };
};

const get_menu_details = async ({ item_name, category }) => {
  if (!supabase) {
    return { error: 'Supabase לא הוגדר (חסר מפתח או URL)' };
  }
  try {
    // אם item_name ספציפי, חפש אותו; אחרת, אפשר לסנן לפי קטגוריה או להחזיר את כל התפריט
    let query = supabase.from('menu_items').select('*');
    let singleItem = false;

    if (item_name) {
      query = query.ilike('name', `%${item_name}%`);
      singleItem = true;
    } else if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    const { data: menuItems, error } = await query;

    if (error) {
      console.error('שגיאה בסופאבייס:', error);
      return { error: `לא נמצאו נתונים: ${error.message}` };
    }

    if (!item_name && !category) {
      // אם אין סינון – החזר טבלה של כל הפריטים
      return {
        success: true,
        action: "display_table",
        table_title: "תפריט המסעדה",
        data: menuItems || []  // array של כל הפריטים
      };
    }

    if (category) {
      return {
        success: true,
        action: "display_table",
        table_title: `פריטים בקטגוריה: ${category}`,
        data: menuItems || []
      };
    }

    if (singleItem) {
      // פרטי פריט ספציפי (השתמש בפריט הראשון שנמצא)
      const item = Array.isArray(menuItems) ? menuItems[0] : menuItems;
      if (!item) {
        return { success: false, response: `לא נמצאו פריטים בשם ${item_name}` };
      }
      return {
        success: true,
        action: "display_details",
        table_title: `פרטי מנה: ${item.name}`,
        item: item  // אובייקט עם name, price, category, status וכו'
      };
    }

    // fallback – החזר את הנתונים כפי שהם
    return {
      success: true,
      action: "display_table",
      data: menuItems || []
    };
  } catch (err) {
    console.error('שגיאה כללית:', err);
    return { error: err.message };
  }
};

const update_menu_item_value = async ({ item_name, field_key, new_value }) => {
  // Mock – replace with real Supabase update
  return {
    success: true,
    action: "display_read_only_form_for_approval",
    table_title: `פרטי מנה: ${item_name} (הוצע שינוי)`,
    records: [
      { "field_name": "שם מנה", "key": "item_name", "value": item_name, "editable": false, "type": "text" },
      { "field_name": "מחיר (ש\"ח)", "key": "price", "value": new_value, "editable": false, "type": "number" },
      { "field_name": "זמינות", "key": "status", "value": "זמין", "editable": false, "type": "select", "options": ["זמין", "אזל", "מלאי מוגבל"] },
      { "field_name": "מק\"ט", "key": "sku", "value": "HFC-S", "editable": false, "type": "text" }
    ]
  };
};

const toolMap = {
  get_employee_availability,
  update_waiting_list,
  send_whatsapp_message,
  sync_local_to_cloud,
  get_menu_details,
  update_menu_item_value
};
async function getMenuItems() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    console.log('Fetched menu items:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return [];
  }
}

async function findMenuItem(query) {
  try {
    const items = await getMenuItems();
    const lowerQuery = query.toLowerCase();

    // חפש התאמה מדויקת או חלקית
    for (const item of items) {
      const itemName = item.name?.toLowerCase() || '';
      if (itemName.includes(lowerQuery) ||
          lowerQuery.includes(itemName) ||
          itemName.includes(lowerQuery.replace('כמה עולה', '').trim()) ||
          lowerQuery.includes(itemName.replace('קטן', '').replace('גדול', '').trim())) {
        return item;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding menu item:', error);
    return null;
  }
}

function getFunctionCallsFromResponse(resp) {
  const parts = resp?.response?.candidates?.[0]?.content?.parts || [];
  const calls = [];
  parts.forEach(part => {
    if (part?.functionCall) {
      calls.push(part.functionCall);
    } else if (Array.isArray(part?.functionCalls)) {
      calls.push(...part.functionCalls);
    }
  });
  return calls;
}

function extractFinalResponse(resp) {
  const parts = resp?.response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part?.text) {
      return { type: 'text', payload: part.text };
    }
    if (part?.inlineData?.data) {
      try {
        const decoded = Buffer.from(part.inlineData.data, 'base64').toString('utf8');
        return { type: 'text', payload: decoded };
      } catch (err) {
        console.error('Failed to decode inlineData:', err);
      }
    }
    if (part?.functionResponse?.response) {
      return { type: 'functionResponse', payload: part.functionResponse.response };
    }
  }
  return null;
}

function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function handler(req, res) {
  console.log('Vercel handler called:', req.method, req.url);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (!body) {
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      console.error('Body parse error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Invalid request body' }));
      return;
    }
  }

  const { command } = body || {};

  if (!command) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Missing command' }));
    return;
  }

  try {
    console.log('Received:', command);

    if (!genAI) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gemini AI not initialized' }));
      return;
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7 },
      tools: [
        {
          functionDeclarations: [
            { name: 'get_employee_availability', description: 'Check employee availability', parameters: { type: 'object', properties: { name: { type: 'string' }, date: { type: 'string' } } } },
            { name: 'update_waiting_list', description: 'Add to waiting list', parameters: { type: 'object', properties: { client_name: { type: 'string' }, phone_number: { type: 'string' }, notes: { type: 'string' } } } },
            { name: 'send_whatsapp_message', description: 'Send WhatsApp', parameters: { type: 'object', properties: { phone_number: { type: 'string' }, message_text: { type: 'string' } } } },
            { name: 'sync_local_to_cloud', description: 'Sync data from Pi', parameters: { type: 'object', properties: { table_name: { type: 'string' }, records_array_json: { type: 'string' } } } },
            { name: 'get_menu_details', description: 'Get menu or category details', parameters: { type: 'object', properties: { item_name: { type: 'string' }, category: { type: 'string' } } } },
            { name: 'update_menu_item_value', description: 'Update menu item', parameters: { type: 'object', properties: { item_name: { type: 'string' }, field_key: { type: 'string' }, new_value: { type: 'string' } } } },
          ],
        },
      ],
    });

    const chat = model.startChat({
      systemInstruction: {
        parts: [
          {
            text: `You are Rani, an AI Manager Agent for a self-service kiosk.
- Use the available tools to answer accurately (availability, waiting list, WhatsApp, sync, menu lookup, price updates).
- Waiting list name: 'רשימת המתנה - ליל שישי בודד'.
- Always respond in Hebrew, short and professional.
- When the frontend needs to render data, respond with JSON that includes fields like action, data, records, clarification as needed.`,
          },
        ],
      },
    });

    let response = await chat.sendMessage(command);

    // Handle tool calls
    let toolCalls = getFunctionCallsFromResponse(response);

    while (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const toolFunc = toolMap[toolCall.name];
        if (toolFunc) {
          const toolResult = await toolFunc(toolCall.args);
          console.log(`Tool ${toolCall.name} result:`, toolResult);

          response = await chat.sendMessage([{
            functionResponse: {
              name: toolCall.name,
              response: toolResult
            }
          }]);
        }
      }

      toolCalls = getFunctionCallsFromResponse(response);
    }

    const finalResponse = extractFinalResponse(response);

    if (finalResponse?.type === 'functionResponse' && finalResponse.payload) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...finalResponse.payload }));
      return;
    }

    if (finalResponse?.type === 'text' && finalResponse.payload) {
      const parsed = tryParseJson(finalResponse.payload);
      if (parsed && typeof parsed === 'object') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...parsed }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, response: finalResponse.payload }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, response: 'אין תשובה' }));

  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

module.exports = handler;
