#!/usr/bin/env python3
"""Show all triple-quote positions and their pairing."""

import re

with open('app/services/dataset_chatbot_service.py', 'r') as f:
    content = f.read()

matches = list(re.finditer(r'"""', content))
print(f'Total """ occurrences: {len(matches)}\n')

for i, match in enumerate(matches, 1):
    pos = match.start()
    line_num = content[:pos].count('\n') + 1
    
    # Get surrounding text
    start = max(0, pos - 80)
    end = min(len(content), pos + 80)
    snippet = content[start:end].replace('\n', '\\n')
    
    pair_status = "OPENS" if i % 2 == 1 else "CLOSES"
    pair_with = i + 1 if i % 2 == 1 else i - 1
    
    print(f'{i:2d}. Line {line_num:4d} pos {pos:6d} [{pair_status:7s} #{pair_with}] ..{snippet[:80]}...')
    
    if i == len(matches):
        print(f'\n^^^ LAST ONE: {pair_status} but no matching pair!' if len(matches) % 2 == 1 else '')
