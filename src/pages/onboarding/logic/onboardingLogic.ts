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
 * 2.6 Visual Seed Analysis (Gemini Vision)
 * Analyzes uploaded seeds to extract precise material, angle, and style details.
 */
export const analyzeVisualSeed = async (imageUrl: string, type: 'container' | 'background', apiKeyPassed?: string): Promise<string> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return `User uploaded ${type}`;

        const prompt = type === 'container'
            ? "Describe ONLY the empty serving dish, plate, or glass. Mention material (ceramic, wood, transparent glass), texture, and color. DO NOT mention any food or liquid inside. Focus on the object itself as a template. Be very concise."
            : "Describe ONLY the environment/background. Mention the table surface (wood, marble, cloth), lighting, and overall style. DO NOT mention plates, cutlery, food, or people. Focus on the vibes and materials of the space. Be very concise.";

        // Safer and faster buffer to base64
        const arrayBuffer = await (await fetch(imageUrl)).blob().then(b => b.arrayBuffer());
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: "image/png", data: base64Data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
                })
            }
        );

        if (!response.ok) throw new Error('Vision API failed');
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
    negativePrompt?: string
): Promise<{ url: string; timeTaken: number; powerSource: string } | null> => {
    try {
        const startTime = Date.now();

        // Enhance prompt with negative instructions for Gemini
        const finalPrompt = negativePrompt
            ? `${prompt}\n\nSTRICT VISUAL CONSTRAINTS (DO NOT INCLUDE): ${negativePrompt}`
            : prompt;

        console.log('🎨 Starting Gemini Image Gen for prompt:', finalPrompt.substring(0, 50) + '...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout (2 minutes)

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: finalPrompt }] }],
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
                const url = `data:${mimeType};base64,${base64}`;
                const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);

                return {
                    url,
                    timeTaken: parseFloat(timeTaken),
                    powerSource: 'Gemini 3 Pro (Image)'
                };
            }

            throw new Error('No image returned from Gemini');

        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('Generation timed out (120s limit). Please try again.');
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
    apiKeyPassed?: string
): Promise<{ prompt: string; negativePrompt: string }> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return { prompt: item.name, negativePrompt: "low quality" };

        const background = item.selectedBackgroundId ? atmosphereSeeds.find(s => s.id === item.selectedBackgroundId) : null;
        const container = item.selectedContainerId ? atmosphereSeeds.find(s => s.id === item.selectedContainerId) : null;

        const subjectDescription = item.visualDescription || item.name;

        // Helper to convert array buffer to base64 safely
        const bufferToBase64 = (buffer: ArrayBuffer) => {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        };

        const parts: any[] = [
            {
                text: `You are a Professional Food Photography Stylist and AI Prompt Architect.
                Your task is to create a masterpiece-level description for a high-end AI image generator.
                STRICT RULE: YOUR OUTPUT MUST BE 100% IN ENGLISH. NO HEBREW.
                
                SUBJECT: ${subjectDescription}
                CATEGORY: ${item.category}
                
                MISSION:
                1. Analyze the 'CONTAINER SEED' image (if provided). You MUST describe the exact dish/plate/glass type, material, and color shown in that image. Use the same camera angle.
                2. Analyze the 'BACKGROUND SEED' image (if provided). You MUST describe the environment, surface, and lighting exactly as shown in that image.
                3. Describe the 'SUBJECT' being served in that container, on that surface, in that environment.
                
                PROMPT STYLE (Natural Language):
                - Start with: "A high-end, professional food photography shot of [SUBJECT]..."
                - Specify lighting: Match the background seed's lighting.
                - Detail textures: Describe the food's texture (crispy, creamy, etc.).
                - Background: Match the background seed precisely.
                - Camera Specs: Describe the angle from the container seed (e.g., "top-down view", "45-degree side angle").
                
                NEGATIVE PROMPT: Mention what to avoid: "people, hands, fingers, text, letters, watermarks, blurry, low quality, mess, straws, plastic, messy, distorted, generic".
                
                RETURN FORMAT: JSON object {"prompt": "...", "negativePrompt": "..."}`
            }
        ];

        if (item.originalImageUrl) {
            try {
                const refData = await (await fetch(item.originalImageUrl)).blob().then(b => b.arrayBuffer()).then(a => bufferToBase64(a));
                parts.push({ text: "REFERENCE IMAGE (Match this object's appearance):" });
                parts.push({ inline_data: { mime_type: "image/png", data: refData } });
            } catch (e) { console.warn("Failed to load reference image seed", e); }
        }
        if (container) {
            try {
                const containerData = await (await fetch(container.blob as string)).blob().then(b => b.arrayBuffer()).then(a => bufferToBase64(a));
                parts.push({ text: "CONTAINER SEED (Use this dish/cup shape, angle and material):" });
                parts.push({ inline_data: { mime_type: "image/png", data: containerData } });
            } catch (e) { console.warn("Failed to load container seed", e); }
        }
        if (background) {
            try {
                const backgroundData = await (await fetch(background.blob as string)).blob().then(b => b.arrayBuffer()).then(a => bufferToBase64(a));
                parts.push({ text: "BACKGROUND SEED (Use this environment and lighting):" });
                parts.push({ inline_data: { mime_type: "image/png", data: backgroundData } });
            } catch (e) { console.warn("Failed to load background seed", e); }
        }

        console.log('🧠 Synthesizing AI Prompt using Gemini 3 Pro...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { temperature: 0.2, response_mime_type: "application/json" }
                })
            }
        );

        const data = await response.json();
        const result = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');

        return {
            prompt: result.prompt || subjectDescription,
            negativePrompt: result.negativePrompt || "people, blurry, candles, straws"
        };
    } catch (err) {
        console.error('Prompt gen failed:', err);
        return { prompt: item.name, negativePrompt: "low quality" };
    }
};

/**
 * 🆕 Enriches item with a visual description for AI generation
 */
export const enrichItemVisually = async (item: OnboardingItem, apiKeyPassed?: string): Promise<string> => {
    try {
        const apiKey = apiKeyPassed || import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return item.description || item.name;

        const prompt = `You are a culinary art director for a high-end restaurant. 
        Create a concise VISUAL description (3-5 words) in HEBREW for this menu item.
        Focus ONLY on the physical appearance of the final dish/drink. 
        Exclude terms like "beans" or "ingredients" if they aren't part of the final visual presentation.
        The goal is to describe what the customer sees on the plate/in the glass.
        
        ITEM name: ${item.name}
        Description: ${item.description}
        Category: ${item.category}
        
        Examples: 
        - "שוט אספרסו בודד, קרמה זהובה, נוזל כהה"
        - "קרואסון חמאה פריך ושחום"
        - "לאטה קרמי עם לאטה ארט בצורת לב"
        
        Visual Description (Hebrew):`;

        console.log('✍️ Generating Visual Description in Hebrew...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
                })
            }
        );

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
