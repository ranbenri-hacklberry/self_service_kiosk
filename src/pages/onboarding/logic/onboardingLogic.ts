/**
 * Onboarding Logic
 * Core business logic: Parsing, Validation, and Prompt Generation.
 */

import { OnboardingItem, ModifierGroup, ModifierItem, ModifierLogic, ModifierRequirement, AtmosphereSeed } from '../types/onboardingTypes';

/**
 * 🆕 Enhanced Modifier Parser (v2.0)
 * 
 * NEW Syntax: GroupName [Type|Logic|Limit]:Option1[Price]{D},Option2;
 * 
 * Examples:
 *   - "Milk [M|R|1]:Regular{D},Soy[2],Oat[3]"
 *   - "Add-ons [O|A|3]:Onion[2],ExtraCheese[5]"
 *   - "Size [M|R|1]:Small[-3]{D},Medium,Large[5]"
 * 
 * Legacy Fallback: "Group Name: Option1[Price], Option2" still supported
 * 
 * Metadata:
 *   - M = Mandatory, O = Optional (default: O)
 *   - R = Replacement, A = Addition (default: A)
 *   - Number = Max Selection (default: 99 for A, 1 for R)
 *   - {D} = Default selected option
 */
export const parseModifierString = (modifierString: string): ModifierGroup[] => {
    if (!modifierString || typeof modifierString !== 'string') return [];

    const groups: ModifierGroup[] = [];
    const groupStrings = modifierString.split(';');

    // Regex to extract group metadata: "GroupName [M|R|1]" or just "GroupName"
    const groupMetaRegex = /^(.+?)\s*(?:\[([MO])\|([RA])\|(\d+)\])?\s*$/;

    for (const gStr of groupStrings) {
        if (!gStr.trim()) continue;

        // Split on FIRST colon to separate group name (with metadata) from options
        const firstColonIndex = gStr.indexOf(':');
        if (firstColonIndex === -1) continue;

        const groupPart = gStr.slice(0, firstColonIndex).trim();
        const optionsPart = gStr.slice(firstColonIndex + 1).trim();

        if (!groupPart || !optionsPart) continue;

        // Parse group metadata
        const metaMatch = groupPart.match(groupMetaRegex);
        if (!metaMatch) continue;

        const groupName = metaMatch[1].trim();
        const reqFlag = metaMatch[2] as 'M' | 'O' | undefined;
        const logicFlag = metaMatch[3] as 'R' | 'A' | undefined;
        const maxSelStr = metaMatch[4];

        // Determine rule properties
        const requirement = reqFlag === 'M' ? ModifierRequirement.MANDATORY : ModifierRequirement.OPTIONAL;
        const logic = logicFlag === 'R' ? ModifierLogic.REPLACE : ModifierLogic.ADD;
        const maxSelection = maxSelStr ? parseInt(maxSelStr, 10) : (logic === ModifierLogic.REPLACE ? 1 : 99);
        const minSelection = requirement === ModifierRequirement.MANDATORY ? 1 : 0;

        // Determine render style
        let renderAs: 'radio' | 'checkbox' | 'stepper' = 'checkbox';
        if (requirement === ModifierRequirement.MANDATORY && maxSelection === 1) {
            renderAs = 'radio';
        } else if (maxSelection > 1) {
            renderAs = 'checkbox';
        }

        // Parse options: "Option1[Price]{D}, Option2[-5]"
        const items: ModifierItem[] = [];
        const optionsRaw = optionsPart.split(',');

        // Enhanced regex: OptionName[Price]{D} - all optional
        // Captures: 1=name, 2=price (optional), 3=D flag (optional)
        const optionRegex = /^(.+?)(?:\[(-?\d+(?:\.\d+)?)\])?(\{D\})?$/;

        for (const opt of optionsRaw) {
            const cleanOpt = opt.trim();
            if (!cleanOpt) continue;

            const optMatch = cleanOpt.match(optionRegex);

            if (optMatch) {
                const name = optMatch[1].trim();
                const price = optMatch[2] ? parseFloat(optMatch[2]) : 0;
                const isDefault = !!optMatch[3]; // {D} present

                items.push({ name, price, isDefault });
            } else {
                // Fallback for malformed options
                items.push({ name: cleanOpt, price: 0, isDefault: false });
            }
        }

        if (items.length > 0) {
            groups.push({
                name: groupName,
                items,
                requirement,
                logic,
                minSelection,
                maxSelection,
                renderAs
            });
        }
    }

    return groups;
};

