/**
 * Maya Code Search - Using xAI Embeddings API
 * This function searches the indexed codebase for relevant chunks
 * Works on both localhost AND production
 */

const XAI_API_URL = 'https://api.x.ai/v1/embeddings';

/**
 * Get embedding for a search query using xAI API
 * Works on both development and production!
 */
export async function getQueryEmbedding(query) {
    const apiKey = import.meta.env.VITE_XAI_API_KEY;

    if (!apiKey) {
        console.warn('🌸 Code search: No xAI API key found');
        return null;
    }

    try {
        console.log('🔍 Maya RAG: Getting embedding for query...');

        const response = await fetch(XAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small', // xAI embedding model
                input: query
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ xAI Embedding error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;

        if (embedding) {
            console.log('✅ Maya RAG: Got embedding (', embedding.length, 'dimensions)');
        }

        return embedding || null;
    } catch (e) {
        console.error('❌ xAI Embedding fetch error:', e.message);
        return null;
    }
}

/**
 * Search code chunks using the embedding
 * @param {object} supabase - Supabase client
 * @param {string} query - The search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of matching code chunks
 */
export async function searchCode(supabase, query, limit = 5) {
    // 1. Get embedding for the query
    const embedding = await getQueryEmbedding(query);

    if (!embedding) {
        console.warn('🌸 Maya RAG: No embedding available, skipping code search');
        return [];
    }

    // 2. Search in Supabase using the RPC
    try {
        const { data, error } = await supabase.rpc('search_code', {
            query_embedding: embedding,
            match_threshold: 0.4, // Lower threshold to get more results
            match_count: limit
        });

        if (error) {
            console.error('❌ Code search RPC error:', error);
            return [];
        }

        console.log('✅ Maya RAG: Found', data?.length || 0, 'matching code chunks');
        return data || [];
    } catch (e) {
        console.error('❌ Code search exception:', e);
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
        `**[${i + 1}] ${r.file_path}** (similarity: ${(r.similarity * 100).toFixed(0)}%)\n\`\`\`\n${r.content}\n\`\`\``
    ).join('\n\n');
}
