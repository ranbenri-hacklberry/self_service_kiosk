const functions = require('@google-cloud/functions-framework');

/**
 * הגדרות GlobalSMS - עבר ל-REST API (JSON POST)
 */
const GLOBAL_SMS_CONFIG = {
  apiKey: '5v$YW#4k2Dn@w96306$H#S7cMp@8t$6R',
  // כתובת REST API הנכונה
  endpoint: 
'https://sapi.itnewsletter.co.il/api/restApiSms/sendSmsToRecipients',
  originator: '0548317887' 
};

functions.http('sendSms', async (req, res) => {
  // --- 1. הגדרות CORS (חובה לאייפד) ---
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // --- 2. בדיקת מתודה ---
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      res.status(400).json({ error: 'Missing phone or message' });
      return;
    }
    
    // --- 3. ניקוי מספר טלפון והכנת ה-Payload ---
    // הסרת כל תו שאינו ספרה
    const cleanPhone = phone.replace(/\D/g, '');
    
    const payload = {
      ApiKey: GLOBAL_SMS_CONFIG.apiKey,
      txtOriginator: GLOBAL_SMS_CONFIG.originator,
      destinations: cleanPhone,
      txtSMSmessage: message,
      dteToDeliver: '', 
      txtAddInf: ''
    };

    console.log(`Sending SMS (REST) to ${cleanPhone} (Original: 
${phone})...`);
    console.log('Payload:', JSON.stringify(payload));

    // --- 4. ביצוע השליחה (JSON POST) ---
    const response = await fetch(GLOBAL_SMS_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultText = await response.text();
    console.log('Provider Response:', resultText);

    // --- 5. בדיקת HTML (שגיאת שרת API) ---
    if (resultText.trim().startsWith('<')) {
       throw new Error(`Provider Error: Received HTML response instead of API result.`);
    }

    // ניתוח התשובה של הספק
    let providerJson;
    try {
        providerJson = JSON.parse(resultText);
    } catch (e) {
        console.warn('Could not parse provider response as JSON:', e);
    }

    // בדיקת שגיאות עסקיות (כמו מספר לא תקין)
    if (providerJson && providerJson.success === false) {
        throw new Error(`Provider Failed: ${providerJson.errDesc || 'Unknown Error'}`);
    }

    /* 
       הערה: הוסרה הבדיקה המחמירה על resultJSON ריק.
       הסתבר לפי התיעוד והלוגים שבמקרה של הצלחה, הספק מחזיר result: 1 (עלות)
       ו-resultJSON יכול להיות ריק, וזה תקין.
       הבדיקה הקודמת גרמה ל-False Positives.
    */

    if (resultText.includes('Failure') || resultText.includes('invalid') || resultText.includes('error')) {
       throw new Error(`Provider Error: ${resultText}`);
    }

    res.status(200).json({ 
      success: true, 
      providerResponse: resultText 
    });

  } catch (error) {
    console.error('Fatal Error sending SMS:', error);
    res.status(500).json({ error: error.message });
  }
});
