
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scanDeep(path = '') {
    const { data, error } = await supabase.storage.from('menu-images').list(path, { limit: 100 });
    if (error) {
        console.error(`Error at ${path}:`, error.message);
        return [];
    }

    let allFiles = data.map(f => ({ ...f, fullPath: path ? `${path}/${f.name}` : f.name }));

    // For each folder, recurse
    for (const item of data) {
        if (!item.id) { // Usually folders don't have an ID in list()
            const subFiles = await scanDeep(path ? `${path}/${item.name}` : item.name);
            allFiles = allFiles.concat(subFiles);
        }
    }
    return allFiles;
}

async function run() {
    console.log("Starting full recursive scan of 'menu-images'...");
    const files = await scanDeep();
    console.log(`Scan complete. Found ${files.length} items total.`);

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const likelyImages = files.filter(f => imageExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));

    console.log(`Found ${likelyImages.length} image files.`);

    // Search for keywords
    const keywords = ['hafuch', 'moka', 'espresso', 'shoko', 'cup', 'coffee', 'dada'];
    const matches = likelyImages.filter(f => keywords.some(k => f.fullPath.toLowerCase().includes(k)));

    console.log("\n--- Keyword Matches ---");
    matches.forEach(f => console.log(`${f.fullPath} (${(f.metadata.size / 1024).toFixed(1)} KB)`));
}

run();
