import json

with open("lib/mock-predictions-db.json") as f:
    data = json.load(f)

# Find a row where 'metrics' is present and not empty
for i, row in enumerate(data):
    if "metrics" in row and row["metrics"]:
        print(f"Row {i} metrics (type: {type(row['metrics'])}):")
        print(json.dumps(row["metrics"], indent=2))
        break
