# Chatbot Error Debugging Guide

## Common Causes of "Sorry, something went wrong."

### 1. **Backend API Not Running**
- **Symptom**: Error happens immediately for every query
- **Fix**: Start the backend server
  ```bash
  cd backend
  python -m uvicorn app.main:app --reload --port 8000
  ```
- **Verify**: Open http://localhost:8000 in browser - should see `{"message": "Intelligent Data Hub API running"}`

### 2. **No Dataset Selected**
- **Symptom**: Error appears only when you try to send a query without selecting a dataset
- **Frontend check**: In ChatbotDataset.jsx, line 317-330, there's a check that prevents sending if `!selectedDataset`
- **Fix**: Always select a dataset first before asking questions

### 3. **Firebase Issues**
- **Symptom**: Data loads but messages fail to store, chat history disappears
- **Causes**:
  - Firebase config is incorrect in `frontend/src/services/firebase.js`
  - User not authenticated properly
  - Firebase rules preventing writes
- **Fix**:
  ```javascript
  // Verify in auth context that user object has:
  // { id, email, name, picture, createdAt, lastLogin }
  ```

### 4. **API Endpoint Failure**
- **Symptom**: Backend is running but requests fail
- **Check server logs**:
  ```bash
  # Look for errors in terminal running uvicorn
  # Should see: POST /chatbot/query
  ```
- **Fix**: Restart backend with proper logging
  ```bash
  python -m uvicorn app.main:app --reload --log-level debug
  ```

### 5. **Dataset API Unavailable**
- **Symptom**: Error mentions "data.gov.in API" or "temporarily unavailable"
- **Cause**: data.gov.in server is down or rate-limited
- **Fix**: Wait and try again - this is a 3rd-party service

### 6. **Network/CORS Issues**
- **Symptom**: Browser console shows network errors
- **Check**: F12 → Network tab → look for failed `/chatbot/query` requests
- **Fix**: CORS is already enabled in main.py, but verify:
  ```python
  CORSMiddleware(
      allow_origins=["*"],  # Allow all origins
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

---

## How to Debug

### **Step 1: Check Browser Console**
```
F12 → Console tab
Look for error messages starting with [ChatbotDataset] or network errors
```

### **Step 2: Check Network Requests**
```
F12 → Network tab
Filter by '/chatbot/query'
Look at:
- Request payload (what was sent)
- Response (what error came back)
- Status code (200, 400, 500, etc.)
```

### **Step 3: Check Backend Logs**
```
Terminal running uvicorn should show:
✓ POST /chatbot/query 200 OK
✗ POST /chatbot/query 500 Server Error
```

### **Step 4: Test Backend Directly**
```bash
curl -X POST http://localhost:8000/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "show datasets",
    "session_id": "test-123",
    "dataset_id": null
  }'
```

---

## Frontend Error Handling

Check `frontend/src/pages/chatbot/ChatbotDataset.jsx` line 361-415:

```javascript
// If there's an error during API call, frontend shows:
const _error = {
  role: 'bot',
  content: 'Sorry, something went wrong. Please try again.',
  restricted: false,
  matches: [],
  insights: [],
  result: null,
  timestamp: new Date().toLocaleTimeString(),
};
```

**To see actual error**, add console.log in catch block:
```javascript
} catch (_error) {
  console.error('[ChatbotDataset] Full API error:', _error);  // ADD THIS LINE
  const errorMessage = { ... };
```

---

## Solution Checklist

- [ ] Backend running on port 8000
- [ ] Frontend can reach API (check Network tab)
- [ ] User is authenticated (check AuthContext)
- [ ] Dataset is selected before sending message
- [ ] Firebase is properly initialized
- [ ] data.gov.in API is available (check live_api_available() in rag_chatbot_service.py)
- [ ] No rate-limiting on data.gov.in (wait and retry)
- [ ] Check server logs for specific error messages
- [ ] Clear browser cache and localStorage if needed
  ```javascript
  localStorage.clear()
  ```

---

## Example Working Flow

1. ✅ Load http://localhost:5173
2. ✅ See login screen (or already logged in)
3. ✅ Navigate to Dashboard → Dataset Chatbot
4. ✅ Search for a dataset (e.g., "agriculture")
5. ✅ Click to select it
6. ✅ Ask a question with actual keywords:
   - "What are the column names?"
   - "Show me key insights"
   - "What's the minimum value?"
7. ✅ Get response with real data

---

## If Still Stuck

1. Check `.env` file in backend - ensure it has OPENAI_API_KEY (optional but recommended)
2. Restart both frontend and backend completely
3. Check for port conflicts:
   ```bash
   # Windows
   netstat -ano | findstr :8000
   netstat -ano | findstr :5173
   
   # Linux/Mac
   lsof -i :8000
   lsof -i :5173
   ```
4. Check backend requirements are installed:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
