/**
 * GEOVIEW DYNAMIC RENDERING IMPLEMENTATION GUIDE
 * 
 * This file provides the framework for implementing dynamic geographic visualization
 * that supports both India-wide (state-level) and state-specific (district-level) datasets
 */

// Step 1: Dataset Scope Detection Function
export const detectDatasetScope = (dataset, records = []) => {
  /**
   * Analyzes dataset metadata and records to determine visualization scope
   * Returns: { scope: 'national' | 'state', targetState: string | null }
   */
  
  // Check dataset metadata for scope hints
  if (dataset?.scope === 'state' || dataset?.stateSpecific) {
    return {
      scope: 'state',
      targetState: dataset.state || dataset.region || normalizeStateName(dataset.stateName),
    };
  }
  
  // Analyze records to detect state distribution
  if (records.length > 0) {
    const stateColumn = detectStateColumn(records, Object.keys(records[0]));
    if (stateColumn) {
      const uniqueStates = new Set();
      records.forEach(rec => {
        const state = rec[stateColumn];
        if (state) uniqueStates.add(normalizeStateName(state));
      });
      
      // If records all from single state, it's state-specific
      if (uniqueStates.size === 1) {
        return {
          scope: 'state',
          targetState: Array.from(uniqueStates)[0],
        };
      }
      
      // Multiple states = national scope
      if (uniqueStates.size > 1) {
        return {
          scope: 'national',
          targetState: null,
        };
      }
    }
  }
  
  // Default to national
  return {
    scope: 'national',
    targetState: null,
  };
};

// Step 2: Dynamic GeoJSON Loader
export const getGeoJSONPath = (scope, targetState = null) => {
  /**
   * Returns appropriate GeoJSON file path based on dataset scope
   * National scope: /india_states.geojson
   * State scope: /districts/{stateName}_districts.geojson
   */
  
  if (scope === 'national') {
    return '/india_states.geojson';
  }
  
  if (scope === 'state' && targetState) {
    // Convert state name to filename format (lowercase, spaces to underscores)
    const stateFilename = targetState
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    
    return `/districts/${stateFilename}_districts.geojson`;
  }
  
  return null;
};

// Step 3: Map Renderer Selection 
export const selectMapType = (scope) => {
  /**
   * Determines which map component/library to use
   * National: Leaflet with state boundaries
   * State: Leaflet with district boundaries
   */
  
  return {
    library: 'leaflet', // or react-simple-maps
    geometry: scope === 'national' ? 'states' : 'districts',
    zoom: scope === 'national' ? 4 : 8, // Initial zoom levels
    center: scope === 'national' ? [20.5937, 78.9629] : null, // India center
  };
};

// Step 4: Data Binding with Normalization
export const bindDataToGeoFeatures = (records, geoJSON, scope, stateOrDistrict = 'state') => {
  /**
   * Maps dataset values to GeoJSON features
   * Handles name normalization and data aggregation
   */
  
  const dataMap = {};
  
  records.forEach(record => {
    const regionName = record[stateOrDistrict];
    if (!regionName) return;
    
    const normalized = normalizeRegionName(regionName, scope);
    
    if (!dataMap[normalized]) {
      dataMap[normalized] = { values: [], rows: 0 };
    }
    
    dataMap[normalized].values.push(record);
    dataMap[normalized].rows += 1;
  });
  
  // Attach data to GeoJSON features
  if (geoJSON.features) {
    geoJSON.features.forEach(feature => {
      const featureName = feature.properties[scope === 'national' ? 'STATE_NAME' : 'DISTRICT_NAME'];
      const normalized = normalizeRegionName(featureName, scope);
      
      feature.properties.data = dataMap[normalized] || {
        values: [],
        rows: 0,
      };
    });
  }
  
  return geoJSON;
};

// Step 5: Error Handling
export const handleMapLoadingError = (scope, targetState, error) => {
  /**
   * Graceful error handling with user-friendly messages
   */
  
  if (error.code === 'GEOJSON_NOT_FOUND') {
    if (scope === 'state') {
      return `Detailed map not available for ${targetState}. Showing region summary instead.`;
    }
    return 'Map visualization not available. Showing data in table format.';
  }
  
  return 'Unable to load geographic visualization. Please try again.';
};

// Step 6: Color Scale for Both Scopes
export const getColorScale = (value, min, max) => {
  /**
   * Consistent color scaling across national and state visualizations
   * Returns: { backgroundColor, opacity }
   */
  
  const normalized = (value - min) / (max - min || 1);
  const intensity = Math.max(0, Math.min(1, normalized));
  
  // Use same color scheme for both
  // Light (low value) → Dark (high value)
  const hue = 0; // Red hue for consistency
  const saturation = 100;
  const lightness = 100 - (intensity * 70); // 100 (lightest) to 30 (darkest)
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Helper: Normalize region names for matching
function normalizeRegionName(name, scope) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Helper: Normalize state name
function normalizeStateName(name) {
  if (!name) return '';
  
  const normalized = normalizeRegionName(name);
  
  // State aliases mapping (same as in backend)
  const stateMap = {
    'andhra pradesh': 'Andhra Pradesh',
    'ap': 'Andhra Pradesh',
    'telangana': 'Telangana',
    'tg': 'Telangana',
    'uttar pradesh': 'Uttar Pradesh',
    'up': 'Uttar Pradesh',
    // ... add more as needed
  };
  
  return stateMap[normalized] || String(name).trim();
}

/**
 * USAGE EXAMPLE:
 * 
 * import { detectDatasetScope, getGeoJSONPath, selectMapType } from '@/utils/geoViewRenderer';
 * 
 * // In GeoViewModalMap component:
 * const scope = detectDatasetScope(dataset, records);
 * const geoJsonPath = getGeoJSONPath(scope.scope, scope.targetState);
 * const mapConfig = selectMapType(scope.scope);
 * 
 * // Load GeoJSON
 * const geoJSON = await fetch(geoJsonPath).then(r => r.json());
 * 
 * // Bind data
 * const enrichedGeoJSON = bindDataToGeoFeatures(
 *   records,
 *   geoJSON,
 *   scope.scope,
 *   scope.scope === 'national' ? 'state' : 'district'
 * );
 * 
 * // Render with Leaflet/react-simple-maps
 */

export default {
  detectDatasetScope,
  getGeoJSONPath,
  selectMapType,
  bindDataToGeoFeatures,
  handleMapLoadingError,
  getColorScale,
};
