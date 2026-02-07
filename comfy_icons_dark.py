import urllib.request
import urllib.parse
import json
import time
import os
import sys
import random

# Configuration
COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "kds-lite/assets/icons_dark"
INPUT_SRC_PATH = "/Users/user/.gemini/antigravity/scratch/ComfyUI/input/grape_slush_src.png"

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

def get_dark_icon_workflow(prompt, seed, filename, denoise=0.75):
    # Using TXT2IMG based workflow to ensure clean background and cup style
    # We drop the img2img for now because we want to completely change the cup to "disposable plastic"
    # DreamShaper is strong enough to do this consistently with good prompting
    
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "dreamshaper_8.safetensors"
            }
        },
        "2": {
            "class_type": "EmptyLatentImage", 
            "inputs": {
                "width": 512,
                "height": 512,
                "batch_size": 1
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["1", 1]
            }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "text, watermark, blur, low quality, messy, complex background, glass cup, mug, handle, coaster, table, reflection, white background", 
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
                "steps": 25, 
                "cfg": 8.0, 
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["5", 0],
                "vae": ["1", 2]
            }
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["6", 0],
                "filename_prefix": filename
            }
        }
    }
    return workflow

def main():
    print("🕵️ Connecting to ComfyUI (Dark Mode Disposable Cups)...")
    
    # Common prompt parts for DARK MODE KDS
    # "Transparent high quality disposable plastic cup"
    BASE = "Minimalist 3D icon, clear disposable plastic cup, single solid color liquid, clean pure black background, studio rim lighting, 4k"
    
    # BATCH LIST
    ICONS = [
        # SLUSHIES (Piled High)
        ("Ice Cafe (Slush)", f"{BASE}, filled with frozen coffee slush, beige brown texture, slush piled high above rim like a mountain", "dark_ice_cafe_slush"),
        ("Grape Slush", f"{BASE}, filled with purple grape slush, frozen texture, slush piled high above rim like a mountain", "dark_grape_slush"),
        ("Lemon Slush", f"{BASE}, filled with yellow lemon slush, frozen texture, slush piled high above rim like a mountain", "dark_lemon_slush"),

        # COLD DRINKS (Liquid + Small Cubes)
        ("Cola", f"{BASE}, filled with dark brown cola, fizzy bubbles, small ice cubes floating at top", "dark_cola"),
        ("Orange Juice", f"{BASE}, filled with bright orange juice, vibrant orange liquid, small ice cubes floating at top", "dark_orange_juice"),
        ("Lemonade", f"{BASE}, filled with yellow lemonade, vibrant yellow liquid, small ice cubes floating at top, mint leaf", "dark_lemonade"),
        ("Iced Chocolate", f"{BASE}, filled with brown chocolate milk, smooth liquid, small ice cubes floating at top", "dark_iced_chocolate"),
        ("Iced Coffee (Latte)", f"{BASE}, filled with beige milky coffee, smooth liquid, small ice cubes floating at top", "dark_iced_coffee"),
        ("Iced Americano", f"{BASE}, filled with black coffee, dark liquid, small ice cubes floating at top", "dark_iced_americano"),
    ]

    for name, full_prompt, filename in ICONS:
        print(f"\n🚀 Generating: {name}...")
        
        seed = random.randint(1, 9999999999)
        prefix = f"DARK_{filename}" 
        
        # Using Txt2Img workflow now for cleaner results on black background
        workflow = get_dark_icon_workflow(full_prompt, seed, prefix)
        
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
