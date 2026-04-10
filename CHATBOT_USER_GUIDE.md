# Chatbot Domain Restriction - User & Frontend Guide

## For End Users

### What Changed?

The Intelligent Data Hub chatbot now **focuses exclusively on dataset and platform-related questions**. The chatbot will no longer answer general knowledge questions or off-topic queries.

### Allowed Questions

You can ask the chatbot about:

#### 📊 Discovering Datasets
- "Show me agriculture datasets"
- "What datasets are available in healthcare?"
- "Find population data for India"
- "List the latest datasets"
- "Show datasets for Maharashtra"

#### 🔍 Understanding Data
- "What does this dataset contain?"
- "Explain this dataset in simple terms"
- "What are the columns in this data?"
- "What is the data source?"
- "When was this updated?"

#### 📈 Analyzing Data
- "Show trends in this dataset"
- "What's the average value?"
- "Find patterns in the data"
- "Compare data between states"
- "Which state has the highest value?"

#### 📥 Working with Data
- "Download this dataset"
- "Show me a visualization"
- "Export as CSV"
- "Recommend similar datasets"

#### ❓ Platform Questions
- "What is the Intelligent Data Hub?"
- "How do I use this platform?"
- "Is this data real-time?"
- "Is the platform free?"

### Not Allowed Questions

The chatbot will **reject** queries like:
- ❌ "What's the capital of India?" (general knowledge)
- ❌ "Tell me a joke" (entertainment)
- ❌ "How do I lose weight?" (personal advice)
- ❌ "What's the weather?" (current information)
- ❌ "Help me with my homework" (general assistance)

### When You Get Rejected

If your question is rejected, you'll see:

```
I can only help with questions about the Intelligent Data Hub 
platform and its datasets. I can assist with:
• Discovering datasets (by sector, state, or topic)
• Understanding dataset structure and content
• Analyzing data trends and patterns
• Downloading or visualizing datasets
• Platform features and availability

Please ask me about datasets or the platform, and I'll be happy to help!
```

**What to do**: Rephrase your question to focus on datasets. For example:
- Instead of: "What's the weather?" 
- Try: "Show me weather-related datasets available on the platform"

### Tips for Better Results

1. **Be specific about what you want**
   - Good: "Show me agriculture datasets for Tamil Nadu"
   - Not ideal: "agriculture"

2. **Mention sectors or states**
   - Good: "Healthcare data for Maharashtra"
   - Works too: "What datasets are in finance?"

3. **Use data-related terms**
   - Good: "Analyze trends in this dataset"
   - Not ideal: "What do you think about agriculture?"

4. **Ask about data actions**
   - Good: "Download the education dataset"
   - Good: "Visualize this data"

### Example Conversations

#### Conversation 1: Dataset Discovery
```
You: "Show me transport datasets"
Chatbot: [Lists 5 transport datasets with descriptions]

You: "Which ones have data for Delhi?"
Chatbot: [Filters to Delhi-specific transport datasets]

You: "Tell me more about the first one"
Chatbot: [Provides detailed info about that dataset]

You: "Can I visualize this data?"
Chatbot: [Provides visualization or download options]
```

#### Conversation 2: Data Analysis
```
You: "Analyze agriculture production trends"
Chatbot: [Shows dataset and analysis results]

You: "Which state has the highest production?"
Chatbot: [Analyzes and shows results]

You: "Show this as a chart"
Chatbot: [Provides visualization]

You: "Export as CSV"
Chatbot: [Provides download link]
```

#### Conversation 3: Rejected Query
```
You: "What's the capital of India?"
Chatbot: "I can only help with questions about the 
Intelligent Data Hub platform and its datasets..."

You: "OK, show me population data for India"
Chatbot: [Shows relevant datasets]
```

---

## For Frontend Developers

### How to Handle Responses

The chatbot now returns `restricted: true` for rejected queries.

#### Check Response Restrictions

```javascript
// After getting chatbot response
const response = await chatbotAPI.query(userQuery);

if (response.restricted) {
  // Query was outside domain scope
  displayRestictionMessage(response.content);
  // Optionally show suggestions for valid queries
  showSuggestedTopics();
} else {
  // Query was allowed and processed
  displayDatasets(response.matches);
  displayInsights(response.insights);
}
```

#### Response Structure

```typescript
interface ChatbotResponse {
  sessionId: string;
  restricted: boolean;  // TRUE if query rejected
  content: string;
  matches: Dataset[];
  insights: string[];
  result: any | null;
  history: Message[];
}
```

### UI Patterns

#### Pattern 1: Show Rejection Message
```jsx
function ChatbotDisplay({ response }) {
  if (response.restricted) {
    return (
      <div className="restriction-message">
        <AlertIcon />
        <p>{response.content}</p>
        <SuggestedTopicsPanel />
      </div>
    );
  }
  return <DatasetResults response={response} />;
}
```