/**
 * Helper: Clean price string (remove ₪, $, commas)
 */
const cleanPrice = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(/[^\d.-]/g, ''); // Remove non-numeric chars except . and -
    return parseFloat(str);
};

/**
 * 2. Excel Validation Engine
 */
export const validateMenuRow = (row: any, rowIndex: number): string[] => {
    const errors: string[] = [];

    // Required fields
    if (!row['Item Name']) errors.push(`Row ${rowIndex + 1}: Missing 'Item Name'`);
    if (!row['Category']) errors.push(`Row ${rowIndex + 1}: Missing 'Category'`);

    // Price Validation
    const rawPrice = row['Price'];
    if (rawPrice === undefined || rawPrice === null || rawPrice === '') {
        errors.push(`Row ${rowIndex + 1}: Missing 'Price'`);
    } else {
        const p = cleanPrice(rawPrice);
        if (isNaN(p)) {
            errors.push(`Row ${rowIndex + 1}: Price '${rawPrice}' is not a valid number`);
        }
        // Warn purely negative weird prices (optional, but requested)
        // We assume 0 is allowed (free item), but maybe -100 is weird unless it's a discount item?
        // Staying safe: if it parses, it's valid, but maybe warn if < 0? 
        // For menu items, usually price >= 0.
        if (p < 0) {
            // Treating as error for main items? Or allowing? 
            // Usually items are positive.
            errors.push(`Row ${rowIndex + 1}: Item price cannot be negative`);
        }
    }

    return errors;
};

/**
 * New Helper: Check for duplicates within the parsed dataset
 */
export const findDuplicateErrors = (items: OnboardingItem[]): Map<string, string[]> => {
    const errorsMap = new Map<string, string[]>(); // itemId -> errors
    const seen = new Map<string, string>(); // "Category:ItemName" -> itemId

    for (const item of items) {
        const key = `${item.category.toLowerCase()}:${item.name.toLowerCase()}`;
        if (seen.has(key)) {
            // Found duplicate
            const originalId = seen.get(key)!;

            // Mark current
            const currentErrors = errorsMap.get(item.id) || [];
            currentErrors.push(`Duplicate item name '${item.name}' in category '${item.category}'`);
            errorsMap.set(item.id, currentErrors);

            // Mark original if not already marked (optional, but good for clarity)
            const originalErrors = errorsMap.get(originalId) || [];
            if (!originalErrors.some(e => e.includes('Duplicate'))) {
                originalErrors.push(`Duplicate item name '${item.name}' in category '${item.category}'`);
                errorsMap.set(originalId, originalErrors);
            }
        } else {
            seen.set(key, item.id);
        }
    }
    return errorsMap;
};

/**
 * 🆕 Modifier Group Validation
 * Ensures rule consistency for POS/KDS behavior.
 */
export interface ModifierValidationError {
    groupName: string;
    errorType: 'NO_DEFAULT_FOR_MANDATORY' | 'TOO_MANY_DEFAULTS' | 'INVALID_LIMIT';
    message: string;
}

