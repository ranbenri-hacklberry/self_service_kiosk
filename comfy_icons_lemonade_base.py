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
OUTPUT_DIR = "kds-lite/assets/icons_final_master"
INPUT_SRC_PATH = "/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/kds-lite/assets/icons_pro/pro_lemonade_v2.png"
COMFY_INPUT_DIR = "/Users/user/.gemini/antigravity/scratch/ComfyUI/input"

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

def get_lemonade_base_workflow(prompt, seed, filename, denoise=0.75):
    image_name = "master_lemonade.png"
    
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
                "text": "text, watermark, blur, low quality, messy, complex background, straw, ugly, deformed, mint, leaf, green leaf", 
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
                "cfg": 8.5, 
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
    print("🕵️ Connecting to ComfyUI (Final Batch from Lemonade V2 Base)...")
    
    # Copy Lemonade V2 to Use as Master
    master_dest = os.path.join(COMFY_INPUT_DIR, "master_lemonade.png")
    shutil.copy(INPUT_SRC_PATH, master_dest)
    print(f"   ✅ Copied Lemonade V2 Master to {master_dest}")

    # BATCH LIST
    BASE = "Minimalist 3D icon, clear disposable plastic cup, clean pure black background, studio rim lighting, 4k"
    
    ICONS = [
        # Keep the Lemonade but Clean (No Mint)
        ("Lemonade (Clean)", f"{BASE}, filled with opaque cloudy yellow lemonade, vibrant yellow liquid, lemon slice floating, small ice cubes", "final_lemonade_clean", 0.65),

        # Orange Use Lemon Slice Shape -> Orange Slice
        ("Orange Juice", f"{BASE}, filled with opaque cloudy orange juice, vibrant orange liquid, orange slice floating, small ice cubes", "final_orange_juice", 0.75),

        # Dark Drinks (Remove Fruit)
        ("Cola", f"{BASE}, filled with dark brown cola, fizzy bubbles, small ice cubes floating, no fruit", "final_cola", 0.75),
        ("Iced Americano", f"{BASE}, filled with black coffee, dark liquid, small ice cubes floating, no fruit", "final_iced_americano", 0.75),
        
        # Milky Drinks (Remove Fruit)
        ("Iced Chocolate", f"{BASE}, filled with light brown chocolate milk, creamy liquid, small ice cubes floating, no fruit", "final_iced_chocolate", 0.75),
        ("Iced Coffee (Latte)", f"{BASE}, filled with beige milky coffee, creamy liquid, small ice cubes floating, no fruit", "final_iced_coffee_latte", 0.75),
        
        # Slushies (Remove Fruit, Add Slush Texture)
        ("Ice Cafe (Slush)", f"{BASE}, filled with frozen coffee slush, beige texture, slush piled high above rim, no fruit", "final_ice_cafe_slush", 0.8),
        ("Grape Slush", f"{BASE}, filled with purple grape slush, frozen texture, slush piled high above rim, no fruit", "final_grape_slush", 0.8),
        ("Lemon Slush", f"{BASE}, filled with green lemon slush, frozen texture, slush piled high above rim, no fruit", "final_lemon_slush", 0.8),
    ]

    for name, full_prompt, filename, denoise in ICONS:
        print(f"\n🚀 Generating: {name}...")
        
        seed = random.randint(1, 9999999999)
        prefix = f"FINAL_{filename}" 
        
        workflow = get_lemonade_base_workflow(full_prompt, seed, prefix, denoise=denoise)
        
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
