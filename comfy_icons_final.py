import urllib.request
import urllib.parse
import json
import time
import os
import sys
import random

# Configuration
COMFY_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = "kds-lite/assets/icons_final"
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

def get_final_icon_workflow(prompt, seed, filename, input_image_path, denoise=0.7):
    image_name = "grape_slush_src.png" # Must match what's in input folder
    
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
                "text": "text, watermark, blur, low quality, hand, holding, ugly, deformed, noisy, grainy, photo, realistic, complex background", 
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
                "steps": 25, 
                "cfg": 8.0, 
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": denoise # CRITICAL for style change vs shape retention
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
    print("🕵️ Connecting to ComfyUI (Final ICON Set)...")
    
    # Common prompt parts
    STYLE = "Minimalist 3D cute cartoon icon, isometric view, soft lighting, vibrant color, clean white background, 4k"
    
    # BATCH LIST
    ICONS = [
        # SLUSHIES (High denoise to reshape top, "Protruding")
        ("Ice Cafe (Slush)", f"{STYLE}, glass cup filled with frozen coffee slush, beige texture, piled high above rim, protruding mountain of slush", "icon_ice_cafe_slush", 0.70),
        ("Grape Slush", f"{STYLE}, glass cup filled with purple grape slush, frozen texture, piled high above rim, protruding mountain of slush", "icon_grape_slush", 0.65),
        ("Lemon Mint Slush", f"{STYLE}, glass cup filled with green lemon mint slush, frozen texture, piled high above rim, protruding mountain of slush, mint leaf on top", "icon_lemon_slush", 0.70),

        # COLD DRINKS (Medium denoise, "Liquid + Cubes")
        ("Iced Chocolate", f"{STYLE}, glass cup filled with brown chocolate milk, liquid surface, small cute ice cubes floating", "icon_iced_chocolate", 0.75),
        ("Iced Coffee (Latte)", f"{STYLE}, glass cup filled with beige milky coffee, liquid surface, small cute ice cubes floating", "icon_iced_coffee_latte", 0.75),
        ("Iced Americano", f"{STYLE}, glass cup filled with dark black coffee, liquid surface, small cute ice cubes floating", "icon_iced_americano", 0.75),
        ("Orange Juice", f"{STYLE}, glass cup filled with bright orange juice, liquid surface, small cute ice cubes floating, orange slice", "icon_orange_juice", 0.75),
        ("Cola", f"{STYLE}, glass cup filled with dark brown cola, fizzy bubbles, liquid surface, small cute ice cubes floating", "icon_cola", 0.75),
    ]

    for name, full_prompt, filename, denoise in ICONS:
        print(f"\n🚀 Generating: {name}...")
        
        # We reuse a random seed or fix it if we want exact consistency, but random usually gives good variation in 'cartoon' style
        seed = random.randint(1, 9999999999)
        prefix = f"ICON_{filename}" 
        
        workflow = get_final_icon_workflow(full_prompt, seed, prefix, INPUT_SRC_PATH, denoise=denoise)
        
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