export const validateModifierGroups = (groups: ModifierGroup[]): ModifierValidationError[] => {
    const errors: ModifierValidationError[] = [];

    for (const group of groups) {
        const defaultCount = group.items.filter(item => item.isDefault).length;

        // Rule 1: Mandatory groups must have at least one default OR will force UI selection
        // We warn but don't block - UI can handle forced selection
        if (group.requirement === ModifierRequirement.MANDATORY && defaultCount === 0) {
            errors.push({
                groupName: group.name,
                errorType: 'NO_DEFAULT_FOR_MANDATORY',
                message: `קבוצה חובה "${group.name}" צריכה לפחות אופציה ברירת מחדל {D}, או שה-UI יאלץ בחירה`
            });
        }

        // Rule 2: Number of defaults cannot exceed maxSelection
        if (defaultCount > group.maxSelection) {
            errors.push({
                groupName: group.name,
                errorType: 'TOO_MANY_DEFAULTS',
                message: `קבוצה "${group.name}" מוגדרת למקסימום ${group.maxSelection} בחירות, אבל יש ${defaultCount} ברירות מחדל`
            });
        }

        // Rule 3: maxSelection must be at least minSelection
        if (group.maxSelection < group.minSelection) {
            errors.push({
                groupName: group.name,
                errorType: 'INVALID_LIMIT',
                message: `קבוצה "${group.name}" - מקסימום בחירות (${group.maxSelection}) לא יכול להיות קטן ממינימום (${group.minSelection})`
            });
        }
    }

    return errors;
};


/**
 * 🆕 Robust Image Compression
 * Prevents 400 errors from Gemini by ensuring images are reasonable size.
 */
const compressImage = async (blob: Blob, maxDim = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            // Return base64 without the prefix
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl.split(',')[1]);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
};

/**
 * 🆕 Resizes a base64 image URL to a target dimension
 */
const resizeBase64 = async (base64Url: string, maxDim = 512): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% quality is plenty
        };
        img.src = base64Url;
    });
};

/**
 * 2.6 Visual Seed Analysis (Gemini Vision)
 * Analyzes uploaded seeds to extract precise material, angle, and style details.
 */
export const analyzeVisualSeed = async (imageUrl: string, type: 'container' | 'background', apiKeyPassed?: string): Promise<string> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return `User uploaded ${type}`;

        // Detect MIME type but fallback to image/png
        const blobObj = await (await fetch(imageUrl)).blob();
        const base64Data = await compressImage(blobObj);

        const prompt = type === 'container'
            ? "Describe ONLY the empty serving dish, plate, glass, or plant pot. Mention material (ceramic, wood, transparent glass, terracotta, plastic), texture, and color. DO NOT mention any food or liquid. Focus on the object itself as a template. Be very concise."
            : "Describe ONLY the environment/background. Mention the table surface (wood, marble, cloth, soil), lighting, and overall style. DO NOT mention plates, cutlery, food, or people. Focus on the vibes and materials of the space. Be very concise.";

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
                })
            }
        );

        if (!response.ok) {
            const errBody = await response.json();
            console.error('Vision API Error Body:', errBody);
            throw new Error(`Vision API failed: ${response.status}`);
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `User uploaded ${type}`;

    } catch (err) {
        console.error('❌ Visual analysis failed:', err);
        return `User uploaded ${type}`;
    }
};

/**
 * 4. Gemini Image Generation Bridge
 * Direct Imagen-3-style generation via Gemini API
 */
