import os
import re

files_to_process = [
    '/Users/nikhilraj/6th Semester/Projects/featurevault/featurevault/apps/web/src/app/page.tsx',
    '/Users/nikhilraj/6th Semester/Projects/featurevault/featurevault/apps/web/src/app/docs/page.tsx',
]

replacements = {
    "'#0a0a0a'": "'var(--color-surface-0)'",
    "'#111'": "'var(--color-surface-1)'",
    "'#111111'": "'var(--color-surface-1)'",
    "'#0f0f0f'": "'var(--color-surface-2)'",
    "'#0d0d0d'": "'var(--color-surface-2)'",
    "'#1a1a1a'": "'var(--color-surface-3)'",
    "'#242424'": "'var(--color-surface-3)'",
    
    "'rgba(10,10,10,0.85)'": "'var(--color-nav-bg)'",
    "'rgba(10,10,10,0.9)'": "'var(--color-nav-bg)'",
    
    "'#f0f0f0'": "'var(--color-text-1)'",
    "'#fff'": "'var(--color-text-1)'",
    
    "'#a0a0a0'": "'var(--color-text-2)'",
    
    "'#707070'": "'var(--color-text-3)'",
    "'#606060'": "'var(--color-text-3)'",
    
    "'#404040'": "'var(--color-text-4)'",
    "'#505050'": "'var(--color-text-4)'",
    "'#303030'": "'var(--color-text-4)'",
    
    "'rgba(255,255,255,0.08)'": "'var(--color-border)'",
    "'rgba(255,255,255,0.07)'": "'var(--color-border)'",
    "'rgba(255,255,255,0.06)'": "'var(--color-border)'",
    "'rgba(255,255,255,0.05)'": "'var(--color-border)'",
    "'rgba(255,255,255,0.04)'": "'var(--color-border)'",
    "'rgba(255,255,255,0.03)'": "'var(--color-border)'",
    
    "'rgba(255,255,255,0.1)'": "'var(--color-border-md)'",
    "'rgba(255,255,255,0.12)'": "'var(--color-border-md)'",
}

for file_path in files_to_process:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for search, replace in replacements.items():
        content = content.replace(search, replace)
        
    # Also handle some edge cases for unquoted #111
    content = content.replace("background: '#111'", "background: 'var(--color-surface-1)'")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done replacing colors!")
