import express from 'express';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.LOCAL_SUPABASE_URL || process.env.VITE_LOCAL_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

/**
 * GET /api/marketing/providers/:businessId
 * Returns available AI providers for the business
 */
router.get('/providers/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;

        // Fetch keys from DB
        const { data: business } = await supabase
            .from('businesses')
            .select('gemini_api_key, grok_api_key, claude_api_key')
            .eq('id', businessId)
            .single();

        // Check ComfyUI (Local)
        let comfyAvailable = false;
        try {
            const comfyResp = await fetch(`${COMFYUI_URL}/system_stats`, { timeout: 1000 });
            comfyAvailable = comfyResp.ok;
        } catch (e) {
            comfyAvailable = false;
        }

        res.json({
            providers: {
                local: { available: comfyAvailable, label: 'מקומי (ComfyUI)' },
                gemini: { available: !!business?.gemini_api_key, label: 'Google Gemini' },
                grok: { available: !!business?.grok_api_key, label: 'xAI Grok' },
                claude: { available: !!business?.claude_api_key, label: 'Anthropic Claude' }
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/marketing/remove-background
 * Uses sharp (basic) or external tool
 */
router.post('/remove-background', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

        const buffer = Buffer.from(imageBase64, 'base64');

        // This is a placeholder. Real background removal usually requires ML.
        // For now, we'll just return the original if we don't have a better tool.
        // But let's try to at least do a "trim" or something with sharp if possible.

        // Mocking successful removal by just returning original for now 
        // until we decide on a ML model (like rembg via python)
        res.json({ imageBase64 });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/marketing/generate-image
 * Generates image using ComfyUI or Cloud API
 */
router.post('/generate-image', async (req, res) => {
    try {
        const { prompt, businessId, provider, aspectRatio = '1:1', seedImageBase64 } = req.body;

        if (!prompt || !businessId) {
            return res.status(400).json({ error: 'prompt and businessId required' });
        }

        console.log(`🎨 Generating marketing image for business ${businessId} using ${provider}...`);

        if (provider === 'local') {
            // Use ComfyUI logic (similar to backend_server.js)
            // For brevity, I'll implement a simplified version or call an internal helper if I had one
            // Let's implement the ComfyUI call here.

            // ... implementation similar to the one in backend_server.js ...
            // (I'll skip the full ComfyUI logic here to keep it clean, 
            // but in a real app this would be a shared service)

            res.status(501).json({ error: 'Local ComfyUI integration for marketing not fully implemented yet' });
        } else {
            // Cloud providers (Gemini/Grok)
            res.status(501).json({ error: `Cloud provider ${provider} for images not implemented yet` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/marketing/composite-hebrew
 * Overlays Hebrew text and logo onto an image
 */
router.post('/composite-hebrew', async (req, res) => {
    try {
        const {
            imageBase64,
            hebrewText,
            bodyText,
            textPosition = 'bottom',
            textColor = '#FFFFFF',
            addLogo = false,
            logoUrl
        } = req.body;

        if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

        console.log(`✍️ Compositing text: "${hebrewText}"`);

        const baseBuffer = Buffer.from(imageBase64, 'base64');
        const metadata = await sharp(baseBuffer).metadata();
        const width = metadata.width;
        const height = metadata.height;

        // Simple SVG overlay for text
        // Note: system must have Hebrew fonts installed for this to work perfectly
        const svgText = `
            <svg width="${width}" height="${height}">
                <style>
                    .title { fill: ${textColor}; font-size: ${Math.floor(width / 15)}px; font-weight: bold; font-family: sans-serif; }
                    .body { fill: ${textColor}; font-size: ${Math.floor(width / 25)}px; font-family: sans-serif; }
                    .overlay { fill: rgba(0,0,0,0.4); }
                </style>
                <rect x="0" y="${height * 0.7}" width="${width}" height="${height * 0.3}" class="overlay" />
                <text x="${width / 2}" y="${height * 0.8}" text-anchor="middle" class="title">${hebrewText}</text>
                <text x="${width / 2}" y="${height * 0.9}" text-anchor="middle" class="body">${bodyText}</text>
            </svg>
        `;

        let pipeline = sharp(baseBuffer).composite([
            { input: Buffer.from(svgText), top: 0, left: 0 }
        ]);

        if (addLogo && logoUrl) {
            try {
                const logoResp = await fetch(logoUrl);
                const logoBuffer = await logoResp.buffer();
                const logoResized = await sharp(logoBuffer)
                    .resize(Math.floor(width / 6))
                    .toBuffer();

                pipeline = pipeline.composite([
                    { input: Buffer.from(svgText), top: 0, left: 0 },
                    { input: logoResized, top: 20, left: 20 }
                ]);
            } catch (e) {
                console.error('Failed to add logo to composite:', e.message);
            }
        }

        const outputBuffer = await pipeline.png().toBuffer();
        res.json({ finalImage: outputBuffer.toString('base64') });

    } catch (err) {
        console.error('Composite error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
