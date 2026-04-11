/**
 * Simple in-memory cache for API responses with TTL
 * Helps reduce redundant API calls across components
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const cache = new Map();
const timers = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cache key from parameters
 */
export function getCacheKey(prefix, ...params) {
  return `${prefix}:${JSON.stringify(params)}`;
}

/**
 * Get cached data if not expired
 */
export function getCachedData(key) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  return null;
}

/**
 * Set cached data with TTL
 */
export function setCachedData(key, data, ttl = DEFAULT_TTL) {
  // Clear existing timer
  if (timers.has(key)) {
    clearTimeout(timers.get(key));
  }

  // Store data
  cache.set(key, data);

  // Set expiration timer
  if (ttl > 0) {
    const timer = setTimeout(() => {
      cache.delete(key);
      timers.delete(key);
    }, ttl);
    timers.set(key, timer);
  }
}

/**
 * Clear specific cache entry
 */
export function clearCacheEntry(key) {
  if (timers.has(key)) {
    clearTimeout(timers.get(key));
    timers.delete(key);
  }
  cache.delete(key);
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  cache.clear();
  timers.clear();
}

/**
 * Debounce function for rapid API calls
 */
export function createDebounce(fn, delay = 300) {
  let timeoutId;
  let lastArgs;
  let lastContext;

  return function debounced(...args) {
    lastArgs = args;
    lastContext = this;

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(lastContext, lastArgs);
    }, delay);
  };
}

/**
 * Throttle function for event handlers
 */
export function createThrottle(fn, delay = 300) {
  let lastCall = 0;
  let lastArgs;
  let lastContext;
  let timeoutId;

  return function throttled(...args) {
    lastArgs = args;
    lastContext = this;
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(lastContext, lastArgs);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(lastContext, lastArgs);
      }, delay - (now - lastCall));
    }
  };
}

/**
 * React hook for debounced API calls with caching
 */
export function useDebouncedApi(apiCall, delay = 300, cacheKey = null) {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const timeoutRef = useRef(null);

  const call = useCallback(
    async (...args) => {
      // Check cache if cacheKey provided
      if (cacheKey) {
        const cached = getCachedData(cacheKey);
        if (cached) {
          setState({ loading: false, data: cached, error: null });
          return cached;
        }
      }

      clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(async () => {
        try {
          setState({ loading: true, data: null, error: null });
          const result = await apiCall(...args);

          // Cache result if cacheKey provided
          if (cacheKey) {
            setCachedData(cacheKey, result);
          }

          setState({ loading: false, data: result, error: null });
          return result;
        } catch (err) {
          setState({ loading: false, data: null, error: err });
          throw err;
        }
      }, delay);
    },
    [apiCall, delay, cacheKey]
  );

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return { ...state, call };
}
