
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Env vars from .env file directly manually inserted here for the script
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FILES_TO_UPLOAD = [
    {
        path: '/Users/user/.gemini/antigravity/brain/7b7e6aca-295d-46a1-8f0f-756173ebdf1c/sachlab_paper_cup_1768098527061.png',
        name: 'sachlab_paper_cup.png'
    },
    {
        path: '/Users/user/.gemini/antigravity/brain/7b7e6aca-295d-46a1-8f0f-756173ebdf1c/pasta_cream_sweet_potato_1768098736371.png',
        name: 'pasta_cream_sweet_potato.png'
    },
    {
        path: '/Users/user/.gemini/antigravity/brain/7b7e6aca-295d-46a1-8f0f-756173ebdf1c/pasta_rosa_basil_1768098849145.png',
        name: 'pasta_rosa_basil.png'
    }
];

const BUCKET_NAME = 'menu-images';

async function uploadImages() {
    console.log('🚀 Starting upload to Supabase Storage...');

    for (const file of FILES_TO_UPLOAD) {
        try {
            console.log(`\n📤 Uploading ${file.name}...`);
            const fileContent = fs.readFileSync(file.path);

            // Unique filename with timestamp to avoid collisions
            const fileName = `generated_${Date.now()}_${file.name}`;

            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, fileContent, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (error) {
                console.error(`❌ Failed to upload ${file.name}:`, error.message);
            } else {
                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(fileName);

                console.log(`✅ Uploaded successfully!`);
                console.log(`🔗 URL: ${publicUrl}`);
            }
        } catch (e) {
            console.error(`❌ Error processing ${file.name}:`, e.message);
        }
    }
    console.log('\n🏁 Done!');
}

uploadImages();
