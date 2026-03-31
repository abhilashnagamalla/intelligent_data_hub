import os, re
p = 'datasets/finance_datasets'
files = [f for f in os.listdir(p) if f.endswith('.csv')]
clean = [re.sub(r'_[0-9a-f]{8}\.csv$', '.csv', f) for f in files]
unique = sorted(set(clean))
prefixes = sorted({m.group(1) for f in files if (m := re.match(r'^(\d{3})_', f))})
print('total csv', len(files))
print('unique base', len(unique))
print('unique prefixes', len(prefixes))
print('sample prefixes', prefixes[:20])
print('sample base names', unique[:20])
