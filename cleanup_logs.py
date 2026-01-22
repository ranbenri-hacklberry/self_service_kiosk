#!/usr/bin/env python3
"""
🧹 Console Log Cleanup Script
Removes excessive debug logs from React components while keeping important ones.
"""

import re
import os
from pathlib import Path

# Files to clean
TARGET_FILES = [
    "src/pages/menu-ordering-interface/index.jsx",
    "src/pages/menu-ordering-interface/hooks/useLoyalty.js",
    "src/pages/menu-ordering-interface/components/SmartCart.jsx",
    "src/lib/loyalty.ts",
]

# Logs to KEEP (important for debugging)
KEEP_PATTERNS = [
    r"console\.error",        # Always keep errors
    r"console\.warn",         # Always keep warnings  
    r"❌",                     # Error indicators
    r"⚠️",                     # Warning indicators
    r"\[Loyalty\].*Result",   # Loyalty results (useful)
    r"Failed to",             # Failure messages
]

# Logs to REMOVE (verbose debug logs)
REMOVE_PATTERNS = [
    # Generic patterns that catch most debug logs
    r"console\.log\('🚀",      # Component rendering
    r"console\.log\('📍",      # Location/navigation
    r"console\.log\('🛒",      # Cart debug
    r"console\.log\('🎯",      # Status decisions
    r"console\.log\('🔍",      # Search/check
    r"console\.log\('🔄",      # Refresh/update
    r"console\.log\('💰",      # Money calculations
    r"console\.log\('📊",      # Data loading
    r"console\.log\('📁",      # Categories
    r"console\.log\('📦",      # Orders
    r"console\.log\('💾",      # Saving
    r"console\.log\('✅",      # Success (non-critical)
    r"console\.log\('👤",      # User/customer
    r"console\.log\('🧹",      # Cleanup
    r"console\.log\('🔙",      # Back navigation
    r"console\.log\('🏁",      # Finish
    r"console\.log\('✏️",      # Edit mode
    r"console\.log\('🔒",      # Restricted mode
    r"console\.log\('🌐",      # Online
    r"console\.log\('📴",      # Offline
    r"console\.log\('📡",      # RPC
    r"console\.log\('📋",      # Navigation target
    r"console\.log\('🎖️",      # Soldier discount
    r"console\.log\('🛡️",      # Final decision
    r"console\.log\('Data fetched",
    r"console\.log\('index\.jsx",
]

def should_remove_line(line):
    """Check if a line should be removed."""
    # Don't remove if it matches a keep pattern
    for pattern in KEEP_PATTERNS:
        if re.search(pattern, line):
            return False
    
    # Remove if it matches a remove pattern
    for pattern in REMOVE_PATTERNS:
        if re.search(pattern, line):
            return True
    
    return False

def clean_file(filepath):
    """Clean console logs from a file."""
    if not os.path.exists(filepath):
        print(f"  ⚠️ File not found: {filepath}")
        return 0, 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    original_count = len([l for l in lines if 'console.log' in l])
    cleaned_lines = []
    removed_count = 0
    
    for line in lines:
        if should_remove_line(line):
            removed_count += 1
            # Comment out instead of delete (safer)
            cleaned_lines.append(f"    // [CLEANED] {line.strip()}\n")
        else:
            cleaned_lines.append(line)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(cleaned_lines)
    
    return original_count, removed_count

def main():
    base_path = Path(__file__).parent
    
    print("=" * 60)
    print("🧹 CONSOLE LOG CLEANUP REPORT")
    print("=" * 60)
    
    total_original = 0
    total_removed = 0
    
    for relative_path in TARGET_FILES:
        filepath = base_path / relative_path
        print(f"\n📄 Processing: {relative_path}")
        
        original, removed = clean_file(filepath)
        total_original += original
        total_removed += removed
        
        if removed > 0:
            print(f"   ✅ Removed {removed}/{original} console.log statements")
        else:
            print(f"   ⏭️ No logs removed (0/{original})")
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"Total console.logs found: {total_original}")
    print(f"Total removed: {total_removed}")
    print(f"Remaining: {total_original - total_removed}")
    
    # Score calculation
    if total_original > 0:
        cleanup_ratio = (total_removed / total_original) * 100
        score = min(100, 50 + cleanup_ratio // 2)  # Base 50 + up to 50 for cleanup
    else:
        score = 100
    
    print(f"\n🎯 CODE CLEANLINESS SCORE: {score}/100")
    print("=" * 60)

if __name__ == "__main__":
    main()
