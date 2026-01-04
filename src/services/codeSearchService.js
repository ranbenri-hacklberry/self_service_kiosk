/**
 * Maya Code Search - Using xAI Embeddings API
 * This function searches the indexed codebase for relevant chunks
 * Works on both localhost AND production
 * 
 * NOTE: Database has 768-dimension embeddings (from Ollama nomic-embed-text)
 * If xAI returns different dimensions, we'll skip RAG for now
 */

const XAI_API_URL = 'https://api.x.ai/v1/embeddings';
const EXPECTED_DIMENSIONS = 768; // Match what's in the database

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
                model: 'v1', // xAI embedding model
                input: query
            })
        });

        // Handle API not supporting embeddings
        if (response.status === 404 || response.status === 400) {
            const errorText = await response.text();
            console.warn('⚠️ Maya RAG: xAI embeddings API issue:', response.status, errorText);
            console.log('🌸 Maya will work without code search for now');
            return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ xAI Embedding error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;

        if (embedding) {
            console.log('✅ Maya RAG: Got embedding (', embedding.length, 'dimensions)');

            // Check if dimensions match what's in the database
            if (embedding.length !== EXPECTED_DIMENSIONS) {
                console.warn(`⚠️ Maya RAG: Dimension mismatch! Got ${embedding.length}, expected ${EXPECTED_DIMENSIONS}`);
                console.log('🌸 Skipping RAG search - embeddings need to be regenerated');
                return null;
            }
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
            match_threshold: 0.3, // Lower threshold to get more results
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
