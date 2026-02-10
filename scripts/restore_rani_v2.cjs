const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: '.env.local' });
const SCRAMBLE_KEY = process.env.BIOMETRIC_SCRAMBLE_KEY;

function getTransformationConfig(key) {
    if (!key) return { permutation: null, mask: null };
    const seed = crypto.createHash('sha256').update(key).digest();
    const permutation = Array.from({ length: 128 }, (_, i) => i);
    const mask = new Array(128);
    let currentHash = seed;
    for (let i = 127; i > 0; i--) {
        currentHash = crypto.createHash('sha256').update(currentHash).digest();
        const j = currentHash.readUInt32BE(0) % (i + 1);
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    currentHash = crypto.createHash('sha256').update(seed).update('mask').digest();
    for (let i = 0; i < 128; i++) {
        if (i % 32 === 0) {
            currentHash = crypto.createHash('sha256').update(currentHash).digest();
        }
        const byteIdx = Math.floor((i % 32) / 8);
        const bitIdx = i % 8;
        const bit = (currentHash[byteIdx] >> bitIdx) & 1;
        mask[i] = bit === 1 ? 1 : -1;
    }
    return { permutation, mask };
}

const { permutation: p, mask: m } = getTransformationConfig(SCRAMBLE_KEY);

function secureTransform(vector) {
    const inverted = vector.map((val, i) => val * m[i]);
    const secured = new Array(128);
    for (let i = 0; i < 128; i++) {
        secured[i] = inverted[p[i]];
    }
    return secured;
}

const supabaseUrl = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const originalRaniVector = [-0.06419937, 0.07818741, 0.050452385, -0.01917805, -0.049970772, -0.07008875, 0.06198924, -0.07362664, 0.24718228, -0.040455557, 0.1748913, 0.06384675, -0.20888638, -0.022904847, -0.0514263, 0.1052624, -0.08572137, -0.10965228, -0.15122855, -0.16641818, 0.07619059, 0.04754796, 0.01931256, 0.04013791, -0.21070105, -0.26368594, -0.1033519, -0.060035683, 0.101018295, -0.14782618, 0.06687993, 0.04164137, -0.17747268, -0.06324075, 0.0027093394, 0.008785576, 0.0018111905, -0.0683352, 0.22040552, 0.10867573, -0.14975408, 0.097380295, 0.020630633, 0.3306406, 0.14404383, 0.027816147, 0.10200544, -0.1154071, 0.090975866, -0.16075245, 0.06567058, 0.12278643, 0.037218027, 0.010341044, 0.108721025, -0.19020605, -0.047168523, 0.18821853, -0.24961478, 0.2027745, 0.075834274, -0.08486195, -0.08990167, -0.065790445, 0.12203017, 0.07204688, -0.12009886, -0.11598828, 0.21978486, -0.15881807, 0.026713692, 0.06056776, -0.088315964, -0.16893287, -0.25483382, 0.091804445, 0.48989862, 0.121315375, -0.15181616, 0.038149305, -0.08989798, -0.0024044672, 0.06872212, 0.06600783, -0.09692839, -0.048702702, -0.06762137, 0.061504327, 0.17695378, 0.09873868, -0.036261193, 0.21162155, 0.006496249, -0.06314382, -0.025056012, 0.028343296, -0.23248659, -0.0022928827, -0.07268049, -0.03890761, -0.013924016, -0.14226101, 0.04919301, 0.07464146, -0.16094592, 0.16340074, 0.026034016, -0.05533383, -0.039205905, 0.093534924, -0.12475207, -0.015868947, 0.15600869, -0.26810443, 0.22810934, 0.19568688, 0.041705467, 0.14487039, 0.053869143, 0.10579472, 0.025286704, 0.04020291, -0.103755414, -0.041179128, -0.029776666, -0.086030275, 0.104118854, 0.037485063];

async function run() {
    const transformed = secureTransform(originalRaniVector);
    const vectorString = `[${transformed.join(',')}]`;
    const { error } = await supabase.from('employees').update({ face_embedding: vectorString }).ilike('name', '%רני%');
    if (error) console.error(error);
    else console.log('✅ Rani successfully re-secured with master key scrambling!');
}

run();
