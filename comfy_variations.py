import urllib.request
import urllib.parse
import json
import time
import os
import sys
import random

# Configuration
COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "kds-lite/assets/variations"

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

def get_schnell_workflow(prompt, seed, filename_prefix):
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "flux_1_schnell_q8p.ckpt"
            }
        },
        "2": {
            "class_type": "EmptyLatentImage", 
            "inputs": {
                "width": 1024,
                "height": 1024,
                "batch_size": 1
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["1", 1] # Use CLIP from Checkpoint
            }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "", # Schnell doesn't need negative prompt
                "clip": ["1", 1] 
            }
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["2", 0],
                "seed": seed,
                "steps": 4,  # ULTRA FAST SCHNELL MODE
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0
            }
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["5", 0],
                "vae": ["1", 2] # Use VAE from Checkpoint
            }
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["6", 0],
                "filename_prefix": filename_prefix
            }
        }
    }
    return workflow

def main():
    print("🕵️ Connecting to ComfyUI with **FLUX SCHNELL** (4-Step Turbo Mode)...")
    
    # Check if Schnell exists
    # We assume it does based on user confirmation

    # BATCH LIST
    DRINKS = [
        ("Toast", "Minimalist 3D icon of a single slice of toast, golden brown, clean white background, studio lighting, octane render, 8k", "toast_clean"),
        ("Orange Juice", "Minimalist 3D icon of a glass cup filled with fresh orange juice, orange liquid, clean white background, studio lighting, 8k", "orange_juice"),
        ("Lemonade", "Minimalist 3D icon of a glass cup filled with cloudy lemonade with mint leaf, yellow liquid, clean white background, studio lighting, 8k", "lemonade"),
        ("Iced Americano", "Minimalist 3D icon of a glass cup filled with dark iced coffee, black liquid, ice cubes, clean white background, studio lighting, 8k", "iced_americano"),
        ("Iced Coffee", "Minimalist 3D icon of a glass cup filled with milky iced coffee, beige liquid, ice cubes, clean white background, studio lighting, 8k", "iced_coffee"),
        ("Iced Chocolate", "Minimalist 3D icon of a glass cup filled with chocolate milk, brown liquid, ice cubes, clean white background, studio lighting, 8k", "iced_chocolate"),
        ("Ice Cafe (Slush)", "Minimalist 3D icon of a glass cup filled with frozen blended coffee slushy, beige texture, clean white background, studio lighting, 8k", "ice_cafe_slush"),
        ("Grape Slush", "Minimalist 3D icon of a glass cup filled with purple grape slush (granita), purple frozen texture, clean white background, studio lighting, 8k", "grape_slush"),
    ]

    for name, full_prompt, filename_key in DRINKS:
        print(f"\n🚀 Generating: {name} (Schnell)...")
        
        seed = random.randint(1, 9999999999)
        prefix = f"SCHNELL_{filename_key}_{int(time.time())}" 
        
        workflow = get_schnell_workflow(full_prompt, seed, prefix)
        
        res = queue_prompt(workflow)
        if not res: 
            print("❌ Failed to queue prompt.")
            continue
            
        prompt_id = res['prompt_id']
        print(f"   ⏳ Job {prompt_id} queued...")
        
        # Poll for completion
        start_time = time.time()
        while True:
            try:
                history = get_history(prompt_id)
                if prompt_id in history:
                    break
            except Exception:
                pass
            if time.time() - start_time > 600: # 10 min timeout (should take seconds though)
                print(f"❌ Timeout waiting for {name}")
                break
            time.sleep(2)
            
        if prompt_id in history:
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
