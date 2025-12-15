// Check modifiers for הפוך קטן וגדול
const API_BASE_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

async function fetchItemOptions(itemId) {
    const response = await fetch(`${API_BASE_URL}/item/${itemId}/options`);
    if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Failed to fetch options for item ${itemId}`);
    }
    return await response.json();
}

async function checkHafuch() {
    console.log('🔍 בדיקת הפוך קטן וגדול...\n');
    console.log('═'.repeat(100));

    try {
        const hafuchKatan = await fetchItemOptions(12);
        const hafuchGadol = await fetchItemOptions(13);

        console.log('\n☕ הפוך קטן (ID: 12):');
        console.log('─'.repeat(100));
        hafuchKatan.forEach((group, idx) => {
            console.log(`\n${idx + 1}. ${group.name} (Group ID: ${group.id})`);
            const values = group.values || [];
            console.log(`   ${values.length} אפשרויות:`);
            values.forEach(v => {
                const price = v.price_adjustment || 0;
                const priceStr = price > 0 ? ` +${price}₪` : '';
                console.log(`   • ${v.value_name}${priceStr}`);
            });
        });

        console.log('\n\n☕ הפוך גדול (ID: 13):');
        console.log('─'.repeat(100));
        hafuchGadol.forEach((group, idx) => {
            console.log(`\n${idx + 1}. ${group.name} (Group ID: ${group.id})`);
            const values = group.values || [];
            console.log(`   ${values.length} אפשרויות:`);
            values.forEach(v => {
                const price = v.price_adjustment || 0;
                const priceStr = price > 0 ? ` +${price}₪` : '';
                console.log(`   • ${v.value_name}${priceStr}`);
            });
        });

        console.log('\n\n📊 סיכום:');
        console.log('═'.repeat(100));
        console.log(`הפוך קטן: ${hafuchKatan.length} קבוצות מודיפיירים`);
        console.log(`הפוך גדול: ${hafuchGadol.length} קבוצות מודיפיירים`);

        // Find common groups
        const katanGroups = new Set(hafuchKatan.map(g => g.id));
        const gadolGroups = new Set(hafuchGadol.map(g => g.id));
        const commonGroups = hafuchKatan.filter(g => gadolGroups.has(g.id));

        console.log(`\nקבוצות משותפות: ${commonGroups.length}`);
        commonGroups.forEach(g => {
            console.log(`  • ${g.name}`);
        });

        console.log('\n' + '═'.repeat(100));
        console.log('\n✨ בדיקה הושלמה!\n');

    } catch (error) {
        console.error('\n❌ שגיאה:', error.message);
    }
}

checkHafuch();
