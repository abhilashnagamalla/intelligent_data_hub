# Chatbot Domain Restriction - Implementation Guide

## Quick Summary

The chatbot has been enhanced with **strict domain restriction** to respond ONLY to platform-related dataset queries. All non-platform queries are gracefully rejected with a helpful message.

## Changes Made

### 1. Core Implementation (rag_chatbot_service.py)

#### Added Query Classification System
- **8 keyword categories** covering all allowed query types
- **Query classification function** to categorize incoming queries
- **Platform validation function** to determine query eligibility
- **Domain restriction response function** for rejections

#### Key Functions Added

```python
is_platform_query(query: str, sector: str | None = None) -> bool
```
- **Purpose**: Validates if a query is platform/dataset related
- **Usage**: Called in chatbot_response() to gate query processing
- **Returns**: True if allowed, False if should be rejected

```python
classify_query_category(query: str) -> str | None
```
- **Purpose**: Categorizes queries for better handling
- **Returns**: Category name or None
- **Categories**: 
  - general_platform
  - dataset_discovery
  - data_understanding
  - data_analysis
  - action_based
  - smart_capability
  - error_handling
  - sector_specific
  - data_related

```python
domain_restricted_response(session_id: str, query: str) -> dict[str, Any]
```
- **Purpose**: Returns helpful rejection message
- **Sets**: `restricted: True` in response
- **Maintains**: Session history for user context

#### Integration Point

In `chatbot_response()` function (line ~1360):
```python
# Domain restriction check
if not (dataset_id or sector or is_platform_query(normalized_query, sector=sector)):
    return domain_restricted_response(active_session_id, normalized_query)
```

### 2. Documentation

- **CHATBOT_DOMAIN_RESTRICTION.md**: Comprehensive feature documentation
  - All allowed query categories with examples
  - Implementation details
  - Configuration guide
  - Future enhancements

### 3. Testing

- **test_chatbot_domain_restriction.py**: Comprehensive test suite
  - Tests for each category (A-H)
  - Tests for state/sector mentions
  - Tests for rejected queries
  - Response structure validation

## Keyword Categories

### Category A: General Platform Keywords (12 keywords)
```python
GENERAL_PLATFORM_KEYWORDS = {
    "intelligent data hub", "platform", "idh",
    "kind of data", "what data", "available data",
    "how to use", "use platform", "real-time", "static",
    "data coming from", "where data from", "free",
    "cost", "reliable", "reliability", "data quality",
}
```

### Category B: Dataset Discovery Keywords (14 keywords)
```python
DATASET_DISCOVERY_KEYWORDS = {
    "show datasets", "find datasets", "search datasets",
    "list datasets", "dataset available", "related to",
    "datasets in", "latest datasets", "filter datasets",
    "highest usage", "most downloaded", "popular datasets",
    "by state", "by year",
}
```

### Category C: Data Understanding Keywords (12 keywords)
```python
DATA_UNDERSTANDING_KEYWORDS = {
    "what does", "represent", "explain dataset",
    "simple terms", "columns", "fields", "attributes",
    "field mean", "source", "last updated",
    "updated when", "data updated", "schema",
    "structure", "preview", "sample",
}
```

### Category D: Data Analysis Keywords (24 keywords)
```python
DATA_ANALYSIS_KEYWORDS = {
    "trends", "trend", "summary", "summarize",
    "average", "maximum", "minimum", "max", "min",
    "compare", "comparison", "top states", "highest",
    "lowest", "pattern", "anomalies", "anomaly",
    "analyze", "analysis", "insights", "insight",
    "statistics", "stats",
}
```

### Category F: Action Keywords (12 keywords)
```python
ACTION_KEYWORDS = {
    "download", "export", "csv", "visualize",
    "visualisation", "visualization", "chart",
    "graph", "charts", "graphs", "save dataset",
    "recommend", "similar datasets",
}
```

### Category G: Capability Keywords (7 keywords)
```python
CAPABILITY_KEYWORDS = {
    "suggest datasets", "recommendation",
    "explain insights", "conclusions",
    "best dataset for", "simplify", "beginner", "easy",
}
```

### Category H: Error Keywords (8 keywords)
```python
ERROR_KEYWORDS = {
    "can't find", "cannot find", "not found",
    "incorrect", "wrong", "missing data",
    "not loading", "api not", "api error",
    "error", "broken",
}
```

## How It Works

### Query Processing Flow

```
User Query
    ↓
Normalize Query
    ↓
Check: dataset_id provided?
    → YES: Allow
    → NO: Continue
    ↓
Check: sector provided?
    → YES: Allow
    → NO: Continue
    ↓
Check: is_platform_query()?
    → YES: Allow & Process
    → NO: Reject with helpful message
```

### Decision Logic

A query is ALLOWED if ANY of these are true:
1. User provided explicit `dataset_id`
2. User provided explicit `sector` parameter
3. Query contains platform-related keywords
4. Query mentions sectors (agriculture, healthcare, etc.)
5. Query mentions states (Maharashtra, Kerala, etc.)
6. Query contains generic data terms (dataset, table, column, etc.)

