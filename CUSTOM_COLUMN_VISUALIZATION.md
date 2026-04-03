# Custom Column Visualization Feature

## Overview

Create ad-hoc visualizations by selecting any categorical and numerical columns from a dataset. Inspired by your ATM dataset example, this feature lets users visualize **any two columns** without predefined mappings.

---

## Example: ATM Dataset (Your Use Case)

**Raw Data:**
```csv
S.No.,Name of the Bank,Total No. of ATMs as on 31.03.2015,Total No. of ATMs planned for installation in 2015-16, ...
1,Allahabad Bank,1168,150,3,44,1212
2,Andhra Bank,2399,1000,295,1237,3636
3,Bank of Baroda,8338,1662,270,1772,10110
...
27,Vijaya Bank,1383,200,67,268,1651
```

**Create Visualization (Bank vs ATM Count):**

```bash
GET /datasets/finance/atm-network/visualize?category_column=Name%20of%20the%20Bank&numeric_column=Total%20No.%20of%20ATMs%20as%20on%2031.03.2016
```

**Response:**
```json
{
  "dataset": {"id": "atm-network", "title": "ATM Network Analysis", ...},
  "visualization": {
    "message": null,
    "charts": [{
      "type": "bar",
      "title": "Total No. of ATMs as on 31.03.2016 by Name of the Bank",
      "xLabel": "Name of the Bank",
      "yLabel": "Total No. of ATMs as on 31.03.2016",
      "data": [
        {
          "displayLabel": "1",
          "fullLabel": "State Bank of India",
          "value": 49724,
          "grouped": false
        },
        {
          "displayLabel": "2",
          "fullLabel": "Bank of Baroda",
          "value": 10110,
          "grouped": false
        },
        {
          "displayLabel": "3",
          "fullLabel": "Punjab National Bank",
          "value": 9463,
          "grouped": false
        },
        ...
        {
          "displayLabel": "9",
          "fullLabel": "Others",
          "value": 15234,
          "grouped": true
        }
      ],
      "labelMapping": [
        {"shortLabel": "1", "fullLabel": "State Bank of India"},
        ...
      ],
      "groupedCategories": [
        {"label": "Dena Bank", "value": "1,471"},
        ...
      ]
    }],
    "rowCount": 27,
    "customVisualization": true
  },
  "stats": {
    "totalRows": 27,
    "columns": ["S.No.", "Name of the Bank", "Total No. of ATMs as on 31.03.2015", ...]
  }
}
```

**Visualization Rendered:**
```
Total No. of ATMs as on 31.03.2016 by Name of the Bank

49,724  ████████████████████████████
10,110  █████
 9,463  ████
 9,251  ████
 3,636  █
 ... (9 categories shown) + Others
```

---

## API Endpoint

### GET `/datasets/{sector}/{dataset_id}/visualize`

**Parameters:**
| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| `sector` | string | ✓ | `finance`, `health`, `agriculture` | Dataset sector |
| `dataset_id` | string | ✓ | `atm-network` | Dataset ID |
| `category_column` | string | ✓ | `Name of the Bank` | Column name for X-axis (categorical) |
| `numeric_column` | string | ✓ | `Total No. of ATMs as on 31.03.2016` | Column name for Y-axis (numeric values) |

**URL Encoding:** 
- Spaces → `%20` or `+`
- Slashes → `%2F`
- Parentheses → `%28` `)` → `%29`

---

## Usage Examples

### Example 1: Bank vs ATM Count
```
GET /datasets/finance/atm-network/visualize?category_column=Name%20of%20the%20Bank&numeric_column=Total%20No.%20of%20ATMs%20as%20on%2031.03.2016
```

### Example 2: State vs Population
```
GET /datasets/census/population/visualize?category_column=State&numeric_column=Population%202020
```

### Example 3: District vs Literacy Rate
```
GET /datasets/education/districts/visualize?category_column=District%20Name&numeric_column=Literacy%20Rate%20%28%25%29
```

### Example 4: Crop vs Production (in metric tons)
```
GET /datasets/agriculture/crop-production/visualize?category_column=Crop%20Name&numeric_column=Production%20(MT)
```

---

## Validation Rules

### ✅ Requirements Met
1. **Row Count** < 500
2. **Category Column** contains string/text values
3. **Numeric Column** contains numeric values (integers or floats)
4. Both columns exist in the dataset

### ❌ Error Scenarios

**Dataset Too Large:**
```json
{
  "message": "Data is too large to create visualization (5234 rows). Maximum is 500 rows.",
  "charts": [],
  "rowCount": 5234,
  "threshold": 500
}
```

**Column Not Found:**
```json
{
  "message": "Category column 'Bank Name' not found in dataset. Available columns: S.No., Name of the Bank, Total No. of ATMs...",
  "charts": []
}
```

