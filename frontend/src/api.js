import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : window.location.origin);

const api = axios.create({
  baseURL,
});

// ── Retry interceptor for 429 (Too Many Requests) ──────────────────────
// When data.gov.in rate-limits us, wait and retry automatically
// instead of showing an error to the user.
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500; // 1.5s, 3s, 6s exponential backoff

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    // Only retry on 429
    if (error.response?.status !== 429) return Promise.reject(error);

    // Track retry count
    config._retryCount = config._retryCount || 0;
    if (config._retryCount >= MAX_RETRIES) return Promise.reject(error);

    config._retryCount += 1;
    const delay = BASE_DELAY_MS * Math.pow(2, config._retryCount - 1);

    console.warn(
      `[api] 429 rate-limited on ${config.url} — retrying in ${delay}ms (attempt ${config._retryCount}/${MAX_RETRIES})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return api.request(config);
  }
);

export default api;
