const functions = require('@google-cloud/functions-framework');

const GLOBAL_SMS_CONFIG = {
    apiKey: '5v$YW#4k2Dn@w96306$H#S7cMp@8t$6R',
    endpoint: 'https://sapi.itnewsletter.co.il/api/restApiSms/getBalance'
};

functions.http('checkBalance', async (req, res) => {
    // CORS Headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log('Checking SMS balance...');

        const response = await fetch(GLOBAL_SMS_CONFIG.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ApiKey: GLOBAL_SMS_CONFIG.apiKey })
        });

        const resultText = await response.text();
        console.log('Provider Response:', resultText);

        let providerJson;
        try {
            providerJson = JSON.parse(resultText);
        } catch (e) {
            console.warn('Could not parse provider response as JSON:', e);
            throw new Error(`Invalid provider response: ${resultText}`);
        }

        if (providerJson.success === false) {
            throw new Error(`Provider Failed: ${providerJson.errDesc || 'Unknown Error'}`);
        }

        // Success
        res.status(200).json({
            success: true,
            credits: providerJson.result,
            raw: providerJson
        });

    } catch (error) {
        console.error('Fatal Error checking balance:', error);
        res.status(500).json({ error: error.message });
    }
});
