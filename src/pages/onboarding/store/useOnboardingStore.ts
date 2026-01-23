import { create } from 'zustand';
import { onboarding_sessions } from '../../../db/database';
import { OnboardingItem, AtmosphereSeed } from '../types/onboardingTypes';
import { validateMenuRow, mapRowToItem, validateModifierGroups, enrichItemVisually, generateImagePrompt, generateImageGemini } from '../logic/onboardingLogic';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';

interface OnboardingState {
    // State
    sessionId: number | null;
    businessId: number | string | null;
    step: number;
    items: OnboardingItem[];
    atmosphereSeeds: AtmosphereSeed[];
    isLoading: boolean;
    error: string | null;
    eventSource: EventSource | null; // 🆕 Track active stream

    // AI Generation
    isGenerating: boolean;
    generationProgress: number;
    currentItemName: string | null;
    geminiApiKey: string | null;
    businessContext: string | null; // 🆕 Global context (e.g., "Nursery", "Coffee Shop")
    setGeminiApiKey: (key: string) => void;
    setBusinessContext: (context: string) => void;

    // Actions
    initSession: (businessId: string | number) => Promise<void>;
    saveSession: () => Promise<void>;
    setStep: (step: number) => void;
    addAtmosphereSeed: (seed: AtmosphereSeed) => void;
    removeAtmosphereSeed: (id: string) => void;
    processExcelData: (rows: any[]) => Promise<void>;
    updateItem: (itemId: string, updates: Partial<OnboardingItem>, saveToCloud?: boolean) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    addNewItem: (category?: string) => void;
    cleanupDuplicates: () => void;
    applyAtmosphereToCategory: (category: string, backgroundId?: string, containerId?: string) => void;
    startLiveGeneration: () => Promise<void>;
    cancelGeneration: () => Promise<void>;
    regenerateSingleItem: (itemId: string) => Promise<void>;
    uploadOriginalImage: (itemId: string, file: File) => Promise<string>;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
    sessionId: null,
    businessId: null,
    step: 1,
    items: [],
    atmosphereSeeds: [],
    isLoading: false,
    error: null,
    isGenerating: false,
    generationProgress: 0,
    currentItemName: null,
    eventSource: null,
    geminiApiKey: localStorage.getItem('onboarding_gemini_api_key'),
    businessContext: null,

    setGeminiApiKey: (key) => {
        localStorage.setItem('onboarding_gemini_api_key', key);
        set({ geminiApiKey: key });
    },
    setBusinessContext: (context) => {
        set({ businessContext: context });
    },

