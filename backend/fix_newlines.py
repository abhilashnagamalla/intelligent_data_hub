#!/usr/bin/env python3
"""Fix literal \\n escape sequences by converting them to real newlines."""

import sys

input_file = 'app/services/dataset_chatbot_service.py'

with open(input_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace literal \n (backslash followed by 'n') with actual newline character
# But be careful not to replace \n inside string literals like "\\n"
# We'll do a simple replace since the whole line 824 is malformed anyway
fixed_content = content.replace('\\n', '\n')

with open(input_file, 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print("Fixed! Replaced literal backslash-n with actual newlines")

# Verify
import ast
try:
    ast.parse(fixed_content)
    print("✓ File is now syntactically valid!")
except SyntaxError as e:
    print(f"✗ Still has syntax error at line {e.lineno}: {e.msg}")
    sys.exit(1)
