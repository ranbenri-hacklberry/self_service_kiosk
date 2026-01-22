import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Check, Info, AlertTriangle, Plus, Minus, MessageSquare,
  Trash2, Coffee, Milk, Layers, ShoppingCart, Loader2,
  Cloud, CloudOff, Thermometer, Flame, Droplets, Leaf, Wheat, Nut,
  Zap, Ban, Puzzle, ArrowUpFromLine, ArrowDownToLine, Blend, Gauge, Apple, Disc
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
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
  const { isDarkMode } = useTheme();
  const numericPrice = Number(price || 0);
  return (
    <button
      onClick={onClick}
      className={`
        relative flex-1 flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl
        font-semibold transition-all duration-200 touch-manipulation min-h-[88px] active:scale-95
        ${isSelected
          ? (isDarkMode ? "bg-orange-500/20 text-orange-400 ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-900 shadow-lg shadow-orange-500/10" : "bg-orange-50 text-orange-600 ring-2 ring-orange-400 ring-offset-2 shadow-lg shadow-orange-100")
          : (isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 shadow-sm" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md")
        }
      `}
    >
      <Icon
        size={24}
        strokeWidth={isSelected ? 2.5 : 2}
        className={`transition-transform duration-200 ${isSelected ? "scale-110" : ""}`}
      />
      <span className="text-sm">{label}</span>
      {numericPrice > 0 && (
        <span className={`text-xs font-medium ${isSelected ? "text-orange-500" : "text-slate-400"}`}>
          +₪{numericPrice}
        </span>
      )}
    </button>
  );
};

