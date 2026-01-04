/**
 * Maya Code Search - Using xAI Collections API
 * This function searches the indexed codebase using xAI's hybrid search
 * Works on both localhost AND production
 */

const XAI_API_URL = 'https://api.x.ai/v1';

/**
 * Search code using xAI Collections API
 * Uses hybrid search (semantic + keyword) for best results
 * 
 * @param {object} supabase - Supabase client (not used, kept for API compatibility)
 * @param {string} query - The search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of matching code chunks
 */
export async function searchCode(supabase, query, limit = 5) {
    const apiKey = import.meta.env.VITE_XAI_API_KEY;
    const collectionId = import.meta.env.VITE_XAI_COLLECTION_ID;

    if (!apiKey) {
        console.warn('🌸 Code search: No xAI API key found');
        return [];
    }

    if (!collectionId) {
        console.warn('🌸 Code search: No xAI Collection ID found');
        return [];
    }

    try {
        console.log('🔍 Maya RAG: Searching codebase with xAI Collections...');
        console.log('📁 Collection ID:', collectionId);

        const response = await fetch(`${XAI_API_URL}/collections/${collectionId}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: query,
                top_k: limit,
                retrieval_mode: 'hybrid' // semantic + keyword search
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ xAI Collections search error:', response.status, errorText);
            return [];
        }

        const data = await response.json();
        console.log('✅ Maya RAG: Got response from xAI Collections:', data);

        // Transform results to match expected format
        const results = (data.results || data.documents || []).map(doc => ({
            file_path: doc.name || doc.metadata?.file_path || 'unknown',
            content: doc.content || doc.text || '',
            summary: doc.metadata?.summary || '',
            similarity: doc.score || doc.relevance_score || 0.8
        }));

        console.log('✅ Maya RAG: Found', results.length, 'matching code chunks');
        return results;

    } catch (e) {
        console.error('❌ xAI Collections search error:', e.message);
        return [];
    }
}

/**
 * Format search results for Maya's context
 */
export function formatCodeContext(results) {
    if (!results || results.length === 0) {
        return 'לא נמצא קוד רלוונטי לשאילתה.';
    }

    return results.map((r, i) =>
        `**[${i + 1}] ${r.file_path}** (relevance: ${(r.similarity * 100).toFixed(0)}%)\n\`\`\`\n${r.content}\n\`\`\``
    ).join('\n\n');
}

// Legacy function - kept for compatibility but not used
export async function getQueryEmbedding(query) {
    console.log('🌸 getQueryEmbedding is deprecated - using xAI Collections instead');
    return null;
}
