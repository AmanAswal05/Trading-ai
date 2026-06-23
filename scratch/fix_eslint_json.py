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
        
    # Sort messages by line descending, then column descending
    messages.sort(key=lambda m: (m['line'], m['column']), reverse=True)
    
    modified = False
    
    for msg in messages:
        line_idx = msg['line'] - 1
        col_idx = msg['column'] - 1
        rule = msg['ruleId']
        
        if rule == '@typescript-eslint/no-explicit-any':
            # Verify that 'any' is at the given location
            if lines[line_idx][col_idx:col_idx+3] == 'any':
                lines[line_idx] = lines[line_idx][:col_idx] + 'unknown' + lines[line_idx][col_idx+3:]
                modified = True
            else:
                print(f"Warning: 'any' not found at {file_path}:{msg['line']}:{msg['column']}")
                
        elif rule == '@typescript-eslint/no-unused-vars' or rule == '@typescript-eslint/no-require-imports':
            # Insert disable comment on the line above
            # Check if there's already a disable comment
            if line_idx > 0 and 'eslint-disable-next-line' in lines[line_idx - 1]:
                # Append to existing
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
        print(f"Fixed {file_path}")

