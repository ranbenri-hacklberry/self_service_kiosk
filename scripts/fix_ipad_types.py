import os

def fix_ipad_types(src_dir):
    target_dir = os.path.join(src_dir, 'pages', 'ipad_inventory')
    old_import = "@/components/manager/types"
    new_import = "@/pages/ipad_inventory/types"
    
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if old_import in content:
                    print(f"Fixing {file_path}")
                    new_content = content.replace(old_import, new_import)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    src_dir = "/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/src"
    fix_ipad_types(src_dir)