export const generateImageGemini = async (
    prompt: string,
    apiKey: string,
    negativePrompt?: string,
    seeds?: { type: string, data: string }[]
): Promise<{ url: string; timeTaken: number; powerSource: string } | null> => {
    try {
        const startTime = Date.now();

        // Enhance prompt with negative instructions for Gemini
        const finalPrompt = negativePrompt
            ? `${prompt}\n\nSTRICT VISUAL CONSTRAINTS (DO NOT INCLUDE): ${negativePrompt}`
            : prompt;

        const parts: any[] = [];

        // 🆕 Pass images FIRST to establish visual context
        if (seeds && seeds.length > 0) {
            seeds.forEach(s => {
                parts.push({ text: `INPUT_${s.type.toUpperCase()}_IMAGE (Follow these pixels exactly):` });
                parts.push({ inline_data: { mime_type: "image/jpeg", data: s.data } });
            });
        }

        // Then add the prompt as an instruction on how to combine them
        parts.push({
            text: `INSTRUCTION: You are a professional image compositor. 
        Your task is to take the EXACT object from the 'INPUT_REFERENCE_IMAGE' and place it perfectly into the environment shown in 'INPUT_BACKGROUND_IMAGE'. 
        RETAIN the exact colors, shape, and pot from the reference. 
        RETAIN the exact landscape from the background.
        
        FINAL TASK: ${finalPrompt}`
        });

        console.log('%c🚀 FINAL AI PROMPT:', 'color: #8b5cf6; font-weight: bold; font-size: 12px;', finalPrompt);
        console.log('%c🚫 NEGATIVE PROMPT:', 'color: #ef4444; font-weight: bold; font-size: 12px;', negativePrompt);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout (3 minutes)

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: {
                            responseModalities: ["image"]
                        }
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Gemini Generation Failed');
            }

            const data = await response.json();

            // Extract the base64 image from the response
            const candidate = data.candidates?.[0];
            const part = candidate?.content?.parts?.find((p: any) => p.inlineData);

            if (part && part.inlineData) {
                const base64 = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                const fullResUrl = `data:${mimeType};base64,${base64}`;

                // 🆕 Shrink image to 512px to save browser memory and storage
                const shrunkUrl = await resizeBase64(fullResUrl, 512);

                const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);
                return {
                    url: shrunkUrl,
                    timeTaken: parseFloat(timeTaken),
                    powerSource: 'Gemini 3 Pro (Image)'
                };
            }

            throw new Error('No image returned from Gemini');

        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('Generation timed out (180s limit). Please try again.');
            }
            throw err;
        }
    } catch (err: any) {
        console.error('Gemini Image Generation Error:', err);
        throw err;
    }
};

