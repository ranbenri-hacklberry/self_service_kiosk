/**
 * AI Service for Maya Assistant
 * Handles fallback logic between Local Ollama (DeepSeek-R1) and Cloud API (Grok/Google)
 */

// Use relative local proxy to bypass CORS (See vite.config.mjs)
const LOCAL_API_URL = '/ollama/generate';
const LOCAL_MODEL = 'gemma2:9b';
const LOCAL_TIMEOUT = 45000; // 45 seconds (Gemma 2 is robust)

/**
 * Strips <thought> tags from the response and logs them to console
 * @param {string} text 
 * @returns {string} Cleaned text
 */
const processDeepSeekResponse = (text) => {
    if (!text) return '';

    // Regex to capture content inside <thought> tags (handling multiline)
    const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/g;
    let match;
    let hasThought = false;

    // Log all thoughts found
    while ((match = thoughtRegex.exec(text)) !== null) {
        hasThought = true;
        console.log('🧠 [DeepSeek Thought]:', match[1].trim());
    }

    if (hasThought) {
        // Remove tags and trim
        return text.replace(thoughtRegex, '').trim();
    }

    return text;
};

/**
 * Formats chat messages into a single prompt string for Ollama /api/generate
 * Adapts to DeepSeek/Standard chat format
 * @param {Array} messages 
 * @returns {string}
 */
const formatPromptForOllama = (messages) => {
    return messages.map(m => {
        let role = m.role === 'user' ? 'User' : (m.role === 'assistant' ? 'Assistant' : 'System');
        return `${role}: ${m.content}`;
    }).join('\n\n') + '\n\nAssistant: ';
};

/**
 * Main function to ask Maya (AI)
 * @param {Array} messages - Array of {role, content}
 * @param {string} apiKey - Cloud API Key (for fallback)
 * @returns {Promise<string>} - The AI response text
 */
export const askMaya = async (messages, apiKey) => {
    // 1. Try Local First
    try {
        console.log('🚀 Attempting Local AI (Ollama/DeepSeek)...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LOCAL_TIMEOUT);

        const prompt = formatPromptForOllama(messages);

        const localResponse = await fetch(LOCAL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: LOCAL_MODEL,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.6 // Balanced for reasoning
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!localResponse.ok) {
            throw new Error(`Local API Error: ${localResponse.status}`);
        }

        const localData = await localResponse.json();

        // DeepSeek-R1 specific: Process thoughts
        const rawText = localData.response;
        const finalAnswer = processDeepSeekResponse(rawText);

        console.log('✅ Served by Local AI');
        return finalAnswer;

    } catch (error) {
        console.warn('⚠️ Local AI failed or timed out:', error.name === 'AbortError' ? 'Timeout' : error.message);
        console.log('☁️ Switching to Cloud Fallback (Grok)...');
    }

    // 2. Fallback to Cloud (Grok)
    // Using the implementation from the existing file
    try {
        if (!apiKey) {
            throw new Error('API Key חסר עבור שירות הענן');
        }

        const cloudResponse = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-3-fast',
                messages: messages,
                temperature: 0.1
            })
        });

        if (!cloudResponse.ok) {
            const errText = await cloudResponse.text();
            throw new Error(`Cloud API Error ${cloudResponse.status}: ${errText}`);
        }

        const cloudData = await cloudResponse.json();
        return cloudData.choices?.[0]?.message?.content || 'מצטערת, לא התקבלה תשובה.';

    } catch (cloudError) {
        console.error('❌ Cloud Fallback Failed:', cloudError);
        throw cloudError; // Propagate error so UI can show the error message
    }
};
