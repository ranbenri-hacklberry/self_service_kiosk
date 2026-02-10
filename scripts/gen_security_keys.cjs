const crypto = require('crypto');
const fs = require('fs');

const envPath = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/.env';
const envLocalPath = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/.env.local';

function generateSecurityConfig() {
    // 1. Permutation (secret order of 128 dimensions)
    const indices = Array.from({ length: 128 }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // 2. Inversion mask (which dimensions to multiply by -1)
    const mask = Array.from({ length: 128 }, () => (Math.random() > 0.5 ? 1 : -1));

    return {
        permutation: indices.join(','),
        mask: mask.join(',')
    };
}

const config = generateSecurityConfig();
const masterKey = crypto.randomBytes(32).toString('hex');

const lines = [
    `FACE_VECTOR_PERMUTATION="${config.permutation}"`,
    `FACE_VECTOR_MASK="${config.mask}"`,
    `DB_MASTER_KEY="${masterKey}"`
];

function updateEnv(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Remove old broken pepper if exists
        content = content.replace(/FACE_VECTOR_PEPPER=.*\n?/g, '');

        lines.forEach(line => {
            const key = line.split('=')[0];
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(content)) {
                content = content.replace(regex, line);
            } else {
                content += '\n' + line + '\n';
            }
        });

        fs.writeFileSync(filePath, content);
        console.log('Updated ' + filePath);
    }
}

updateEnv(envPath);
updateEnv(envLocalPath);
