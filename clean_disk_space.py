import os
import sys
from pathlib import Path

# --- Configuration ---
MIN_SIZE_MB = 100  # Only show files larger than this (in MB)
SEARCH_DIRS = [
    "Downloads",
    "Movies",
    "Music",
    "Documents",
    "Desktop"
]
# File extensions to highlight (Video, Audio, Archives, Disk Images)
MEDIA_EXTENSIONS = {
    '.mp4', '.mkv', '.mov', '.avi', '.wmv', '.flv', '.webm',  # Video
    '.mp3', '.wav', '.flac', '.m4a', '.aac',                  # Audio
    '.zip', '.rar', '.7z', '.tar', '.gz',                     # Archives
    '.iso', '.dmg', '.img'                                    # Disk Images
}

def get_size_str(size_in_bytes):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.2f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.2f} PB"

def scan_files(home_dir):
    large_files = []
    print(f"🔍 Scanning for files larger than {MIN_SIZE_MB}MB in your home directories...")
    print("This might take a minute...\n")

    for dirname in SEARCH_DIRS:
        dir_path = home_dir / dirname
        if not dir_path.exists():
            continue
            
        print(f"  Scanning {dirname}...")
        
        try:
            for root, dirs, files in os.walk(dir_path):
                # Skip hidden directories (starting with .)
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                
                for name in files:
                    if name.startswith('.'):
                        continue
                        
                    file_path = Path(root) / name
                    
                    # Skip if it's a symlink
                    if file_path.is_symlink():
                        continue
                        
                    try:
                        size = file_path.stat().st_size
                        if size > MIN_SIZE_MB * 1024 * 1024:
                            # Check if it's a media file or just a large file
                            ext = file_path.suffix.lower()
                            category = "OTHER"
                            if ext in MEDIA_EXTENSIONS:
                                category = "MEDIA"
                            
                            large_files.append({
                                'path': file_path,
                                'size': size,
                                'category': category
                            })
                    except (OSError, PermissionError):
                        continue
        except (OSError, PermissionError):
            print(f"  ⚠️  Permission denied for {dirname}, skipping.")
            continue

    # Sort by size (descending)
    large_files.sort(key=lambda x: x['size'], reverse=True)
    return large_files

def main():
    home_dir = Path.home()
    files = scan_files(home_dir)

    if not files:
        print(f"\n✅ No files larger than {MIN_SIZE_MB}MB found!")
        return

    print(f"\nFound {len(files)} large files.\n")
    print("-" * 80)
    print(f"{'#':<4} {'Size':<10} {'Type':<8} {'File Path'}")
    print("-" * 80)

    # List files
    for i, f in enumerate(files):
        print(f"{i+1:<4} {get_size_str(f['size']):<10} {f['category']:<8} {f['path']}")

    print("-" * 80)
    print("\nOptions:")
    print(" [Number]  Delete specific file (e.g. '1' or '1,3,5')")
    print(" [q]       Quit")
    
    while True:
        choice = input("\nEnter choice: ").strip()
        
        if choice.lower() == 'q':
            print("Exiting.")
            break
            
        try:
            # Handle comma-separated lists
            indices = [int(x.strip()) - 1 for x in choice.split(',')]
            valid_indices = [i for i in indices if 0 <= i < len(files)]
            
            if not valid_indices:
                print("❌ Invalid selection.")
                continue
                
            # Confirm deletion
            print("\nYou selected:")
            for i in valid_indices:
                print(f"  - {files[i]['path']} ({get_size_str(files[i]['size'])})")
                
            confirm = input("\n⚠️  Are you SURE you want to DELETE these files? (yes/no): ")
            if confirm.lower() == 'yes':
                deleted_count = 0
                for i in valid_indices:
                    file_to_del = files[i]['path']
                    if file_to_del.exists():
                        try:
                            # Ensure we are deleting the file we listed (basic safety)
                            os.remove(file_to_del)
                            print(f"✅ Deleted: {file_to_del.name}")
                            deleted_count += 1
                        except Exception as e:
                            print(f"❌ Error deleting {file_to_del.name}: {e}")
                    else:
                        print(f"⚠️  File already gone: {file_to_del.name}")
                print(f"\nDone. {deleted_count} files removed.")
                
                # Re-run or exit? Let's just exit for safety to force a re-scan.
                print("Please re-run the script to scan again.")
                break
            else:
                print("Deletion cancelled.")
                
        except ValueError:
            print("Please enter a valid number or 'q'.")

if __name__ == "__main__":
    main()
