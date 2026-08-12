import re

with open("src/App.tsx", "r") as f:
    content = f.read()

content = re.sub(r"\s*color: '#64748b',?", "", content)

with open("src/App.tsx", "w") as f:
    f.write(content)
print("Done")
