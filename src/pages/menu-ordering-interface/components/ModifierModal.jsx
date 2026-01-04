import React, { useEffect, useState, useMemo } from 'react';
import {
  X, Check, Coffee, Milk, Leaf, Wheat, Nut,
  Cloud, CloudOff, Thermometer, Flame, Droplets,
  Zap, Ban, Puzzle, ArrowUpFromLine, ArrowDownToLine, Blend, Gauge, Apple, Disc
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchManagerItemOptions, clearOptionsCache, normalizeOptionGroups } from '@/lib/managerApi';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';

const formatPrice = (price = 0) => {
  const numPrice = Number(price);
  return numPrice > 0 ? `+${numPrice}₪` : '';
};

// Helper function to get icon based on value name
const getIconForValue = (valueName, groupName) => {
  const name = (valueName || '').toLowerCase();
  const group = (groupName || '').toLowerCase();

  // Milk icons
  if (group.includes('חלב') || group.includes('milk')) {
    if (name.includes('סויה')) return Leaf;
    if (name.includes('שיבולת')) return Wheat;
    if (name.includes('שקדים')) return Nut;
    return Milk;
  }

  // Foam icons
  if (group.includes('קצף') || group.includes('foam')) {
    if (name.includes('הרבה') || name.includes('extra')) return ArrowUpFromLine;
    if (name.includes('מעט') || name.includes('little')) return ArrowDownToLine;
    if (name.includes('בלי') || name.includes('none')) return X;
    return Cloud;
  }

  // Temperature icons
  if (group.includes('טמפרטורה') || group.includes('temp')) {
    if (name.includes('רותח') || name.includes('hot')) return Flame;
    if (name.includes('פושר') || name.includes('warm')) return Thermometer;
    return Thermometer;
  }

  // Base icons
  if (group.includes('בסיס') || group.includes('base')) {
    if (name.includes('מים') || name.includes('water')) return Droplets;
    if (name.includes('חצי')) return Blend;
    return Droplets;
  }

  // Strength icons
  if (group.includes('חוזק') || group.includes('strength')) {
    if (name.includes('חזק') || name.includes('strong')) return Gauge;
    if (name.includes('חלש') || name.includes('weak')) return Coffee;
    return Zap;
  }

  // Topping icons (for pizza/toast)
  const groupLower = group.toLowerCase();
  if (groupLower.includes('תוספות') || groupLower.includes('topping')) {
    if (name.includes('עגבניות') || name.includes('tomato')) return Apple;
    if (name.includes('זיתים') || name.includes('olive')) return Disc;
    if (name.includes('בצל') || name.includes('onion')) return Disc;
    return Disc;
  }

  // Special icons
  if (name.includes('נטול')) return Ban;
  if (name.includes('מפורק')) return Puzzle;

  // Food / Topping Fallbacks (catch-all if group name doesn't match)
  if (name.includes('עגבנ')) return Apple;
  if (name.includes('זית')) return Disc;
  if (name.includes('בצל')) return Disc;
  if (name.includes('פטריות')) return Disc;
  if (name.includes('גבינה') || name.includes('בולגרית') || name.includes('פרוסה')) return Disc;
  if (name.includes('טונה')) return Disc;
  if (name.includes('תירס')) return Wheat;
  if (name.includes('פלפל') || name.includes('חריף')) return Flame;
  if (name.includes('ביצה')) return Disc;

  return Coffee;
};

// Milk Card Component (Hero Section)
const MilkCard = ({ label, Icon, price, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex-1 flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl
        font-semibold transition-all duration-200 touch-manipulation min-h-[88px] active:scale-95
        ${isSelected
          ? "bg-orange-50 text-orange-600 ring-2 ring-orange-400 ring-offset-2 shadow-lg shadow-orange-100"
          : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md"
        }
      `}
    >
      <Icon
        size={24}
        strokeWidth={isSelected ? 2.5 : 2}
        className={`transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}
      />
      <span className="text-sm">{label}</span>
      {price > 0 && (
        <span className={`text-xs font-medium ${isSelected ? "text-orange-500" : "text-slate-400"}`}>
          +₪{price}
        </span>
      )}
    </button>
  );
};

