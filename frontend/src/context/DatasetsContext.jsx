import { createContext, useState, useCallback, useEffect } from 'react';
import api from '../api';

export const DatasetsContext = createContext();

export function DatasetsProvider({ children }) {
  const [datasets, setDatasets] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAllDatasets = useCallback(async (page = 1, limit = 50) => {
    if (Object.keys(datasets).length > 0) {
      return datasets; // Return cached data if available
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/datasets/all', { params: { page, limit } });
      
      const allDatasetsMap = {};
      for (const [sector, sectorData] of Object.entries(response.data)) {
        if (sectorData.data || Array.isArray(sectorData)) {
          allDatasetsMap[sector] = sectorData.data || sectorData;
        }
      }
      
      setDatasets(allDatasetsMap);
      return allDatasetsMap;
    } catch (err) {
      console.error('Error fetching datasets:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [datasets]);

  const getDatasetsBySector = useCallback((sector) => {
    return datasets[sector] || [];
  }, [datasets]);

  const getDatasetById = useCallback((id) => {
    for (const sectorDatasets of Object.values(datasets)) {
      const found = sectorDatasets.find(d => d.id === id);
      if (found) return found;
    }
    return null;
  }, [datasets]);

  return (
    <DatasetsContext.Provider value={{ 
      datasets, 
      loading, 
      error, 
      fetchAllDatasets, 
      getDatasetsBySector,
      getDatasetById 
    }}>
      {children}
    </DatasetsContext.Provider>
  );
}
