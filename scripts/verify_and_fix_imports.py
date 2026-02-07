import os
import re

def resolve_import(alias_path, src_dir):
    # alias_path is like "@/types/onboardingTypes"
    rel_path = alias_path[2:] # "types/onboardingTypes"
    
    # Check common extensions
    extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json']
    for ext in extensions:
        full_path = os.path.join(src_dir, rel_path + ext)
        if os.path.isfile(full_path):
            return True
        # Check index files if it's a directory
        if os.path.isdir(os.path.join(src_dir, rel_path)):
            for idx_ext in ['.js', '.jsx', '.ts', '.tsx']:
                if os.path.isfile(os.path.join(src_dir, rel_path, 'index' + idx_ext)):
                    return True
    return False

def find_correct_path(alias_path, src_dir):
    # Extract the filename/basename
    filename = os.path.basename(alias_path)
    if not filename: return None
    
    matches = []
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            name_no_ext = os.path.splitext(f)[0]
            if name_no_ext == filename:
                rel_found = os.path.relpath(os.path.join(root, name_no_ext), src_dir)
                matches.append(rel_found)
    
    if len(matches) == 1:
        return f"@/{matches[0].replace('\\', '/')}"
    
    # Try directory match (for folder imports)
    dir_matches = []
    for root, dirs, files in os.walk(src_dir):
        for d in dirs:
            if d == filename:
                # Check if it has an index file
                for idx_ext in ['.js', '.jsx', '.ts', '.tsx']:
                    if os.path.isfile(os.path.join(root, d, 'index' + idx_ext)):
                        rel_found = os.path.relpath(os.path.join(root, d), src_dir)
                        dir_matches.append(rel_found)
                        break
    
    if len(dir_matches) == 1:
        return f"@/{dir_matches[0].replace('\\', '/')}"

    return None

def verify_and_fix_imports(src_dir):
    import_regex = re.compile(r"((?:from|import)\s+['\"])(@\/[^'\"]+)(['\"])")
    
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                file_path = os.path.join(root, file)
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                changed = False
                new_lines = []
                for line in lines:
                    match = import_regex.search(line)
                    if match:
                        prefix = match.group(1)
                        alias_path = match.group(2)
                        suffix = match.group(3)
                        
                        if not resolve_import(alias_path, src_dir):
                            print(f"Broken import: {alias_path} in {file_path}")
                            correct_path = find_correct_path(alias_path, src_dir)
                            if correct_path:
                                print(f"  -> Fixed to: {correct_path}")
                                new_line = line.replace(alias_path, correct_path)
                                new_lines.append(new_line)
                                changed = True
                            else:
                                print(f"  -> Could not fix automatically.")
                                new_lines.append(line)
                        else:
                            new_lines.append(line)
                    else:
                        new_lines.append(line)
                
                if changed:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)

if __name__ == "__main__":
    src_dir = "/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/src"
    verify_and_fix_imports(src_dir)
