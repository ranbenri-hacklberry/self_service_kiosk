// Check all modifier groups in the system
const API_BASE_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

async function fetchItemOptions(itemId) {
    const response = await fetch(`${API_BASE_URL}/item/${itemId}/options`);
    if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Failed to fetch options for item ${itemId}`);
    }
    return await response.json();
}

async function checkAllModifiers() {
    console.log('🔍 בדיקת כל קבוצות המודיפיירים במערכת...\n');
    console.log('═'.repeat(100));

    try {
        // Check espresso items
        const espressoShort = await fetchItemOptions(10);
        const espressoDouble = await fetchItemOptions(11);

        console.log('\n📋 אספרסו קצר (ID: 10):');
        console.log('─'.repeat(100));
        espressoShort.forEach(group => {
            console.log(`\n🏷️  ${group.name} (Group ID: ${group.id})`);
            const values = group.values || [];
            values.forEach(v => {
                const price = v.price_adjustment || 0;
                const priceStr = price > 0 ? ` +${price}₪` : price < 0 ? ` ${price}₪` : '';
                console.log(`   • ${v.value_name}${priceStr} (Value ID: ${v.id})`);
            });
        });

        console.log('\n\n📋 אספרסו כפול (ID: 11):');
        console.log('─'.repeat(100));
        espressoDouble.forEach(group => {
            console.log(`\n🏷️  ${group.name} (Group ID: ${group.id})`);
            const values = group.values || [];
            values.forEach(v => {
                const price = v.price_adjustment || 0;
                const priceStr = price > 0 ? ` +${price}₪` : price < 0 ? ` ${price}₪` : '';
                console.log(`   • ${v.value_name}${priceStr} (Value ID: ${v.id})`);
            });
        });

        // Find all unique groups
        const allGroups = new Map();
        [...espressoShort, ...espressoDouble].forEach(group => {
            if (!allGroups.has(group.id)) {
                allGroups.set(group.id, group);
            }
        });

        console.log('\n\n📊 סיכום קבוצות מודיפיירים:');
        console.log('═'.repeat(100));
        console.log(`\nנמצאו ${allGroups.size} קבוצות מודיפיירים ייחודיות:\n`);

        Array.from(allGroups.values()).forEach(group => {
            const values = group.values || [];
            console.log(`• ${group.name} (ID: ${group.id}) - ${values.length} אפשרויות`);
        });

        console.log('\n' + '═'.repeat(100));
        console.log('\n✨ בדיקה הושלמה!\n');

    } catch (error) {
        console.error('\n❌ שגיאה:', error.message);
    }
}

checkAllModifiers();
