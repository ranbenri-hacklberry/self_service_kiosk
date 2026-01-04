/**
 * Maya Code Search - Using local Ollama embeddings
 * This function searches the indexed codebase for relevant chunks
 */

const OLLAMA_URL = 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * Get embedding for a search query using Ollama
 */
export async function getQueryEmbedding(query) {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                prompt: query
            })
        });

        if (!response.ok) {
            console.error('Ollama embedding error:', response.status);
            return null;
        }

        const data = await response.json();
        return data.embedding;
    } catch (e) {
        console.error('Ollama connection error:', e);
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
        console.error('Failed to get embedding for query');
        return [];
    }

    // 2. Search in Supabase using the RPC
    const { data, error } = await supabase.rpc('search_code', {
        query_embedding: embedding,
        match_threshold: 0.4, // Lower threshold to get more results
        match_count: limit
    });

    if (error) {
        console.error('Code search error:', error);
        return [];
    }

    return data || [];
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
