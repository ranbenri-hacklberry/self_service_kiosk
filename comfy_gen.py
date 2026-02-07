import urllib.request
import urllib.parse
import json
import time
import os
import sys
import random

# Configuration
COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "kds-lite/assets/icons"

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def queue_prompt(workflow):
    p = {"prompt": workflow}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(f"{COMFY_URL}/prompt", data=data)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as e:
        print(f"❌ API Error: {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"❌ Network Error: {e}")
        return None

def get_history(prompt_id):
    with urllib.request.urlopen(f"{COMFY_URL}/history/{prompt_id}") as response:
        return json.loads(response.read())

def get_image_content(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen(f"{COMFY_URL}/view?{url_values}") as response:
        return response.read()

def get_flux_klein_workflow(prompt, seed, filename_prefix):
    workflow = {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "flux-2-klein-4b.safetensors",
                "weight_dtype": "default"
            }
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": "t5xxl_fp8_e4m3fn.safetensors",
                "clip_name2": "clip_l.safetensors",
                "type": "flux"
            }
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {
                "vae_name": "ae.safetensors"
            }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["2", 0]
            }
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "text, watermark, blur, low quality, mug, ceramic cup, glass cup", 
                "clip": ["2", 0]
            }
        },
        "6": {
            "class_type": "EmptyLatentImage", 
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1
            }
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["5", 0],
                "latent_image": ["6", 0],
                "seed": seed,
                "steps": 20, # Increased steps for better details
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["7", 0],
                "vae": ["3", 0]
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["8", 0],
                "filename_prefix": filename_prefix
            }
        }
    }
    return workflow

def main():
    print("🕵️ Connecting to ComfyUI with **FIXED SEEDS**...")
    
    # Batch Definition with FIXED SEEDS
    # Format: (Name, Prompt, Filename, Seed)
    BATCH = [
        ("Croissant", "Golden baked buttery croissant", "croissant", 1001),
        ("Cola", "Disposable paper cup with ice cold cola and straw, splash", "cola", 2055), # New seed attempt
        ("Pizza", "Slice of delicious pizza with melted cheese and basil", "pizza", 3003),
        ("Espresso", "Small disposable cardboard espresso cup", "espresso", 4004),
        ("Cappuccino", "Disposable paper coffee cup with cappuccino, plastic lid off to side, heart latte art", "cappuccino", 5005),
    ]

    for name, user_prompt, filename_key, seed_val in BATCH:
        print(f"\n🎨 Generating: {name} (Seed: {seed_val})...")
        
        full_prompt = f"Minimalist 3D icon of a {user_prompt}, white takeaway cup, studio lighting, volumetric light, glowing neon green highlights, dark slate background, octane render, 8k"
        
        if name in ["Croissant", "Pizza"]:
             full_prompt = f"Minimalist 3D icon of a {user_prompt}, studio lighting, volumetric light, glowing neon green highlights, dark slate background, octane render, 8k"
        
        # Adding nonce just to be safe against cache, but keeping seed constant
        full_prompt += f" --nonce {random.randint(1,100)}"
        
        # Use our fixed seed
        seed = seed_val
        
        # Unique prefix for Comfy
        comfy_filename_prefix = f"KDS_FIXED_{filename_key}_{int(time.time())}" 
        
        workflow = get_flux_klein_workflow(full_prompt, seed, comfy_filename_prefix)
        
        res = queue_prompt(workflow)
        if not res: 
            print("❌ Failed to queue prompt.")
            continue
            
        prompt_id = res['prompt_id']
        print(f"   ⏳ Job {prompt_id} queued...")
        
        while True:
            history = get_history(prompt_id)
            if prompt_id in history:
                break
            time.sleep(1)
            
        outputs = history[prompt_id]['outputs']
        for node_id in outputs:
            if 'images' in outputs[node_id]:
                for img in outputs[node_id]['images']:
                    print(f"   📸 Image generated: {img['filename']}")
                    data = get_image_content(img['filename'], img['subfolder'], img['type'])
                    
                    path = os.path.join(OUTPUT_DIR, f"{filename_key}.png")
                    with open(path, 'wb') as f:
                        f.write(data)
                    print(f"   ✅ Saved to: {path}")

if __name__ == "__main__":
    main()
