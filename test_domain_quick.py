import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

from app.services.rag_chatbot_service import is_platform_query

# Test generic greetings rejection
test_cases = [
    ("hi", False, "pure greeting"),
    ("hello", False, "pure greeting"),
    ("what is intelligent data hub", True, "platform question"),
    ("show me agriculture datasets", True, "dataset discovery"),
    ("hi, show me agriculture datasets", True, "greeting with context"),
    ("what is the weather", False, "non-platform"),
    ("tell me a joke", False, "non-platform"),
]

print("\n" + "="*60)
print("CHATBOT DOMAIN RESTRICTION TESTS")
print("="*60 + "\n")

passed = 0
failed = 0

for query, expected, description in test_cases:
    result = is_platform_query(query)
    status = "OK" if result == expected else "FAIL"
    if result == expected:
        passed += 1
    else:
        failed += 1
    print(f"[{status}] {description:25} | Query: '{query}' | Expected: {expected}, Got: {result}")

print("\n" + "="*60)
print(f"RESULTS: {passed} passed, {failed} failed")
print("="*60 + "\n")

sys.exit(0 if failed == 0 else 1)
