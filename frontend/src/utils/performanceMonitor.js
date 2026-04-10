/**
 * Performance Monitor Utility
 * Tracks page rendering time and auto-reloads if exceeds threshold
 */

const RENDER_TIME_THRESHOLD = 20; // milliseconds
const MAX_RELOAD_ATTEMPTS = 2;
const RELOAD_COUNTER_KEY = 'idh-reload-counter';
const RELOAD_RESET_TIME = 60000; // 1 minute

export function usePerformanceMonitor(pageName) {
  const getReloadCount = () => {
    const data = localStorage.getItem(RELOAD_COUNTER_KEY);
    if (!data) return { count: 0, timestamp: Date.now() };
    
    const parsed = JSON.parse(data);
    // Reset counter if older than RELOAD_RESET_TIME
    if (Date.now() - parsed.timestamp > RELOAD_RESET_TIME) {
      return { count: 0, timestamp: Date.now() };
    }
    return parsed;
  };

  const setReloadCount = (count) => {
    localStorage.setItem(RELOAD_COUNTER_KEY, JSON.stringify({
      count,
      timestamp: Date.now(),
      page: pageName
    }));
  };

  const measureRenderTime = (callback) => {
    const startTime = performance.now();
    
    // Execute the callback and measure when React finish rendering
    const result = callback();
    
    // Use requestAnimationFrame to measure after paint
    requestAnimationFrame(() => {
      const renderTime = performance.now() - startTime;
      
      console.log(`[Performance] ${pageName} render time: ${renderTime.toFixed(2)}ms`);
      
      // If rendering took too long, trigger reload
      if (renderTime > RENDER_TIME_THRESHOLD) {
        const reloadData = getReloadCount();
        
        if (reloadData.count < MAX_RELOAD_ATTEMPTS) {
          console.warn(`[Performance] Render time exceeded ${RENDER_TIME_THRESHOLD}ms (${renderTime.toFixed(2)}ms). Auto-reloading... (Attempt ${reloadData.count + 1}/${MAX_RELOAD_ATTEMPTS})`);
          setReloadCount(reloadData.count + 1);
          
          // Delay reload slightly to allow any pending operations
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else {
          console.error(`[Performance] Max reload attempts reached for ${pageName}. Performance issue may persist.`);
          localStorage.removeItem(RELOAD_COUNTER_KEY);
        }
      } else {
        // Reset counter on successful render
        localStorage.removeItem(RELOAD_COUNTER_KEY);
      }
    });
    
    return result;
  };

  return { measureRenderTime };
}

/**
 * Wrapper hook for measuring specific data loading operations
 */
export function useDataLoadingMonitor(operationName) {
  const startMeasure = () => {
    return performance.now();
  };

  const endMeasure = (startTime, threshold = RENDER_TIME_THRESHOLD) => {
    const duration = performance.now() - startTime;
    console.log(`[Data Loading] ${operationName}: ${duration.toFixed(2)}ms`);
    
    if (duration > threshold) {
      console.warn(`[Data Loading] ${operationName} exceeded threshold (${threshold}ms)`);
    }
    
    return duration;
  };

  return { startMeasure, endMeasure };
}

/**
 * Check current page performance metrics
 */
export function getPagePerformanceMetrics() {
  if (!window.performance) return null;
  
  const navigation = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  
  return {
    domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
    loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
    totalNavigation: navigation?.loadEventEnd - navigation?.fetchStart
  };
}
