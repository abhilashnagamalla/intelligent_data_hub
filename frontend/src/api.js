import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : window.location.origin);

const api = axios.create({
  baseURL,
});

// ── Request interceptor for logging ──────────────────────
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error(`[API] Request error:`, error);
    return Promise.reject(error);
  }
);

// ── Response interceptor for 429 and logging ─────────────
// When data.gov.in rate-limits us, wait and retry automatically
// instead of showing an error to the user.
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500; // 1.5s, 3s, 6s exponential backoff

api.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config) {
      console.error(`[API] Error (no config):`, error.message);
      return Promise.reject(error);
    }

    console.error(`[API] ${error.response?.status || 'UNKNOWN'} ${config.method.toUpperCase()} ${config.url}: ${error.message}`);

    // Only retry on 429
    if (error.response?.status !== 429) return Promise.reject(error);

    // Track retry count
    config._retryCount = config._retryCount || 0;
    if (config._retryCount >= MAX_RETRIES) {
      console.error(`[API] Max retries (${MAX_RETRIES}) exceeded for ${config.url}`);
      return Promise.reject(error);
    }

    config._retryCount += 1;
    const delay = BASE_DELAY_MS * Math.pow(2, config._retryCount - 1);

    console.warn(
      `[API] 429 rate-limited on ${config.url} — retrying in ${delay}ms (attempt ${config._retryCount}/${MAX_RETRIES})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return api.request(config);
  }
);

export default api;
