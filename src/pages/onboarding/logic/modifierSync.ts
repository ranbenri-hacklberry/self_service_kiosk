
import { supabase } from '@/lib/supabase';
import { ModifierGroup, ModifierLogic, ModifierRequirement } from '@/types/onboardingTypes';

/**
 * Synchronizes the JSON-based modifiers state with the relational database tables.
 * This ensures that the POS (which reads relational tables) matches the Editor (which edits JSON).
 */
export const syncModifiersToRelational = async (menuItemId: string | number, modifiers: ModifierGroup[]) => {
    const numericId = Number(menuItemId);
    const isNumericId = !isNaN(numericId);

    if (!modifiers || !isNumericId) return;

    try {
        console.log(`🔄 Syncing modifiers for Item ${menuItemId} to relational tables...`, modifiers);

        // 1. Fetch existing groups for this item
        const { data: existingGroups, error: fetchError } = await supabase
            .from('optiongroups')
            .select('id')
            .eq('menu_item_id', numericId);

        if (fetchError) throw fetchError;

        const existingGroupIds = new Set((existingGroups || []).map(g => g.id));
        const currentGroupIds = new Set<string>();

        // 2. Iterate and Upsert Groups
        for (const group of modifiers) {
            // Determine ID (use existing if valid UUID, else create new)
            let groupId = group.id;
            const isNewGroup = !groupId || !groupId.includes('-'); // Simple UUID check

            const groupPayload = {
                menu_item_id: numericId,
                name: group.name,
                is_required: group.requirement === ModifierRequirement.MANDATORY,
                is_multiple_select: group.logic === ModifierLogic.ADD && group.maxSelection > 1, // Inference
                min_selection: group.requirement === ModifierRequirement.MANDATORY ? 1 : 0,
                max_selection: group.logic === ModifierLogic.ADD ? (group.maxSelection || 10) : 1,
                is_replacement: group.logic === ModifierLogic.REPLACE
            };

            let upsertedGroup;

            if (isNewGroup) {
                // Create New Group
                const { data, error } = await supabase
                    .from('optiongroups')
                    .insert([groupPayload])
                    .select('id')
                    .single();
                if (error) throw error;
                upsertedGroup = data;
                // Update local object ID so subsequent saves know it exists
                group.id = upsertedGroup.id;
            } else {
                // Update Existing Group
                const { data, error } = await supabase
                    .from('optiongroups')
                    .update(groupPayload)
                    .eq('id', groupId)
                    .select('id')
                    .single();
                if (error) throw error;
                upsertedGroup = data;
            }

            if (upsertedGroup) {
                currentGroupIds.add(upsertedGroup.id);
                groupId = upsertedGroup.id;

                // 2a. Sync Values for this Group
                await syncGroupValues(groupId!, group.items);

                // 2b. Ensure Link in menuitemoptions
                await ensureLink(numericId, groupId!);
            }
        }

        // 3. Delete Removed Groups
        const groupsToDelete = [...existingGroupIds].filter(id => !currentGroupIds.has(id));
        if (groupsToDelete.length > 0) {
            console.log(`🗑️ Deleting ${groupsToDelete.length} removed modifier groups...`);
            await supabase.from('optiongroups').delete().in('id', groupsToDelete);
        }

        console.log(`✅ Modifier Sync Complete for Item ${menuItemId}`);

    } catch (err) {
        console.error('❌ Failed to sync modifiers to relational tables:', err);
        // We don't block the UI, but we log the error
    }
};

const syncGroupValues = async (groupId: string, items: any[]) => {
    // Fetch existing values
    const { data: existingValues } = await supabase
        .from('optionvalues')
        .select('id')
        .eq('group_id', groupId);

    const existingValueIds = new Set((existingValues || []).map(v => v.id));
    const currentValueIds = new Set<string>();

    for (const item of items) {
        let valId = item.id;
        const isNewVal = !valId || !String(valId).includes('-');

        const valPayload = {
            group_id: groupId,
            value_name: item.name,
            price_adjustment: item.price || 0,
            is_default: item.isDefault || false
        };

        if (isNewVal) {
            const { data } = await supabase.from('optionvalues').insert([valPayload]).select('id').single();
            if (data) {
                item.id = data.id;
                currentValueIds.add(data.id);
            }
        } else {
            await supabase.from('optionvalues').update(valPayload).eq('id', valId);
            currentValueIds.add(valId);
        }
    }

    // Delete removed values
    const valsToDelete = [...existingValueIds].filter(id => !currentValueIds.has(id));
    if (valsToDelete.length > 0) {
        await supabase.from('optionvalues').delete().in('id', valsToDelete);
    }
};

const ensureLink = async (itemId: number, groupId: string) => {
    const { data } = await supabase
        .from('menuitemoptions')
        .select('id')
        .match({ item_id: itemId, group_id: groupId })
        .maybeSingle();

    if (!data) {
        await supabase.from('menuitemoptions').insert([{ item_id: itemId, group_id: groupId }]);
    }
};