export const generateImagePrompt = async (
    item: OnboardingItem,
    atmosphereSeeds: AtmosphereSeed[],
    apiKeyPassed?: string,
    businessContext?: string | null
): Promise<{ prompt: string; negativePrompt: string; seeds?: { type: string, data: string }[] }> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return { prompt: item.name, negativePrompt: "low quality" };

        const background = item.selectedBackgroundId ? atmosphereSeeds.find(s => s.id === item.selectedBackgroundId) : null;
        const container = item.selectedContainerId ? atmosphereSeeds.find(s => s.id === item.selectedContainerId) : null;

        const subjectDescription = item.visualDescription || item.name;
        const subjectName = item.name.toLowerCase();
        const subjectCategory = (item.category || "").toLowerCase();

        // 🌿 Map tricky Hebrew plant names to clear English botanical names
        const plantNameMap: Record<string, string> = {
            'אמנון ותמר': 'Viola tricolor pansy flower plant',
            'ביצן': 'Alternanthera plant',
            'לוע הארי': 'Snapdragon Antirrhinum flower',
            'פטוניה': 'Petunia flower',
            'ניצנית': 'Kalanchoe succulent plant',
            'סלסילי כסף': 'Lobularia maritima Alyssum',
            'לובליה': 'Lobelia flower',
            'בידנס': 'Bidens ferulifolia flower',
            'לנטנה': 'Lantana camara flower',
            'חמניה': 'Sunflowers plant',
            'אלוורה': 'Aloe Vera succulent plant',
        };

        let botanicalEnrichment = "";
        for (const [heb, eng] of Object.entries(plantNameMap)) {
            if (subjectName.includes(heb)) {
                botanicalEnrichment = `(This is a ${eng}, NOT a person or biblical character)`;
                break;
            }
        }

        const isPlant = (businessContext?.includes('Nursery') ||
            subjectCategory.includes('plant') ||
            subjectCategory.includes('flower') ||
            subjectCategory.includes('succulent') ||
            subjectCategory.includes('צמח') ||
            subjectCategory.includes('פרח') ||
            subjectCategory.includes('משתלה') ||
            subjectCategory.includes('עונתי') ||
            subjectCategory.includes('גינה') ||
            subjectName.includes('plant') ||
            subjectName.includes('flower') ||
            subjectName.includes('אמנון ותמר') ||
            subjectName.includes('שתיל') ||
            subjectName.includes('עציץ'));


        const parts: any[] = [
            {
                text: `You are a Professional ${isPlant ? 'Botanical and Nursery' : 'Food'} Photography Stylist and AI Prompt Architect.
                ${businessContext ? `CONTEXT: This is a ${businessContext}.` : ''}
                Your task is to create a masterpiece-level description for a high-end AI image generator.
                STRICT RULE: YOUR OUTPUT MUST BE 100% IN ENGLISH. NO HEBREW.
                ${isPlant ? 'CRITICAL: THIS IS A NURSERY/PLANT SHOP (משתלה). THE SUBJECT IS ALWAYS A PLANT. NEVER GENERATE PEOPLE, HUMANS, OR RELIGIOUS/MYTHICAL FIGURES.' : ''}
                
                SUBJECT: ${subjectName} (Description: ${subjectDescription}) ${botanicalEnrichment}
                CATEGORY: ${item.category}
                CONTEXT: This is a botanical product for a nursery.
                
                MISSION:
                1. ANALYZE REFERENCE: Look at 'REFERENCE IMAGE'. Describe its specific features (exact flower colors, pot material/shape, unique growth patterns). Your generated prompt MUST include these details to ensure 1:1 fidelity.
                2. SCENE COMPOSITION: You MUST place this exact object onto the edge of the rustic wooden deck shown/described in the 'BACKGROUND SEED' or environment seeds.
                3. BACKGROUND REPLACEMENT: The background from the 'REFERENCE IMAGE' must be totally deleted. Replace it with the SOLE environment from the background seeds, but apply a heavy, cinematic blur (bokeh).
                4. CINEMATIC LIGHTING: Match the lighting from the background seeds onto the object. Foreground (object) is sharp, background is blurry.

                STRICT PROMPT TEMPLATE:
                "Macro cinematic photoreal product photography of [DETAILED DESCRIPTION OF REFERENCE OBJECT] sitting on the edge of a rustic wooden deck, overlooking a blurred [DESCRIPTION OF BACKGROUND ENVIRONMENT], professional bokeh, high-end commercial aesthetic, 8k resolution, extreme detail."
                
                STRICT RULES:
                - ALWAYS English.
                - NEVER generate people/hands.
                - IGNORE the original background in the reference image completely.
                
                RETURN FORMAT: JSON object {"prompt": "...", "negativePrompt": "..."}`
            }
        ];

        const seeds: { type: string, data: string }[] = [];

        if (item.originalImageUrl) {
            try {
                const b = await (await fetch(item.originalImageUrl)).blob();
                const refData = await compressImage(b);
                parts.push({ text: "REFERENCE IMAGE (Match this object's appearance):" });
                parts.push({ inline_data: { mime_type: "image/jpeg", data: refData } });
                seeds.push({ type: 'reference', data: refData });
            } catch (e) { console.warn("Failed to load reference image seed", e); }
        }
        if (container) {
            try {
                const b = await (await fetch(container.blob as string)).blob();
                const containerData = await compressImage(b);
                parts.push({ text: "CONTAINER SEED (Use this dish/cup shape, angle and material):" });
                parts.push({ inline_data: { mime_type: "image/jpeg", data: containerData } });
                seeds.push({ type: 'container', data: containerData });
            } catch (e) { console.warn("Failed to load container seed", e); }
        }
        if (background) {
            try {
                const b = await (await fetch(background.blob as string)).blob();
                const backgroundData = await compressImage(b);
                parts.push({ text: "BACKGROUND SEED (Use this environment and lighting):" });
                parts.push({ inline_data: { mime_type: "image/jpeg", data: backgroundData } });
                seeds.push({ type: 'background', data: backgroundData });
            } catch (e) { console.warn("Failed to load background seed", e); }
        }

        console.log('🧠 Synthesizing AI Prompt using Gemini 3 Flash (The Architect)...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { temperature: 0, response_mime_type: "application/json" }
                })
            }
        );

        if (!response.ok) {
            const errData = await response.json();
            console.error('Gemini Prompt Gen API Error:', errData);
            throw new Error(`Cloud AI Error: ${response.status}`);
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const result = JSON.parse(resultText);

        return {
            prompt: result.prompt || subjectDescription,
            negativePrompt: result.negativePrompt || "people, blurry, candles, straws",
            seeds: seeds // 🆕 Pass the raw image data forward
        };
    } catch (err) {
        console.error('Prompt gen failed:', err);
        return { prompt: item.name, negativePrompt: "low quality", seeds: [] };
    }
};

