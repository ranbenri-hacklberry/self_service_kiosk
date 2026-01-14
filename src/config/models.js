export const AI_MODELS = {
    // Google Gemini Models
    GEMINI: {
        FLASH_2_0: 'gemini-2.0-flash',
        FLASH_2_0_LITE: 'gemini-2.0-flash-lite',
        PRO_1_5: 'gemini-1.5-pro',
        FLASH_1_5: 'gemini-1.5-flash',
    },
    // xAI Grok Models
    GROK: {
        GROK_2_VISION: 'grok-2-vision-1212',
        GROK_2: 'grok-2-1212',
    }
};

export const DEFAULT_MODEL = AI_MODELS.GEMINI.FLASH_2_0;

export const FALLBACK_MODELS = [
    AI_MODELS.GEMINI.FLASH_2_0,
    AI_MODELS.GEMINI.FLASH_1_5,
    AI_MODELS.GEMINI.PRO_1_5
];
