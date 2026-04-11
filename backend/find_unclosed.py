#!/usr/bin/env python3
"""Find unclosed triple-quoted strings."""

with open('app/services/dataset_chatbot_service.py', 'r') as f:
    lines = f.readlines()

# Count triple quotes to find imbalance
balance = 0
last_open_line = None

for i, line in enumerate(lines, 1):
    count = line.count('"""')
    if count > 0:
        balance += count
        if balance % 2 == 1:  
            last_open_line = i
            print(f'Line {i}: OPENED (balance now odd at {balance})')
            print(f'  {line.strip()[:120]}')
        else:
            print(f'Line {i}: closed (balance now even at {balance})')
            print(f'  {line.strip()[:120]}')

if balance % 2 == 1:
    print(f'\n❌ ERROR: String opened at line {last_open_line} is never closed!')
else:
    print(f'\n✓ All triple-quotes are balanced')
