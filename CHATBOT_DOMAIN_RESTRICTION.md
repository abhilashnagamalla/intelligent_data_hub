# Chatbot Domain Restriction Enhancement

## Overview
The Intelligent Data Hub chatbot has been enhanced to respond **ONLY to platform-related dataset queries**. Non-platform queries are now gracefully rejected with helpful guidance.

## Allowed Query Categories

### A. General Platform Questions
Questions about the platform itself:
- "What is Intelligent Data Hub?"
- "What kind of data is available?"
- "How can I use this platform?"
- "Is the data real-time or static?"
- "Where is this data coming from?"
- "Is this platform free to use?"
- "How reliable is the data?"

### B. Dataset Discovery Questions
Queries to find and explore datasets:
- "Show datasets related to agriculture"
- "What datasets are available in healthcare?"
- "Give me population data for India"
- "What are the latest datasets uploaded?"
- "Filter datasets by state or year"
- "Show datasets with highest usage/downloads"

### C. Data Understanding Questions
Questions to understand dataset structure and content:
- "What does this dataset represent?"
- "Explain this dataset in simple terms"
- "What are the columns in this dataset?"
- "What does this field/attribute mean?"
- "What is the source of this dataset?"
- "When was this data last updated?"

### D. Data Analysis Questions
Queries to analyze and extract insights:
- "What trends can you find in this dataset?"
- "Show summary of this dataset"
- "What is the average/maximum/minimum value?"
- "Compare data between two years"
- "Show top 5 states based on this data"
- "Identify any patterns or anomalies"

### E. Sector-Specific Handling
Queries about specific data sectors:

**Agriculture:**
- "Crop production in last 5 years"
- "Which state has highest yield?"
- "Rainfall vs crop output relation"

**Healthcare:**
- "Disease statistics in India"
- "Vaccination data trends"
- "Hospital availability by region"

**Transport:**
- "Traffic density data"
- "Road accidents statistics"
- "Public transport usage trends"

**Finance:**
- "Government expenditure data"
- "GDP trends"
- "Inflation rates"

**Education:**
- "Literacy rate by state"
- "School enrollment statistics"
- "Dropout rates"

**Census & Surveys:**
- "Population growth trends"
- "Urban vs rural population"
- "Household data insights"

### F. Interaction/Action-Based Questions
Queries for data manipulation and export:
- "Download this dataset"
- "Visualize this data"
- "Show charts/graphs"
- "Export data as CSV"
- "Save this dataset"
- "Recommend similar datasets"

### G. Smart Chatbot Capability Questions
Queries leveraging chatbot intelligence:
- "Suggest datasets based on my interest"
- "Explain insights from this dataset"
- "What conclusions can be drawn?"
- "Which dataset is best for analysis on X topic?"
- "Can you simplify this data for beginners?"

### H. Error/Edge Case Questions
Queries about platform issues:
- "I can't find a dataset"
- "This data looks incorrect"
- "Why is data missing?"
- "Dataset not loading"
- "API not working"

## Implementation Details

### Core Functions

#### `is_platform_query(query: str, sector: str | None = None) -> bool`
Determines if a query is platform/dataset related.
- Returns `True` if query matches allowed categories
- Returns `False` for non-platform queries

#### `classify_query_category(query: str) -> str | None`
Classifies queries into specific categories for better handling.
- **Returns:** Category name or `None` if unclassified
- **Categories:** general_platform, dataset_discovery, data_understanding, data_analysis, action_based, smart_capability, error_handling, sector_specific, data_related

#### `domain_restricted_response(session_id: str, query: str) -> dict[str, Any]`
Returns a helpful rejection message for non-platform queries.
- Sets `"restricted": True` in response
- Provides guidance on allowed query types
- Maintains session history

### Query Validation Logic

The chatbot now includes domain validation with multiple criteria:

```python
Query is allowed IF:
  - dataset_id is provided (user is asking about specific dataset), OR
  - sector is provided (user specifies a sector), OR
  - query matches ANY of the following:
    * Platform keywords (what is IDH, how to use, etc.)
    * Dataset discovery keywords (show, find, search datasets)
    * Data understanding keywords (explain, columns, schema)
    * Data analysis keywords (trends, patterns, insights)
    * Action keywords (download, visualize, export)
    * Capability keywords (suggest, recommend, simplify)
    * Error keywords (broken, not loading)
    * Sector mentions (agriculture, healthcare, etc.)
    * State mentions (Maharashtra, Karnataka, etc.)
    * Generic data terms (data, dataset, table, column)
```

### Query Rejection

When a query is rejected, users receive:
1. A clear message: "I can only help with questions about the Intelligent Data Hub platform..."
2. A bulleted list of what the chatbot CAN help with
3. An invitation to ask another question

Example response:
```
I can only help with questions about the Intelligent Data Hub platform and its datasets. 
I can assist with:
• Discovering datasets (by sector, state, or topic)
• Understanding dataset structure and content
• Analyzing data trends and patterns
• Downloading or visualizing datasets
• Platform features and availability

Please ask me about datasets or the platform, and I'll be happy to help!
```

