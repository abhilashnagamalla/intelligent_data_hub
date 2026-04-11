#!/usr/bin/env python3
"""Find the exact location of the unclosed triple-quote."""

import re

with open('app/services/dataset_chatbot_service.py', 'r') as f:
    content = f.read()

matches = list(re.finditer(r'"""', content))
print(f'Total triple-quote occurrences: {len(matches)}')

if len(matches) % 2 == 1:
    # Get the last (unclosed) one
    last_match = matches[-1]
    pos = last_match.start()
    
    # Get line number
    line_num = content[:pos].count('\n') + 1
    print(f'\nODD count! Last unclosed """ is at position {pos}, line {line_num}')
    
    # Print context
    start = max(0, pos - 300)
    end = min(len(content), pos + 300)
    print(f'\nContext (300 chars before and after):')
    print('---')
    print(content[start:end])
    print('---')
else:
    print('All triple-quotes are balanced!')
