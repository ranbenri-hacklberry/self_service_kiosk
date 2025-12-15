// Check modifiers for items 10-20
const API_BASE_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

async function fetchItemOptions(itemId) {
    const response = await fetch(`${API_BASE_URL}/item/${itemId}/options`);
    if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Failed to fetch options for item ${itemId}`);
    }
    return await response.json();
}

async function fetchMenuItems() {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'תפריט' })
    });
    if (!response.ok) throw new Error('Failed to fetch menu');
    const result = await response.json();
    return result?.data || result?.menuItems || result || [];
}

async function checkItems10to20() {
    console.log('🔍 בדיקת פריטים 10-20...\n');
    console.log('═'.repeat(100));

    try {
        const allItems = await fetchMenuItems();
        const items = allItems.filter(item => item.id >= 10 && item.id <= 20).sort((a, b) => a.id - b.id);

        console.log(`\n📋 נמצאו ${items.length} פריטים בטווח 10-20\n`);

        for (const item of items) {
            console.log('\n' + '─'.repeat(100));
            console.log(`\n☕ ${item.name}`);
            console.log(`   ID: ${item.id}`);
            console.log(`   קטגוריה: ${item.category}`);
            console.log(`   מחיר: ${item.price}₪`);
            console.log(`   משקה חם: ${item.is_hot_drink ? 'כן' : 'לא'}`);

            const options = await fetchItemOptions(item.id);

            if (options.length === 0) {
                console.log(`   ⚠️  אין מודיפיירים`);
            } else {
                console.log(`   ✅ ${options.length} קבוצות מודיפיירים:\n`);

                options.forEach((group, idx) => {
                    const values = group.values || [];
                    console.log(`      ${idx + 1}. ${group.name} (${values.length} אפשרויות)`);

                    values.forEach(v => {
                        const price = v.price_adjustment || v.priceAdjustment || 0;
                        const priceStr = price > 0 ? ` +${price}₪` : '';
                        const def = v.is_default ? ' [ברירת מחדל]' : '';
                        console.log(`         • ${v.value_name || v.name}${priceStr}${def}`);
                    });
                });
            }
        }

        console.log('\n' + '═'.repeat(100));
        console.log('\n✨ בדיקה הושלמה!\n');

    } catch (error) {
        console.error('\n❌ שגיאה:', error.message);
    }
}

checkItems10to20();