## Keyword Reference

### Platform Keywords
- intelligent data hub, platform, idh, kind of data, available data, real-time, static, free, reliable, data quality

### Discovery Keywords
- show, find, search, list datasets, filter, latest, highest usage, popular, by state, by year

### Understanding Keywords
- what does, explain, columns, fields, attributes, source, updated, schema, preview, sample

### Analysis Keywords
- trends, summary, average, maximum, minimum, compare, patterns, anomalies, insights, statistics

### Action Keywords
- download, export, visualize, chart, graph, save, recommend

### Capability Keywords
- suggest, recommendation, conclusions, best dataset, simplify, beginner

### Error Keywords
- can't find, incorrect, wrong, missing, not loading, api error, broken

## Testing

### Test Cases

1. **Allowed Query - Platform Question**
   ```
   Query: "What is Intelligent Data Hub?"
   Expected: Allowed (general platform question)
   ```

2. **Allowed Query - Dataset Discovery**
   ```
   Query: "Show me agriculture datasets"
   Expected: Allowed (sector + discovery keyword)
   ```

3. **Allowed Query - Data Analysis**
   ```
   Query: "What trends do you see in this data?"
   Expected: Allowed (data analysis keyword)
   ```

4. **Allowed Query - Sector Specific**
   ```
   Query: "Healthcare data in Maharashtra"
   Expected: Allowed (sector + state mention)
   ```

5. **Rejected Query - General Knowledge**
   ```
   Query: "What is the capital of India?"
   Expected: REJECTED (general knowledge, not dataset-related)
   ```

6. **Rejected Query - Off-Topic**
   ```
   Query: "Tell me a joke"
   Expected: REJECTED (entertainment, not platform-related)
   ```

7. **Rejected Query - Personal Advice**
   ```
   Query: "How do I lose weight?"
   Expected: REJECTED (personal advice, not data-related)
   ```

## Chatbot Rules

### Strictly Domain-Restricted
- ✅ Only respond to platform and dataset queries
- ❌ No generic or unrelated answers
- ❌ No general knowledge questions (unless data-related)
- ❌ No personal advice or entertainment queries

### Response Quality
- Provide clear, concise, data-driven responses
- Use structured responses (lists, summaries, tables)
- Maintain professional tone
- Ensure consistency across sectors

### User Experience
- When rejected: Provide helpful guidance on what's allowed
- When matched: Show relevant datasets or insights
- Maintain session context for follow-up questions
- Handle edge cases gracefully

## Configuration

The domain restriction system is configured through:

1. **Keyword Sets** (in rag_chatbot_service.py):
   - `GENERAL_PLATFORM_KEYWORDS`
   - `DATASET_DISCOVERY_KEYWORDS`
   - `DATA_UNDERSTANDING_KEYWORDS`
   - `DATA_ANALYSIS_KEYWORDS`
   - `ACTION_KEYWORDS`
   - `CAPABILITY_KEYWORDS`
   - `ERROR_KEYWORDS`

2. **Classification Function**:
   - `classify_query_category()` - categorizes queries
   - `is_platform_query()` - validates if query is allowed

3. **Response Function**:
   - `domain_restricted_response()` - returns rejection with guidance

## Future Enhancements

Potential improvements:
1. Machine learning-based query classification
2. User feedback loop to improve keyword detection
3. Contextual learning from user sessions
4. Smart suggestions when query is rejected
5. Query correction/rephrasing suggestions
6. A/B testing of rejection messages

## Maintenance

To add new allowed query patterns:

1. **Add keywords to appropriate set**:
   ```python
   DATA_ANALYSIS_KEYWORDS.add("new_keyword")
   ```

2. **Update `ALL_VALID_KEYWORDS` union** (done automatically if you add to existing sets)

3. **Test with sample queries** to ensure coverage

4. **Document the addition** in this file

## Integration Points

The domain restriction is integrated at:
- **Entry point**: `chatbot_response()` function
- **Validation**: Early in the response pipeline
- **Response**: Uses `domain_restricted_response()` for rejections
- **Session tracking**: Maintains session history even for rejected queries

## API Response Structure

### Allowed Query Response
```json
{
  "sessionId": "uuid",
  "restricted": false,
  "content": "Detailed response...",
  "matches": [...],
  "insights": [...],
  "result": {...}
}
```

### Rejected Query Response
```json
{
  "sessionId": "uuid",
  "restricted": true,
  "content": "I can only help with questions about the Intelligent Data Hub platform...",
  "matches": [],
  "insights": ["This query is outside the scope of the Intelligent Data Hub platform assistant."],
  "result": null
}
```

## References

- **Backend Service**: `backend/app/services/rag_chatbot_service.py`
- **API Router**: `backend/app/routers/chatbot.py`
- **Dataset Chatbot**: `backend/app/services/dataset_chatbot_service.py`
- **Catalog Service**: `backend/app/services/dataset_catalog.py`
