import os

files = [
    '/Users/nikhilraj/6th Semester/Projects/featurevault/featurevault/apps/web/src/app/page.tsx',
    '/Users/nikhilraj/6th Semester/Projects/featurevault/featurevault/apps/web/src/app/docs/page.tsx',
    '/Users/nikhilraj/6th Semester/Projects/featurevault/featurevault/README.md'
]

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    content = content.replace("github.com/yourusername/featurevault", "github.com/nikhiilraj/FeatureVault")
    with open(f, 'w') as file:
        file.write(content)
print("Done URLs")