    initSession: async (businessId) => {
        set({ isLoading: true, businessId });
        try {
            // 1. Fetch API Key
            const { data: businessData } = await supabase
                .from('businesses')
                .select('gemini_api_key')
                .eq('id', businessId)
                .single();

            if (businessData?.gemini_api_key) {
                set({ geminiApiKey: businessData.gemini_api_key });
            }

            // 2. Load existing items from Supabase
            console.log(`📡 Fetching existing menu items for business ${businessId}...`);
            const { data: cloudItems, error: cloudError } = await supabase
                .from('menu_items')
                .select('*')
                .eq('business_id', businessId)
                .order('name');

            if (cloudError) throw cloudError;

            // Map Supabase items to OnboardingItem type
            const mappedCloudItems: OnboardingItem[] = (cloudItems || []).map((ci: any) => ({
                id: ci.id,
                name: ci.name,
                category: ci.category || 'General',
                description: ci.description || '',
                price: ci.price || 0,
                salePrice: ci.sale_price,
                productionArea: ci.production_area || 'Kitchen',
                ingredients: ci.ingredients || [],
                imageUrl: ci.image_url,
                modifiers: ci.modifiers || [],
                status: 'completed', // Existing items are considered completed
                visualDescription: ci.visual_description,
                prompt: ci.ai_prompt
            }));

            // 3. Check Dexie session for progress
            const existing: any = await onboarding_sessions
                .where('business_id')
                .equals(businessId)
                .last();

            if (existing) {
                // Merge cloud items with session items (prefer cloud items for consistency if IDs match)
                const sessionIds = new Set((existing.items || []).map((i: any) => i.id));
                const uniqueCloudItems = mappedCloudItems.filter(ci => !sessionIds.has(ci.id));
                const mergedItems = [...(existing.items || []), ...uniqueCloudItems];

                set({
                    sessionId: existing.id,
                    step: existing.step,
                    items: mergedItems,
                    atmosphereSeeds: existing.atmosphereSeeds || [],
                    isLoading: false
                });

                // Cleanup visual duplicates (same name/category) immediately after merge
                get().cleanupDuplicates();
            } else {
                const id = await onboarding_sessions.add({
                    business_id: businessId,
                    step: 2, // Start at step 2 if we found items
                    items: mappedCloudItems,
                    atmosphereSeeds: [],
                    updated_at: Date.now()
                });
                set({
                    sessionId: id as number,
                    step: 2,
                    items: mappedCloudItems,
                    atmosphereSeeds: [],
                    isLoading: false
                });
            }

            // 🆕 Global Context Detection
            const allItems = get().items;
            const plantKeywords = ['צמח', 'פרח', 'משתלה', 'עונתי', 'שתיל', 'עציץ', 'plant', 'flower', 'nursery'];
            const plantItemCount = allItems.filter(i =>
                plantKeywords.some(kw => i.name.toLowerCase().includes(kw) || i.category?.toLowerCase().includes(kw))
            ).length;

            if (plantItemCount > allItems.length * 0.3 || plantItemCount > 3) {
                set({ businessContext: 'Plant Nursery (משתלה)' });
            } else {
                set({ businessContext: 'Coffee Shop / Restaurant' });
            }
            console.log(`🏢 Business Context Detected: ${get().businessContext}`);
        } catch (err: any) {
            console.error('Failed to init session:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    saveSession: async () => {
        const { sessionId, step, items, atmosphereSeeds } = get();
        if (sessionId) {
            await onboarding_sessions.update(sessionId, {
                step,
                items,
                atmosphereSeeds,
                updated_at: Date.now()
            });
        }
    },

    setStep: (step) => {
        set({ step });
        get().saveSession();
    },

    addAtmosphereSeed: (seed) => {
        set(state => ({ atmosphereSeeds: [...state.atmosphereSeeds, seed] }));
        get().saveSession();
    },

    removeAtmosphereSeed: (id) => {
        set(state => ({ atmosphereSeeds: state.atmosphereSeeds.filter(s => s.id !== id) }));
        get().saveSession();
    },

    processExcelData: async (rows) => {
        set({ isLoading: true });
        const items: OnboardingItem[] = rows.map((row, index) => {
            const item = mapRowToItem(row, uuidv4());
            const basicErrors = validateMenuRow(row, index);
            const modifierErrors = validateModifierGroups(item.modifiers || []);
            const modifierMsgErrors = modifierErrors.map(e => `Modifier Error [${e.groupName}]: ${e.message}`);
            const allErrors = [...basicErrors, ...modifierMsgErrors];

            item.validationErrors = allErrors;
            if (allErrors.length > 0) item.status = 'error';
            return item;
        });

        set({ items, isLoading: false });
        get().saveSession();

        // 🆕 Async Enrichment of Visual Anchors (Hebrew Descriptions)
        for (const item of items) {
            if (item.status !== 'error') {
                const visualAnchor = await enrichItemVisually(item, get().geminiApiKey || undefined);
                const { prompt: aiPrompt } = await generateImagePrompt(item, get().atmosphereSeeds);
                get().updateItem(item.id, {
                    visualDescription: visualAnchor,
                    prompt: aiPrompt // Pre-generate the SD tags too
                });
            }
        }
    },

    updateItem: async (itemId, updates, saveToCloud = true) => {
        set(state => ({
            items: state.items.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            )
        }));

        get().saveSession();

        if (saveToCloud) {
            const { businessId } = get();
            const item = get().items.find(i => i.id === itemId);
            if (!item || !businessId) return;

            console.log(`☁️ Syncing item ${item.name} to cloud...`);

            // Map to Supabase schema
            const dbItem = {
                business_id: businessId,
                name: item.name,
                category: item.category,
                description: item.description,
                price: item.price,
                sale_price: item.salePrice,
                production_area: item.productionArea,
                ingredients: item.ingredients,
                image_url: item.imageUrl,
                modifiers: item.modifiers,
                visual_description: item.visualDescription,
                ai_prompt: item.prompt,
                updated_at: new Date().toISOString()
            };

            try {
                let result;
                // If ID is UUID (Supabase generated) or we check if it exists
                if (itemId.length > 20 && !itemId.includes('-local')) {
                    result = await supabase.from('menu_items').update(dbItem).eq('id', itemId);
                } else {
                    result = await supabase.from('menu_items').insert([dbItem]).select();
                    if (result.data) {
                        // Update local ID with the one from Supabase
                        const newId = result.data[0].id;
                        set(state => ({
                            items: state.items.map(i => i.id === itemId ? { ...i, id: newId } : i)
                        }));
                    }
                }
                if (result.error) throw result.error;
            } catch (err) {
                console.error('Failed to sync item to Supabase:', err);
            }
        }
    },

    deleteItem: async (itemId) => {
        set(state => ({
            items: state.items.filter(i => i.id !== itemId)
        }));
        get().saveSession();

        if (itemId.length > 20 && !itemId.includes('-local')) {
            await supabase.from('menu_items').delete().eq('id', itemId);
        }
    },

    cleanupDuplicates: () => {
        const { items } = get();
        const seen = new Map<string, string>(); // "category:name" -> id
        const cleanItems: OnboardingItem[] = [];
        let count = 0;

        items.forEach(item => {
            const key = `${item.category.trim().toLowerCase()}:${item.name.trim().toLowerCase()}`;
            if (!seen.has(key)) {
                seen.set(key, item.id);
                cleanItems.push(item);
            } else {
                count++;
                console.log(`🗑️ Removing duplicate: ${item.name} (${item.category})`);
            }
        });

        if (count > 0) {
            set({ items: cleanItems });
            get().saveSession();
            console.log(`✅ Cleanup complete. Removed ${count} duplicates.`);
        }
    },

    addNewItem: (category = 'General') => {
        const existingNewItems = get().items.filter(i => i.name.startsWith('New Item')).length;
        const newItem: OnboardingItem = {
            id: `local-${Date.now()}`,
            name: `New Item ${existingNewItems + 1}`,
            category: category,
            description: '',
            price: 0,
            productionArea: 'Kitchen',
            ingredients: [],
            modifiers: [],
            status: 'pending'
        };
        set(state => ({ items: [newItem, ...state.items] }));
        get().saveSession();
    },

    applyAtmosphereToCategory: (category: string, backgroundId?: string, containerId?: string) => {
        set(state => ({
            items: state.items.map(item =>
                item.category === category
                    ? { ...item, selectedBackgroundId: backgroundId, selectedContainerId: containerId }
                    : item
            )
        }));
        get().saveSession();
    },

    startLiveGeneration: async () => {
        const { businessId, eventSource: existingSource } = get();

        if (existingSource) {
            existingSource.close();
        }

        set(state => ({
            items: state.items.map(item => {
                if (item.status === 'pending' || item.status === 'error') {
                    return { ...item, status: 'pending' as const };
                }
                return item;
            }) as OnboardingItem[]
        }));
        get().saveSession();

        const pendingItems = get().items.filter(i => i.status === 'pending');
        if (pendingItems.length === 0) {
            set({ isGenerating: false, generationProgress: 100 });
            return;
        }

        set({ isGenerating: true, generationProgress: 0, error: null });

        try {
            // Serialize prompt generation to avoid rate limits
            const itemsWithPrompts = [];
            for (const item of pendingItems) {
                console.log(`📝 Generating prompt for: ${item.name}`);
                const { prompt, negativePrompt, seeds } = await generateImagePrompt(item, get().atmosphereSeeds, get().geminiApiKey || undefined, get().businessContext);
                itemsWithPrompts.push({
                    ...item,
                    prompt,
                    negativePrompt,
                    seeds
                });
            }

            if (get().geminiApiKey) {
                // 🆕 New Logic: Use Google Gemini Direct
                for (let i = 0; i < itemsWithPrompts.length; i++) {
                    const item = itemsWithPrompts[i];
                    if (!get().isGenerating) break;

                    set({ currentItemName: item.name });

                    try {
                        // Mark as generating
                        set(state => ({
                            items: state.items.map(it => it.id === item.id ? { ...it, status: 'generating' as const } : it)
                        }));

                        // Small delay to prevent rate limits
                        await new Promise(r => setTimeout(r, 1000));
                        const result = await generateImageGemini(item.prompt, get().geminiApiKey!, item.negativePrompt, item.seeds);
                        if (result) {
                            set(state => ({
                                items: state.items.map(it => it.id === item.id ? {
                                    ...it,
                                    imageUrl: result.url,
                                    status: 'completed' as const,
                                    generationTime: result.timeTaken,
                                    powerSource: result.powerSource
                                } : it)
                            }));
                        }
                    } catch (e: any) {
                        console.error('Gemini Gen failed for item:', item.name, e);
                    }

                    const progress = Math.round(((i + 1) / itemsWithPrompts.length) * 100);
                    set({ generationProgress: progress });
                }

                set({ isGenerating: false, generationProgress: 100, currentItemName: 'Done!' });
                get().saveSession();
                console.log('✅ Batch Generation completed via Gemini Cloud.');
                return;
            }

            console.log('🚀 Starting Local Machine Generation (ComfyUI)...');
            const prepResponse = await fetch('/api/onboarding/prepare-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId, items: itemsWithPrompts })
            });

            if (!prepResponse.ok) throw new Error('Failed to prepare generation');
            const { jobId } = await prepResponse.json();

            const url = `/api/onboarding/generate?jobId=${jobId}`;
            const eventSource = new EventSource(url);
            set({ eventSource });

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'start') {
                    set({ generationProgress: 0 });
                } else if (data.type === 'progress') {
                    set({ currentItemName: data.item });
                } else if (data.type === 'success') {
                    const progress = Math.round(((data.index + 1) / pendingItems.length) * 100);
                    set(state => ({
                        generationProgress: progress,
                        items: state.items.map(item =>
                            item.id === data.id ? {
                                ...item,
                                imageUrl: data.url,
                                status: 'completed' as const,
                                generationTime: data.timeTaken,
                                powerSource: data.powerSource
                            } : item
                        )
                    }));
                    get().saveSession();
                } else if (data.type === 'complete') {
                    set({ isGenerating: false, generationProgress: 100, currentItemName: 'Done!', eventSource: null });
                    eventSource.close();
                } else if (data.type === 'error' || data.type === 'cancelled') {
                    set({ isGenerating: false, error: data.message, eventSource: null });
                    eventSource.close();
                }
            };

