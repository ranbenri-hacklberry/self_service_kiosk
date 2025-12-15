// Script to check modifiers configuration via the Manager API

const API_BASE_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

async function fetchMenuItems() {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'תפריט' })
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.statusText}`);
    }

    const result = await response.json();
    return result?.data || result?.menuItems || result || [];
}

async function fetchItemOptions(itemId) {
    const response = await fetch(`${API_BASE_URL}/item/${itemId}/options`);

    if (!response.ok) {
        if (response.status === 404) {
            return [];
        }
        throw new Error(`Failed to fetch options for item ${itemId}: ${response.statusText}`);
    }

    return await response.json();
}

async function analyzeModifiers() {
    console.log('🔍 Analyzing modifiers configuration...\n');
    console.log('═'.repeat(80));

    try {
        // Fetch all menu items
        const menuItems = await fetchMenuItems();
        console.log(`\n📋 Found ${menuItems.length} menu items\n`);

        // Group by category
        const byCategory = {};
        menuItems.forEach(item => {
            const cat = item.category || 'אחר';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(item);
        });

        // Analyze each item
        const allGroups = new Set();
        const itemsWithIssues = [];

        for (const category of Object.keys(byCategory).sort()) {
            console.log(`\n📂 ${category}`);
            console.log('─'.repeat(80));

            for (const item of byCategory[category]) {
                const options = await fetchItemOptions(item.id);

                // Collect all group names
                options.forEach(group => allGroups.add(group.name || group.title));

                const groupNames = options.map(g => g.name || g.title).join(', ');
                const optionCount = options.length;

                console.log(`\n☕ ${item.name} (ID: ${item.id})`);
                console.log(`   מחיר: ${item.price}₪`);

                if (optionCount === 0) {
                    console.log(`   ⚠️  אין מודיפיירים`);
                } else {
                    console.log(`   ✅ ${optionCount} קבוצות מודיפיירים: ${groupNames}`);

                    // Show details of each group
                    options.forEach(group => {
                        const values = group.values || [];
                        const defaultValue = values.find(v => v.is_default);
                        console.log(`      • ${group.name || group.title} (${values.length} אפשרויות)`);
                        values.forEach(v => {
                            const def = v.is_default ? '⭐' : '  ';
                            const price = v.price_adjustment || v.priceAdjustment || 0;
                            const priceStr = price > 0 ? `+${price}₪` : '';
                            console.log(`        ${def} ${v.name} ${priceStr}`);
                        });
                    });
                }

                // Check for potential issues
                const hasMilk = options.some(g => (g.name || g.title)?.includes('חלב'));
                const isHotDrink = item.is_hot_drink;
                const isColdDrink = category === 'שתיה קרה';
                const name = item.name.toLowerCase();

                // Issue 1: Hot coffee drink without milk option
                if (isHotDrink && !hasMilk && !name.includes('תה') && !name.includes('אמריקנו')) {
                    itemsWithIssues.push({
                        item: item.name,
                        issue: 'משקה קפה חם ללא אפשרות חלב',
                        severity: 'high'
                    });
                }

                // Issue 2: Non-coffee drink with milk option
                if (hasMilk && (name.includes('מיץ') || name.includes('מים') || name.includes('לימונדה'))) {
                    itemsWithIssues.push({
                        item: item.name,
                        issue: 'משקה ללא קפה עם אפשרות חלב',
                        severity: 'medium'
                    });
                }

                // Issue 3: Too many modifier groups (might be confusing)
                if (optionCount > 5) {
                    itemsWithIssues.push({
                        item: item.name,
                        issue: `יותר מדי קבוצות מודיפיירים (${optionCount})`,
                        severity: 'low'
                    });
                }
            }
        }

        // Summary
        console.log('\n\n' + '═'.repeat(80));
        console.log('📊 סיכום');
        console.log('═'.repeat(80));
        console.log(`\nסה"כ פריטים: ${menuItems.length}`);
        console.log(`קבוצות מודיפיירים שנמצאו: ${allGroups.size}`);
        console.log(`\nקבוצות מודיפיירים:`);
        Array.from(allGroups).sort().forEach(name => {
            console.log(`  • ${name}`);
        });

        // Issues
        if (itemsWithIssues.length > 0) {
            console.log('\n\n⚠️  בעיות פוטנציאליות שנמצאו:');
            console.log('═'.repeat(80));

            const bySevirity = {
                high: itemsWithIssues.filter(i => i.severity === 'high'),
                medium: itemsWithIssues.filter(i => i.severity === 'medium'),
                low: itemsWithIssues.filter(i => i.severity === 'low')
            };

            if (bySevirity.high.length > 0) {
                console.log('\n🔴 חשיבות גבוהה:');
                bySevirity.high.forEach(issue => {
                    console.log(`   ❌ ${issue.item}: ${issue.issue}`);
                });
            }

            if (bySevirity.medium.length > 0) {
                console.log('\n🟡 חשיבות בינונית:');
                bySevirity.medium.forEach(issue => {
                    console.log(`   ⚠️  ${issue.item}: ${issue.issue}`);
                });
            }

            if (bySevirity.low.length > 0) {
                console.log('\n🟢 חשיבות נמוכה:');
                bySevirity.low.forEach(issue => {
                    console.log(`   ℹ️  ${issue.item}: ${issue.issue}`);
                });
            }
        } else {
            console.log('\n\n✅ לא נמצאו בעיות!');
        }

        console.log('\n' + '═'.repeat(80));
        console.log('\n✨ ניתוח הושלם!\n');

    } catch (error) {
        console.error('\n❌ שגיאה:', error.message);
        console.error(error);
    }
}

analyzeModifiers();