// Modifier Pill Button
const ModifierPill = ({ label, Icon, isSelected, onClick, variant = "default", price }) => {
  const selectedStyles =
    variant === "purple"
      ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
      : "bg-slate-800 text-white shadow-lg shadow-slate-300";

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl
        font-medium transition-all duration-200 touch-manipulation active:scale-95
        ${isSelected
          ? selectedStyles
          : "bg-white text-slate-600 border border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50"
        }
      `}
    >
      <Icon size={18} strokeWidth={isSelected ? 2.5 : 2} />
      <span className="text-sm">{label}</span>
      {price !== undefined && price > 0 && (
        <span className={`text-xs ${isSelected ? "text-white/80" : "text-slate-400"}`}>
          +₪{price}
        </span>
      )}
    </button>
  );
};

const ModifierModal = (props) => {
  const { isOpen, selectedItem, onClose, onAddItem } = props;

  // ⚠️ CRITICAL: All hooks MUST be called before any early returns (React Rules of Hooks)
  // const [optionGroups, setOptionGroups] = useState([]); // Removed, now derived
  const [orderNote, setOrderNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [optionSelections, setOptionSelections] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  // const [isLoadingOptions, setIsLoadingOptions] = useState(false); // Derived

  // Check if this is an espresso item
  const isEspresso = selectedItem?.name?.includes('אספרסו');

  // Reset state when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      setOptionSelections({});
      setShowAdvanced(false);
      setOrderNote('');
      setIsNoteOpen(false);
    }
  }, [selectedItem?.id]);

  // --- LOCAL FIRST DATA FETCHING ---
  const targetItemId = useMemo(() => {
    if (!selectedItem) return null;
    const rawId = selectedItem.menu_item_id || selectedItem.menuItemId || selectedItem.id;
    return rawId ? Number(rawId) : null;
  }, [selectedItem]);

  // DEBUG: Check Dexie data on mount
  useEffect(() => {
    if (!isOpen || !selectedItem) return;

    // alert(`DEBUG: Opening Modal for ${selectedItem?.name} (ID: ${targetItemId})`);
    console.log('🔍 [DEBUG] useEffect triggered:', { isOpen, hasSelectedItem: !!selectedItem, targetItemId });

    (async () => {
      try {
        const groups = await db.optiongroups.toArray();
        const values = await db.optionvalues.toArray();
        const links = await db.menuitemoptions.toArray();
        console.log('🔍 [DEBUG] Dexie Data Check:', {
          totalGroups: groups.length,
          totalValues: values.length,
          totalLinks: links.length,
          sampleGroup: groups[0],
          sampleValue: values[0],
          itemId: targetItemId
        });
      } catch (err) {
        console.error('❌ [DEBUG] Failed to check Dexie:', err);
      }
    })();
  }, [isOpen, selectedItem, targetItemId]);


  // --- DATA FETCHING (DEXIE + SUPABASE FALLBACK) ---
  const [remoteData, setRemoteData] = useState(null);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);

  // 1. Reactive query from Dexie (Local) with CLAUDE'S TYPE-SAFETY FIX
  // 1. Reactive query from Dexie (Local) - SURGICAL DEBUGGING V2.3.2
  const dexieOptions = useLiveQuery(async () => {
    const queryId = `dexie-${Date.now()}`;
    console.log(`🔵 [${queryId}] DEXIE QUERY START`, {
      targetItemId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 50),
    });

    if (!targetItemId) {
      console.log(`🔵 [${queryId}] SKIP: No targetItemId`);
      return null;
    }

    try {
      // Step 1: Linked groups
      const linked = await db.menuitemoptions
        .where('item_id')
        .equals(targetItemId)
        .toArray();

      console.log(`🔵 [${queryId}] Step 1 - Linked:`, {
        count: linked.length,
        sample: linked[0],
      });

      const linkedIds = linked.map(l => String(l.group_id));

      // Step 2: Private groups
      const privateGroups = await db.optiongroups
        .where('menu_item_id')
        .equals(targetItemId)
        .toArray();

      console.log(`🔵 [${queryId}] Step 2 - Private:`, {
        count: privateGroups.length,
        sample: privateGroups[0],
      });

      // Step 3: Shared groups
      let sharedGroups = [];
      if (linkedIds.length > 0) {
        sharedGroups = await db.optiongroups.bulkGet(linkedIds);
        sharedGroups = sharedGroups.filter(Boolean);
        console.log(`🔵 [${queryId}] Step 3 - Shared:`, {
          count: sharedGroups.length,
          sample: sharedGroups[0],
        });
      }

      const allGroups = [...privateGroups, ...sharedGroups];

      if (allGroups.length === 0) {
        console.warn(`🔵 [${queryId}] ⚠️ NO GROUPS FOUND - Returning null to trigger fallback`);
        return null;
      }

      // Step 4: Fetch values
      const groupIds = allGroups.map(g => String(g.id));

      console.log(`🔵 [${queryId}] Step 4 - Fetching values:`, {
        groupCount: allGroups.length,
        groupIdsSample: groupIds.slice(0, 3),
        allGroupIdTypes: [...new Set(groupIds.map(id => typeof id))],
      });

      const values = await db.optionvalues
        .where('group_id')
        .anyOf(groupIds)
        .toArray();

      console.log(`🔵 [${queryId}] Step 5 - Values fetched:`, {
        valuesCount: values.length,
        valuesSample: values.slice(0, 2),
        valuesGroupIdTypes: [...new Set(values.map(v => typeof v.group_id))],
      });

      // CRITICAL CHECK: If groups exist but NO values
      if (allGroups.length > 0 && values.length === 0) {
        console.error(`🔵 [${queryId}] ❌ CRITICAL: ${allGroups.length} groups but 0 values!`);
        console.error(`🔵 [${queryId}] ❌ Group IDs that failed:`, groupIds);
        console.error(`🔵 [${queryId}] ❌ Forcing fallback to Supabase RPC`);
        return null;
      }

      // Step 6: Map groups with their values
      const result = allGroups.map(g => ({
        ...g,
        values: values
          .filter(v => String(v.group_id) === String(g.id))
          .map(v => ({
            ...v,
            name: v.name || v.value_name,
            priceAdjustment: v.priceAdjustment || v.price_adjustment || 0,
          }))
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      }));

      // Final validation
      const groupsWithValues = result.filter(g => g.values && g.values.length > 0);
      const groupsWithoutValues = result.filter(g => !g.values || g.values.length === 0);

      console.log(`🔵 [${queryId}] ✅ DEXIE SUCCESS:`, {
        totalGroups: result.length,
        groupsWithValues: groupsWithValues.length,
        groupsWithoutValues: groupsWithoutValues.length,
        emptyGroups: groupsWithoutValues.map(g => ({ id: g.id, name: g.name })),
      });

      if (groupsWithoutValues.length > 0) {
        console.warn(`🔵 [${queryId}] ⚠️ Some groups missing values, forcing fallback`);
        return null;
      }

      return result;

    } catch (err) {
      console.error(`🔵 [${queryId}] ❌ EXCEPTION:`, {
        error: err,
        message: err.message,
        stack: err.stack,
      });
      return null;
    }
  }, [targetItemId]);

  // 2. Fallback to Supabase (Remote) - SURGICAL DEBUGGING V2.3.2
  // ════════════════════════════════════════════════════════════════════
  // FALLBACK EFFECT - With Enhanced Logging
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const effectId = `effect-${Date.now()}`;

    console.log(`🟢 [${effectId}] FALLBACK EFFECT TRIGGERED`, {
      isOpen,
      targetItemId,
      dexieOptions: dexieOptions === undefined ? 'UNDEFINED' : dexieOptions === null ? 'NULL' : `ARRAY(${dexieOptions.length})`,
      isRemoteLoading,
      hasRemoteData: !!remoteData,
      timestamp: new Date().toISOString(),
    });

    // Guard clauses
    if (!isOpen) {
      console.log(`🟢 [${effectId}] SKIP: Modal not open`);
      return;
    }

    if (!targetItemId) {
      console.log(`🟢 [${effectId}] SKIP: No targetItemId`);
      return;
    }

    // Wait for Dexie to resolve (undefined → value or null)
    if (dexieOptions === undefined) {
      console.log(`🟢 [${effectId}] WAITING: Dexie query still pending...`);
      return;
    }

    // Check if Dexie has valid data
    const hasValidData = dexieOptions &&
      dexieOptions.length > 0 &&
      dexieOptions.every(g => g.values && g.values.length > 0);

    console.log(`🟢 [${effectId}] DEXIE VALIDATION:`, {
      dexieOptions: dexieOptions ? `${dexieOptions.length} groups` : 'null',
      hasValidData,
      groupsWithValues: dexieOptions ? dexieOptions.filter(g => g.values?.length > 0).length : 0,
      groupsWithoutValues: dexieOptions ? dexieOptions.filter(g => !g.values || g.values.length === 0).length : 0,
    });

    if (hasValidData) {
      console.log(`🟢 [${effectId}] ✅ Using Dexie data - Skipping RPC`);
      return;
    }

    // Skip if already loading or loaded
    if (isRemoteLoading) {
      console.log(`🟢 [${effectId}] SKIP: Already loading from Supabase`);
      return;
    }

    if (remoteData) {
      console.log(`🟢 [${effectId}] SKIP: Already have remote data`);
      return;
    }

    console.warn(`🟢 [${effectId}] 🚨 TRIGGERING SUPABASE RPC FALLBACK`);

    const fetchRemote = async () => {
      const rpcId = `rpc-${Date.now()}`;

      console.group(`🟠 [${rpcId}] SUPABASE RPC START`);
      console.log('📋 Context:', {
        targetItemId,
        itemIdType: typeof targetItemId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        location: window.location.href,
        supabaseUrl: supabase?.supabaseUrl || 'UNDEFINED',
        hasSupabaseKey: !!supabase?.supabaseKey,
      });

      setIsRemoteLoading(true);

      try {
        console.log(`🟠 [${rpcId}] Calling RPC: get_item_modifiers...`);
        const rpcStartTime = performance.now();

        const { data, error, status, statusText } = await supabase
          .rpc('get_item_modifiers', {
            target_item_id: targetItemId
          });

        const rpcDuration = performance.now() - rpcStartTime;

        console.log(`🟠 [${rpcId}] RPC Response:`, {
          duration: `${rpcDuration.toFixed(2)}ms`,
          status,
          statusText,
          hasError: !!error,
          hasData: !!data,
          dataType: data ? (Array.isArray(data) ? `Array(${data.length})` : typeof data) : 'null/undefined',
        });

        if (error) {
          console.error(`🟠 [${rpcId}] ❌ RPC ERROR:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fullError: error,
          });
          console.groupEnd();
          return;
        }

        if (!data || data.length === 0) {
          console.warn(`🟠 [${rpcId}] ⚠️ RPC returned empty/null`);
          setRemoteData([]);
          console.groupEnd();
          return;
        }

        // Processing Logic (Simplified for brevity but robust)
        const groupsMap = new Map();
        data.forEach(row => {
          if (!groupsMap.has(row.group_id)) {
            groupsMap.set(row.group_id, {
              id: row.group_id,
              name: row.group_name,
              is_required: row.is_required,
              is_multiple_select: row.is_multiple_select,
              min_selection: row.min_selection,
              max_selection: row.max_selection,
              display_order: row.display_order,
              values: []
            });
          }
          if (row.value_id) {
            const group = groupsMap.get(row.group_id);
            if (!group.values.some(v => v.id === row.value_id)) {
              group.values.push({
                id: row.value_id,
                group_id: row.group_id,
                name: row.value_name,
                priceAdjustment: row.price_adjustment,
                display_order: row.value_display_order,
                is_default: row.is_default
              });
            }
          }
        });

        const enhanced = Array.from(groupsMap.values()).map(g => ({
          ...g,
          values: g.values.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        })).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        console.log(`🟠 [${rpcId}] ✅ Data Processed: ${enhanced.length} groups`);
        setRemoteData(enhanced);
        console.groupEnd();

      } catch (err) {
        console.error(`🟠 [${rpcId}] ❌ EXCEPTION:`, err);
        console.groupEnd();
      } finally {
        setIsRemoteLoading(false);
      }
    };

    fetchRemote();
  }, [isOpen, targetItemId, dexieOptions, remoteData, isRemoteLoading]);

  // 3. Merge and Deduplicate Final results
  const optionGroups = useMemo(() => {
    const raw = dexieOptions || remoteData || [];
    const fromProps = props.extraGroups || [];
    const combined = [...raw, ...fromProps];

    const uniqueMap = new Map();
    combined.forEach(g => {
      if (!uniqueMap.has(g.name)) {
        const valMap = new Map();
        (g.values || []).forEach(v => {
          if (!valMap.has(v.name)) valMap.set(v.name, v);
        });

        uniqueMap.set(g.name, {
          ...g,
          values: Array.from(valMap.values()).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
          is_required: g.is_required || (g.min_selection > 0)
        });
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [dexieOptions, remoteData, props.extraGroups]);

  const isLoadingOptions = (dexieOptions === undefined) || (!optionGroups.length && isRemoteLoading);

  // Handle Defaults & Auto-Add
  useEffect(() => {
    // Only run when we have loaded options
    if (isLoadingOptions) return;

    // Auto-Add Logic
    if (optionGroups.length === 0 && props.allowAutoAdd !== false) {
      console.log('⚡ Auto-adding item (no options & allowed)');
      onAddItem?.({
        ...selectedItem,
        selectedOptions: [],
        totalPrice: selectedItem.price,
        price: selectedItem.price
      });
      onClose();
      return;
    }

    // Process Defaults logic (moved here from loadOptions)
    processDefaults(optionGroups);

  }, [isLoadingOptions, optionGroups, props.allowAutoAdd, selectedItem?.id]); // depend on optionGroups result

  const processDefaults = (options) => {
    const defaults = {};
    const existingSelections = selectedItem.selectedOptions || [];

    options.forEach(group => {
      const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
      if (isMultipleSelect) {
        const existingToppings = existingSelections
          .filter(opt => String(opt.groupId) === String(group.id))
          .map(opt => String(opt.valueId));

        if (existingToppings.length > 0) {
          defaults[group.id] = existingToppings;
        } else {
          defaults[group.id] = [];
        }
        return;
      }

      // Try to find match by ID first
      let existingChoice = existingSelections.find(opt =>
        opt.groupId && String(opt.groupId) === String(group.id)
      );

      // If not found by ID, try to find by matching value names across all selections
      // This handles cases where we only stored names in the DB (legacy/simple format)
      if (!existingChoice) {
        const matchingValue = group.values?.find(v =>
          existingSelections.some(sel => {
            // If selection is just a string (legacy)
            if (typeof sel === 'string') return sel === v.name;
            // If selection is object but only has names
            return sel.valueName === v.name;
          })
        );

        if (matchingValue) {
          defaults[group.id] = String(matchingValue.id);
          return;
        }
      }

      if (existingChoice) {
        const existingVal = group.values?.find(v =>
          String(v.id) === String(existingChoice.valueId)
        );
        if (existingVal) {
          defaults[group.id] = String(existingVal.id);
          return;
        }
      }

      // --- FIXED DEFAULT LOGIC ---
      const defaultVal = group.values?.find(v => v.is_default) ||
        group.values?.find(v => v.name?.includes('רגיל'));

      if (defaultVal) {
        defaults[group.id] = String(defaultVal.id);
      } else if (group.required) {
        // Only auto-select first option if the group is REQUIRED
        const firstVal = group.values?.[0];
        if (firstVal) defaults[group.id] = String(firstVal.id);
      }
    });

    // Avoid resetting selections if we already have some (from previous run) unless component reset
    // Use functional update to check if empty? No, reset handles that.
    setOptionSelections(defaults);

    const hasOtherGroupSelections = options.some((group) => {
      const isMilkGroup = group.name?.toLowerCase().includes('חלב');
      if (isMilkGroup) return false;
      return existingSelections.some(opt =>
        String(opt.groupId) === String(group.id)
      );
    });

    const hasMilkGroup = options.some(g => g.name?.toLowerCase().includes('חלב'));
    if ((hasOtherGroupSelections && options.length > 1) || !hasMilkGroup) {
      setShowAdvanced(true);
    }
  };

  const { milkGroup, foamGroup, tempGroup, baseGroup, strengthGroup, otherGroups } = useMemo(() => {
    if (!optionGroups?.length) return {
      milkGroup: null, foamGroup: null, tempGroup: null,
      baseGroup: null, strengthGroup: null, otherGroups: []
    };

    const normalize = (str) => (str || '').toLowerCase();
    const hasValue = (group, keyword) => {
      return group.values?.some(v => {
        const valName = normalize(v.name || v.value_name);
        return valName.includes(keyword);
      });
    };

    // Helper to check group name/title/category
    const checkGroup = (group, keywords, category) => {
      const title = normalize(group.title || group.name); // Use title as primary, fallback to name
      const cat = normalize(group.category);

      if (category && cat === category) return true;
      return keywords.some(k => title.includes(k));
    };

    // 1. Milk
    const milk = optionGroups.find(g => {
      if (checkGroup(g, ['חלב', 'milk'], 'milk')) return true;

      // Fallback: check values
      const hasSoy = hasValue(g, 'סויה');
      const hasOat = hasValue(g, 'שיבולת');
      const hasAlmond = hasValue(g, 'שקדים');
      return hasSoy || hasOat || hasAlmond;
    });

    // 2. Foam
    const foam = optionGroups.find(g => {
      return checkGroup(g, ['קצף', 'foam'], 'texture') || hasValue(g, 'קצף');
    });

    // 3. Temp
    const temp = optionGroups.find(g => {
      return checkGroup(g, ['טמפרטורה', 'חום', 'temp'], 'temperature') ||
        hasValue(g, 'רותח') || hasValue(g, 'פושר');
    });

    // 4. Base
    let base = optionGroups.find(g => {
      return checkGroup(g, ['בסיס', 'base', 'water'], 'base') ||
        hasValue(g, 'בסיס') || hasValue(g, 'מים');
    });

    // Filter base group: remove orange base if item is coffee
    const isCoffeeItem = selectedItem?.name?.includes('קפה') ||
      selectedItem?.name?.includes('הפוך') ||
      selectedItem?.name?.includes('אספרסו') ||
      selectedItem?.name?.includes('נס') ||
      selectedItem?.name?.includes('מקיאטו');

    if (base && isCoffeeItem) {
      const hasWaterOrMilkBase = base.values.some(v =>
        v?.name?.includes('מים') || v?.name?.includes('חלב') || v?.name?.includes('סודה')
      );

      if (!hasWaterOrMilkBase) {
        base = null;
      }
    }

    // 5. Strength
    const strength = optionGroups.find(g => {
      return checkGroup(g, ['חוזק', 'strength'], 'strength') ||
        hasValue(g, 'חזק') || hasValue(g, 'חלש');
    });

    const others = optionGroups.filter(g =>
      g !== milk && g !== foam && g !== temp && g !== base && g !== strength
    );

    return {
      milkGroup: milk, foamGroup: foam, tempGroup: temp,
      baseGroup: base, strengthGroup: strength, otherGroups: others
    };
  }, [optionGroups, selectedItem]);

  const totalPrice = useMemo(() => {
    if (!selectedItem) return 0;
    let sum = Number(selectedItem?.price || 0);

    (optionGroups || []).forEach(group => {
      const selectedId = optionSelections[group.id];
      if (!selectedId) return;

      const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
      if (isMultipleSelect && Array.isArray(selectedId)) {
        selectedId.forEach(id => {
          const value = group.values?.find(v => String(v.id) === String(id));
          const effectivePrice = Number(value?.priceAdjustment || 0);
          if (effectivePrice > 0) sum += effectivePrice;
        });
      } else {
        const value = group.values?.find(v => String(v.id) === selectedId);
        const effectivePrice = Number(value?.priceAdjustment || 0);
        if (effectivePrice > 0) sum += effectivePrice;
      }
    });
    return sum;
  }, [selectedItem?.price, optionGroups, optionSelections]);

  const toggleOption = (groupId, valueId) => {
    if (!selectedItem) return;

    setOptionSelections(prev => {
      const group = (optionGroups || []).find(g => g.id === groupId);
      const current = prev[groupId];
      const isMultipleSelect = group?.is_multiple_select || group?.type === 'multi';

      if (isMultipleSelect) {
        const currentArray = Array.isArray(current) ? current : [];
        const valueIdStr = String(valueId);
        if (currentArray.includes(valueIdStr)) {
          return { ...prev, [groupId]: currentArray.filter(id => id !== valueIdStr) };
        }
        return { ...prev, [groupId]: [...currentArray, valueIdStr] };
      }

      if (current === valueId) {
        const defaultVal = group.values?.find(v => v.is_default) ||
          group.values?.find(v => v.name?.includes('רגיל')) ||
          group.values?.[0];
        return { ...prev, [groupId]: defaultVal ? String(defaultVal.id) : null };
      }

      return { ...prev, [groupId]: valueId };
    });
  };

  const handleAdd = () => {
    const selectedOptions = (optionGroups || []).flatMap(group => {
      const selId = optionSelections[group.id];
      if (!selId) return [];

      const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
      if (isMultipleSelect && Array.isArray(selId)) {
        return selId.map(id => {
          const val = group.values.find(v => String(v.id) === String(id));
          if (!val) return null;
          const effectivePrice = Number(val.priceAdjustment || 0);
          return {
            groupId: group.id,
            groupName: group.title || group.name, // Use title
            valueId: val.id,
            valueName: val.name,
            priceAdjustment: effectivePrice
          };
        }).filter(Boolean);
      }

      const val = group.values.find(v => String(v.id) === selId);
      if (!val) return [];
      const effectivePrice = Number(val.priceAdjustment || 0);
      if (val.name?.includes('רגיל') && effectivePrice === 0) return [];

      return [{
        groupId: group.id,
        groupName: group.title || group.name, // Use title
        valueId: val.id,
        valueName: val.name,
        priceAdjustment: effectivePrice
      }];
    });

    onAddItem?.({
      ...selectedItem,
      tempId: `${selectedItem.id}-${Date.now()}`,
      quantity: 1,
      selectedOptions,
      notes: orderNote, // Add the note here
      totalPrice,
      price: totalPrice
    });
    onClose();
  };

  if (!isOpen || !selectedItem) return null;


  try {
    console.log('🚀 ModifierModal Reaching Return Statement - Rendering JSX');
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        dir="rtl"
        onClick={onClose}
      >
        {/* Backdrop */}
        {/* The backdrop is now part of the main container div */}

        {/* Modal */}
        <div
          className="relative w-auto max-w-[90vw] min-w-[420px] flex flex-col bg-[#FAFAFA] rounded-[2rem] shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex items-center sticky top-0 z-20 border-b border-slate-100/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
                <Coffee size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">{selectedItem.name}</h2>
                <p className="text-sm text-slate-400">התאמה אישית</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px]">

            {/* 1. Milk Selection - Hero - MOVED TO TOP EXPLICITLY */}
            {milkGroup && milkGroup.values && !isEspresso && (
              <section className="order-first mb-4">
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex gap-2">
                    {(() => {
                      const seen = new Set();
                      let values = milkGroup.values?.filter(value => {
                        const name = (value.name || '').toLowerCase();

                        // Always filter out juices and chocolate drinks from milk options
                        if (name.includes('תפוזים') || name.includes('לימונענע') || name.includes('גזר') || name.includes('תפוח')) return false;
                        if (name.includes('שוקו')) return false;

                        // Filter out special modifiers
                        if (name.includes('נטול קפאין') || name.includes('מפורק')) return false;
                        if (name.includes('ללא')) return false;

                        const shortName = name.includes('סויה') ? 'סויה' :
                          name.includes('שיבולת') ? 'שיבולת' :
                            name.includes('שקדים') ? 'שקדים' :
                              name.includes('רגיל') ? 'רגיל' : name;

                        if (seen.has(shortName)) return false;
                        seen.add(shortName);
                        return true;
                      }) || [];

                      // Sort: Regular (Right), Oat, Soy
                      values.sort((a, b) => {
                        const aName = (a.name || '').toLowerCase();
                        const bName = (b.name || '').toLowerCase();

                        const getScore = (n) => {
                          if (n.includes('רגיל')) return 10;
                          if (n.includes('שיבולת')) return 9;
                          if (n.includes('סויה')) return 8;
                          if (n.includes('שקדים')) return 7;
                          return 0;
                        };

                        return getScore(bName) - getScore(aName); // Descending score
                      });

                      return values.map(value => {
                        let displayName = value?.name || '';
                        if (displayName.includes('סויה')) displayName = 'סויה';
                        else if (displayName.includes('שיבולת')) displayName = 'שיבולת';
                        else if (displayName.includes('שקדים')) displayName = 'שקדים';
                        else if (displayName.includes('רגיל')) displayName = 'רגיל';

                        // FIX: Pass 'milk' explicitly
                        const IconComponent = getIconForValue(value?.name || '', 'milk');
                        const isSelected = String(optionSelections[milkGroup.id]) === String(value.id);
                        const effectivePrice = value.priceAdjustment || 0;
                        if (effectivePrice > 0) console.log(`🥛 Milk option price: ${value.name} = ${effectivePrice}`);

                        return (
                          <MilkCard
                            key={value.id}
                            label={displayName}
                            Icon={IconComponent}
                            price={effectivePrice}
                            isSelected={isSelected}
                            onClick={() => toggleOption(milkGroup.id, String(value.id))}
                          />
                        );
                      });
                    })()}
                  </div>
                </div>
              </section>
            )}

            {/* Loading State */}
            {isLoadingOptions && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              </div>
            )}

            {/* Empty State Message */}
            {(optionGroups || []).length === 0 && !isLoadingOptions && (
              <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 mb-4">
                <p className="font-medium">אין תוספות מובנות לפריט זה</p>
                <p className="text-xs mt-1">אבל אפשר לכתוב הערות חופשיות למטה 👇</p>
              </div>
            )}

            {/* 2. Modifiers Grid (Dynamic Columns) */}
            {(foamGroup || tempGroup || baseGroup || strengthGroup) && (
              <section>
                <div className={`grid gap-4 ${[foamGroup, tempGroup, baseGroup, strengthGroup].filter(Boolean).length === 1
                  ? 'grid-cols-1'
                  : [foamGroup, tempGroup, baseGroup, strengthGroup].filter(Boolean).length === 2
                    ? 'grid-cols-2'
                    : [foamGroup, tempGroup, baseGroup, strengthGroup].filter(Boolean).length === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-4'
                  }`}>

                  {/* Foam Column */}
                  {foamGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">קצף</p>
                      {foamGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        return !name.includes('רגיל') && !name.includes('default');
                      }).map(value => {
                        const IconComponent = getIconForValue(value.name, 'foam');
                        const isSelected = String(optionSelections[foamGroup.id]) === String(value.id);
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            isSelected={isSelected}
                            onClick={() => toggleOption(foamGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Temperature Column */}
                  {tempGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">טמפרטורה</p>
                      {tempGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        return !name.includes('רגיל') && !name.includes('default');
                      }).map(value => {
                        const IconComponent = getIconForValue(value.name, 'temp');
                        const isSelected = String(optionSelections[tempGroup.id]) === String(value.id);
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            isSelected={isSelected}
                            onClick={() => toggleOption(tempGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Base Column */}
                  {baseGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">בסיס</p>
                      {baseGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        return !name.includes('רגיל') && !name.includes('default');
                      }).map(value => {
                        const IconComponent = getIconForValue(value.name, 'base');
                        const isSelected = String(optionSelections[baseGroup.id]) === String(value.id);
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            isSelected={isSelected}
                            onClick={() => toggleOption(baseGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Strength Column */}
                  {strengthGroup && (
                    <div className="space-y-1.5 min-w-[140px]">
                      <p className="text-xs text-slate-400 text-center mb-1">חוזק</p>
                      {strengthGroup.values?.filter(v => {
                        const name = (v.name || '').toLowerCase();
                        return !name.includes('רגיל') && !name.includes('default');
                      }).map(value => {
                        const IconComponent = getIconForValue(value.name, 'strength');
                        const isSelected = String(optionSelections[strengthGroup.id]) === String(value.id);
                        const effectivePrice = value.priceAdjustment || 0;

                        return (
                          <ModifierPill
                            key={value.id}
                            label={value.name}
                            Icon={IconComponent}
                            isSelected={isSelected}
                            onClick={() => toggleOption(strengthGroup.id, String(value.id))}
                            price={effectivePrice}
                          />
                        );
                      })}
                    </div>
                  )}

                </div>
              </section>
            )}

            {/* 4. Other Groups (Toppings, etc.) */}
            {otherGroups.length > 0 && (
              <div className="flex flex-col gap-4">
                {otherGroups.map((group) => {
                  const isMultipleSelect = group.is_multiple_select || group.type === 'multi';
                  const visibleOptions = (group.values || []).filter(v => {
                    if (!v.name) return false;
                    const lower = (v.name || '').toLowerCase();
                    if (lower.includes('מפורק')) return false;
                    if (lower.includes('נטול')) return false;
                    if (lower.includes('רגיל') || lower.includes('default')) return false;
                    return true;
                  });

                  if (visibleOptions.length === 0) return null;

                  return (
                    <div key={group.id} className="flex flex-col gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                      <h4 className="text-sm font-black text-slate-800 px-1">{group.name}</h4>
                      <div className={`grid gap-2 ${isMultipleSelect ? 'grid-cols-3' : visibleOptions.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {visibleOptions.map(value => {
                          const IconComponent = getIconForValue(value.name, group.name);
                          const valueIdStr = String(value.id);
                          let isSelected;
                          if (isMultipleSelect) {
                            const selectedArray = Array.isArray(optionSelections[group.id])
                              ? optionSelections[group.id]
                              : [];
                            isSelected = selectedArray.some(id => String(id) === valueIdStr);
                          } else {
                            isSelected = String(optionSelections[group.id]) === valueIdStr;
                          }

                          const effectivePrice = value.priceAdjustment || 0;
                          if (effectivePrice > 0) console.log(`🍕 Option price: ${value.name} (Group: ${group.name}) = ${effectivePrice}`);

                          return (
                            <button
                              key={value.id}
                              onClick={() => toggleOption(group.id, String(value.id))}
                              className={`
                                relative flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl
                                font-semibold transition-all duration-200 touch-manipulation min-h-[88px] active:scale-95
                                ${isSelected
                                  ? "bg-orange-50 text-orange-600 ring-2 ring-orange-400 ring-offset-2 shadow-lg shadow-orange-100"
                                  : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md"
                                }
                              `}
                            >
                              <IconComponent
                                size={24}
                                strokeWidth={isSelected ? 2.5 : 2}
                                className={`transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}
                              />
                              <span className="text-sm text-center">{value.name || value.value_name}</span>
                              {effectivePrice > 0 && (
                                <span className={`text-xs font-medium ${isSelected ? "text-orange-500" : "text-slate-400"}`}>
                                  +₪{effectivePrice}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Special Options Row: Decaf | Note - AT BOTTOM */}
            <section className="mt-2">
              {(() => {
                const specialOptions = [];
                const isCoffeeItem = selectedItem?.name?.includes('אספרסו') ||
                  selectedItem?.name?.includes('הפוך') ||
                  selectedItem?.name?.includes('מוקה') ||
                  selectedItem?.name?.includes('אמריקנו');

                [...(optionGroups || [])].forEach(group => {
                  group.values?.forEach(val => {
                    if (val.name?.includes('מפורק')) {
                      specialOptions.push({ ...val, groupId: group.id });
                    }
                    if (val.name?.includes('נטול') && isCoffeeItem) {
                      specialOptions.push({ ...val, groupId: group.id });
                    }
                  });
                });

                specialOptions.sort((a, b) => {
                  const aIsDecaf = a.name?.includes('נטול');
                  const bIsDecaf = b.name?.includes('נטול');
                  if (aIsDecaf && !bIsDecaf) return -1;
                  if (!aIsDecaf && bIsDecaf) return 1;
                  return 0;
                });

                const hasSpecialOptions = specialOptions.length > 0;
                const gridCols = hasSpecialOptions ? 'grid-cols-2' : 'grid-cols-1';

                return (
                  <div className={`grid gap-3 ${gridCols}`}>
                    {hasSpecialOptions && (
                      <div className="flex gap-2">
                        {specialOptions.map(value => {
                          const IconComponent = getIconForValue(value.name, '');
                          const isSelected = String(optionSelections[value.groupId]) === String(value.id);
                          const effectivePrice = value.priceAdjustment || 0;
                          const displayName = value.name.includes('נטול') ? 'נטול קפאין' : 'מפורק';

                          return (
                            <button
                              key={value.id}
                              onClick={() => toggleOption(value.groupId, String(value.id))}
                              className={`flex-1 relative flex items-center justify-center gap-2 h-[50px] rounded-xl border transition-all duration-200 ${isSelected
                                ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-500'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              <IconComponent size={16} className={isSelected ? 'text-purple-600' : 'text-slate-400'} />
                              <span className={`text-sm font-bold ${isSelected ? 'text-purple-700' : 'text-slate-600'}`}>
                                {displayName}
                              </span>
                              {effectivePrice > 0 && (
                                <span className="text-[10px] text-slate-400 ml-1">+{effectivePrice}₪</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Note Input Pill - Only show if allow_notes is not false */}
                    {selectedItem?.allow_notes !== false && (
                      <div className={`relative flex items-center h-[50px] rounded-xl border transition-all duration-200 ${orderNote.length > 0
                        ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>

                        <input
                          type="text"
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          maxLength={20}
                          placeholder="הוסף הערה"
                          className={`w-full h-full bg-transparent text-center font-bold text-sm focus:outline-none px-2 placeholder:text-slate-400 ${orderNote.length > 0 ? 'text-orange-600' : 'text-slate-800'
                            }`}
                        />

                        {orderNote.length > 0 && (
                          <span className="absolute bottom-1 left-2 text-[9px] text-orange-400 font-medium">
                            {orderNote.length}/20
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>



          </div>

          {/* 🕵️‍♂️ VISUAL DEBUGGER v2.3.3 - Shows status directly on screen */}
          {isOpen && (
            <div
              dir="ltr"
              className="mx-3 mb-2 p-3 bg-slate-900/95 text-green-400 font-mono text-[10px] rounded-xl overflow-hidden shadow-2xl border border-slate-700"
              onClick={() => console.log('Debug Clicked')}
            >
              <div className="flex justify-between items-center border-b border-slate-700 pb-1 mb-1">
                <span className="font-bold text-white">🚧 DEBUGGER v2.3.3</span>
                <span className={dexieOptions && dexieOptions.length > 0 ? "text-green-400" : "text-red-400"}>
                  {dexieOptions && dexieOptions.length > 0 ? "DEXIE OK" : "DEXIE EMPTY"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <div>ITEM ID: <span className="text-white">{targetItemId}</span></div>
                <div>LOADING: <span className={isRemoteLoading ? "text-yellow-400 animate-pulse" : "text-slate-500"}>{isRemoteLoading ? "YES" : "NO"}</span></div>
                <div>REMOTE DATA: <span className={remoteData ? "text-green-400" : "text-slate-500"}>{remoteData ? `YES (${remoteData.length} grps)` : "NO"}</span></div>
                <div>FINAL SOURCE: <span className="text-white font-bold">{dexieOptions && dexieOptions.length ? 'DEXIE' : remoteData ? 'SUPABASE' : 'NONE'}</span></div>
              </div>

              {/* DETAILED GROUP BREAKDOWN */}
              <div className="mt-2 pt-1 border-t border-slate-700">
                <div className="font-bold mb-1">Group Breakdown:</div>
                {(dexieOptions || remoteData || []).map(g => (
                  <div key={g.id} className="flex justify-between text-[9px] border-b border-slate-800 pb-0.5">
                    <span className="truncate w-24">{g.name}</span>
                    <span className={g.values && g.values.length > 0 ? "text-green-400" : "text-red-500 font-bold"}>
                      {g.values?.length || 0} vals
                    </span>
                  </div>
                ))}
              </div>

              {/* Error Display if exists */}
              {(dexieOptions && dexieOptions.length && dexieOptions.some(g => !g.values || g.values.length === 0)) && (
                <div className="mt-1 text-red-500 bg-red-900/20 p-1 rounded">
                  ⚠️ DEXIE: Groups found but VALUES MISSING!
                </div>
              )}
            </div>
          )}

          <div className="p-3 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="w-1/3 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors active:scale-95"
              >
                ביטול
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 bg-slate-900 hover:bg-black text-white h-12 rounded-2xl flex items-center justify-between px-6 text-base font-bold shadow-xl shadow-slate-300/50 transition-colors active:scale-98"
              >
                <span>הוסף להזמנה</span>
                <div className="flex items-center gap-2 bg-white/15 px-3 py-1 rounded-xl">
                  <span>₪{totalPrice}</span>
                  <Check size={16} />
                </div>
              </button>
            </div>
          </div>
        </div >
      </div >
    );
  } catch (error) {
    console.error("ModifierModal crashed:", error, error.message, error.stack);
    return null;
  }
};

export default React.memo(ModifierModal);
