with open('scripts/test_api.ts', 'r') as f:
    lines = f.read().split('\n')
# insert above line 13
lines.insert(12, '// eslint-disable-next-line @typescript-eslint/no-unused-vars')
with open('scripts/test_api.ts', 'w') as f:
    f.write('\n'.join(lines))
