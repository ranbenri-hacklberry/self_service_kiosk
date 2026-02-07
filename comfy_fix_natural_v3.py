import urllib.request
import urllib.parse
import json
import time
import os
import sys
import random
import shutil

# Configuration
COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "kds-lite/assets/icons_pro"
INPUT_SRC_PATH = "/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/kds-lite/assets/icons_dark/dark_iced_americano.png"
COMFY_INPUT_DIR = "/Users/user/.gemini/antigravity/scratch/ComfyUI/input"

# Ensure output directory exists (using existing pro folder)
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

def get_natural_workflow(prompt, seed, filename, denoise=0.8):
    image_name = "master_americano.png"
    
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "dreamshaper_8.safetensors"
            }
        },
        "2": {
            "class_type": "LoadImage", 
            "inputs": {
                "image": image_name 
            }
        },
        "3": {
            "class_type": "VAEEncode",
            "inputs": {
                "pixels": ["2", 0],
                "vae": ["1", 2]
            }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["1", 1]
            }
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "text, watermark, blur, low quality, messy, complex background, straw, ugly, deformed, neon, glowing, radioactive, saturated", 
                "clip": ["1", 1] 
            }
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["5", 0],
                "latent_image": ["3", 0], 
                "seed": seed,
                "steps": 30, 
                "cfg": 7.5, # Lower CFG for more natural colors
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": denoise 
            }
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["6", 0],
                "vae": ["1", 2]
            }
        },
        "8": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["7", 0],
                "filename_prefix": filename
            }
        }
    }
    return workflow

def main():
    print("🕵️ Connecting to ComfyUI (Natural V3 Fix)...")
    
    # BATCH LIST (Natural Prompts)
    BASE = "Minimalist 3D icon, clear disposable plastic cup, clean pure black background, studio rim lighting, 4k"
    
    ICONS = [
        ("Orange Juice", f"{BASE}, filled with natural cloudy orange juice, soft matte texture, small crushed ice cubes floating", "pro_orange_juice_v3"),
        
        ("Lemonade", f"{BASE}, filled with natural cloudy yellow lemonade, soft matte texture, small crushed ice cubes floating, mint leaf", "pro_lemonade_v3"),
        
        ("Iced Chocolate", f"{BASE}, filled with natural light brown chocolate milk, creamy matte texture, small crushed ice cubes floating", "pro_iced_chocolate_v3"),
        
        ("Iced Coffee (Latte)", f"{BASE}, filled with natural beige milky coffee, creamy matte texture, small crushed ice cubes floating", "pro_iced_coffee_latte_v3"),
    ]

    for name, full_prompt, filename in ICONS:
        print(f"\n🚀 Generating: {name} (Natural V3)...")
        
        seed = random.randint(1, 9999999999)
        prefix = f"NATURAL_{filename}" 
        
        workflow = get_natural_workflow(full_prompt, seed, prefix, denoise=0.8)
        
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
            if time.time() - start_time > 120: 
                print(f"❌ Timeout waiting for {name}")
                break
            time.sleep(1)
            
        if prompt_id in history:
            outputs = history[prompt_id]['outputs']
            for node_id in outputs:
                if 'images' in outputs[node_id]:
                    for img in outputs[node_id]['images']:
                        print(f"   📸 Image generated: {img['filename']}")
                        data = get_image_content(img['filename'], img['subfolder'], img['type'])
                        
                        path = os.path.join(OUTPUT_DIR, f"{filename}.png")
                        with open(path, 'wb') as f:
                            f.write(data)
                        print(f"   ✅ Saved to: {path}")

if __name__ == "__main__":
    main()
