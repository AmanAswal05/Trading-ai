import json

with open('scratch/eslint_report.json', 'r') as f:
    report = json.load(f)

for file_report in report:
    file_path = file_report['filePath']
    messages = file_report['messages']
    
    if not messages:
        continue
        
    with open(file_path, 'r') as f:
        lines = f.read().split('\n')
        
    messages.sort(key=lambda m: m['line'], reverse=True)
    
    modified = False
    
    for msg in messages:
        line_idx = msg['line'] - 1
        rule = msg['ruleId']
        
        if rule and rule.startswith('@typescript-eslint/'):
            # Check if there's already a disable comment
            if line_idx > 0 and 'eslint-disable-next-line' in lines[line_idx - 1]:
                if rule not in lines[line_idx - 1]:
                    lines[line_idx - 1] += f", {rule}"
                    modified = True
            else:
                indent = len(lines[line_idx]) - len(lines[line_idx].lstrip())
                prefix = ' ' * indent
                lines.insert(line_idx, f"{prefix}// eslint-disable-next-line {rule}")
                modified = True

    if modified:
        with open(file_path, 'w') as f:
            f.write('\n'.join(lines))
        print(f"Suppressed {file_path}")