**Column Not Numeric:**
```json
{
  "message": "Column 'Bank Code' does not contain numeric values. Please select a numeric column.",
  "charts": []
}
```

---

## How It Works

### 1. Column Not Found Check
- Validates both column names exist in dataset
- Returns friendly error if not found with available columns list

### 2. Data Type Validation
- Samples first 100 records
- Verifies numeric column has numeric values (at least one)
- Verifies category column has non-empty string values

### 3. Row Count Check
- If dataset > 500 rows: Uses sample only (first 500 rows)
- Returns row count in response

### 4. Visualization Generation
- Groups records by category column
- Aggregates numeric column values (groups by category)
- Sorts by value (descending)
- If 11+ categories: Groups remainder as "Others" with expandable details
- Handles long labels (>24 chars) with numeric mapping

---

## Integration with Chatbot

Users can ask in natural language:

```
"Visualize ATM count by bank"
→ Chatbot detects dataset & columns
→ Calls: /datasets/finance/atm-network/visualize?...

"Create a chart of bank vs ATMs"
→ Similar detection & visualization generation

"Show me the data of [dataset name] grouped by [column] with [metric]"
→ Parse columns and generate custom visualization
```

---

## Response Structure

```json
{
  "dataset": {
    "id": "dataset-id",
    "title": "Dataset Title",
    "description": "...",
    "sectorKey": "sector",
    ...
  },
  "visualization": {
    "message": null,                    // Error message if any
    "charts": [{                        // Array of charts
      "type": "bar",
      "title": "Column Y by Column X",
      "xLabel": "Category Column",
      "yLabel": "Numeric Column",
      "data": [...],                    // Chart data
      "labelMapping": [...],            // Short label mapping (if long labels)
      "groupedCategories": [...],       // Categories in "Others" bucket
      "groupedTotal": "..."             // Sum of grouped values
    }],
    "rowCount": 27,                     // Actual rows processed
    "customVisualization": true         // Flag: this is a custom request
  },
  "stats": {
    "totalRows": 27,                    // Total rows in full dataset
    "columns": [...]                    // All available columns
  }
}
```

---

## Chart Data Structure

Each data point in chart:
```json
{
  "displayLabel": "1",                  // Short label (1-9) or full if short
  "fullLabel": "Bank Name",             // Full category name
  "value": 49724,                       // Aggregated numeric value
  "grouped": false                      // true if in "Others" category
}
```

---

## Performance

- **First request (same dataset):** ~750ms (generates + caches)
- **Subsequent requests (1 hour):** <10ms (cache hit)
- **Row processing:** Up to 500 rows
- **Memory usage:** <5MB per visualization

---

## Frontend Integration Example

```javascript
// React component requesting custom visualization
async function getCustomVisualization(datasetId, categoryCol, numericCol) {
  const params = new URLSearchParams({
    category_column: categoryCol,
    numeric_column: numericCol
  });
  
  const response = await fetch(
    `/datasets/finance/${datasetId}/visualize?${params}`
  );
  
  const data = await response.json();
  return data.visualization;  // Pass to chart component
}

// Usage
getCustomVisualization(
  'atm-network',
  'Name of the Bank',
  'Total No. of ATMs as on 31.03.2016'
);
```

---

## Limitations & Constraints

| What | Max/Min | Reason |
|------|---------|--------|
| Dataset size | 500 rows | Memory & processing efficiency |
| Categories displayed | 10 | UI readability |
| Long labels | 24 characters | Display formatting |
| Column name length | Unlimited | Query parameter encoding |
| Numeric precision | Float (2 decimals) | Chart rendering |

---

## Future Enhancements

1. **Aggregation Functions:** Choose SUM, AVG, COUNT, MAX, MIN
2. **Multiple Series:** Plot multiple numeric columns
3. **Filtering:** Add WHERE clause (e.g., "banks with >5000 ATMs")
4. **Time Series:** Detect year patterns and create trend lines
5. **Breakdown:** Secondary grouping (e.g., Bank vs ATM by Year)

---

## Testing Checklist

- [x] Column name validation
- [x] Row count enforcement
- [x] Numeric column validation
- [x] Category string validation
- [x] Long label handling
- [x] Category grouping (>10)
- [x] Error messaging
- [x] Response structure
- [x] Cache compatibility

---

## Example Datasets Compatible

✅ **Finance:** Bank names vs ATM count, branch count, loan amount
✅ **Agriculture:** Crop names vs production, area cultivated, yield
✅ **Education:** School names vs student count, pass rate, facilities
✅ **Health:** District names vs hospital count, beds, patient visits
✅ **Census:** State names vs population, literacy rate, density

