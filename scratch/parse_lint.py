import json
from pathlib import Path

path = Path("scratch/lint_results.json")
if path.exists():
    with open(path) as f:
        data = json.load(f)
    
    error_count = 0
    for file_data in data:
        file_path = file_data["filePath"]
        errors = [m for m in file_data["messages"] if m.get("severity") == 2 or "Error:" in m.get("message", "")]
        if errors:
            print(f"\nFile: {file_path}")
            for err in errors:
                error_count += 1
                print(f"  Line {err.get('line')}:{err.get('column')} - {err.get('message')} ({err.get('ruleId')})")
    print(f"\nTotal errors found: {error_count}")
else:
    print("lint_results.json not found")
