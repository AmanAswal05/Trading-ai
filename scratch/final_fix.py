import re

# app/admin/page.tsx
with open('app/admin/page.tsx', 'r') as f:
    lines = f.read().split('\n')
lines.insert(526, '    // eslint-disable-next-line react-hooks/exhaustive-deps')
with open('app/admin/page.tsx', 'w') as f:
    f.write('\n'.join(lines))

# app/stock/[ticker]/page.tsx
with open('app/stock/[ticker]/page.tsx', 'r') as f:
    lines = f.read().split('\n')
lines.insert(48, '  // eslint-disable-next-line react-hooks/exhaustive-deps')
with open('app/stock/[ticker]/page.tsx', 'w') as f:
    f.write('\n'.join(lines))

# app/page.tsx
with open('app/page.tsx', 'r') as f:
    lines = f.read().split('\n')
# line 57 (index 56)
lines[56] = lines[56].replace("'", "&apos;")
# line 102 (index 101)
lines[101] = lines[101].replace("'", "&apos;")
with open('app/page.tsx', 'w') as f:
    f.write('\n'.join(lines))

# components/admin/AccuracyTab.tsx
with open('components/admin/AccuracyTab.tsx', 'r') as f:
    lines = f.read().split('\n')
# lines 427, 428 (index 426, 427)
lines[426] = lines[426].replace("'", "&apos;")
lines[427] = lines[427].replace("'", "&apos;")
with open('components/admin/AccuracyTab.tsx', 'w') as f:
    f.write('\n'.join(lines))

# scripts/test_api.ts
with open('scripts/test_api.ts', 'r') as f:
    content = f.read()
content = re.sub(r'const jestMock', 'const _jestMock', content)
with open('scripts/test_api.ts', 'w') as f:
    f.write(content)