/**
 * 🆕 Enriches item with a visual description for AI generation
 */
export const enrichItemVisually = async (item: OnboardingItem, apiKeyPassed?: string): Promise<string> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return item.description || item.name;

        const subjectName = item.name.toLowerCase();
        const subjectCategory = (item.category || "").toLowerCase();

        const isPlant = subjectCategory.includes('plant') ||
            subjectCategory.includes('flower') ||
            subjectCategory.includes('succulent') ||
            subjectCategory.includes('צמח') ||
            subjectCategory.includes('פרח') ||
            subjectCategory.includes('משתלה') ||
            subjectCategory.includes('עונתי') ||
            subjectName.includes('plant') ||
            subjectName.includes('flower') ||
            subjectName.includes('אמנון ותמר') ||
            subjectName.includes('שתיל');

        const persona = isPlant ? "botanical and nursery art director" : "culinary art director";
        const examples = isPlant
            ? `- "שתיל אמנון ותמר עם פרחים סגולים וצהובים בעציץ פלסטיק חום"
- "סקולנט ירוק בשרני בתוך כלי קרמיקה קטן"
- "זר פרחי חמניה צהובים וגבוהים"`
            : `- "שוט אספרסו בודד, קרמה זהובה, נוזל כהה"
- "קרואסון חמאה פריך ושחום"
- "לאטה קרמי עם לאטה ארט בצורת לב"`;

        const prompt = `You are a professional ${persona} for a high-end business. 
Create a concise VISUAL description (3-5 words) in HEBREW for this item.
Focus ONLY on the physical appearance of the final object/plant. 
${isPlant ? 'DO NOT mention people or religious figures. Focus on the plant\'s color, shape, and pot.' : 'Exclude terms like "beans" or "ingredients" if they aren\'t part of the final visual presentation.'}
The goal is to describe what the customer sees.

ITEM name: ${item.name}
Description: ${item.description}
Category: ${item.category}

Examples: 
${examples}

Visual Description (Hebrew):`;

        console.log(`✍️ Generating Visual Description in Hebrew (${isPlant ? 'Plant' : 'Food'} context)...`);
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
                })
            }
        );

        if (!response.ok) {
            const err = await response.json();
            console.error('Visual description API error:', err);
            return item.name;
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || item.name;
    } catch (e) {
        console.error('Visual enrichment failed:', e);
        return item.name;
    }
};

/**
 * Helper to map Excel Row -> OnboardingItem
 */
export const mapRowToItem = (row: any, id: string): OnboardingItem => {
    return {
        id,
        name: row['Item Name'] || '',
        category: row['Category'] || 'Uncategorized',
        description: row['Description'] || '',
        price: cleanPrice(row['Price']), // Clean it now
        productionArea: row['Production Area'] || 'Kitchen',
        ingredients: row['Ingredients'] ? String(row['Ingredients']).split(',').map(s => s.trim()) : [],
        vibeOverride: row['Vibe Override'],
        modifiers: parseModifierString(row['Modifiers'] || ''),
        status: 'pending',
        validationErrors: []
    };
};

// Assuming OnboardingItem is defined elsewhere or implicitly, adding the new fields here.
// If OnboardingItem is an interface, it would look like this:
// export interface OnboardingItem {
//     id: string;
//     name: string;
//     category: string;
//     description: string;
//     price: number;
//     productionArea: string;
//     ingredients: string[];
//     vibeOverride?: string;
//     modifiers: Modifier[];
//     status: 'pending' | 'processing' | 'completed' | 'failed';
//     validationErrors?: string[];
//     visualDescription?: string; // 🆕 Gemini-generated visual anchor
//     generationTime?: number;
// }