            eventSource.onerror = (err) => {
                console.error("SSE Error:", err);
                set({ isGenerating: false, error: 'Connection lost', eventSource: null });
                eventSource.close();
            };
        } catch (err: any) {
            console.error("Generation startup failed:", err);
            set({ isGenerating: false, error: err.message });
        }
    },

    cancelGeneration: async () => {
        const { businessId } = get();
        try {
            await fetch('/api/onboarding/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId })
            });
            set({ isGenerating: false, currentItemName: 'Stopping...' });
        } catch (e) {
            console.error('Cancel failed:', e);
        }
    },

    regenerateSingleItem: async (itemId: string) => {
        const { atmosphereSeeds } = get();
        try {
            set(state => ({
                items: state.items.map(i => i.id === itemId ? { ...i, status: 'preparing' as const } : i)
            }));

            const item = get().items.find(i => i.id === itemId);
            if (!item) return;

            // 🆕 Respect manual prompt if it exists, otherwise generate
            let finalPrompt = item.prompt;
            let finalNegative = "low quality, blurry";

            if (!finalPrompt || finalPrompt.trim() === "") {
                const { prompt, negativePrompt, seeds } = await generateImagePrompt(item, atmosphereSeeds, get().geminiApiKey || undefined, get().businessContext);
                finalPrompt = prompt;
                finalNegative = negativePrompt;
                item.seeds = seeds;
            }

            if (get().geminiApiKey) {
                // 🆕 New Logic: Gemini Direct
                try {
                    const result = await generateImageGemini(finalPrompt, get().geminiApiKey!, finalNegative, item.seeds);
                    if (result) {
                        set(state => ({
                            items: state.items.map(i => i.id === itemId ? {
                                ...i,
                                imageUrl: result.url,
                                status: 'completed' as const,
                                generationTime: result.timeTaken,
                                powerSource: result.powerSource
                            } : i)
                        }));
                        get().saveSession();
                        console.log(`✅ Item ${itemId} regenerated via Gemini Cloud.`);
                        return;
                    } else {
                        throw new Error('Empty result from Gemini');
                    }
                } catch (e: any) {
                    console.error("❌ Gemini Regeneration failed:", e);
                    set(state => ({
                        items: state.items.map(i => i.id === itemId ? {
                            ...i,
                            status: 'error' as const,
                            error: e.message // 🆕 Capture specific error
                        } : i),
                        error: `Gemini Cloud Error: ${e.message}`
                    }));
                    return; // 🛑 Prevent fallback to local if Gemini failed but was intended
                }
            }

            console.log('🚀 Regenerating via Local Machine (ComfyUI)...');

            const res = await fetch('/api/onboarding/generate-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: get().businessId,
                    itemId: item.id,
                    prompt: finalPrompt,
                    negativePrompt: finalNegative,
                    originalImageUrl: item.originalImageUrl
                })
            });

            if (!res.ok) throw new Error('Failed to regenerate');
            const data = await res.json();

            set(state => ({
                items: state.items.map(i => i.id === itemId ? {
                    ...i,
                    imageUrl: data.url,
                    status: 'completed' as const,
                    generationTime: data.timeTaken,
                    powerSource: data.powerSource
                } : i)
            }));
            get().saveSession();
        } catch (err: any) {
            set(state => ({
                items: state.items.map(i => i.id === itemId ? { ...i, status: 'error' as const } : i),
                error: err.message
            }));
        }
    },

    uploadOriginalImage: async (itemId: string, file: File) => {
        const { businessId } = get();
        try {
            const tempId = uuidv4();
            const fileExt = file.name.split('.').pop();
            const folder = businessId || 'anonymous';
            const fileName = `wizard/${folder}/${itemId}_${tempId}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('menu-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('menu-images')
                .getPublicUrl(fileName);

            set(state => ({
                items: state.items.map(i => i.id === itemId ? { ...i, originalImageUrl: publicUrl } : i)
            }));

            get().saveSession();

            // Also sync to cloud if possible
            const item = get().items.find(i => i.id === itemId);
            if (item && businessId) {
                await supabase.from('menu_items').update({ original_image_url: publicUrl }).eq('id', itemId);
            }

            return publicUrl;
        } catch (err: any) {
            console.error('Reference image upload failed:', err);
            set({ error: err.message });
            throw err;
        }
    }
}));
