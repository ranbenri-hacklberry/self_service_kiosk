import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Save, Check, Trash2, Image as ImageIcon, Plus, Power, GripHorizontal, PlusCircle, Loader2, DollarSign, ChevronDown, CheckCircle, ArrowRight, Package, Minus, Search, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// Reusable animated accordion section to prevent layout jumps
const AnimatedSection = ({ show, children }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
            >
                {children}
            </motion.div>
        )}
    </AnimatePresence>
);

/**
 * ⚠️ אזהרה - אין לשנות את העיצוב של קומפוננטה זו ללא אישור מפורש מהמשתמש!
 * WARNING - Do not change the design of this component without explicit user approval!
 */

const MenuEditModal = ({ item, onClose, onSave }) => {
    const [formData, setFormData] = useState({ name: '', price: '', description: '', category: '', image_url: '', is_in_stock: true, allow_notes: true });
    const [availableCategories, setAvailableCategories] = useState([]);
    const [isNewCategory, setIsNewCategory] = useState(false);
    const [loading, setLoading] = useState(false);
    const [allGroups, setAllGroups] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
    const [showModifiersSection, setShowModifiersSection] = useState(false);
    const [showPriceSection, setShowPriceSection] = useState(false);
    const [showSaleDates, setShowSaleDates] = useState(false);
    const [allOptionNames, setAllOptionNames] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [groupSuggestionsOpen, setGroupSuggestionsOpen] = useState(false);
    const [addingToGroupId, setAddingToGroupId] = useState(null);
    const [newOptionData, setNewOptionData] = useState({ name: '', price: '0', is_default: false });
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showComponentsSection, setShowComponentsSection] = useState(false);
    const [components, setComponents] = useState([]);
    const [componentsLoading, setComponentsLoading] = useState(false);
    const [componentsError, setComponentsError] = useState('');
    const [deleteCandidateId, setDeleteCandidateId] = useState(null);
    const [groupDeleteCandidateId, setGroupDeleteCandidateId] = useState(null);
    const [expandedComponentId, setExpandedComponentId] = useState(null);
    const [hasRecipe, setHasRecipe] = useState(false);
    const [selectedRecipeId, setSelectedRecipeId] = useState(null);
    const [deletedComponentIds, setDeletedComponentIds] = useState(new Set());
    const [expandedComponents, setExpandedComponents] = useState(new Set());
    const [newIngredientExpanded, setNewIngredientExpanded] = useState(false);
    const [newIngredient, setNewIngredient] = useState({ inventory_item_id: '', quantity: '', unit: '', price: 0 });
    const [inventoryOptions, setInventoryOptions] = useState([]); // For dropdowns
    const [deletedOptionIds, setDeletedOptionIds] = useState(new Set()); // Pending deletes for options
    const [saveBanner, setSaveBanner] = useState(null);
    const searchRef = useRef(null);
    const nameInputRef = useRef(null);

    // Lock body scroll to prevent background scrolling
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);
    const [activeView, setActiveView] = useState('main'); // 'main' | 'modifiers' | 'picker'
    const [modifierFilter, setModifierFilter] = useState('all'); // 'all' | 'food' | 'drink'
    const [uniqueModifiers, setUniqueModifiers] = useState([]); // { name: string, count: number }

    // New State for "Picker" flows
    const [pickerMode, setPickerMode] = useState(null); // 'add_to_group' | 'create_group' | null
    const [pickerTargetGroupId, setPickerTargetGroupId] = useState(null);
    const [pickerSelectedNames, setPickerSelectedNames] = useState(new Set());
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerGroupName, setPickerGroupName] = useState(''); // For creating new group

    // --- AUTO SAVE & HISTORY STATE ---
    const [history, setHistory] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const saveTimeoutRef = useRef(null);
    const historyTimeoutRef = useRef(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const { currentUser: user } = useAuth();
    const scrollContainerRef = useRef(null);
    const [expandedOptionId, setExpandedOptionId] = useState(null); // Re-added
    const [showKitchenLogic, setShowKitchenLogic] = useState(false);
    const [taskSchedule, setTaskSchedule] = useState({}); // { 0: { qty: 10, mode: 'fixed' }, ... }

    const updateSchedule = (day, field, value) => {
        setTaskSchedule(prev => ({
            ...prev,
            [day]: { ...(prev[day] || { qty: 0, mode: 'fixed' }), [field]: value }
        }));
    };

    // Initial History Push
    useEffect(() => {
        // Wait for components to load? No, initial state might have empty components
        // But we want baseline.
    }, [item]);

    // Update baseline history when components OR groups load for the first time
    useEffect(() => {
        if (item && !loading && history.length === 0 && (components.length > 0 || allGroups.length > 0)) {
            setHistory([{
                formData,
                components,
                deletedComponentIds: Array.from(deletedComponentIds),
                allGroups,
                deletedOptionIds: Array.from(deletedOptionIds)
            }]);
        }
    }, [components, allGroups, loading]);

    // History Tracker (Debounced)
    useEffect(() => {
        if (!item || history.length === 0) return;

        const currentSnapshot = {
            formData,
            components,
            deletedComponentIds: Array.from(deletedComponentIds),
            allGroups, // Track modifier groups state
            deletedOptionIds: Array.from(deletedOptionIds)
        };
        const currentParams = JSON.stringify(currentSnapshot);

        const lastSnapshot = history.length > 0 ? history[history.length - 1] : null;
        const lastParams = lastSnapshot ? JSON.stringify({
            formData: lastSnapshot.formData,
            components: lastSnapshot.components,
            deletedComponentIds: lastSnapshot.deletedComponentIds,
            allGroups: lastSnapshot.allGroups,
            deletedOptionIds: lastSnapshot.deletedOptionIds
        }) : null;

        if (currentParams !== lastParams) {
            setIsDirty(true);

            if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);

            historyTimeoutRef.current = setTimeout(() => {
                setHistory(prev => [...prev, currentSnapshot]);
            }, 800);
        }
    }, [formData, components, deletedComponentIds, allGroups, deletedOptionIds]);

    // Auto-Save Effect
    useEffect(() => {
        if (isDirty) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                saveInternal(true);
            }, 2000); // 2s Auto-Save
        }
        return () => clearTimeout(saveTimeoutRef.current);
    }, [formData, isDirty]);


    useEffect(() => {
        if (item) {
            setFormData({
                name: item.name || '',
                price: item.price || '',
                description: item.description || '',
                category: item.category || '',
                image_url: item.image_url || '',
                is_in_stock: item.is_in_stock ?? true,
                // Ensure number safety for sale price
                sale_price: item.sale_price || '',
                sale_start_date: item.sale_start_date || '',
                sale_start_time: item.sale_start_time || '',
                sale_end_date: item.sale_end_date || '',
                sale_end_time: item.sale_end_time || '',
                allow_notes: item.allow_notes ?? true
            });
            setIsNewCategory(false);

            // Re-fetch all supplementary data whenever item changes
            fetchCategories();
            fetchModifiers();
            fetchAllOptionNames();
            fetchKitchenLogic();
            // Fetch inventory first, then components (pass inventory data directly)
            fetchInventoryOptions().then((invData) => fetchComponents(item.id, invData));
            fetchUniqueModifiers(); // Fetch unique modifiers for the picker
        }
        const handleClickOutside = (event) => { if (searchRef.current && !searchRef.current.contains(event.target)) setShowSuggestions(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [item]);

    const fetchCategories = async () => { try { const { data } = await supabase.from('menu_items').select('category').not('category', 'is', null); if (data) setAvailableCategories([...new Set(data.map(i => i.category))].sort()); } catch (e) { console.error(e); } };

    const fetchModifiers = async () => {
        console.log('🔍 fetchModifiers called for item:', item?.id);
        try {
            // Fetch groups that are either linked via menuitemoptions OR owned by this item (private groups)
            // 1. Get linked group IDs
            let linkedGroupIds = new Set();
            if (item?.id) {
                console.log('🔗 Fetching linked groups for item:', item.id);
                const { data: linked, error: linkedError } = await supabase.from('menuitemoptions').select('group_id').eq('item_id', item.id);
                console.log('🔗 Linked groups result:', linked, 'error:', linkedError);
                if (linkedError) {
                    console.error('❌ Error fetching menuitemoptions:', linkedError);
                }
                linked?.forEach(l => linkedGroupIds.add(l.group_id));
                console.log('🔗 Linked group IDs:', [...linkedGroupIds]);
            }

            // 2. Fetch ALL groups from the system
            console.log('📋 Fetching all optiongroups...');
            const { data: groups, error: groupsError } = await supabase.from('optiongroups')
                .select(`*, is_food, is_drink, optionvalues (id, value_name, price_adjustment, is_default, display_order, inventory_item_id, quantity, is_replacement)`)
                .order('name');
            
            if (groupsError) {
                console.error('❌ Error fetching optiongroups:', groupsError);
                return;
            }
            console.log('📋 Total groups in DB:', groups?.length);
            console.log('📋 All groups:', groups?.map(g => ({id: g.id, name: g.name, menu_item_id: g.menu_item_id, optionvalues: g.optionvalues?.length})));

            // Filter in memory to handle the OR condition effectively without complex RLS/query logic issues
            const relevantGroups = groups?.filter(g => g.menu_item_id === item?.id || linkedGroupIds.has(g.id)) || [];
            console.log('🎯 Relevant groups after filter:', relevantGroups.length, relevantGroups.map(g => ({id: g.id, name: g.name, menu_item_id: g.menu_item_id})));

            setAllGroups(relevantGroups.map(g => ({ ...g, optionvalues: g.optionvalues?.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)) || [] })));

            // Allow selecting them all effectively since we are in "Private Mode" mostly
            if (item?.id) {
                // If it's a private group, it should be treated as selected
                const combined = new Set([...linkedGroupIds, ...relevantGroups.filter(g => g.menu_item_id === item.id).map(g => g.id)]);
                console.log('✅ Setting selectedGroupIds to:', [...combined]);
                setSelectedGroupIds(combined);
            }
        } catch (e) {
            console.error('❌ fetchModifiers error:', e);
        }
    };

    const fetchComponents = async (menuItemId, inventoryData = []) => {
        if (!menuItemId) { setComponents([]); return; }
        setComponentsLoading(true);
        setComponentsError('');
        try {
            const { data: recipeRows } = await supabase.from('recipes').select('id').eq('menu_item_id', menuItemId);
            const recipeIds = (recipeRows || []).map(r => r.id).filter(Boolean);
            if (!recipeIds.length) { setComponents([]); setHasRecipe(false); setComponentsLoading(false); return; }
            const activeRecipeId = Math.max(...recipeIds);
            setSelectedRecipeId(activeRecipeId);
            setHasRecipe(true);
            // Include cost_per_unit from recipe_ingredients
            const { data: ingredients } = await supabase.from('recipe_ingredients').select('id, recipe_id, inventory_item_id, quantity_used, unit_of_measure, cost_per_unit').eq('recipe_id', activeRecipeId);

            // Build a map from the passed inventory data for name lookups
            const invMap = (inventoryData || []).reduce((acc, it) => {
                acc[String(it.id)] = { ...it, price: it.cost_per_unit ? Number(it.cost_per_unit) : (it.price ? Number(it.price) : null) };
                return acc;
            }, {});

            setComponents((ingredients || []).map(row => {
                const inv = invMap[String(row.inventory_item_id)] || {};
                const qty = row.quantity_used ? Number(row.quantity_used) : 0;
                const price = row.cost_per_unit ? Number(row.cost_per_unit) : (inv.price || null);
                return {
                    id: row.id,
                    inventory_item_id: row.inventory_item_id,
                    name: inv.name || 'רכיב לא ידוע',
                    quantity: qty,
                    unit: row.unit_of_measure || inv.unit || 'kg',
                    price: price,
                    subtotal: (price && qty) ? price * qty : null
                };
            }));
        } catch (e) { console.error(e); setComponentsError('שגיאה בטעינת רכיבים'); }
        finally { setLoading(false); }
    };

    const fetchInventoryOptions = async () => {
        try {
            // Use cost_per_unit instead of price
            let { data, error } = await supabase.from('inventory_items').select('id, name, unit, cost_per_unit, quantity_step').order('name');
            console.log('📦 Inventory fetched:', data?.length, 'items', error ? `Error: ${error.message}` : '');
            // Debug: show some cost_per_unit values
            const withCosts = (data || []).filter(i => i.cost_per_unit && i.cost_per_unit > 0);
            console.log('📦 Items with cost_per_unit > 0:', withCosts.length, withCosts.slice(0, 3).map(i => ({ id: i.id, name: i.name, cost: i.cost_per_per_unit })));
            // Map cost_per_unit to price for consistency in component
            const mappedData = (data || []).map(item => ({ ...item, price: item.cost_per_unit }));
            setInventoryOptions(mappedData);
            return mappedData;
        } catch (e) {
            console.error('fetchInventoryOptions error:', e);
            return [];
        }
    };
    const fetchAllOptionNames = async () => { const { data } = await supabase.from('optionvalues').select('value_name'); if (data) setAllOptionNames([...new Set(data.map(d => d.value_name))].sort()); };

    const fetchKitchenLogic = async () => {
        if (!item?.id) return;
        try {
            const { data } = await supabase.from('recurring_tasks')
                .select('weekly_schedule, logic_type')
                .eq('menu_item_id', item.id)
                .maybeSingle();

            if (data && data.weekly_schedule) {
                setTaskSchedule(data.weekly_schedule || {});
            } else {
                setTaskSchedule({});
            }
        } catch (e) {
            console.error('Fetch kitchen logic error:', e);
        }
    };

    const fetchUniqueModifiers = async () => {
        // Fetch all distinct value_names from the system to serve as a library
        const { data } = await supabase.from('optionvalues').select('value_name');
        if (data) {
            // Count frequency just for sorting/interest? Or just unique list.
            // Let's just get unique names sorted.
            const unique = [...new Set(data.map(d => d.value_name).filter(Boolean))].sort();
            setUniqueModifiers(unique);
        }
    };

    const sortedGroups = useMemo(() => [...allGroups].sort((a, b) => { const aSel = selectedGroupIds.has(a.id); const bSel = selectedGroupIds.has(b.id); return aSel === bSel ? 0 : aSel ? -1 : 1; }), [allGroups, selectedGroupIds]);
    const handleModifierToggle = (groupId) => {
        // In "Private Group" mode, toggling off usually means deleting the group if it's private.
        // But for now, we'll keep the UI behavior of just hiding it or unlinking.
        // However, user requested "If deleting the group... delete from DB".
        // So we will implement a specific DELETE button on the group card instead of just valid toggle.
        const next = new Set(selectedGroupIds);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        setSelectedGroupIds(next);
    };

    const handleCreatePrivateGroup = async () => {
        const name = newGroupName.trim();
        if (!name) return;

        try {
            // Create PRIVATE group (linked to menu_item_id)
            const { data } = await supabase.from('optiongroups').insert({
                name,
                menu_item_id: item.id, // Private link
                is_food: true, // Default
                is_drink: false
            }).select().single();

            // Also link in junction table for compatibility if needed, but the fetch logic handles menu_item_id
            if (data) {
                await supabase.from('menuitemoptions').insert({ item_id: item.id, group_id: data.id });
                resetGroupCreation();
                fetchModifiers();
            }
        } catch (e) { alert('שגיאה ביצירת קבוצה'); console.error(e); }
    };

    const handleDeleteGroup = async (group) => {
        // Confirm handled by UI
        try {
            // Strict delete from DB
            const { error } = await supabase.from('optiongroups').delete().eq('id', group.id);
            if (error) {
                alert('שגיאה במחיקת הקבוצה: ' + error.message);
                return;
            }
            // Junction table cleans up via cascade usually, or we let it be
            setGroupDeleteCandidateId(null);
            fetchModifiers();
        } catch (e) {
            console.error(e);
            alert('שגיאה בלתי צפויה');
        }
    };

    const handleUpdateOption = async (optionId, updates) => {
        // Local state update only
        setAllGroups(prev => prev.map(group => ({
            ...group,
            optionvalues: group.optionvalues?.map(ov =>
                ov.id === optionId ? { ...ov, ...updates } : ov
            ) || []
        })));
    };

    // --- PICKER LOGIC ---
    const openPickerForGroup = (groupId) => {
        setPickerMode('add_to_group');
        setPickerTargetGroupId(groupId);

        // Pre-select existing modifiers in this group
        const group = allGroups.find(g => g.id === groupId);
        const existingNames = group?.optionvalues?.map(ov => ov.value_name) || [];
        setPickerSelectedNames(new Set(existingNames));

        setPickerSearch('');
        setActiveView('picker');
    };

    const openPickerForNewGroup = () => {
        setPickerMode('create_group');
        setPickerTargetGroupId(null);
        setPickerGroupName('');
        setPickerSelectedNames(new Set());
        setPickerSearch('');
        setActiveView('picker');
    };

    const handlePickerToggle = (name) => {
        const next = new Set(pickerSelectedNames);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setPickerSelectedNames(next);
    };

    const handlePickerSave = async () => {
        try {
            if (pickerMode === 'add_to_group' && pickerTargetGroupId) {
                // Sync logic: Fetch current options to diff correctly (prevent duplicates/price reset)
                const { data: currentOps } = await supabase.from('optionvalues').select('value_name').eq('group_id', pickerTargetGroupId);
                const currentNames = new Set(currentOps?.map(o => o.value_name) || []);
                const selectedNames = pickerSelectedNames;

                // Identify Additions (New items)
                const toAdd = Array.from(selectedNames).filter(n => !currentNames.has(n));
                // Identify Removals (Unselected items)
                const toRemove = Array.from(currentNames).filter(n => !selectedNames.has(n));

                if (toAdd.length > 0) {
                    await supabase.from('optionvalues').insert(toAdd.map(name => ({
                        group_id: pickerTargetGroupId,
                        value_name: name,
                        price_adjustment: 0,
                        is_default: false
                    })));
                }

                if (toRemove.length > 0) {
                    await supabase.from('optionvalues').delete()
                        .eq('group_id', pickerTargetGroupId)
                        .in('value_name', toRemove);
                }
            } else if (pickerMode === 'create_group') {
                const groupName = pickerGroupName.trim() || 'קבוצה חדשה';
                // 1. Create Group
                const { data: group } = await supabase.from('optiongroups').insert({
                    name: groupName,
                    menu_item_id: item.id,
                    is_food: true, // Default
                    is_drink: false
                }).select().single();

                if (group) {
                    // 2. Add Options
                    const inserts = Array.from(pickerSelectedNames).map(name => ({
                        group_id: group.id,
                        value_name: name,
                        price_adjustment: 0,
                        is_default: false
                    }));
                    if (inserts.length > 0) {
                        await supabase.from('optionvalues').insert(inserts);
                    }
                    // 3. Select the new group
                    setSelectedGroupIds(prev => new Set(prev).add(group.id));
                }
            }

            fetchModifiers();
            setActiveView('main'); // Return to main view (or modifiers list if we prefer)
        } catch (e) {
            console.error(e);
            if (e.code === '23505') { // Postgres unique violation code
                alert('שגיאה: שם הקבוצה כבר קיים במערכת (אולי במנה אחרת). אנא בחר שם ייחודי.');
            } else {
                alert('שגיאה בשמירת התוספות: ' + (e.message || 'נסה שוב'));
            }
        }
    };



    const saveKitchenLogicToDB = async () => {
        if (!item?.id) return;
        const savedId = item.id;
        try {
            const hasSchedule = Object.values(taskSchedule).some(v => v.qty > 0 || v.mode === 'par_level');
            const { data: existingTask } = await supabase.from('recurring_tasks')
                .select('id')
                .eq('menu_item_id', savedId)
                .maybeSingle();

            if (hasSchedule) {
                const payload = {
                    name: formData.name || 'משימה אוטומטית',
                    menu_item_id: savedId,
                    category: 'prep',
                    frequency: 'Weekly',
                    weekly_schedule: taskSchedule,
                    is_active: true
                };

                if (existingTask) {
                    await supabase.from('recurring_tasks').update(payload).eq('id', existingTask.id);
                } else {
                    await supabase.from('recurring_tasks').insert(payload);
                }
            } else if (existingTask) {
                await supabase.from('recurring_tasks').update({ is_active: false }).eq('id', existingTask.id);
            }
        } catch (e) { console.error('Auto-save kitchen logic failed', e); }
    };

    // --- ACCORDION & SCROLL LOGIC ---
    const toggleSection = (section) => {
        // Auto-save logic when closing Kitchen Logic
        if (showKitchenLogic && section !== 'kitchenLogic') {
            saveKitchenLogicToDB();
        }

        // Close others and scroll to top with offset
        if (section === 'price') {
            const willOpen = !showPriceSection;
            setShowPriceSection(willOpen);
            if (willOpen) {
                setShowModifiersSection(false);
                setShowComponentsSection(false);
                setShowKitchenLogic(false);
                setTimeout(() => {
                    const el = document.getElementById('price-section');
                    if (el && scrollContainerRef.current) {
                        const top = el.offsetTop - 90;
                        scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
        if (section === 'modifiers') {
            const willOpen = !showModifiersSection;
            setShowModifiersSection(willOpen);
            if (willOpen) {
                setShowPriceSection(false);
                setShowComponentsSection(false);
                setShowKitchenLogic(false);
                setTimeout(() => {
                    const el = document.getElementById('modifiers-section');
                    if (el && scrollContainerRef.current) {
                        const top = el.offsetTop - 90;
                        scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
        if (section === 'components') {
            const willOpen = !showComponentsSection;
            setShowComponentsSection(willOpen);
            if (willOpen) {
                setShowPriceSection(false);
                setShowModifiersSection(false);
                setShowKitchenLogic(false);
                setTimeout(() => {
                    const el = document.getElementById('components-section');
                    if (el && scrollContainerRef.current) {
                        const top = el.offsetTop - 90;
                        scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
        if (section === 'kitchenLogic') {
            const willOpen = !showKitchenLogic;
            setShowKitchenLogic(willOpen);
            if (!willOpen) {
                saveKitchenLogicToDB();
            } else {
                setShowPriceSection(false);
                setShowModifiersSection(false);
                setShowComponentsSection(false);
                setTimeout(() => {
                    const el = document.getElementById('kitchen-logic-section');
                    if (el && scrollContainerRef.current) {
                        const top = el.offsetTop - 90;
                        scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
                    }
                }, 300);
            }
        }
    };

    const handleDeleteItemVerify = async () => {
        if (!pinInput) { alert('נא להזין קוד אישי'); return; }

        try {
            // Verify PIN
            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user?.id).eq('pin_code', pinInput).single();
            if (!profile) { alert('קוד שגוי'); return; }

            // Delete Item
            if (item?.id) {
                await supabase.from('menu_items').delete().eq('id', item.id);
                onSave?.(); // Refresh list
                onClose(); // Close modal
            }
        } catch (e) {
            console.error(e);
            alert('שגיאה במחיקת פריט');
        }
    };

    const resetGroupCreation = () => { setIsCreatingGroup(false); setNewGroupName(''); setGroupSuggestionsOpen(false); };
    const handleAddOptionClick = (groupId) => { setAddingToGroupId(groupId); setNewOptionData({ name: '', price: '0', is_default: false }); setSearchTerm(''); setShowSuggestions(false); setTimeout(() => nameInputRef.current?.focus(), 100); };
    const handleSaveNewOption = () => {
        const name = searchTerm.trim() || newOptionData.name.trim();
        if (!addingToGroupId || !name) return;

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newOpt = {
            id: tempId,
            group_id: addingToGroupId,
            value_name: name,
            price_adjustment: 0,
            is_default: false,
            // Add other fields if necessary
        };

        setAllGroups(prev => prev.map(group => {
            if (group.id !== addingToGroupId) return group;
            return {
                ...group,
                optionvalues: [...(group.optionvalues || []), newOpt]
            };
        }));

        setSearchTerm('');
        setNewOptionData({ name: '', price: '0', is_default: false });
        // Keep input focus
        setTimeout(() => nameInputRef.current?.focus(), 100);
    };
    const handleDeleteOption = (id) => {
        if (!id) return;
        // Local delete only
        setAllGroups(prev => prev.map(group => ({
            ...group,
            optionvalues: group.optionvalues?.filter(ov => ov.id !== id) || []
        })));
        setDeletedOptionIds(prev => { const next = new Set(prev); next.add(id); return next; });
    };

    // Format display - show in grams, no decimals for whole numbers
    const formatQuantityDisplay = (quantity, unit) => {
        if (!quantity && quantity !== 0) return '--';
        const numQ = Number(quantity);
        const u = (unit || '').toLowerCase().trim();

        // Convert KG to grams for display
        if (['kg', 'kilo', 'ק"ג'].includes(u)) {
            const grams = Math.round(numQ * 1000);
            return `${grams} גרם`;
        }

        // Format without unnecessary decimals
        const formatted = Number.isInteger(numQ) ? numQ.toString() : numQ.toFixed(2).replace(/\.?0+$/, '');

        const unitMap = { 'gr': 'גרם', 'g': 'גרם', 'ml': 'מ"ל', 'l': 'ליטר', 'pcs': 'יח׳', 'unit': 'יח׳' };
        return `${formatted} ${unitMap[u] || u}`;
    };

    // Convert to grams for input display
    const getQuantityInGrams = (quantity, unit) => {
        const numQ = Number(quantity) || 0;
        const u = (unit || '').toLowerCase().trim();
        if (['kg', 'kilo', 'ק"ג'].includes(u)) {
            return Math.round(numQ * 1000);
        }
        return Math.round(numQ);
    };

    // Convert from grams back to original unit for storage
    const setQuantityFromGrams = (id, gramsValue, unit) => {
        const u = (unit || '').toLowerCase().trim();
        let newValue = Number(gramsValue);
        if (['kg', 'kilo', 'ק"ג'].includes(u)) {
            newValue = gramsValue / 1000;
        }
        handleComponentChange(id, 'quantity', newValue);
    };



    // Live Update Helper
    const syncComponentToDB = async (comp) => {
        if (!comp.id || comp.isNew) return; // Should not happen with new logic, but safety
        try {
            await supabase.from('recipe_ingredients').update({
                quantity_used: comp.quantity,
                unit_of_measure: comp.unit
            }).eq('id', comp.id);
        } catch (e) { console.error('Sync error:', e); }
    };

    const adjustComponentQuantity = (id, deltaGrams) => {
        setComponents(prev => prev.map(c => {
            if (c.id !== id) return c;
            const u = (c.unit || '').toLowerCase().trim();
            const isKg = ['kg', 'kilo', 'ק"ג'].includes(u);
            const delta = isKg ? deltaGrams / 1000 : deltaGrams;
            const next = Math.max(0, Number(c.quantity || 0) + delta);
            const updated = { ...c, quantity: next, subtotal: (c.price && next) ? Number(c.price) * next : null };
            syncComponentToDB(updated); // Auto-save
            return updated;
        }));
    };

    const handleComponentChange = (id, field, value) => {
        setComponents(prev => prev.map(c => {
            if (c.id !== id) return c;
            const updated = { ...c, [field]: value };
            if (field === 'quantity' || field === 'price') {
                const p = field === 'price' ? Number(value) : Number(c.price);
                const q = field === 'quantity' ? Number(value) : Number(c.quantity);
                updated.subtotal = (p && q) ? p * q : null;
            }
            if (field === 'quantity') syncComponentToDB(updated); // Auto-save
            return updated;
        }));
    };

    const handleAddComponent = async () => {
        const { inventory_item_id, quantity, unit, price } = newIngredient;
        if (!inventory_item_id) return;
        setComponentsLoading(true);

        try {
            // 1. Ensure Recipe Exists
            let recipeId = selectedRecipeId;
            if (!recipeId) {
                const { data: newRecipe } = await supabase.from('recipes').insert({ menu_item_id: item.id, name: item.name }).select().single();
                if (newRecipe) {
                    recipeId = newRecipe.id;
                    setSelectedRecipeId(newRecipe.id);
                    setHasRecipe(true);
                }
            }

            if (!recipeId) throw new Error('Could not create recipe');

            // 2. Insert Ingredient
            const invItem = inventoryOptions.find(i => String(i.id) === String(inventory_item_id));
            const activeUnit = unit || invItem?.unit || 'kg';
            const cleanUnit = (activeUnit || '').toLowerCase().trim();
            const isKg = ['kg', 'kilo', 'ק"ג'].includes(cleanUnit);
            // Input is in grams for Kg items, convert to Kg for storage
            const dbQuantity = (Number(quantity) || 0) / (isKg ? 1000 : 1);

            const { data: newRow } = await supabase.from('recipe_ingredients').insert({
                recipe_id: recipeId,
                inventory_item_id: Number(inventory_item_id),
                quantity_used: dbQuantity,
                unit_of_measure: activeUnit,
                cost_per_unit: invItem?.cost_per_unit || invItem?.price // Capture current cost
            }).select().single();

            if (newRow) {
                // 3. Add to state
                const addedComp = {
                    id: newRow.id,
                    inventory_item_id: newRow.inventory_item_id,
                    name: invItem?.name || 'פריט חדש',
                    quantity: Number(newRow.quantity_used),
                    unit: newRow.unit_of_measure,
                    price: Number(newRow.cost_per_unit),
                    subtotal: (Number(newRow.cost_per_unit) * Number(newRow.quantity_used))
                };
                setComponents(prev => [...prev, addedComp]);
                setNewIngredient({ inventory_item_id: '', quantity: '', unit: '', price: 0 });
                setNewIngredientExpanded(false);
                setExpandedComponentId(addedComp.id); // Open it
            }
        } catch (e) {
            console.error(e);
            alert('שגיאה בהוספת רכיב');
        } finally {
            setComponentsLoading(false);
        }
    };

    const handleDeleteComponent = (id) => {
        // Local delete only (Pending). Actual delete happens on Save.
        setComponents(prev => prev.filter(c => c.id !== id));
        setDeletedComponentIds(prev => { const next = new Set(prev); next.add(id); return next; });
    };

    const saveRecipeData = async (menuItemId) => {
        let activeRecipeId = selectedRecipeId;
        if (!activeRecipeId) {
            const { data: existing } = await supabase.from('recipes').select('id').eq('menu_item_id', menuItemId).maybeSingle();
            if (existing) { activeRecipeId = existing.id; }
            else { const { data } = await supabase.from('recipes').insert({ menu_item_id: menuItemId, name: 'Default' }).select().single(); activeRecipeId = data.id; }
        }
        const idsToDelete = Array.from(deletedComponentIds).filter(id => typeof id === 'number');
        if (idsToDelete.length) await supabase.from('recipe_ingredients').delete().in('id', idsToDelete);

        // Include cost_per_unit in insert and update
        const toInsert = components.filter(c => c.isNew || typeof c.id === 'string').map(c => ({
            recipe_id: activeRecipeId,
            inventory_item_id: c.inventory_item_id,
            quantity_used: c.quantity,
            unit_of_measure: c.unit,
            cost_per_unit: c.price || 0
        }));
        const toUpdate = components.filter(c => !c.isNew && typeof c.id === 'number' && !deletedComponentIds.has(c.id)).map(c => ({
            id: c.id,
            recipe_id: activeRecipeId,
            inventory_item_id: c.inventory_item_id,
            quantity_used: c.quantity,
            unit_of_measure: c.unit,
            cost_per_unit: c.price || 0
        }));

        if (toInsert.length > 0) {
            const { error } = await supabase.from('recipe_ingredients').insert(toInsert);
            if (error) console.error('Insert error:', error);
        }
        if (toUpdate.length) {
            // Bulk update not directly supported easily, iterate (safe for small numbers)
            for (const row of toUpdate) {
                await supabase.from('recipe_ingredients').update(row).eq('id', row.id);
            }
        }
    };

    const saveOptionsData = async (menuItemId) => {
        // 1. Delete options marked for deletion
        const idsToDelete = Array.from(deletedOptionIds).filter(id => typeof id === 'number');
        if (idsToDelete.length) {
            await supabase.from('optionvalues').delete().in('id', idsToDelete);
        }

        // 2. Process all groups and their options
        for (const group of allGroups) {
            // If group is new (temp ID), insert it first
            let currentGroupId = group.id;
            if (typeof group.id === 'string' && group.id.startsWith('temp_')) {
                const { data: newGroup, error: groupError } = await supabase.from('optiongroups').insert({
                    name: group.name,
                    menu_item_id: group.menu_item_id,
                    is_food: group.is_food,
                    is_drink: group.is_drink,
                    min_select: group.min_select,
                    max_select: group.max_select,
                    display_order: group.display_order
                }).select().single();
                if (groupError) { console.error('Error inserting new group:', groupError); continue; }
                currentGroupId = newGroup.id;
            } else {
                // Update existing group properties if needed (e.g., min_select, max_select)
                await supabase.from('optiongroups').update({
                    name: group.name,
                    is_food: group.is_food,
                    is_drink: group.is_drink,
                    min_select: group.min_select,
                    max_select: group.max_select,
                    display_order: group.display_order
                }).eq('id', currentGroupId);
            }

            // Process options within this group
            for (const option of group.optionvalues || []) {
                if (typeof option.id === 'string' && option.id.startsWith('temp_')) {
                    // Insert new option
                    await supabase.from('optionvalues').insert({
                        group_id: currentGroupId,
                        value_name: option.value_name,
                        price_adjustment: Number(option.price_adjustment),
                        is_default: option.is_default,
                        display_order: option.display_order,
                        inventory_item_id: option.inventory_item_id,
                        quantity: option.quantity
                    });
                } else if (!deletedOptionIds.has(option.id)) {
                    // Update existing option (if not marked for deletion)
                    await supabase.from('optionvalues').update({
                        value_name: option.value_name,
                        price_adjustment: Number(option.price_adjustment),
                        is_default: option.is_default,
                        display_order: option.display_order,
                        inventory_item_id: option.inventory_item_id,
                        quantity: option.quantity
                    }).eq('id', option.id);
                }
            }
        }
        // Clear deletedOptionIds after successful save
        setDeletedOptionIds(new Set());
    };

    const handleImageUpload = async (e) => { const file = e.target.files[0]; if (!file) return; try { const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`; await supabase.storage.from('menu-images').upload(fileName, file); const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName); setFormData(prev => ({ ...prev, image_url: data.publicUrl })); } catch (e) { alert('Upload failed'); } };

    const saveInternal = async (silent = false) => {
        console.log('🔄 saveInternal called, silent:', silent, 'formData.price:', formData.price);
        if (!silent) setLoading(true);
        else setIsSaving(true);

        try {
            const payload = {
                name: formData.name,
                price: Number(formData.price),
                description: formData.description || null,
                category: formData.category,
                image_url: formData.image_url || null,
                is_in_stock: formData.is_in_stock,
                allow_notes: formData.allow_notes,
                sale_price: formData.sale_price ? Number(formData.sale_price) : null,
                sale_start_date: formData.sale_start_date || null,
                sale_end_date: formData.sale_end_date || null,
                sale_start_time: formData.sale_start_time || null,
                sale_end_time: formData.sale_end_time || null
            };
            console.log('📤 Saving payload:', payload);
            let savedId = item.id;
            console.log('🆔 Item ID:', savedId);

            if (savedId) {
                console.log('🔄 Updating existing item...');
                const result = await supabase.from('menu_items').update(payload).eq('id', savedId);
                console.log('✅ Update result:', result);
                if (result.error) {
                    console.error('❌ Update error:', result.error);
                    throw result.error;
                }
            } else {
                console.log('➕ Inserting new item...');
                const { data } = await supabase.from('menu_items').insert(payload).select().single();
                savedId = data.id;
                console.log('✅ Insert result, new ID:', savedId);
            }

            // Only update relations if not auto-saving (to avoid race conditions or heavy load)?
            // Actually user expects everything saved. Let's do lightweight update.
            // But deleting/re-inserting options every 2s is bad.
            // Optimization: Only update Menu Item fields on auto-save, unless we track dirty relations.
            // For now, full save to be safe.

            console.log('🗑️ Deleting existing menuitemoptions for item:', savedId);
            const deleteResult = await supabase.from('menuitemoptions').delete().eq('item_id', savedId);
            console.log('✅ Delete result:', deleteResult);

            if (selectedGroupIds.size > 0) {
                const links = Array.from(selectedGroupIds).map(gid => ({ item_id: savedId, group_id: gid }));
                console.log('🔗 Inserting new menuitemoptions:', links);
                const insertResult = await supabase.from('menuitemoptions').insert(links);
                console.log('✅ Insert result:', insertResult);
                if (insertResult.error) {
                    console.error('❌ Insert error:', insertResult.error);
                }
            } else {
                console.log('⚠️ No selected groups to insert');
            }
            await saveRecipeData(savedId);
            await saveOptionsData(savedId);

            // --- NEW: SAVE RECURRING TASK SCHEDULE ---
            const hasSchedule = Object.values(taskSchedule).some(v => v.qty > 0 || v.mode === 'par_level');
            // Check if we already have one
            const { data: existingTask } = await supabase.from('recurring_tasks')
                .select('id')
                .eq('menu_item_id', savedId)
                .maybeSingle();

            if (hasSchedule) {
                const payload = {
                    name: formData.name || 'משימה אוטומטית',
                    menu_item_id: savedId,
                    category: 'prep',
                    frequency: 'Weekly',
                    weekly_schedule: taskSchedule,
                    is_active: true
                };

                if (existingTask) {
                    await supabase.from('recurring_tasks').update(payload).eq('id', existingTask.id);
                } else {
                    await supabase.from('recurring_tasks').insert(payload);
                }
            } else if (existingTask) {
                // If cleared all quantities, maybe deactivate?
                await supabase.from('recurring_tasks').update({ is_active: false }).eq('id', existingTask.id);
            }
            // -----------------------------------------

            setLastSavedTime(new Date());
            setIsDirty(false);

            if (!silent) {
                setSaveBanner({ name: payload.name });
                setTimeout(() => { onSave?.(); onClose(); }, 1000);
            }
        } catch (e) { console.error(e); if (!silent) alert('שגיאה בשמירה'); }
        finally { setLoading(false); setIsSaving(false); }
    };

    const handleSubmit = (e) => { e.preventDefault(); saveInternal(false); };

    const handleUndo = () => {
        if (history.length <= 1) return;
        const prev = history[history.length - 2]; // Get previous state
        setHistory(h => h.slice(0, -1)); // Pop current

        // Restore State
        if (prev.formData) setFormData(prev.formData);
        if (prev.components) setComponents(prev.components);
        if (prev.deletedComponentIds) setDeletedComponentIds(new Set(prev.deletedComponentIds));
        if (prev.allGroups) setAllGroups(prev.allGroups);
        if (prev.deletedOptionIds) setDeletedOptionIds(new Set(prev.deletedOptionIds));

        setIsDirty(true);
    };

    const getModClass = (text) => { if (!text) return ''; const t = String(text).toLowerCase(); if (t.includes('בלי') || t.includes('ללא')) return 'text-red-600'; if (t.includes('תוספת') || t.includes('extra')) return 'text-green-600'; return ''; };
    const filteredSuggestions = allOptionNames.filter(n => n.toLowerCase().includes(searchTerm.toLowerCase()));

    const toggleComponentExpand = (id) => {
        setExpandedComponents(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    return (
        // Wrapper: Covers full screen, but passes clicks through to underlying elements (like the blue nav bar)
        <div className="fixed inset-0 z-40 flex flex-col font-heebo pointer-events-none" dir="rtl">

            {/* 1. Transparent Spacer (60px) - clicks go through to Blue Bar */}
            <div className="h-[60px] shrink-0" />

            {/* 2. Modal Content - Fills remaining space, captures clicks */}
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="flex-1 flex flex-col pointer-events-auto bg-gray-100 shadow-2xl overflow-hidden"
            >
                {/* Header - OPAQUE to cover underlying content */}
                <div className="bg-gray-100 sticky top-0 z-30 transition-all pb-3 pt-2 px-2 shadow-sm border-b border-gray-200/50 shrink-0">
                    <div className="max-w-6xl mx-auto flex items-center gap-2">
                        {/* Back Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (activeView === 'modifiers' || activeView === 'picker') setActiveView('main');
                                else onClose();
                            }}
                            className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            <ArrowRight size={22} strokeWidth={2.5} />
                        </button>

                        {/* Title Section */}
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-black text-gray-800 truncate leading-tight">
                                {activeView === 'modifiers' ? 'בחירת תוספות' : activeView === 'picker' ? 'בחר תוספות' : (item?.id ? 'עריכת מנה' : 'מנה חדשה')}
                            </h2>
                            <p className="text-xs font-bold text-gray-400 truncate">
                                {activeView === 'modifiers' ? 'סמן את התוספות שיוצגו למנה זו' : activeView === 'picker' ? 'בחר תוספות קיימות או צור חדשות' : (item?.name || 'הזן פרטי מנה')}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {activeView === 'modifiers' ? (
                                <div className="flex gap-2 w-full">
                                    <div className="relative flex-1">
                                        <input
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="חיפוש..."
                                            className="w-full pl-3 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><DollarSign size={0} className="hidden" /><ArrowRight size={0} className="hidden" />🔍</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveView('main')}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all text-sm whitespace-nowrap"
                                    >
                                        שמור בחירה
                                    </button>
                                </div>
                            ) : activeView === 'picker' ? (
                                <>
                                    <button onClick={() => setActiveView('main')} className="px-4 py-2 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200">ביטול</button>
                                    <button
                                        onClick={handlePickerSave}
                                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 flex items-center gap-2"
                                        disabled={pickerMode === 'create_group' && !pickerGroupName.trim()}
                                    >
                                        <Check size={18} /> שמור {pickerSelectedNames.size > 0 ? `(${pickerSelectedNames.size})` : ''}
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-2 w-full max-w-[320px]">
                                    {/* Save Indicator (Popup) linked to auto-save */}
                                    {isSaving && (
                                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1 rounded-full shadow-md animate-pulse whitespace-nowrap z-50">
                                            שומר...
                                        </div>
                                    )}

                                    {/* Undo Button */}
                                    <button
                                        type="button"
                                        onClick={handleUndo}
                                        disabled={history.length <= 1}
                                        className="w-10 md:w-12 aspect-square flex items-center justify-center bg-gray-100 text-gray-400 font-bold rounded-2xl hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200"
                                        title="בטל שינוי אחרון"
                                    >
                                        <RotateCcw size={20} />
                                    </button>

                                    {/* Delete Item Button (Only for existing items) */}
                                    {item?.id && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPinModal(true)}
                                            className="w-10 md:w-12 aspect-square flex items-center justify-center bg-red-50 text-red-500 font-bold rounded-2xl hover:bg-red-100 active:scale-95 transition-all border border-red-100"
                                            title="מחק מנה"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}

                                    {/* Save Button */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || !isDirty}
                                        className={`flex-1 px-4 py-3 rounded-2xl font-black shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 ${isDirty ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' : 'bg-gray-100 text-green-600 border border-green-200'
                                            }`}
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : isDirty ? <Save size={20} /> : <Check size={20} />}
                                        <span>{loading ? 'שומר...' : isDirty ? 'שמור' : 'נשמר'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PIN Confirmation Modal */}
                    {showPinModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center gap-4"
                            >
                                <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2">
                                    <Trash2 size={32} />
                                </div>
                                <h3 className="text-xl font-black text-gray-800 text-center">אישור מחיקת מנה</h3>
                                <p className="text-sm text-gray-500 text-center">אנא הזן קוד אישי לאישור המחיקה.<br />פעולה זו אינה הפיכה.</p>

                                <input
                                    type="password"
                                    autoFocus
                                    value={pinInput}
                                    onChange={e => setPinInput(e.target.value)}
                                    placeholder="קוד אישי (PIN)"
                                    className="w-full text-center text-2xl font-black tracking-widest h-14 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-red-400 focus:bg-white transition-all"
                                    maxLength={6}
                                />

                                <div className="flex gap-3 w-full mt-2">
                                    <button onClick={() => { setShowPinModal(false); setPinInput(''); }} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">ביטול</button>
                                    <button
                                        onClick={handleDeleteItemVerify}
                                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200"
                                        disabled={!pinInput}
                                    >
                                        מחק
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
                    {activeView === 'main' ? (
                        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4 space-y-4 pb-24">

                            {/* 1. Basic Info Card (Image, Stock, Name, Category) - No Price */}
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-2">
                                {/* Top Row: Image + Stock */}
                                <div className="flex items-stretch gap-4 mb-4">
                                    {/* Image Group */}
                                    <div className="flex items-stretch gap-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                                        <div className="w-16 h-16 bg-gray-100 overflow-hidden relative group shrink-0">
                                            {formData.image_url ? (
                                                <img src={formData.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                    <ImageIcon size={20} />
                                                </div>
                                            )}
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} />
                                        </div>
                                        <label className="px-4 flex items-center justify-center bg-gray-50 text-gray-600 font-bold text-xs hover:bg-gray-100 cursor-pointer transition-all border-r border-gray-200">
                                            החלף
                                            <input type="file" className="hidden" onChange={handleImageUpload} />
                                        </label>
                                    </div>

                                    <div className="flex-1" />

                                    {/* Stock Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, is_in_stock: !p.is_in_stock }))}
                                        className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-xs transition-all shrink-0 ${formData.is_in_stock ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-200'}`}
                                    >
                                        <Power size={20} strokeWidth={2.5} />
                                        <span>{formData.is_in_stock ? 'במלאי' : 'חסר'}</span>
                                    </button>
                                </div>

                                {/* Row 2: Name + Category */}
                                <div className="grid grid-cols-2 gap-4 items-start">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1">שם המנה</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full text-lg font-bold px-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all placeholder-gray-300"
                                            placeholder="לדוגמה: קפוצ'ינו..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1">קטגוריה</label>
                                        {isNewCategory ? (
                                            <div className="flex gap-2">
                                                <input autoFocus value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="flex-1 px-4 py-3 bg-white border-2 border-blue-500 rounded-xl font-bold outline-none text-sm" placeholder="שם קטגוריה..." />
                                                <button type="button" onClick={() => setIsNewCategory(false)} className="px-3 bg-gray-100 rounded-xl hover:bg-gray-200"><X size={18} /></button>
                                            </div>
                                        ) : (
                                            <select
                                                value={formData.category}
                                                onChange={(e) => e.target.value === '__NEW__' ? setIsNewCategory(true) : setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 text-sm appearance-none"
                                            >
                                                <option value="">בחר...</option>
                                                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                <option value="__NEW__" className="font-black text-blue-600">+ קטגוריה חדשה</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Price & Sales Card (Collapsible) - Combined */}
                            {(() => {
                                const salePriceNum = Number(formData.sale_price || 0);
                                const regularPriceNum = Number(formData.price || 0);
                                const isSaleActive = salePriceNum > 0 && salePriceNum < regularPriceNum;

                                // Check start date (logic preserved)
                                let saleStartLabel = '';
                                if (formData.sale_start_date) {
                                    const startDate = new Date(formData.sale_start_date + (formData.sale_start_time ? `T${formData.sale_start_time}` : 'T00:00'));
                                    const now = new Date();
                                    if (startDate > now) {
                                        const diffMs = startDate - now;
                                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                        const diffDays = Math.floor(diffHours / 24);
                                        if (diffDays > 0) saleStartLabel = `מתחיל בעוד ${diffDays} ימים`;
                                        else if (diffHours > 0) saleStartLabel = `מתחיל בעוד ${diffHours} שעות`;
                                        else saleStartLabel = 'מתחיל בקרוב';
                                    }
                                }

                                return (
                                    <div
                                        id="price-section"
                                        className={`bg-white rounded-2xl border transition-all duration-300 ${showPriceSection ? 'border-blue-300 shadow-md ring-1 ring-blue-100' : 'border-gray-200 shadow-sm'} overflow-hidden relative`}
                                    >
                                        {/* Header - Collapsible */}
                                        <div
                                            onClick={() => toggleSection('price')}
                                            className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${showPriceSection ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-4 overflow-hidden flex-1">
                                                <div className="w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 bg-green-100 text-green-600">
                                                    <DollarSign size={24} strokeWidth={1.5} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <h3 className="font-black text-gray-800 text-base truncate leading-tight">מחיר ומבצעים</h3>
                                                    {!showPriceSection && (
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {isSaleActive ? (
                                                                <>
                                                                    <span className="text-xs font-bold text-red-500">מבצע פעיל: ₪{formData.sale_price}</span>
                                                                    <span className="text-[10px] text-gray-400 font-bold line-through">₪{formData.price}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs font-bold text-gray-500">הגדרת מחיר, הנחות ותוקף</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pl-1">
                                                {!showPriceSection && (
                                                    <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] bg-gray-50 border-gray-100 text-gray-700">
                                                        <span className="text-[9px] font-bold text-gray-400 leading-none mb-0.5 uppercase tracking-wide">מחיר</span>
                                                        <span className="font-black text-lg leading-none">₪{formData.price || 0}</span>
                                                    </div>
                                                )}
                                                <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${showPriceSection ? 'rotate-180 bg-gray-100' : ''}`}>
                                                    <ChevronDown size={20} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        <AnimatedSection show={showPriceSection}>
                                            <div className="border-t border-gray-100 p-4 bg-white space-y-2">

                                                {/* Part 1: Regular Price */}
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <button type="button" onClick={() => setFormData(p => ({ ...p, price: Math.max(0, (Number(p.price || 0) || 0) - 1), sale_price: '', sale_start_date: '', sale_end_date: '' }))} className="h-12 w-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all">
                                                            <span className="text-xl font-bold">-</span>
                                                        </button>
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="number"
                                                                value={formData.price}
                                                                onChange={e => setFormData({ ...formData, price: e.target.value, sale_price: '', sale_start_date: '', sale_end_date: '' })}
                                                                className="w-full h-12 text-center font-black text-2xl bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all z-10 relative"
                                                                placeholder="0"
                                                            />
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold z-20">₪</span>
                                                        </div>
                                                        <button type="button" onClick={() => setFormData(p => ({ ...p, price: (Number(p.price || 0) || 0) + 1, sale_price: '', sale_start_date: '', sale_end_date: '' }))} className="h-12 w-12 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-green-600 hover:bg-green-50 hover:border-green-200 active:scale-95 transition-all">
                                                            <span className="text-xl font-bold">+</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-gray-100 w-full"></div>

                                                {/* Part 2: Sale Section */}
                                                <div>
                                                    {/* Sale Price Input */}
                                                    {(() => {
                                                        const isSaleModified = formData.sale_price !== undefined && Number(formData.sale_price) < Number(formData.price) && Number(formData.sale_price) > 0;
                                                        return (
                                                            <div className={`p-4 rounded-xl transition-colors ${isSaleModified ? 'bg-red-50 border border-red-100' : 'bg-gray-50/50 border border-transparent'}`}>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-sm font-black flex items-center gap-1.5 ${isSaleModified ? 'text-red-800' : 'text-gray-500'}`}>
                                                                            מחיר מבצע
                                                                        </span>
                                                                        <span className="text-[11px] text-gray-400 font-bold">המחיר שיוצג ללקוח</span>
                                                                    </div>
                                                                    {isSaleModified && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">פעיל</span>}
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <button type="button" onClick={() => {
                                                                        const current = formData.sale_price ? Number(formData.sale_price) : Number(formData.price);
                                                                        setFormData(p => ({ ...p, sale_price: Math.max(0, current - 1) }));
                                                                    }} className={`h-12 w-12 flex items-center justify-center bg-white border rounded-xl shadow-sm active:scale-95 transition-all ${isSaleModified ? 'border-red-200 text-red-500' : 'border-gray-200 text-gray-300'}`}>
                                                                        <span className="text-xl font-bold">-</span>
                                                                    </button>
                                                                    <div className="flex-1 relative">
                                                                        <input
                                                                            type="number"
                                                                            value={formData.sale_price || ''}
                                                                            onChange={e => setFormData({ ...formData, sale_price: e.target.value })}
                                                                            className={`w-full h-12 text-center font-black text-2xl bg-white border rounded-xl outline-none transition-all ${isSaleModified ? 'border-red-200 text-red-600' : 'border-gray-200 focus:border-blue-300'}`}
                                                                            placeholder={formData.price}
                                                                        />
                                                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold ${isSaleModified ? 'text-red-300' : 'text-gray-300'}`}>₪</span>
                                                                    </div>
                                                                    <button type="button" onClick={() => {
                                                                        const current = formData.sale_price ? Number(formData.sale_price) : Number(formData.price);
                                                                        setFormData(p => ({ ...p, sale_price: current + 1 }));
                                                                    }} className="h-12 w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-green-600 active:scale-95 transition-all shadow-sm">
                                                                        <span className="text-xl font-bold">+</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Date Logic (Preserved) */}
                                                    {(() => {
                                                        const hasDateSet = formData.sale_start_date || formData.sale_end_date;
                                                        const formatDate = (dateStr) => {
                                                            if (!dateStr) return '';
                                                            const d = new Date(dateStr);
                                                            return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' });
                                                        };

                                                        return (
                                                            <div className="mt-2">
                                                                {hasDateSet && !showSaleDates ? (
                                                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                                                                        <div className="text-sm font-bold text-amber-800">
                                                                            {formatDate(formData.sale_start_date)} {formData.sale_start_time} - {formatDate(formData.sale_end_date)} {formData.sale_end_time}
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button type="button" onClick={() => setShowSaleDates(true)} className="text-xs font-bold text-amber-600 hover:text-amber-800 px-2 py-1 hover:bg-amber-100 rounded-lg">ערוך</button>
                                                                            <button type="button" onClick={() => setFormData(p => ({ ...p, sale_price: '', sale_start_date: '', sale_start_time: '', sale_end_date: '', sale_end_time: '' }))} className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg">בטל מבצע</button>
                                                                        </div>
                                                                    </div>
                                                                ) : !showSaleDates ? (
                                                                    <button type="button" onClick={() => setShowSaleDates(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 transition-all text-xs">
                                                                        + הגדר תאריכי תוקף למבצע
                                                                    </button>
                                                                ) : (
                                                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 animate-in slide-in-from-top-2">
                                                                        <div className="text-xs font-bold text-gray-500 mb-3">תקופת המבצע</div>
                                                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                                                            <div>
                                                                                <div className="text-[10px] font-bold text-gray-400 mb-2">התחלה</div>
                                                                                <input type="date" value={formData.sale_start_date || ''} min={new Date().toLocaleDateString('en-CA')} onChange={e => setFormData({ ...formData, sale_start_date: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none mb-2" />
                                                                                <select value={formData.sale_start_time || ''} onChange={e => setFormData({ ...formData, sale_start_time: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none">
                                                                                    <option value="">שעה...</option>
                                                                                    {[...Array(24)].map((_, h) => <option key={h} value={`${String(h).padStart(2, '0')}:00`}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] font-bold text-gray-400 mb-2">סיום</div>
                                                                                <input type="date" value={formData.sale_end_date || ''} min={formData.sale_start_date} onChange={e => setFormData({ ...formData, sale_end_date: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none mb-2" />
                                                                                <select value={formData.sale_end_time || ''} onChange={e => setFormData({ ...formData, sale_end_time: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none">
                                                                                    <option value="">שעה...</option>
                                                                                    {[...Array(24)].map((_, h) => <option key={h} value={`${String(h).padStart(2, '0')}:00`}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button type="button" onClick={() => setShowSaleDates(false)} className="flex-1 py-2 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700">שמור תאריכים</button>
                                                                            <button type="button" onClick={() => { setShowSaleDates(false); setFormData(p => ({ ...p, sale_start_date: '', sale_end_date: '' })); }} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-xl">ביטול</button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </AnimatedSection>
                                    </div>
                                );
                            })()}

                            {/* Modifiers Section - Expandable Card Design like InventoryItemCard */}
                            <div
                                className={`bg-white rounded-2xl border transition-all duration-300 ${showModifiersSection ? 'border-blue-300 shadow-md ring-1 ring-blue-100 mb-8' : 'border-gray-200 shadow-sm'} overflow-hidden`}
                                id="modifiers-section"
                            >
                                {/* Header - Always Visible */}
                                <div
                                    onClick={() => toggleSection('modifiers')}
                                    className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${showModifiersSection ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-4 overflow-hidden flex-1">
                                        <div className="w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 bg-blue-100 text-blue-600">
                                            <GripHorizontal size={24} strokeWidth={1.5} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <h3 className="font-black text-gray-800 text-base truncate leading-tight">תוספות ושדרוגים</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-bold text-gray-500">ניהול אפשרויות ללקוח</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pl-1">
                                        {!showModifiersSection && selectedGroupIds.size > 0 && (
                                            <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] bg-blue-50 border-blue-100 text-blue-600">
                                                <span className="text-[9px] font-bold text-blue-400 leading-none mb-0.5">קבוצות</span>
                                                <span className="font-black text-lg leading-none">{selectedGroupIds.size}</span>
                                            </div>
                                        )}
                                        <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${showModifiersSection ? 'rotate-180 bg-gray-100' : ''}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatedSection show={showModifiersSection}>
                                    <div className="border-t border-gray-100 p-4 bg-white space-y-4">
                                        {/* Debug Info */}
                                        {process.env.NODE_ENV === 'development' && (
                                            <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg mb-2">
                                                Debug: allGroups={allGroups.length}, selectedGroupIds={selectedGroupIds.size}, sortedGroups={sortedGroups.length}
                                            </div>
                                        )}
                                        
                                        <label onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, allow_notes: !p.allow_notes })); }} className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.allow_notes ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                                                {formData.allow_notes && <Check size={16} strokeWidth={3} />}
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm text-slate-800 block">אפשר הערות חופשיות</span>
                                                <span className="text-xs text-gray-400">לקוחות יוכלו לכתוב בקשות מיוחדות</span>
                                            </div>
                                        </label>

                                        {/* Empty State for No Groups */}
                                        {sortedGroups.filter(g => selectedGroupIds.has(g.id)).length === 0 && (
                                            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                <p className="font-bold mb-1">אין תוספות מוגדרות</p>
                                                <p className="text-sm">לחץ על הכפתור למטה להוספת תוספות חדשות</p>
                                            </div>
                                        )}

                                        {sortedGroups.filter(g => selectedGroupIds.has(g.id)).map(group => (
                                            <div key={group.id} className="border border-blue-100 rounded-2xl bg-white overflow-hidden">
                                                <div className="flex items-center justify-between p-4 bg-blue-50/40 border-b border-blue-100">
                                                    <span className="font-black text-slate-700">{group.name}</span>
                                                    <div className="flex gap-2">
                                                        {group.menu_item_id && groupDeleteCandidateId === group.id ? (
                                                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow border border-red-100">
                                                                <span className="text-xs text-red-500 font-bold px-1">למחוק?</span>
                                                                <button type="button" onClick={() => handleDeleteGroup(group)} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600"><Check size={14} /></button>
                                                                <button type="button" onClick={() => setGroupDeleteCandidateId(null)} className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (group.menu_item_id) setGroupDeleteCandidateId(group.id);
                                                                    else handleModifierToggle(group.id);
                                                                }}
                                                                className="p-2 bg-white text-red-500 rounded-xl shadow-sm border border-red-100 hover:bg-red-50"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2 p-3">


                                                    {group.optionvalues?.map(ov => {
                                                        const isExpanded = expandedOptionId === ov.id;
                                                        return (
                                                            <div key={ov.id} className={`bg-gray-50 border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-teal-200 shadow-md bg-white' : 'border-gray-100 hover:border-teal-100'}`}>
                                                                {/* Header (Closed) */}
                                                                <div
                                                                    onClick={() => setExpandedOptionId(isExpanded ? null : ov.id)}
                                                                    className="p-3 flex items-center justify-between cursor-pointer select-none"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="font-bold text-gray-800">{ov.value_name}</div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-sm font-bold text-teal-700">
                                                                            {ov.price_adjustment ? `+₪${Number(ov.price_adjustment).toFixed(2)}` : '--'}
                                                                        </div>
                                                                        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                    </div>
                                                                </div>

                                                                {/* Expanded Body */}
                                                                {isExpanded && (
                                                                    <div className="border-t border-gray-100 p-4 bg-white animate-in slide-in-from-top-2">
                                                                        <div className="flex flex-col sm:flex-row items-start gap-6">
                                                                            {/* Left Column: Stacked Pickers */}
                                                                            <div className="flex flex-col gap-4 flex-1">
                                                                                {/* Price Picker Row */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <span className="text-sm font-bold text-gray-500 w-20 shrink-0">תוספת מחיר</span>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleUpdateOption(ov.id, { price_adjustment: Math.max(0, (Number(ov.price_adjustment) || 0) - 1) })}
                                                                                            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 flex items-center justify-center transition-colors"
                                                                                        >
                                                                                            <Minus size={16} strokeWidth={2.5} />
                                                                                        </button>
                                                                                        <div className="w-14 h-10 flex items-center justify-center font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-xl">
                                                                                            <input
                                                                                                type="number"
                                                                                                value={ov.price_adjustment || ''}
                                                                                                onChange={(e) => handleUpdateOption(ov.id, { price_adjustment: e.target.value })}
                                                                                                className="w-full h-full text-center outline-none bg-transparent text-base font-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                                placeholder="0"
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleUpdateOption(ov.id, { price_adjustment: (Number(ov.price_adjustment) || 0) + 1 })}
                                                                                            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 flex items-center justify-center transition-colors"
                                                                                        >
                                                                                            <Plus size={16} strokeWidth={2.5} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Weight Picker Row */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <span className="text-sm font-bold text-gray-500 w-20 shrink-0">משקל (גרם)</span>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleUpdateOption(ov.id, { quantity: Math.max(0, (Number(ov.quantity) || 0) - 10) })}
                                                                                            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 flex items-center justify-center transition-colors"
                                                                                        >
                                                                                            <Minus size={16} strokeWidth={2.5} />
                                                                                        </button>
                                                                                        <div className="w-14 h-10 flex items-center justify-center font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-xl">
                                                                                            <input
                                                                                                type="number"
                                                                                                value={ov.quantity || ''}
                                                                                                onChange={(e) => handleUpdateOption(ov.id, { quantity: e.target.value })}
                                                                                                className="w-full h-full text-center outline-none bg-transparent text-base font-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                                placeholder="0"
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleUpdateOption(ov.id, { quantity: (Number(ov.quantity) || 0) + 10 })}
                                                                                            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 flex items-center justify-center transition-colors"
                                                                                        >
                                                                                            <Plus size={16} strokeWidth={2.5} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Right Column: Logic & Actions */}
                                                                            <div className="flex flex-col gap-3 shrink-0 items-end">
                                                                                {/* Row with Cost + Replacement */}
                                                                                <div className="flex items-stretch gap-2 w-full">
                                                                                    {/* Cost Display Box */}
                                                                                    {(() => {
                                                                                        const invItem = inventoryOptions.find(i => String(i.id) === String(ov.inventory_item_id));
                                                                                        const cost = invItem && ov.quantity ? ((Number(ov.quantity) / 1000) * Number(invItem.cost_per_unit || 0)).toFixed(2) : null;
                                                                                        return (
                                                                                            <div className={`rounded-xl px-3 py-2 text-center shrink-0 ${cost ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                                                                                                <div className={`text-[10px] font-bold ${cost ? 'text-amber-600' : 'text-gray-400'}`}>עלות</div>
                                                                                                <div className={`text-sm font-black ${cost ? 'text-amber-700' : 'text-gray-400'}`}>{cost ? `₪${cost}` : '--'}</div>
                                                                                            </div>
                                                                                        );
                                                                                    })()}

                                                                                    {/* Replacement Checkbox - Original Design */}
                                                                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all flex-1 ${ov.is_replacement ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100 hover:bg-white'}`}>
                                                                                        <div className="relative flex items-center mt-0.5">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={ov.is_replacement || false}
                                                                                                onChange={(e) => handleUpdateOption(ov.id, { is_replacement: e.target.checked })}
                                                                                                className="peer w-4 h-4 accent-teal-600 rounded bg-white border-gray-300"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex flex-col">
                                                                                            <span className={`text-xs font-bold ${ov.is_replacement ? 'text-teal-700' : 'text-gray-700'}`}>מחליף פריט במתכון?</span>
                                                                                            <span className="text-[10px] text-gray-400 max-w-[140px] leading-tight mt-0.5">
                                                                                                {ov.is_replacement ? 'יורד ממלאי של התוספות במקום מהרכיב הראשי' : 'יורד בנוסף למרכיבים הרגילים'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </label>
                                                                                </div>

                                                                                {/* Delete Button - Full Width */}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDeleteOption(ov.id)}
                                                                                    className="flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 py-3 rounded-xl text-sm font-bold transition-colors w-full"
                                                                                >
                                                                                    <Trash2 size={16} /> מחק תוספת
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {(!group.optionvalues || group.optionvalues.length === 0) && (
                                                        <div className="text-center text-gray-400 italic text-xs py-4">
                                                            אין אפשרויות בקבוצה זו
                                                        </div>
                                                    )}

                                                    {/* Add Button Inside Group */}
                                                    <button
                                                        type="button"
                                                        onClick={() => openPickerForGroup(group.id)}
                                                        className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold border border-blue-100 border-dashed flex items-center justify-center gap-1 transition-colors mt-2"
                                                    >
                                                        <Plus size={14} /> הוסף תוספת
                                                    </button>
                                                </div>
                                            </div>
                                        ))}


                                        <div className="pt-2">
                                            <button
                                                type="button"
                                                onClick={openPickerForNewGroup}
                                                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
                                            >
                                                <PlusCircle size={20} /> צור רשימת תוספות חדשה
                                            </button>
                                        </div>
                                    </div>
                                </AnimatedSection>
                            </div>

                            {/* Stock & Recipe Section - Expandable Card Design like InventoryItemCard */}
                            <div
                                className={`bg-white rounded-2xl border transition-all duration-300 ${showComponentsSection ? 'border-teal-300 shadow-lg ring-1 ring-teal-100 mb-8' : 'border-gray-200 shadow-sm'} overflow-hidden`}
                                id="components-section"
                            >
                                {/* Header - Always Visible */}
                                <div
                                    onClick={() => toggleSection('components')}
                                    className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${showComponentsSection ? 'bg-teal-50/30' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-4 overflow-hidden flex-1">
                                        <div className="w-12 h-12 flex items-center justify-center rounded-2xl shrink-0 bg-teal-100 text-teal-600">
                                            <CheckCircle size={24} strokeWidth={1.5} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <h3 className="font-black text-gray-800 text-base truncate leading-tight">ניהול מלאי ומתכון</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-bold text-gray-500">רכיבי המנה ועלויות</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pl-1">
                                        {!showComponentsSection && components.filter(c => !deletedComponentIds.has(c.id)).length > 0 && (
                                            <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border min-w-[3.5rem] bg-teal-50 border-teal-100 text-teal-600">
                                                <span className="text-[9px] font-bold text-teal-400 leading-none mb-0.5">רכיבים</span>
                                                <span className="font-black text-lg leading-none">{components.filter(c => !deletedComponentIds.has(c.id)).length}</span>
                                            </div>
                                        )}
                                        <div className={`p-1 rounded-full text-gray-400 transition-transform duration-300 ${showComponentsSection ? 'rotate-180 bg-gray-100' : ''}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatedSection show={showComponentsSection}>
                                    <div className="border-t border-gray-100 p-4 bg-white">
                                        <div className="space-y-3 mb-6">
                                            {components.map(comp => {
                                                if (deletedComponentIds.has(comp.id)) return null;
                                                const isExpanded = expandedComponentId === comp.id;
                                                const isKg = ['kg', 'kilo', 'ק"ג'].includes((comp.unit || '').toLowerCase().trim());
                                                const gramsValue = getQuantityInGrams(comp.quantity, comp.unit);

                                                // Dynamic Step Logic
                                                const invItem = inventoryOptions.find(i => String(i.id) === String(comp.inventory_item_id));
                                                let step = 1;
                                                if (invItem?.quantity_step) {
                                                    step = Number(invItem.quantity_step);
                                                } else {
                                                    step = isKg ? 10 : 1;
                                                }

                                                return (
                                                    <div key={comp.id} className={`bg-gray-50 border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-teal-200 shadow-md bg-white' : 'border-gray-100 hover:border-teal-100'}`}>
                                                        {/* Header (Closed) */}
                                                        <div
                                                            onClick={() => setExpandedComponentId(isExpanded ? null : comp.id)}
                                                            className="p-3 flex items-center justify-between cursor-pointer select-none"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="font-bold text-gray-800">{comp.name}</div>
                                                                <div className="bg-white border border-gray-200 px-2 py-0.5 rounded-lg text-xs font-bold text-gray-500 min-w-[60px] text-center">
                                                                    {formatQuantityDisplay(comp.quantity, comp.unit)}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-sm font-bold text-teal-700">
                                                                    {comp.price ? (comp.subtotal ? `₪${comp.subtotal.toFixed(2)}` : '₪0.00') : '--'}
                                                                </div>
                                                                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                            </div>
                                                        </div>

                                                        {/* Expanded Body (Picker) */}
                                                        {isExpanded && (
                                                            <div className="border-t border-gray-100 p-4 bg-white animate-in slide-in-from-top-2">
                                                                <div className="flex items-center justify-between gap-4">
                                                                    {/* Quantity Picker */}
                                                                    {/* Quantity Picker (Detached) */}
                                                                    <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                                                                        <button type="button" onClick={() => adjustComponentQuantity(comp.id, -step)} className="w-12 h-12 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 text-lg flex items-center justify-center transition-colors">
                                                                            <Minus size={18} strokeWidth={2.5} />
                                                                        </button>
                                                                        <div className="flex-1 h-12 flex items-center justify-center font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-xl relative">
                                                                            <input
                                                                                type="number"
                                                                                className="w-full h-full text-center outline-none bg-transparent text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                value={isKg ? gramsValue : comp.quantity}
                                                                                onChange={(e) => isKg ? setQuantityFromGrams(comp.id, e.target.value, comp.unit) : handleComponentChange(comp.id, 'quantity', e.target.value)}
                                                                            />
                                                                            <span className="absolute right-3 text-[10px] font-bold text-gray-400 pointer-events-none">{isKg ? 'גרם' : (comp.unit || 'יח׳')}</span>
                                                                        </div>
                                                                        <button type="button" onClick={() => adjustComponentQuantity(comp.id, step)} className="w-12 h-12 bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 text-lg flex items-center justify-center transition-colors">
                                                                            <Plus size={18} strokeWidth={2.5} />
                                                                        </button>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDeleteComponent(comp.id, e)}
                                                                        className="w-10 h-10 rounded-xl bg-white text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center border border-gray-200 hover:border-red-100 transition-colors shadow-sm"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {components.filter(c => !deletedComponentIds.has(c.id)).length === 0 && (
                                                <div className="text-center text-gray-400 italic text-sm py-4">
                                                    לא הוגדרו רכיבים
                                                </div>
                                            )}
                                        </div>

                                        {/* Summary (Cost & Weight) */}
                                        {components.filter(c => !deletedComponentIds.has(c.id)).length > 0 && (
                                            <div className="bg-teal-50 rounded-2xl p-4 border border-teal-100 flex items-center justify-between text-sm mb-4">
                                                <div className="flex flex-col">
                                                    <span className="text-teal-600/70 text-xs font-bold">סה״כ משקל/כמות</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="font-black text-lg text-teal-800">
                                                            {/* Sum Grams for Kg items */}
                                                            {Math.round(components.reduce((sum, c) => {
                                                                if (deletedComponentIds.has(c.id)) return sum;
                                                                const u = (c.unit || '').toLowerCase();
                                                                if (['kg', 'kilo', 'ק"ג'].includes(u)) return sum + getQuantityInGrams(c.quantity, u);
                                                                return sum;
                                                            }, 0))}
                                                        </span>
                                                        <span className="text-xs font-bold text-teal-600">גרם</span>
                                                        <span className="mx-1 text-teal-300">|</span>
                                                        <span className="font-black text-lg text-teal-800">
                                                            {/* Sum Units for Unit items */}
                                                            {components.reduce((sum, c) => {
                                                                if (deletedComponentIds.has(c.id)) return sum;
                                                                const u = (c.unit || '').toLowerCase();
                                                                if (!['kg', 'kilo', 'ק"ג'].includes(u)) return sum + Number(c.quantity || 0);
                                                                return sum;
                                                            }, 0)}
                                                        </span>
                                                        <span className="text-xs font-bold text-teal-600">יח׳</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-teal-600/70 text-xs font-bold">סה״כ עלות</span>
                                                    <span className="font-black text-2xl text-teal-800 leading-none">
                                                        ₪{components.reduce((sum, c) => !deletedComponentIds.has(c.id) && c.subtotal ? sum + Number(c.subtotal) : sum, 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Add Ingredient Button */}
                                        {!newIngredientExpanded ? (
                                            <button
                                                type="button"
                                                onClick={() => setNewIngredientExpanded(true)}
                                                className="w-full py-4 bg-white border-2 border-dashed border-teal-200 text-teal-600 rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-teal-50 transition-all shadow-sm"
                                            >
                                                <PlusCircle size={20} /> הוסף רכיב למתכון
                                            </button>
                                        ) : (
                                            <div className="bg-white p-4 rounded-2xl border-2 border-teal-500 shadow-xl animate-in zoom-in-95">
                                                <h4 className="font-black text-teal-800 mb-3 text-center">הוספת רכיב חדש</h4>
                                                <div className="space-y-4">
                                                    <select
                                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none text-sm"
                                                        value={newIngredient.inventory_item_id}
                                                        onChange={(e) => {
                                                            const it = inventoryOptions.find(i => String(i.id) === e.target.value);
                                                            setNewIngredient({
                                                                ...newIngredient,
                                                                inventory_item_id: e.target.value,
                                                                unit: it?.unit || 'kg',
                                                                price: it?.price || 0
                                                            });
                                                        }}
                                                    >
                                                        <option value="">בחר רכיב מהמלאי...</option>
                                                        {inventoryOptions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                    </select>

                                                    <div className="flex gap-3">
                                                        <div className="flex-1">
                                                            <label className="text-[10px] text-gray-400 font-bold block mb-1">כמות {['kg', 'kilo', 'ק"ג'].includes((newIngredient.unit || '').toLowerCase().trim()) ? '(גרם)' : ''}</label>
                                                            <div className="flex items-center gap-2 h-12 flex-1 relative shadow-sm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const selectedInv = inventoryOptions.find(i => String(i.id) === String(newIngredient.inventory_item_id));
                                                                        const isKg = ['kg', 'kilo', 'ק"ג'].includes((selectedInv?.unit || '').toLowerCase().trim());
                                                                        let step = 1;
                                                                        if (selectedInv?.quantity_step) {
                                                                            step = Number(selectedInv.quantity_step);
                                                                        } else {
                                                                            step = isKg ? 10 : 1;
                                                                        }
                                                                        setNewIngredient(p => ({ ...p, quantity: Math.max(0, (Number(p.quantity) || 0) - step) }));
                                                                    }}
                                                                    className="w-12 h-full bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 text-xl flex items-center justify-center transition-colors"
                                                                >
                                                                    <Minus size={18} strokeWidth={2.5} />
                                                                </button>
                                                                <div className="flex-1 flex items-center justify-center font-black text-lg text-gray-800 relative bg-gray-50 border border-gray-200 rounded-xl h-full">
                                                                    <input
                                                                        type="number"
                                                                        value={newIngredient.quantity}
                                                                        onChange={e => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                                                        className="w-full text-center font-black bg-transparent outline-none h-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const selectedInv = inventoryOptions.find(i => String(i.id) === String(newIngredient.inventory_item_id));
                                                                        const isKg = ['kg', 'kilo', 'ק"ג'].includes((selectedInv?.unit || '').toLowerCase().trim());
                                                                        let step = 1;
                                                                        if (selectedInv?.quantity_step) {
                                                                            step = Number(selectedInv.quantity_step);
                                                                        } else {
                                                                            step = isKg ? 10 : 1;
                                                                        }
                                                                        setNewIngredient(p => ({ ...p, quantity: (Number(p.quantity) || 0) + step }));
                                                                    }}
                                                                    className="w-12 h-full bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold border border-gray-200 rounded-xl active:bg-gray-200 text-xl flex items-center justify-center transition-colors"
                                                                >
                                                                    <Plus size={18} strokeWidth={2.5} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3 pt-4">
                                                        <button type="button" onClick={handleAddComponent} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-95 transition-all">הוסף למתכון</button>
                                                        <button type="button" onClick={() => setNewIngredientExpanded(false)} className="px-5 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 active:scale-95 transition-all">ביטול</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AnimatedSection>
                            </div>

                            {/* --- KITCHEN LOGIC SECTION (Bottom) --- */}
                            <div id="kitchen-logic-section" className="border-t border-gray-100 bg-white">
                                <div className="flex items-center gap-3 w-full p-4 pointer-events-auto">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection('kitchenLogic')}
                                        className="w-full flex items-center justify-between hover:bg-gray-50 transition-colors p-2 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl transition-colors ${showKitchenLogic ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                                <RotateCcw size={20} />
                                            </div>
                                            <div className="text-right">
                                                <h3 className={`font-black text-lg ${showKitchenLogic ? 'text-purple-900' : 'text-gray-700'}`}>
                                                    הכנות אוטומטיות (פרדקשן)
                                                </h3>
                                                <p className="text-xs text-gray-400 font-medium">הגדרת כמויות ייצור יומיות</p>
                                            </div>
                                        </div>
                                        <div className={`transform transition-transform duration-300 ${showKitchenLogic ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={20} className="text-gray-400" />
                                        </div>
                                    </button>
                                </div>

                                <AnimatedSection show={showKitchenLogic}>
                                    <div className="p-4 bg-purple-50/50 space-y-3 pb-6">
                                        {/* Days Grid */}
                                        <div className="space-y-2">
                                            {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
                                                const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                                                const config = taskSchedule[dayIdx] || { qty: 0, mode: 'fixed' };

                                                return (
                                                    <div key={dayIdx} className="bg-white rounded-xl p-3 border border-purple-100/50 shadow-sm flex items-center justify-between">

                                                        {/* Left: Day & Type Toggle */}
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 text-center">
                                                                <span className="block font-black text-slate-700 text-sm">{days[dayIdx]}</span>
                                                            </div>

                                                            {/* Logic Mode Toggle */}
                                                            <div className="flex bg-gray-100 rounded-lg p-0.5 h-8">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateSchedule(dayIdx, 'mode', 'fixed')}
                                                                    className={`px-3 rounded-md text-xs font-bold transition flex items-center ${config.mode !== 'par_level' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
                                                                >
                                                                    ייצור
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateSchedule(dayIdx, 'mode', 'par_level')}
                                                                    className={`px-3 rounded-md text-xs font-bold transition flex items-center ${config.mode === 'par_level' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
                                                                >
                                                                    השלמה
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Right: Quantity Picker */}
                                                        <div className="flex items-center gap-3" dir="ltr">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateSchedule(dayIdx, 'qty', Math.max(0, (config.qty || 0) - 1))}
                                                                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-90"
                                                            >
                                                                <Minus size={16} strokeWidth={3} />
                                                            </button>

                                                            <div className="w-12 text-center">
                                                                <span className={`text-xl font-black ${config.qty > 0 ? 'text-purple-700' : 'text-gray-300'}`}>
                                                                    {config.qty || 0}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => updateSchedule(dayIdx, 'qty', (config.qty || 0) + 1)}
                                                                className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 flex items-center justify-center transition-colors active:scale-90"
                                                            >
                                                                <Plus size={16} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </AnimatedSection>
                            </div>
                        </form >
                    ) : activeView === 'modifiers' ? (
                        <div className="max-w-5xl mx-auto p-4 space-y-4">
                            {/* Filter Tabs */}
                            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex gap-1 sticky top-0 z-10 mx-auto max-w-md">
                                {['all', 'food', 'drink'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setModifierFilter(f)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${modifierFilter === f ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        {f === 'all' ? 'הכל' : f === 'food' ? 'אוכל' : 'שתייה'}
                                    </button>
                                ))}
                            </div>

                            {/* Groups & Options Cards */}
                            <div className="space-y-6">
                                {sortedGroups
                                    .filter(g => {
                                        // 1. Type Filter
                                        if (modifierFilter === 'food' && !g.is_food) return false;
                                        if (modifierFilter === 'drink' && !g.is_drink) return false;
                                        // 2. Search (also check option values)
                                        if (searchTerm) {
                                            const nameMatch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
                                            const optionsMatch = g.optionvalues?.some(ov => ov.value_name.toLowerCase().includes(searchTerm.toLowerCase()));
                                            return nameMatch || optionsMatch;
                                        }
                                        return true;
                                    })
                                    .map(group => {
                                        return (
                                            <div key={group.id} className="rounded-2xl border-2 border-blue-100 bg-white overflow-hidden shadow-sm">
                                                {/* Group Header */}
                                                <div className="p-4 flex items-center justify-between bg-blue-50/50">
                                                    <div>
                                                        <h3 className="font-black text-gray-800 text-lg">{group.name}</h3>
                                                        <p className="text-xs text-blue-400 font-bold">קבוצה פרטית למנה זו</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteGroup(group)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                                        title="מחק קבוצה"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                {/* Options Cards Grid */}
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {group.optionvalues?.map(ov => (
                                                        <div key={ov.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col gap-3 group hover:border-blue-300 transition-colors relative">
                                                            {/* Delete Option X */}
                                                            <button
                                                                onClick={() => handleDeleteOption(ov.id)}
                                                                className="absolute top-2 left-2 text-gray-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>

                                                            <div className="flex justify-between items-start pr-1">
                                                                <span className="font-bold text-gray-800 text-sm">{ov.value_name}</span>
                                                            </div>

                                                            {/* Price Picker (Styled like Inventory) */}
                                                            <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden h-10">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateOption(ov.id, { price_adjustment: Math.max(0, (Number(ov.price_adjustment) || 0) - 1) })}
                                                                    className="w-10 h-full flex items-center justify-center bg-gray-50 text-red-500 hover:bg-red-50 active:bg-red-100 border-l border-gray-200"
                                                                >
                                                                    <Minus size={16} strokeWidth={3} />
                                                                </button>
                                                                <div className="flex-1 flex items-center justify-center bg-white font-black text-gray-800 text-sm">
                                                                    {ov.price_adjustment > 0 ? `₪${ov.price_adjustment}` : '0'}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateOption(ov.id, { price_adjustment: (Number(ov.price_adjustment) || 0) + 1 })}
                                                                    className="w-10 h-full flex items-center justify-center bg-gray-50 text-green-600 hover:bg-green-50 active:bg-green-100 border-r border-gray-200"
                                                                >
                                                                    <Plus size={16} strokeWidth={3} />
                                                                </button>
                                                            </div>

                                                            {/* Inventory Linkage */}
                                                            < div className="space-y-2 pt-2 border-t border-gray-100" >
                                                                <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden h-10 bg-white shadow-sm mt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateOption(ov.id, { quantity: Math.max(0, (Number(ov.quantity) || 0) - 10) })}
                                                                        className="w-10 h-full flex items-center justify-center bg-gray-50 text-red-500 hover:bg-red-50 border-l border-gray-200"
                                                                    >
                                                                        <Minus size={16} strokeWidth={2.5} />
                                                                    </button>
                                                                    <div className="flex-1 flex items-center justify-center relative bg-white">
                                                                        <span className="absolute right-2 text-[9px] font-bold text-gray-400 pointer-events-none">גרם</span>
                                                                        <input
                                                                            type="number"
                                                                            value={ov.quantity || ''}
                                                                            onChange={e => handleUpdateOption(ov.id, { quantity: e.target.value })}
                                                                            className="w-full text-center font-black text-sm text-gray-800 outline-none h-full bg-transparent placeholder-gray-300"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateOption(ov.id, { quantity: (Number(ov.quantity) || 0) + 10 })}
                                                                        className="w-10 h-full flex items-center justify-center bg-gray-50 text-green-600 hover:bg-green-50 border-r border-gray-200"
                                                                    >
                                                                        <Plus size={16} strokeWidth={2.5} />
                                                                    </button>
                                                                </div>
                                                                <div className="relative">
                                                                    <select
                                                                        value={ov.inventory_item_id || ''}
                                                                        onChange={e => handleUpdateOption(ov.id, { inventory_item_id: e.target.value || null })}
                                                                        className="w-full text-xs font-bold bg-gray-50 border-0 rounded-lg py-1.5 pr-1 pl-6 text-gray-600 outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer"
                                                                    >
                                                                        <option value="">-- חיבור למלאי --</option>
                                                                        {inventoryOptions.map(i => (
                                                                            <option key={i.id} value={i.id}>{i.name}</option>
                                                                        ))}
                                                                    </select>
                                                                    <div className="absolute left-2 top-1.5 pointer-events-none text-gray-400">
                                                                        <Package size={12} />
                                                                    </div>
                                                                </div>

                                                                {/* Quantity Adjuster */}
                                                                {
                                                                    ov.inventory_item_id && (
                                                                        <div className="flex items-center justify-between bg-blue-50/50 rounded-lg p-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleUpdateOption(ov.id, { quantity: Math.max(0, (Number(ov.quantity) || 0) - 10) })}
                                                                                className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                                                            >-</button>
                                                                            <span className="text-xs font-mono font-black text-blue-700">{(Number(ov.quantity) || 0)}g</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleUpdateOption(ov.id, { quantity: (Number(ov.quantity) || 0) + 10 })}
                                                                                className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                                                            >+</button>
                                                                        </div>
                                                                    )
                                                                }
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* New Modifier Input Card (Always last) */}
                                                    <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-3 flex flex-col justify-center gap-2 hover:border-blue-300 transition-colors">
                                                        <span className="text-xs font-bold text-gray-400 text-center mb-1">הוסף תוספת חדשה</span>
                                                        <input
                                                            value={addingToGroupId === group.id ? searchTerm : ''}
                                                            onFocus={() => setAddingToGroupId(group.id)}
                                                            onChange={e => { setAddingToGroupId(group.id); setSearchTerm(e.target.value); }}
                                                            onKeyDown={e => e.key === 'Enter' && handleSaveNewOption()}
                                                            placeholder="שם התוספת..."
                                                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm font-bold text-center outline-none focus:border-blue-400 bg-white"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveNewOption}
                                                            className={`w-full h-8 rounded-lg font-black text-xs transition-all ${addingToGroupId === group.id && searchTerm ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                            disabled={!(addingToGroupId === group.id && searchTerm)}
                                                        >
                                                            הוסף +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                            {/* Create New Group Button (Always Visible at Bottom) */}
                            <div className="pt-8 pb-20 border-t border-gray-100">
                                {!isCreatingGroup ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingGroup(true)}
                                        className="w-full py-6 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all group"
                                    >
                                        <PlusCircle size={32} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                                        <span className="font-black text-lg">צור קבוצת תוספות חדשה</span>
                                    </button>
                                ) : (
                                    <div className="bg-white border-2 border-blue-500 rounded-2xl p-6 shadow-xl animate-in zoom-in-95">
                                        <h4 className="font-black text-gray-800 mb-4 text-center text-lg">יצירת קבוצה חדשה למנה זו</h4>
                                        <div className="flex gap-3">
                                            <input
                                                autoFocus
                                                value={newGroupName}
                                                onChange={e => setNewGroupName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleCreatePrivateGroup()}
                                                placeholder="שם הקבוצה (לדוגמה: תוספות לפיצה)"
                                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-100 text-lg"
                                            />
                                            <button type="button" onClick={handleCreatePrivateGroup} className="bg-blue-600 text-white px-8 rounded-xl font-black shadow-lg hover:bg-blue-700">שמור</button>
                                            <button type="button" onClick={resetGroupCreation} className="bg-gray-100 text-gray-500 px-6 rounded-xl font-bold hover:bg-gray-200">ביטול</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Empty State */}
                            {sortedGroups.length === 0 && !isCreatingGroup && (
                                <div className="text-center py-10 text-gray-400">
                                    <p className="font-bold text-lg mb-2">אין תוספות למנה זו</p>
                                    <p className="text-sm">לחץ על הכפתור למטה כדי ליצור את הקבוצה הראשונה</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // --- GLOBAL MODIFIER PICKER VIEW (Compact & Animated) ---
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="max-w-4xl mx-auto p-4 flex flex-col h-full overflow-hidden"
                        >
                            {/* Picker Header */}
                            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-4 flex flex-col gap-3 shrink-0">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-gray-800 text-lg">
                                        {pickerMode === 'create_group' ? 'יצירת רשימת תוספות חדשה' : 'הוספת תוספות לקבוצה'}
                                    </h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => setActiveView('main')} className="px-3 py-1.5 bg-gray-100 text-gray-500 font-bold rounded-lg hover:bg-gray-200 text-sm">ביטול</button>
                                        <button
                                            onClick={handlePickerSave}
                                            className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                                            disabled={pickerMode === 'create_group' && !pickerGroupName.trim()}
                                        >
                                            <Check size={16} /> שמור {pickerSelectedNames.size > 0 ? `(${pickerSelectedNames.size})` : ''}
                                        </button>
                                    </div>
                                </div>

                                {/* Group Name Input (Only for New Group) */}
                                {pickerMode === 'create_group' && (
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            value={pickerGroupName}
                                            onChange={e => setPickerGroupName(e.target.value)}
                                            placeholder="שם הקבוצה (חובה)..."
                                            className="w-full h-10 px-3 rounded-lg border-2 border-blue-100 font-black text-base outline-none focus:border-blue-400 focus:bg-blue-50/10 bg-gray-50"
                                        />
                                    </div>
                                )}

                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        value={pickerSearch}
                                        onChange={e => setPickerSearch(e.target.value)}
                                        placeholder="חפש תוספת..."
                                        className="w-full h-9 pr-10 pl-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* Modifiers Grid (Compact) */}
                            <div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-2xl border border-gray-100 p-3 shadow-inner bg-gray-50/50">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {uniqueModifiers
                                        .filter(m => m.toLowerCase().includes(pickerSearch.toLowerCase()))
                                        .map(name => {
                                            const isSelected = pickerSelectedNames.has(name);
                                            return (
                                                <button
                                                    key={name}
                                                    onClick={() => handlePickerToggle(name)}
                                                    className={`px-3 py-2 rounded-lg border text-right transition-all flex items-center justify-between group h-10 ${isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/30'}`}
                                                >
                                                    <span className="font-bold text-xs truncate pl-1">{name}</span>
                                                    {isSelected && <CheckCircle size={14} strokeWidth={3} className="shrink-0" />}
                                                </button>
                                            );
                                        })}

                                    {uniqueModifiers.length === 0 && (
                                        <div className="col-span-full py-10 text-center text-gray-400">
                                            <p className="text-xs">לא נמצאו תוספות.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div >

            </motion.div >

            {/* Success Toast */}
            {
                saveBanner && (
                    <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[60] animate-in slide-in-from-top-4 fade-in">
                        <div className="bg-green-500 rounded-full p-1"><Check size={14} className="text-white" strokeWidth={3} /></div>
                        <div className="font-bold">השינויים נשמרו בהצלחה!</div>
                    </div>
                )
            }
        </div >
    );
};

export default MenuEditModal;