#### Pattern 2: Suggest Valid Queries
```jsx
function SuggestedTopics() {
  const suggestions = [
    "Show agriculture datasets",
    "Healthcare data for Maharashtra",
    "Find the latest datasets",
    "Analyze population trends",
  ];
  
  return (
    <div className="suggestions">
      <h4>Try asking about:</h4>
      <ul>
        {suggestions.map(s => (
          <li key={s} onClick={() => submitQuery(s)}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Pattern 3: Disable Submit for Invalid Input
```jsx
function ChatInput() {
  const [query, setQuery] = useState("");
  
  const isRestricted = !wouldBeAllowed(query);
  
  return (
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Ask about datasets..."
      disabled={isRestricted && query.length > 0}
    />
  );
}
```

### API Integration

#### TypeScript Types
```typescript
interface DomainValidationResponse {
  sessionId: string;
  restricted: boolean;
  content: string;
  matches: any[];
  insights: string[];
  result: null;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface ChatRequest {
  query: string;
  session_id?: string;
  sector?: string;
  dataset_id?: string;
  dataset_title?: string;
}

async function callChatbot(request: ChatRequest): Promise<DomainValidationResponse> {
  const response = await fetch("/api/chatbot/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return response.json();
}
```

#### Usage Example
```javascript
// Query about platform
const response1 = await callChatbot({
  query: "Show me agriculture data",
  sector: "agriculture",
});
// response1.restricted === false (allowed)

// Query off-topic
const response2 = await callChatbot({
  query: "Tell me a joke",
});
// response2.restricted === true (rejected)

// Query with dataset context
const response3 = await callChatbot({
  query: "Analyze this",
  dataset_id: "123",
});
// response3.restricted === false (allowed because dataset_id provided)
```

### Handling Sessions

```javascript
// Store session ID to maintain context
let currentSessionId = null;

async function sendMessage(query) {
  // Reuse session ID for continuity
  const response = await callChatbot({
    query,
    session_id: currentSessionId,
  });
  
  // Update session ID
  currentSessionId = response.sessionId;
  
  // Display response
  if (response.restricted) {
    displayRestrictedMessage(response);
  } else {
    displayResults(response);
  }
}
```

### Error States

```javascript
// Handle different response types
handleChatbotResponse(response) {
  if (!response || !response.sessionId) {
    showError("Invalid response from chatbot");
    return;
  }
  
  if (response.restricted) {
    // Show guidance message
    showGuidanceMessage(response.content);
    showSuggestedQueries();
  } else if (!response.matches || response.matches.length === 0) {
    // No matches but query was within domain
    showNoMatches(response);
  } else {
    // Show results
    displayDatasets(response.matches);
  }
}
```

### Testing in Frontend

```javascript
// Mock responses for testing
const mockRestrictedResponse = {
  sessionId: "test-session",
  restricted: true,
  content: "I can only help with questions about...",
  matches: [],
  insights: ["This query is outside the scope..."],
  result: null,
  history: [],
};

const mockAllowedResponse = {
  sessionId: "test-session",
  restricted: false,
  content: "Found 5 agriculture datasets...",
  matches: [/* datasets */],
  insights: ["Showing top 5 of 10 matching datasets"],
  result: null,
  history: [],
};

// Test component behavior
test("Shows restriction message when restricted=true", () => {
  const { getByText } = render(
    <ChatbotDisplay response={mockRestrictedResponse} />
  );
  expect(getByText(/can only help with/)).toBeInTheDocument();
});
```

### CSS Styling for Restricted Messages

```css
.restriction-message {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 16px;
  margin: 8px 0;
}

.restriction-message svg {
  color: #ff9800;
  margin-right: 8px;
}

.suggested-topics {
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 4px;
  padding: 12px;
  margin-top: 12px;
}

.suggested-topics li {
  cursor: pointer;
  color: #1976d2;
  text-decoration: underline;
}

.suggested-topics li:hover {
  color: #1565c0;
}
```

### Performance Considerations

- Domain validation is done **server-side** (not frontend)
- No additional API calls needed
- Response time is minimal (pure keyword matching)
- Restrict validation doesn't impact latency

### Backwards Compatibility

- Existing sessions continue to work
- New `restricted` field defaults to `false` for old queries
- No breaking changes to API contract
- Gradual rollout safe

---

## Common Questions

### Q: Why was this added?
**A**: To keep the chatbot focused on its core purpose - helping users discover and analyze datasets from the Intelligent Data Hub. This prevents confusion and ensures users get relevant, data-driven responses.

### Q: Will my old queries still work?
**A**: Yes! Any query about datasets, sectors, or states will continue to work as before. Only unrelated queries are now rejected.

### Q: How can I suggest new allowed topics?
**A**: Reach out to the development team with examples of queries you think should be allowed. They can evaluate and potentially add them to the keyword lists.

### Q: Can I use the chatbot for things besides datasets?
**A**: Not with this chatbot. It's specifically designed for the Intelligent Data Hub platform. For other queries, you may need a different tool.

### Q: What if I accidentally ask an off-topic question?
**A**: You'll get a friendly message explaining what the chatbot can help with, plus suggestions for how to rephrase your question about data.

---

## Resources

- **User Documentation**: This file
- **Technical Documentation**: `CHATBOT_DOMAIN_RESTRICTION.md`
- **Implementation Guide**: `CHATBOT_IMPLEMENTATION_GUIDE.md`
- **Test Suite**: `test_chatbot_domain_restriction.py`
- **Backend Service**: `backend/app/services/rag_chatbot_service.py`

---

**Version**: 1.0  
**Last Updated**: 2026-04-10  
**Status**: Production Ready
