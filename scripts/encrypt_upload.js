import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Configuration
const SOURCE_DIR = process.argv[2]; // Passed as argument
// Optional: Second argument is destination. Default to local folder.
const DEST_DIR = process.argv[3] || 'encrypted_music_output';
const ENCRYPTION_KEY = process.env.MUSIC_ENCRYPTION_KEY || 'my-secret-key-must-be-32-bytes!!'; // 32 chars
const ALGORITHM = 'aes-256-cbc';

if (!SOURCE_DIR) {
    console.error('Usage: node scripts/encrypt_upload.js <source_path> [destination_path]');
    process.exit(1);
}

// Ensure key length
const key = Buffer.from(ENCRYPTION_KEY);
if (key.length !== 32) {
    console.error(`Error: Key must be 32 bytes. Current length: ${key.length}`);
    console.log('Using default key for demo purposes is NOT SECURE for production.');
    process.exit(1);
}

function encryptFile(inputPath, outputPath) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    // Write IV first
    output.write(iv);

    input.pipe(cipher).pipe(output);

    return new Promise((resolve, reject) => {
        output.on('finish', resolve);
        output.on('error', reject);
    });
}

function scanAndEncrypt(dir, outputBaseDir) {
    if (!fs.existsSync(outputBaseDir)) fs.mkdirSync(outputBaseDir, { recursive: true });

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name.startsWith('.')) continue;

        if (entry.isDirectory()) {
            scanAndEncrypt(fullPath, path.join(outputBaseDir, entry.name));
        } else if (/\.(mp3|flac|m4a|wav)$/i.test(entry.name)) {
            const destPath = path.join(outputBaseDir, `${entry.name}.enc`);

            // Check if file already exists
            if (fs.existsSync(destPath)) {
                // Optional: Check timestamps to see if source is newer
                const srcStat = fs.statSync(fullPath);
                const destStat = fs.statSync(destPath);

                if (srcStat.mtime <= destStat.mtime) {
                    console.log(`⏩ Skipping (already exists): ${entry.name}`);
                    continue;
                }
            }

            console.log(`🔒 Encrypting: ${entry.name} -> ${destPath}`);
            encryptFile(fullPath, destPath);
        }
    }
}

console.log(`Starting encryption from: ${SOURCE_DIR}`);
console.log(`Output directory: ${DEST_DIR}`);
scanAndEncrypt(SOURCE_DIR, DEST_DIR);
console.log('✅ Encryption complete! Now upload the "encrypted_music_output" folder to Google Drive as "Music Encrypted".');
