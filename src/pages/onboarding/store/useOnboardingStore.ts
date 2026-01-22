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
    setGeminiApiKey: (key: string) => void;

    // Actions
    initSession: (businessId: string | number) => Promise<void>;
    saveSession: () => Promise<void>;
    setStep: (step: number) => void;
    addAtmosphereSeed: (seed: AtmosphereSeed) => void;
    removeAtmosphereSeed: (id: string) => void;
    processExcelData: (rows: any[]) => Promise<void>;
    updateItem: (itemId: string, updates: Partial<OnboardingItem>) => void;
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

    setGeminiApiKey: (key) => {
        localStorage.setItem('onboarding_gemini_api_key', key);
        set({ geminiApiKey: key });
    },

    initSession: async (businessId) => {
        set({ isLoading: true });
        try {
            // Fetch API Key from Supabase if available
            const { data: businessData } = await supabase
                .from('businesses')
                .select('gemini_api_key')
                .eq('id', businessId)
                .single();

            if (businessData?.gemini_api_key) {
                console.log('💎 Gemini API Key loaded for business:', businessId);
                set({ geminiApiKey: businessData.gemini_api_key });
                localStorage.setItem('onboarding_gemini_api_key', businessData.gemini_api_key);
            } else {
                console.warn('⚠️ No Gemini API Key found in DB for this business. Using local fallback.');
            }

            const existing = await onboarding_sessions
                .where('business_id')
                .equals(businessId)
                .last();

            if (existing) {
                set({
                    sessionId: existing.id,
                    businessId: existing.business_id,
                    step: existing.step,
                    items: existing.items || [],
                    atmosphereSeeds: existing.atmosphereSeeds || [],
                    isLoading: false
                });
            } else {
                const id = await onboarding_sessions.add({
                    business_id: businessId,
                    step: 1,
                    items: [],
                    atmosphereSeeds: [],
                    updated_at: Date.now()
                });
                set({
                    sessionId: id as number,
                    businessId,
                    step: 1,
                    items: [],
                    atmosphereSeeds: [],
                    isLoading: false
                });
            }
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

    updateItem: (itemId, updates) => {
        set(state => ({
            items: state.items.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            )
        }));
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
                const { prompt, negativePrompt } = await generateImagePrompt(item, get().atmosphereSeeds, get().geminiApiKey || undefined);
                itemsWithPrompts.push({
                    ...item,
                    prompt,
                    negativePrompt
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
                        const result = await generateImageGemini(item.prompt, get().geminiApiKey!, item.negativePrompt);
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
                const { prompt, negativePrompt } = await generateImagePrompt(item, atmosphereSeeds, get().geminiApiKey || undefined);
                finalPrompt = prompt;
                finalNegative = negativePrompt;
            }

            if (get().geminiApiKey) {
                // 🆕 New Logic: Gemini Direct
                try {
                    const result = await generateImageGemini(finalPrompt, get().geminiApiKey!, finalNegative);
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
            const formData = new FormData();
            formData.append('image', file);
            formData.append('businessId', String(businessId));
            formData.append('itemId', itemId);

            const response = await fetch('/api/onboarding/upload-seed', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const result = await response.json();
            const { url } = result;

            set(state => ({
                items: state.items.map(i => i.id === itemId ? { ...i, originalImageUrl: url } : i)
            }));
            get().saveSession();
            return url;
        } catch (err: any) {
            set({ error: err.message });
            throw err;
        }
    }
}));
