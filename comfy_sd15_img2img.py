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
INPUT_IMAGE_PATH = "/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/kds-lite/assets/variations/grape_slush.png"
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

def get_sd15_img2img_workflow(prompt, seed, filename, input_image_path, denoise=0.65):
    # Image name must be just the filename in ComfyUI/input
    image_name = "grape_slush_src.png"
    
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
                "text": "text, watermark, blur, low quality, hand, holding, ugly, deformed, noisy, grainy, purple, big ice blocks, geometric ice, giant ice", 
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
                "cfg": 8.0, 
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
    print("🕵️ Connecting to ComfyUI (Img2Img Refined Ice)...")
    
    # BATCH LIST - REFINED FOR SMALL ICE
    DRINKS = [
        # SLUSH remains slushy (low denoise, keep texture) - Actually let's redo it to be coffee colored
         ("Iced Coffee (Slush)", "Minimalist 3D icon of a glass cup filled with frozen blended coffee slushy, beige brown texture, small ice crystals, clean white background, studio lighting, 8k", "iced_coffee_slush_v3", 0.65), 

        # CUBES need high denoise to break the big chunks from the source image
        ("Iced Chocolate", "Minimalist 3D icon of a glass cup filled with cold chocolate milk, brown liquid, small crushed ice cubes floating on top, clean white background, studio lighting, 8k", "iced_chocolate_v3", 0.75),
        
        ("Cold Coffee (Latte)", "Minimalist 3D icon of a glass cup filled with cold latte coffee, milky beige liquid, many small ice cubes floating on top surface, clean white background, studio lighting, 8k", "cold_coffee_latte_v3", 0.75), 
        
        ("Iced Americano", "Minimalist 3D icon of a glass cup filled with dark black coffee, dark liquid, small ice cubes floating on surface, clean white background, studio lighting, 8k", "iced_americano_v3", 0.75),
    ]

    for name, full_prompt, filename_key, denoise_val in DRINKS:
        print(f"\n🚀 Generating: {name}...")
        
        seed = random.randint(1, 9999999999)
        prefix = f"DS8_V3_{filename_key}_{int(time.time())}" 
        
        workflow = get_sd15_img2img_workflow(full_prompt, seed, prefix, INPUT_SRC_PATH, denoise=denoise_val)
        
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
                        
                        path = os.path.join(OUTPUT_DIR, f"{filename_key}_refined.png")
                        with open(path, 'wb') as f:
                            f.write(data)
                        print(f"   ✅ Saved to: {path}")

if __name__ == "__main__":
    main()
