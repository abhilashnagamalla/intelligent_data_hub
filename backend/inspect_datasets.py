import os

p = 'datasets/finance_datasets'
files = os.listdir(p)
print('total', len(files))
print(files[:20])
