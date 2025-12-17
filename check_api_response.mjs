import fetch from 'node-fetch';

const API_AL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

async function checkApiReturnsBusinessId() {
    console.log('🔍 Checking Manager API Response Structure...');

    try {
        const response = await fetch(API_AL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'תפריט' })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        let items = [];

        if (Array.isArray(data)) items = data;
        else if (data.data && Array.isArray(data.data)) items = data.data;
        else if (data.menuItems) items = data.menuItems;

        console.log(`✅ API returned ${items.length} items.`);

        if (items.length > 0) {
            const firstItem = items[0];
            console.log('🔍 First Item Keys:', Object.keys(firstItem));
            console.log('🔍 First Item business_id value:', firstItem.business_id);

            if (firstItem.business_id === undefined) {
                console.error('❌ CRITICAL: business_id is MISSING from API response!');
            } else {
                console.log('✅ business_id is present in response.');
            }
        }

    } catch (error) {
        console.error('❌ Error calling API:', error);
    }
}

checkApiReturnsBusinessId();
