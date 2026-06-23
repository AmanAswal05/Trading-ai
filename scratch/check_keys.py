import pandas as pd
import json

with open("lib/mock-predictions-db.json") as f:
    data = json.load(f)

df = pd.DataFrame(data)
print("Columns in mock-predictions-db.json:")
print(list(df.columns))
print("First row keys:")
print(data[0].keys())
