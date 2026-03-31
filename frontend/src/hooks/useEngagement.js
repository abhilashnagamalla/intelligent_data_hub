import { useCallback } from 'react';
import api from '../api';

export default function useEngagement() {
  const trackView = useCallback(async (datasetId, sector) => {
    if (!datasetId || !sector) return null;
    const response = await api.post(`/datasets/${sector}/${encodeURIComponent(datasetId)}/view`);
    return response.data?.stats || null;
  }, []);

  const trackDownload = useCallback(async (datasetId, sector) => {
    if (!datasetId || !sector) return null;
    const response = await api.post(`/datasets/${sector}/${encodeURIComponent(datasetId)}/download`);
    return response.data || null;
  }, []);

  return { trackView, trackDownload };
}