Otherwise, query is REJECTED.

## Testing the Feature

### Run Full Test Suite
```bash
cd d:\MPS\intelligent_data_hub
python test_chatbot_domain_restriction.py
```

### Test Specific Categories
```python
from app.services.rag_chatbot_service import is_platform_query

# Should allow
assert is_platform_query("Show datasets related to agriculture") == True

# Should reject
assert is_platform_query("Tell me a joke") == False

# With explicit sector
assert is_platform_query("tell me", sector="health") == True
```

### Manual Testing

1. **Allowed Query**:
   - Input: "What trends are in the agriculture data?"
   - Expected: Dataset analysis results

2. **Rejected Query**:
   - Input: "What's the weather today?"
   - Expected: Domain restriction message

## Configuration & Maintenance

### Adding New Keywords

1. **Identify the category** (A-H)
2. **Add to the appropriate set**:
   ```python
   DATA_ANALYSIS_KEYWORDS.add("new_keyword")
   ```
3. **Test with sample queries**
4. **Update documentation** (CHATBOT_DOMAIN_RESTRICTION.md)

### Removing Keywords

1. **Locate the keyword** in rag_chatbot_service.py
2. **Remove from the set**:
   ```python
   GENERAL_PLATFORM_KEYWORDS.discard("platform")
   ```
3. **Test to ensure no false rejections**
4. **Update documentation**

### Modifying Rejection Message

Edit `get_restriction_message()` function:
```python
def get_restriction_message() -> str:
    return (
        "I can only help with questions about the Intelligent Data Hub platform and its datasets. "
        # ... customize message here ...
    )
```

## API Response Examples

### Allowed Query Response
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "restricted": false,
  "content": "I found 5 relevant datasets for 'agriculture'...",
  "matches": [
    {
      "id": "123",
      "title": "Agricultural Production",
      "sector": "agriculture",
      "description": "..."
    }
  ],
  "insights": ["Matched keywords: agriculture, production.", "..."],
  "result": null
}
```

### Rejected Query Response
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "restricted": true,
  "content": "I can only help with questions about the Intelligent Data Hub platform...",
  "matches": [],
  "insights": ["This query is outside the scope of the Intelligent Data Hub platform assistant."],
  "result": null
}
```

## Debugging

### Enable Query Classification Logging

Add to chatbot_response():
```python
category = classify_query_category(normalized_query)
print(f"Query: '{normalized_query}' → Category: {category}")
```

### Check Keyword Matching

```python
from app.services.rag_chatbot_service import ALL_VALID_KEYWORDS

query = "show agriculture data"
matched = [kw for kw in ALL_VALID_KEYWORDS if kw in query.lower()]
print(f"Matched keywords: {matched}")
```

### Test is_platform_query()

```python
from app.services.rag_chatbot_service import is_platform_query

queries = [
    "Show agriculture data",
    "What's the weather?",
    "Explain this dataset",
]

for q in queries:
    print(f"{q}: {is_platform_query(q)}")
```

## Performance Considerations

- **Query normalization**: O(n) where n = query length
- **Keyword matching**: O(m) where m = number of keywords
- **Overall complexity**: O(1) amortized - fast keyword lookups
- **No API calls**: Pure Python string operations
- **Session tracking**: Minimal overhead

## Future Enhancements

1. **Machine Learning Classification**
   - Train model on query examples
   - More nuanced category detection
   - Context-aware decisions

2. **Similarity Matching**
   - Use embeddings for semantic matching
   - Detect similar queries to known categories

3. **User Feedback Loop**
   - Collect false positives/negatives
   - Continuous keyword improvement
   - A/B test rejection messages

4. **Contextual Understanding**
   - Consider session history
   - Learn user intent patterns
   - Personalized responses

5. **Query Correction**
   - Suggest rephrased versions
   - Offer dataset recommendations based on intent
   - Help users craft better queries

## Troubleshooting

### Issue: Valid query is being rejected

**Solution**: 
1. Identify missing keyword
2. Add to appropriate category set
3. Test and verify

### Issue: Invalid query is being allowed

**Solution**:
1. Check keyword sets for overly broad terms
2. Remove or refine the keyword
3. Add negative test case

### Issue: Session history lost

**Solution**:
- Ensure `domain_restricted_response()` is called (lines preserve history)
- Check `_session_history` dictionary is maintained
- Verify session_id is passed correctly

## References

- **Main Service**: `backend/app/services/rag_chatbot_service.py`
- **Test File**: `test_chatbot_domain_restriction.py`
- **Documentation**: `CHATBOT_DOMAIN_RESTRICTION.md`
- **API Router**: `backend/app/routers/chatbot.py`
- **Frontend Component**: `frontend/src/components/Chatbot.jsx`

## Support

For questions or issues with the domain restriction feature:

1. Check `CHATBOT_DOMAIN_RESTRICTION.md` for detailed feature documentation
2. Review `test_chatbot_domain_restriction.py` for usage examples
3. Check logs for query classification details
4. Review keyword sets in `rag_chatbot_service.py`

---

**Version**: 1.0  
**Last Updated**: 2026-04-10  
**Status**: Production Ready
