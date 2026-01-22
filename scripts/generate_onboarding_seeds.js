import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMFYUI_URL = 'http://127.0.0.1:8188';
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets');
const CLIENT_ID = randomUUID();

// Use dreamshaper_8 which is available in your checkpoints
const CHECKPOINT = 'dreamshaper_8.safetensors';

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const ITEMS = [
    {
        name: 'seed_plate_soup',
        prompt: 'Top-down close-up shot of an empty rustic ceramic soup bowl, completely filling the frame, sitting on a textured wooden cafe table. Warm, natural lighting, sharp focus, high resolution, professional food photography style. Minimalist elegant vibe.',
        negative: 'food, soup, liquid, text, watermark, logo, blurry, low quality'
    },
    {
        name: 'seed_plate_pasta',
        prompt: 'Top-down close-up shot of an empty wide-rimmed artisan ceramic pasta bowl, completely filling the frame, sitting on a textured wooden cafe table. High-end aesthetic, soft shadows, natural daylight. Minimalist elegant vibe.',
        negative: 'food, pasta, text, watermark, logo, blurry, low quality'
    },
    {
        name: 'seed_plate_dessert',
        prompt: 'Top-down close-up shot of an empty elegant flat thin clear glass dessert plate, modern minimalist design, completely filling the frame, sitting on a textured wooden cafe table. High-end, natural lighting, sharp focus. Sophisticated fine dining style.',
        negative: 'food, dessert, text, watermark, logo, blurry, low quality, ashtray'
    },
    {
        name: 'seed_cup_coffee',
        prompt: 'Top-down close-up shot of a classic ceramic coffee cup with saucer, completely filling the frame, on a textured wooden cafe table. A small square blondie cookie sitting on the saucer edge. Warm, natural lighting, sharp focus. Minimalist elegant vibe.',
        negative: 'text, watermark, logo, blurry, low quality'
    },
    {
        name: 'seed_glass_wine',
        prompt: 'Side view of an empty elegant wine glass standing on a textured wooden table surface. The background is pure solid white. High-end product photography, soft natural lighting, sharp focus.',
        negative: 'wine, liquid, text, watermark, logo, blurry, low quality'
    },
    {
        name: 'seed_glass_soft',
        prompt: 'Side view of an empty tall highball glass for soft drinks standing on a textured wooden table surface. The background is pure solid white. High-end product photography, soft natural lighting, sharp focus.',
        negative: 'drink, liquid, text, watermark, logo, blurry, low quality'
    }
];

// ComfyUI workflow for text-to-image
function createWorkflow(prompt, negative, seed) {
    return {
        "3": {
            "inputs": {
                "seed": seed,
                "steps": 25,
                "cfg": 7,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": CHECKPOINT
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {
                "text": prompt,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": negative,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": "comfyui_output",
                "images": ["8", 0]
            },
            "class_type": "SaveImage"
        }
    };
}

async function queuePrompt(workflow) {
    const response = await fetch(`${COMFYUI_URL}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: workflow,
            client_id: CLIENT_ID
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to queue prompt: ${error}`);
    }

    return response.json();
}

async function waitForCompletion(promptId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${CLIENT_ID}`);

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'executing') {
                if (message.data.node === null && message.data.prompt_id === promptId) {
                    ws.close();
                    resolve();
                }
            }
        });

        ws.on('error', reject);

        // Timeout after 5 minutes
        setTimeout(() => {
            ws.close();
            reject(new Error('Timeout waiting for completion'));
        }, 300000);
    });
}

async function getHistory(promptId) {
    const response = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    return response.json();
}

async function downloadImage(filename, outputPath) {
    const response = await fetch(`${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=&type=output`);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
}

async function generateImage(item) {
    console.log(`🎨 Generating: ${item.name}...`);

    try {
        const seed = Math.floor(Math.random() * 1000000000);
        const workflow = createWorkflow(item.prompt, item.negative, seed);

        console.log(`   Queuing prompt...`);
        const result = await queuePrompt(workflow);
        const promptId = result.prompt_id;

        console.log(`   Waiting for generation (prompt_id: ${promptId})...`);
        await waitForCompletion(promptId);

        console.log(`   Getting result...`);
        const history = await getHistory(promptId);
        const outputs = history[promptId]?.outputs;

        if (outputs && outputs["9"]) {
            const images = outputs["9"].images;
            if (images && images.length > 0) {
                const imageFilename = images[0].filename;
                const outputPath = path.join(OUTPUT_DIR, `${item.name}.png`);
                await downloadImage(imageFilename, outputPath);
                console.log(`   ✅ Saved: ${item.name}.png`);
            }
        } else {
            console.error(`   ❌ No output found in history`);
        }

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
    }
}

async function run() {
    console.log("🚀 Starting Seed Image Generation (ComfyUI Local)...");
    console.log(`   Checkpoint: ${CHECKPOINT}`);
    console.log(`   Output: ${OUTPUT_DIR}`);
    console.log("");

    // Verify ComfyUI is running
    try {
        const response = await fetch(`${COMFYUI_URL}/system_stats`);
        if (!response.ok) throw new Error('ComfyUI not responding');
        console.log("✅ ComfyUI is running\n");
    } catch (e) {
        console.error("❌ ComfyUI is not running. Please start it first.");
        process.exit(1);
    }

    for (const item of ITEMS) {
        await generateImage(item);
    }

    console.log("\n🏁 Done!");
}

run();
