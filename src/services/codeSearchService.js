/**
 * Maya Code Search - Using Supabase code_chunks with text search
 * Fallback to simple text matching since embeddings require server-side processing
 * Works on both localhost AND production
 */

/**
 * Search code using simple text matching in Supabase
 * 
 * @param {object} supabase - Supabase client
 * @param {string} query - The search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of matching code chunks
 */
export async function searchCode(supabase, query, limit = 5) {
    if (!query || query.trim().length < 2) {
        console.warn('🌸 Code search: Query too short');
        return [];
    }

    try {
        console.log('🔍 Maya RAG: Searching codebase in Supabase...');

        // Extract keywords from query (Hebrew and English)
        const keywords = query
            .toLowerCase()
            .split(/[\s,.\-_]+/)
            .filter(k => k.length > 2)
            .slice(0, 5); // Max 5 keywords

        console.log('🔑 Keywords:', keywords);

        if (keywords.length === 0) {
            return [];
        }

        // Build search query - search in content and file_path
        // Using multiple OR conditions for keyword matching
        let searchQuery = supabase
            .from('code_chunks')
            .select('file_path, content, summary')
            .limit(limit * 2); // Get more results, will filter

        // Add text search conditions
        // Search for any keyword in content or file_path
        const orConditions = keywords.map(kw =>
            `content.ilike.%${kw}%,file_path.ilike.%${kw}%`
        ).join(',');

        const { data, error } = await supabase
            .from('code_chunks')
            .select('file_path, content, summary')
            .or(orConditions)
            .limit(limit);

        if (error) {
            console.error('❌ Code search error:', error);
            return [];
        }

        // Score results by keyword matches
        const scoredResults = (data || []).map(chunk => {
            const contentLower = (chunk.content || '').toLowerCase();
            const pathLower = (chunk.file_path || '').toLowerCase();
            let score = 0;

            keywords.forEach(kw => {
                if (contentLower.includes(kw)) score += 2;
                if (pathLower.includes(kw)) score += 3;
            });

            return {
                ...chunk,
                similarity: Math.min(score / (keywords.length * 5), 1) // Normalize to 0-1
            };
        });

        // Sort by score and take top results
        const results = scoredResults
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        console.log('✅ Maya RAG: Found', results.length, 'matching code chunks');
        return results;

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
        return '';
    }

    return results.map((r, i) =>
        `**[${i + 1}] ${r.file_path}** (relevance: ${(r.similarity * 100).toFixed(0)}%)\n\`\`\`\n${r.content}\n\`\`\``
    ).join('\n\n');
}

// Legacy function - kept for compatibility
export async function getQueryEmbedding(query) {
    return null;
}
