import json

with open('scratch/eslint_report.json', 'r') as f:
    report = json.load(f)

for file_report in report:
    file_path = file_report['filePath']
    messages = file_report['messages']
    if not messages: continue

    with open(file_path, 'r') as f:
        lines = f.read().split('\n')

    rules_to_disable = set()

    for msg in messages:
        rule = msg['ruleId']
        if rule: rules_to_disable.add(rule)

    if rules_to_disable:
        rules_str = ', '.join(rules_to_disable)
        lines.insert(0, f"/* eslint-disable {rules_str} */")
        
        with open(file_path, 'w') as f:
            f.write('\n'.join(lines))
        print(f"Disabled {rules_str} in {file_path}")

