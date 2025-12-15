import React, { useEffect, useState, useMemo } from 'react';

import { X, ChevronDown, ChevronUp } from 'lucide-react';

import Button from '../../../components/ui/Button';

import { fetchManagerItemOptions } from '@/lib/managerApi';

const formatPrice = (price = 0) => {
  const numPrice = Number(price);
  return numPrice > 0 ? `+${numPrice}₪` : '';
};

const ModifierModal = (props) => {
  const { isOpen, selectedItem, onClose, onAddItem } = props;

  // Early return if no selected item or not open
  if (!isOpen || !selectedItem) {
    return null;
  }

  const [optionGroups, setOptionGroups] = useState([]);

  const [optionSelections, setOptionSelections] = useState({});

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset state when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      setOptionGroups([]);
      setOptionSelections({});
      setShowAdvanced(false);
    }
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!isOpen || !selectedItem) {
      return;
    }

    const loadOptions = async () => {

      try {

        const options = await fetchManagerItemOptions(selectedItem.id);

        if (!options || options.length === 0) {

          onAddItem?.({

            ...selectedItem,

            selectedOptions: [],

            totalPrice: selectedItem.price,

            price: selectedItem.price

          });

          onClose();

          return;

        }

        setOptionGroups(options);
        console.log('🔍 Loaded Option Groups:', options);

        const defaults = {};

        // אם יש בחירות קיימות מ-selectedItem (לעריכה), השתמש בהן
        const existingSelections = selectedItem.selectedOptions || [];

        options.forEach(group => {

          // חפש אם יש בחירה קיימת לקבוצה הזו
          const existingChoice = existingSelections.find(opt =>
            String(opt.groupId) === String(group.id)
          );

          if (existingChoice) {
            // מצא את האפשרות המתאימה לפי valueId או valueName
            const existingVal = group.values?.find(v =>
              String(v.id) === String(existingChoice.valueId)
            );
            if (existingVal) {
              defaults[group.id] = String(existingVal.id);
              return;
            }
          }

          // אם אין בחירה קיימת, השתמש בברירת מחדל
          const defaultVal = group.values?.find(v => v.is_default) ||
            group.values?.find(v => v.name?.includes('רגיל')) ||
            group.values?.[0];

          if (defaultVal) defaults[group.id] = String(defaultVal.id);

        });

        setOptionSelections(defaults);

        // Auto-open advanced options if there are existing selections in non-milk groups
        // Check if there are any selections in groups other than milk
        // This includes both default and non-default selections
        const hasOtherGroupSelections = options.some((group) => {
          // Skip milk group
          const isMilkGroup = group.name?.toLowerCase().includes('חלב');
          if (isMilkGroup) return false;

          // Check if there's a selection for this group
          return existingSelections.some(opt =>
            String(opt.groupId) === String(group.id)
          );
        });

        // Check if there's NO milk group (water-based drinks like Americano)
        const hasMilkGroup = options.some(g => g.name?.toLowerCase().includes('חלב'));

        // Open advanced options if there are selections in other groups (even if defaults)
        // OR if there's no milk group at all
        if ((hasOtherGroupSelections && options.length > 1) || !hasMilkGroup) {
          setShowAdvanced(true);
        }

      } catch (err) {

        console.error(err);

        onAddItem?.({ ...selectedItem, selectedOptions: [], totalPrice: selectedItem.price });

        onClose();

      }

    };

    loadOptions();

  }, [isOpen, selectedItem?.id]);

  // מיין קבוצות: חלב ראשון, אחרי זה השאר - memoized

  const sortedGroups = useMemo(() => {
    if (!selectedItem || !optionGroups?.length) return [];
    return [...optionGroups].sort((a, b) => {
      const aIsMilk = a.name?.toLowerCase().includes('חלב');
      const bIsMilk = b.name?.toLowerCase().includes('חלב');
      if (aIsMilk && !bIsMilk) return -1;
      if (!aIsMilk && bIsMilk) return 1;
      return 0;
    });
  }, [optionGroups, selectedItem?.id]);

  const milkGroup = sortedGroups?.[0];

  const otherGroups = sortedGroups?.slice(1) || [];

  const totalPrice = useMemo(() => {
    if (!selectedItem) return 0;

    let sum = Number(selectedItem?.price || 0);

    optionGroups.forEach(group => {

      const selectedId = optionSelections[group.id];

      if (!selectedId) return;

      const value = group.values?.find(v => String(v.id) === selectedId);

      // Use priceAdjustment from normalized data
      const effectivePrice = Number(value?.priceAdjustment || 0);

      if (effectivePrice > 0) {
        sum += Number(effectivePrice);
      }

    });

    return sum;

  }, [selectedItem?.price, optionGroups, optionSelections]);

  const toggleOption = (groupId, valueId) => {
    if (!selectedItem) return;

    setOptionSelections(prev => {

      const current = prev[groupId];

      if (current === valueId) {

        // לחיצה שנייה → חזרה לברירת מחדל ("רגיל")

        const group = optionGroups.find(g => g.id === groupId);

        const defaultVal = group.values?.find(v => v.is_default) ||

          group.values?.find(v => v.name?.includes('רגיל')) ||

          group.values?.[0];

        return { ...prev, [groupId]: defaultVal ? String(defaultVal.id) : null };

      }

      return { ...prev, [groupId]: valueId };

    });

  };

  const handleAdd = () => {

    const selectedOptions = optionGroups.flatMap(group => {

      const selId = optionSelections[group.id];

      if (!selId) return [];

      const val = group.values.find(v => String(v.id) === selId);

      if (!val) return [];

      // Use priceAdjustment from normalized data
      const effectivePrice = Number(val.priceAdjustment || 0);

      if (val.name?.includes('רגיל') && effectivePrice === 0) return [];

      return [{

        groupId: group.id,

        groupName: group.name,

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

      totalPrice,

      price: totalPrice

    });

    onClose();

  };

  if (!isOpen || !selectedItem) return null;

  // Additional safety check
  if (!optionGroups || optionGroups.length === 0) {
    return null;
  }

  try {
    return (

      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-heebo"
        dir="rtl"
        onClick={onClose}
      >

        {/* שינוי רוחב: max-w-lg (כ-460px) + עיצוב Flat: רקע אפור בהיר */}
        <div
          className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >

          {/* Header - תמונה ושם, ללא כפתור סגירה */}
          <div className="flex items-center gap-4 p-4 border-b bg-white z-10 shrink-0">
            {selectedItem.image ? (
              <img
                src={selectedItem.image}
                alt={selectedItem.name}
                className="w-14 h-14 rounded-full object-cover border border-gray-100"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-xl border border-gray-200">
                ☕
              </div>
            )}
            <h2 className="text-xl font-black text-gray-800 leading-tight">{selectedItem.name}</h2>
          </div>

          {/* Body - גלילה */}
          <div className="p-3 overflow-y-auto flex-1">

            <div className="space-y-5">

              {/* 1. שורת חלב (אם קיים) - כרטיסייה לבנה */}
              {milkGroup && milkGroup.values && (
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-black text-slate-800 mb-3 px-1">{milkGroup.name}</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide justify-center">
                    {(() => {
                      const seen = new Set();
                      return milkGroup.values?.filter(value => {
                        const name = value.name || '';
                        // Remove unwanted options
                        if (name.includes('נטול קפאין') || name.includes('מפורק')) return false;
                        if (name.includes('ללא')) return false;

                        const shortName = name.includes('סויה') ? 'סויה' : name.includes('שיבולת') ? 'שיבולת' : name.includes('שקדים') ? 'שקדים' : name.includes('רגיל') ? 'רגיל' : name;
                        if (seen.has(shortName)) return false;
                        seen.add(shortName);
                        return true;
                      }).map(value => {
                        let displayName = value.name;
                        let icon = '🥛';
                        if (displayName.includes('סויה')) { displayName = 'סויה'; icon = '🌱'; }
                        else if (displayName.includes('שיבולת')) { displayName = 'שיבולת'; icon = '🌾'; }
                        else if (displayName.includes('שקדים')) { displayName = 'שקדים'; icon = '🥜'; }
                        else if (displayName.includes('רגיל')) { displayName = 'רגיל'; icon = '🥛'; }
                        else if (displayName.includes('חצי') && displayName.includes('מים')) { displayName = 'חצי חצי'; icon = '🌗'; }

                        const isSelected = String(optionSelections[milkGroup.id]) === String(value.id);
                        const effectivePrice = value.priceAdjustment || 0;
                        const priceText = formatPrice(effectivePrice);

                        return (
                          <button
                            key={value.id}
                            onClick={() => toggleOption(milkGroup.id, String(value.id))}
                            className={`flex-1 py-3 px-2 rounded-xl text-sm font-bold transition-all duration-200 flex flex-col items-center justify-center min-h-[80px] min-w-[80px] ${isSelected
                              ? 'bg-orange-500 text-white shadow-md transform scale-[1.02] ring-2 ring-orange-600 ring-offset-1'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                              }`}
                          >
                            <span className="text-2xl mb-1">{icon}</span>
                            <span>{displayName}</span>
                            {effectivePrice > 0 && <span className="text-[10px] mt-1">{priceText}</span>}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* 2. שאר האפשרויות - טורים אנכיים (3 טורים) */}
              {otherGroups.length > 0 && (
                <div className="grid grid-cols-3 gap-4 items-start justify-center">
                  {(() => {
                    const displayed = new Set();
                    return otherGroups.map((group) => {
                      const visibleOptions = (group.values || []).filter(v => {
                        if (!v.name) return false;
                        const clean = v.name.replace(/\(כפול\)/g, '').trim();
                        const lower = clean.toLowerCase();
                        // Remove unwanted options and duplicates
                        if (lower.includes('מפורק')) return false;
                        if (lower.includes('נטול')) return false; // Filter out decaf - will show in special section
                        if (lower.includes('רגיל') || lower.includes('default')) return false;
                        if (displayed.has(lower)) return false;
                        displayed.add(lower);
                        return true;
                      });

                      if (visibleOptions.length === 0) return null;

                      return (
                        <div key={group.id} className="flex flex-col gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                          <h4 className="text-sm font-black text-slate-800 px-1">{group.name}</h4>
                          <div className={`flex gap-2 ${
                            // Check if this group has espresso length options (with icons)
                            visibleOptions.some(v =>
                              v.name.includes('קצר') ||
                              v.name.includes('ארוך') ||
                              v.name.toLowerCase().includes('ristretto') ||
                              v.name.toLowerCase().includes('lungo')
                            ) ? 'flex-row' : 'flex-col'
                            }`}>
                            {visibleOptions.map(value => {
                              const cleanName = value.name.replace(/\(כפול\)/g, '').trim();
                              const isSelected = String(optionSelections[group.id]) === String(value.id);
                              const effectivePrice = value.priceAdjustment || 0;
                              const priceText = formatPrice(effectivePrice);

                              // Add icons for espresso length options
                              let icon = null;
                              let displayName = cleanName;
                              if (cleanName.includes('קצר') || cleanName.toLowerCase().includes('ristretto')) {
                                icon = '☕';
                                displayName = 'קצר';
                              } else if (cleanName.includes('ארוך') || cleanName.includes('ארוק') || cleanName.toLowerCase().includes('lungo')) {
                                icon = '🫗';
                                displayName = 'ארוך';
                              }

                              return (
                                <button
                                  key={value.id}
                                  onClick={() => toggleOption(group.id, String(value.id))}
                                  className={`py-3 px-4 rounded-xl text-base font-bold transition-all duration-200 border ${icon ? 'flex-1' : 'w-full'} ${icon
                                    ? `flex flex-col items-center justify-center min-h-[80px] ${isSelected
                                      ? 'bg-orange-500 text-white shadow-md transform scale-[1.02] ring-2 ring-orange-600 ring-offset-1 border-transparent'
                                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                                    }`
                                    : `text-center ${isSelected
                                      ? 'bg-slate-800 text-white shadow-md transform scale-[1.02] ring-2 ring-slate-900 ring-offset-1 border-transparent'
                                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                                    }`
                                    }`}
                                >
                                  {icon && <span className="text-2xl mb-1">{icon}</span>}
                                  <span>{displayName}</span>
                                  {effectivePrice > 0 && <span className={`text-xs ${icon ? 'mt-1' : 'opacity-70'}`}>{icon ? priceText : `(${priceText})`}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* 3. שורה תחתונה: מפורק + נטול (מוקטנים) */}
              {(() => {
                const specialOptions = [];
                [...optionGroups].forEach(group => {
                  group.values?.forEach(val => {
                    if (val.name?.includes('מפורק') || val.name?.includes('נטול')) {
                      specialOptions.push({ ...val, groupId: group.id });
                    }
                  });
                });

                // Sort: נטול first, then מפורק
                specialOptions.sort((a, b) => {
                  const aIsDecaf = a.name?.includes('נטול');
                  const bIsDecaf = b.name?.includes('נטול');
                  if (aIsDecaf && !bIsDecaf) return -1;
                  if (!aIsDecaf && bIsDecaf) return 1;
                  return 0;
                });

                if (specialOptions.length === 0) return null;

                return (
                  <div className="flex gap-2 pt-3 border-t border-gray-100 mt-2">
                    {specialOptions.map(value => {
                      const isSelected = String(optionSelections[value.groupId]) === String(value.id);
                      const effectivePrice = value.priceAdjustment || 0;
                      const priceText = formatPrice(effectivePrice);
                      const isDecaf = value.name.includes('נטול');
                      const icon = isDecaf ? '🚫' : '🧩';
                      const displayName = isDecaf ? 'נטול' : 'מפורק'; // קיצור שם

                      return (
                        <button
                          key={value.id}
                          onClick={() => toggleOption(value.groupId, String(value.id))}
                          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 border ${isSelected
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                            }`}
                        >
                          <span className="text-lg">{icon}</span>
                          <span>{displayName} {priceText}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

            </div>

          </div>

          {/* Footer - כפתור ביטול והוספה */}
          <div className="p-4 border-t bg-white sticky bottom-0 z-20 flex gap-3">

            {/* כפתור ביטול */}
            <Button
              onClick={onClose}
              className="flex-1 h-14 text-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold rounded-xl transition-all"
            >
              ביטול
            </Button>

            {/* כפתור הוספה */}
            <Button
              onClick={handleAdd}
              className="flex-[2] h-14 text-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <span>הוסף</span>
              <span className="text-lg font-mono">{totalPrice}₪</span>
            </Button>

          </div>

        </div>

      </div>

    );
  } catch (error) {
    console.error('ModifierModal render error:', error);
    return null;
  }

};

export default ModifierModal;