// Modifier Pill Button
const ModifierPill = ({ label, Icon, isSelected, onClick, variant = "default", price }) => {
  const { isDarkMode } = useTheme();
  const numericPrice = Number(price || 0);
  const selectedStyles =
    variant === "purple"
      ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
      : (isDarkMode ? "bg-slate-200 text-slate-900 shadow-lg" : "bg-slate-800 text-white shadow-lg shadow-slate-300");

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl
        font-bold transition-all duration-200 touch-manipulation active:scale-95
        ${isSelected
          ? selectedStyles
          : (isDarkMode ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700" : "bg-white text-slate-600 border border-slate-100 shadow-sm hover:shadow-md hover:bg-slate-50")
        }
      `}
    >
      <Icon size={18} strokeWidth={isSelected ? 2.5 : 2} />
      <span className="text-sm">{label}</span>
      {numericPrice > 0 && (
        <span className={`text-xs ${isSelected ? "text-white/80" : "text-slate-400"}`}>
          +₪{numericPrice}
        </span>
      )}
    </button>
  );
};

const ModifierModal = (props) => {
  const { isOpen, selectedItem, onClose, onAddItem } = props;
  const { isDarkMode } = useTheme();
  const [orderNote, setOrderNote] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [optionSelections, setOptionSelections] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(true); // 🔥 Forced Open
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
    return rawId;
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
  const [rawDebugData, setRawDebugData] = useState(null);
  const [debugStep, setDebugStep] = useState('IDLE'); // 🔥 NEW: Step Tracker // 🔥 NEW: Raw Debug v2.3.7
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
            // Ensure numeric price, check all possible keys
            priceAdjustment: Number(v.price_adjustment !== undefined ? v.price_adjustment : (v.priceAdjustment !== undefined ? v.priceAdjustment : 0)),
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

  // 2. Fallback to Supabase (RPC BYPASS v2) - v2.4.1
  useEffect(() => {
    if (!isOpen || !targetItemId) return;
    if (dexieOptions && dexieOptions.length > 0) return;
    if (isRemoteLoading || remoteData) return;

    const fetchRemote = async () => {
      setIsRemoteLoading(true);
      setRawDebugData(null);
      setDebugStep('INIT_BYPASS');

      const updateStep = (step, data = null) => {
        console.log(`🪜 STEP: ${step}`);
        setDebugStep(step);
        if (data) setRawDebugData(prev => Array.isArray(prev) ? [...prev, { step, data }] : [{ step, data }]);
      };

      try {
        const tId = targetItemId;

        // A. FETCH GROUPS
        updateStep('FETCH_GROUPS');
        const { data: privGroups } = await supabase.from('optiongroups').select('*').eq('menu_item_id', tId);
        const { data: links } = await supabase.from('menuitemoptions').select('group_id').eq('item_id', tId);

        let sharedGroups = [];
        if (links && links.length > 0) {
          const linkIds = links.map(l => l.group_id);
          const { data: sGroups } = await supabase.from('optiongroups').select('*').in('id', linkIds);
          sharedGroups = sGroups || [];
        }

        const allGroupsRaw = [...(privGroups || []), ...sharedGroups];

        // DEDUPLICATE GROUPS BY ID IMMEDIATELY
        const allGroupsMap = new Map();
        allGroupsRaw.forEach(g => {
          if (g && g.id && !allGroupsMap.has(g.id)) {
            allGroupsMap.set(g.id, g);
          }
        });
        const allGroups = Array.from(allGroupsMap.values());

        updateStep(`GOT_${allGroups.length}_UNIQUE_GROUPS`, allGroups);

        if (allGroups.length === 0) {
          setRemoteData([]);
          return;
        }

        // B. FETCH VALUES via RPC BYPASS
        const groupIds = allGroups.map(g => g.id);
        updateStep('RPC_VALUES_CALL', { groupIds });

        // 🔥 CALL RPC with detailed error capture
        const { data: allValues, error: vErr } = await supabase
          .rpc('get_values_for_groups', { target_group_ids: groupIds });

        if (vErr) {
          console.error("RPC Error Details:", vErr);
          // 🔥 LOG THE ERROR EXPLICITLY TO DEBUGGER
          updateStep('RPC_ERROR', {
            msg: vErr.message,
            code: vErr.code,
            details: vErr.details,
            hint: vErr.hint
          });

          // Fallback
          updateStep('FALLBACK_START');
          const { data: fbValues, error: fbErr } = await supabase.from('optionvalues').select('*').in('group_id', groupIds);

          if (fbErr) updateStep('FALLBACK_ERROR', fbErr);
          else updateStep(`GOT_${fbValues?.length}_VALS_FALLBACK`, fbValues);

          const result = allGroups.map(g => ({
            ...g,
            values: (fbValues || [])
              .filter(v => v.group_id === g.id)
              .map(v => ({
                ...v,
                name: v.name || v.value_name || 'Unk',
                // Fallback Mapping
                priceAdjustment: Number(v.price_adjustment !== undefined ? v.price_adjustment : (v.priceAdjustment !== undefined ? v.priceAdjustment : 0))
              }))
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          }));
          setRemoteData(result);
          return;
        }

        updateStep(`RPC_SUCCESS_${allValues?.length}`, allValues);

        // C. MERGE
        const result = allGroups.map(g => ({
          ...g,
          values: (allValues || [])
            .filter(v => v.group_id === g.id)
            .map(v => ({
              ...v,
              name: v.name || v.value_name || 'Unk',
              // Bypass Mapping
              priceAdjustment: Number(v.price_adjustment !== undefined ? v.price_adjustment : (v.priceAdjustment !== undefined ? v.priceAdjustment : 0))
            }))
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        }));

        setRemoteData(result);
        updateStep('DONE_BYPASS');

      } catch (err) {
        console.error("Bypass Fetch Error:", err);
        setRawDebugData({ error: err.message, step: 'CRASH' });
        setDebugStep('ERROR');
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
    // Put KDS prep decision (extraGroups) FIRST so it appears at the top
    const combined = [...fromProps, ...raw];

    const uniqueMap = new Map();
    combined.forEach(g => {
      // DEDUP BY NAME: If we have multiple groups with the same name (e.g. from local & remote)
      // we merge them. This prevents "תוספות" appearing twice.
      const normalizedName = (g.name || '').trim();
      const key = normalizedName;

      if (!uniqueMap.has(key)) {
        const valMap = new Map();
        (g.values || []).forEach(v => {
          const vName = (v.name || v.value_name || '').trim();
          if (!valMap.has(vName)) {
            valMap.set(vName, {
              ...v,
              name: vName,
              priceAdjustment: v.priceAdjustment || v.price_adjustment || 0
            });
          }
        });

        uniqueMap.set(key, {
          ...g,
          id: g.id || `temp-${normalizedName}`,
          name: normalizedName,
          values: Array.from(valMap.values()).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
          is_required: g.is_required || (g.min_selection > 0)
        });
      }
    });

    // Sort: Keep KDS prep decision at top, then alphabetical
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const aIsKds = String(a.id).startsWith('kds_');
      const bIsKds = String(b.id).startsWith('kds_');
      if (aIsKds && !bIsKds) return -1;
      if (!aIsKds && bIsKds) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
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
    if (!optionGroups?.length) {
      return {
        milkGroup: null, foamGroup: null, tempGroup: null,
        baseGroup: null, strengthGroup: null, otherGroups: []
      };
    }

    // Helper functions
    const normalize = (str) => (str || '').toLowerCase();
    const hasValue = (group, keyword) => {
      return group.values?.some(v => {
        const valName = normalize(v.name || v.value_name);
        return valName.includes(keyword);
      });
    };
    const checkGroup = (group, keywords, category) => {
      const title = normalize(group.title || group.name);
      return keywords.some(k => title.includes(k));
    };

    // Pool of available groups
    let candidates = [...optionGroups];

    // Helper to find and extract a group
    const extractGroup = (predicate) => {
      const index = candidates.findIndex(predicate);
      if (index !== -1) {
        const group = candidates[index];
        candidates.splice(index, 1); // Remove from pool
        return group;
      }
      return null;
    };

    // 1. Milk
    const milk = extractGroup(g => {
      if (checkGroup(g, ['חלב', 'milk'], 'milk')) return true;
      return hasValue(g, 'סויה') || hasValue(g, 'שיבולת') || hasValue(g, 'שקדים');
    });

    // 2. Foam
    const foam = extractGroup(g => checkGroup(g, ['קצף', 'foam'], 'texture') || hasValue(g, 'קצף'));

    // 3. Temp
    const temp = extractGroup(g =>
      checkGroup(g, ['טמפרטורה', 'חום', 'temp'], 'temperature') || hasValue(g, 'רותח') || hasValue(g, 'פושר')
    );

    // 4. Base (with logic for Coffee items)
    const isCoffeeItem = selectedItem?.name?.includes('קפה') ||
      selectedItem?.name?.includes('הפוך') ||
      selectedItem?.name?.includes('אספרסו') ||
      selectedItem?.name?.includes('נס') ||
      selectedItem?.name?.includes('מקיאטו');

    const base = extractGroup(g => {
      const matchesBase = checkGroup(g, ['בסיס', 'base', 'water'], 'base') || hasValue(g, 'בסיס') || hasValue(g, 'מים');
      if (!matchesBase) return false;

      // Special check for coffee items to be stricter
      if (isCoffeeItem) {
        const hasWaterOrMilkBase = g.values.some(v =>
          v?.name?.includes('מים') || v?.name?.includes('חלב') || v?.name?.includes('סודה')
        );
        if (!hasWaterOrMilkBase) return false;
      }
      return true;
    });

    // 5. Strength
    const strength = extractGroup(g =>
      checkGroup(g, ['חוזק', 'strength'], 'strength') || hasValue(g, 'חזק') || hasValue(g, 'חלש')
    );

    // 6. Exclude "optionsGroup" if it exists (but treat as 'other' if needed, here logic was to exclude it from 'others' but not assign it?)
    // The original code excluded `optionsGroup` (matching 'אפשרויות'/'תוספות מיוחדות') from 'others' but didn't assign it anywhere visible?
    // If the user wants it visible, it should be in 'others'.
    // If it was meant to be hidden, we should check why.
    // Looking at original code: `const optionsGroup = ...` then `exclusions` included it.
    // So distinct special 'options' group was hidden from 'others'.
    // We will replicate that behavior: extract it but don't assign to `otherGroups`.
    const specialHidden = extractGroup(g =>
      g.name?.includes('אפשרויות') || g.name?.includes('תוספות מיוחדות')
    );

    // Remaining groups are 'others'
    const others = [specialHidden, ...candidates].filter(Boolean).filter(g => g !== specialHidden); // Re-add if we want, or keep hidden?
    // Original logic: `return !exclusions.includes(g.id);` where `optionsGroup?.id` was an exclusion.
    // So it was truly hidden.
    // We will leave `specialHidden` out of `others`.

    return {
      milkGroup: milk, foamGroup: foam, tempGroup: temp,
      baseGroup: base, strengthGroup: strength, otherGroups: candidates // candidates now only holds the rest
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
        // Allow uncheck if NOT required
        if (!group.is_required) {
          return { ...prev, [groupId]: null };
        }

        // Otherwise revert to default logic
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


  // console.log('🚀 ModifierModal Reaching Return Statement - Rendering JSX');
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      dir="rtl"
      onClick={onClose}
    >
      {/* Backdrop */}
      {/* The backdrop is now part of the main container div */}

      {/* Modal */}
      <div
        className={`relative w-auto max-w-[90vw] min-w-[420px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-[#FAFAFA]'
          }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`backdrop-blur-xl px-6 py-4 flex items-center sticky top-0 z-20 border-b transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100/50'
          }`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${isDarkMode ? 'bg-orange-500/10 text-orange-400' : 'bg-gradient-to-br from-orange-100 to-orange-50 text-orange-500'
              }`}>
              <Coffee size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedItem.name}</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>התאמה אישית</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px]">

          {/* 1. Milk Selection - Hero - MOVED TO TOP EXPLICITLY */}
          {milkGroup && milkGroup.values && !isEspresso && (
            <section className="order-first mb-4">
              <div className={`p-2 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
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
            <div className={`p-4 text-center rounded-xl border border-dashed mb-4 ${isDarkMode ? 'text-slate-500 bg-slate-800/50 border-slate-700' : 'text-slate-500 bg-slate-50 border-slate-200'
              }`}>
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
                  <div key={group.id} className={`flex flex-col gap-2 p-3 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
                    }`}>
                    <h4 className={`text-sm font-black px-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{group.name}</h4>
                    <div className={`grid gap-2 ${isMultipleSelect ? 'grid-cols-3' : visibleOptions.length === 4 ? 'grid-cols-2' : visibleOptions.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
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

                        const effectivePrice = Number(value.priceAdjustment || 0);
                        if (effectivePrice > 0) console.log(`🍕 Option price: ${value.name} (Group: ${group.name}) = ${effectivePrice}`);

                        return (
                          <button
                            key={value.id}
                            onClick={() => toggleOption(group.id, String(value.id))}
                            className={`
                                relative flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-2xl
                                font-semibold transition-all duration-200 touch-manipulation min-h-[88px] active:scale-95
                                ${isSelected
                                ? (isDarkMode ? "bg-orange-500/20 text-orange-400 ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-800 shadow-lg shadow-orange-500/10" : "bg-orange-50 text-orange-600 ring-2 ring-orange-400 ring-offset-2 shadow-lg shadow-orange-100")
                                : (isDarkMode ? "bg-slate-900 text-slate-400 hover:bg-slate-700 border border-slate-700 shadow-sm" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md")
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

              const seenNames = new Set();
              [...(optionGroups || [])].forEach(group => {
                group.values?.forEach(val => {
                  const name = val.name || '';
                  if (name.includes('מפורק') && !seenNames.has('מפורק')) {
                    specialOptions.push({ ...val, groupId: group.id });
                    seenNames.add('מפורק');
                  }
                  if (name.includes('נטול') && !seenNames.has('נטול')) {
                    specialOptions.push({ ...val, groupId: group.id });
                    seenNames.add('נטול');
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

              console.log('🔍 SPECIAL OPTIONS DEBUG:');
              specialOptions.forEach((o, idx) => {
                console.log(`  [${idx}] Name: "${o.name}" | ID: ${o.id} | GroupID: ${o.groupId}`);
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
                              ? (isDarkMode ? 'bg-purple-900/30 border-purple-500 ring-1 ring-purple-500' : 'bg-purple-50 border-purple-200 ring-1 ring-purple-500')
                              : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')
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
                      : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')
                      }`}>

                      <input
                        type="text"
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        maxLength={20}
                        placeholder="הוסף הערה"
                        className={`w-full h-full bg-transparent text-center font-bold text-sm focus:outline-none px-2 placeholder:text-slate-400 ${orderNote.length > 0
                          ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                          : (isDarkMode ? 'text-slate-300' : 'text-slate-800')
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




        <div className={`p-3 border-t shadow-[0_-10px_30px_rgba(0,0,0,0.03)] transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`w-1/3 h-12 rounded-2xl font-bold transition-colors active:scale-95 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
            >
              ביטול
            </button>
            <button
              onClick={handleAdd}
              className={`flex-1 h-12 rounded-2xl flex items-center justify-between px-6 text-base font-bold transition-colors active:scale-98 shadow-xl ${isDarkMode ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-900/20' : 'bg-slate-900 hover:bg-black text-white shadow-slate-300/50'
                }`}
            >
              <span>הוסף להזמנה</span>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-xl ${isDarkMode ? 'bg-black/20' : 'bg-white/15'}`}>
                <span>₪{totalPrice}</span>
                <Check size={16} />
              </div>
            </button>
          </div>
        </div>
      </div >
    </div >
  );

};

export default React.memo(ModifierModal);
