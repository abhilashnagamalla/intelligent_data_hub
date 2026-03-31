import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Eye, BarChart3, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api';
import DatasetMeta from '../../components/dataset/DatasetMeta';
import DatasetVisualizer from '../../components/dataset/DatasetVisualizer';
import useEngagement from '../../hooks/useEngagement';

const PAGE_SIZE = 500;

function apiErrorMessage(error, fallback) {
  if (error?.response?.status === 429) {
    return 'Data.gov.in rate limit reached. Please wait a moment and retry.';
  }
  if (error?.response?.status === 502) {
    return 'Data.gov.in is temporarily unavailable. Please try again shortly.';
  }
  return fallback;
}

function formatCsv(records, columns) {
  if (!records.length || !columns.length) return 'No data available.';
  const rows = [columns.join(',')];
  records.forEach((record) => {
    rows.push(
      columns
        .map((column) => {
          const value = String(record[column] ?? '');
          const escaped = value.replace(/"/g, '""');
          return /[",\n]/.test(value) ? `"${escaped}"` : escaped;
        })
        .join(','),
    );
  });
  return rows.join('\n');
}

export default function DatasetDetailLive() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { trackView, trackDownload } = useEngagement();
  const trackedRef = useRef(false);

  const [dataset, setDataset] = useState(location.state || null);
  const [sector, setSector] = useState(location.state?.sectorKey || location.state?.sector?.toLowerCase() || '');
  const [stats, setStats] = useState(location.state || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('table');
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({ records: [], columns: [], totalRows: 0, totalPages: 1 });
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [vizState, setVizState] = useState({ loading: false, data: null, error: '' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      setLoading(true);
      setError('');
      try {
        if (location.state?.id === id) {
          setDataset(location.state);
          setSector(location.state.sectorKey || location.state.sector?.toLowerCase() || '');
        }
        const response = await api.get(`/datasets/by-id/${encodeURIComponent(id)}`);
        if (cancelled) return;
        setDataset(response.data?.dataset || null);
        setSector(response.data?.sector || response.data?.dataset?.sectorKey || '');
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setError(apiErrorMessage(loadError, 'Dataset not found.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDataset();
    return () => {
      cancelled = true;
      trackedRef.current = false;
    };
  }, [id, location.state]);

  useEffect(() => {
    if (!dataset || !sector) return;
    let cancelled = false;

    async function loadStatsAndTrack() {
      try {
        const statsResponse = await api.get(`/datasets/${sector}/${encodeURIComponent(dataset.id)}/stats`);
        if (!cancelled) setStats(statsResponse.data?.stats || null);

        if (!trackedRef.current) {
          trackedRef.current = true;
          const trackedStats = await trackView(dataset.id, sector);
          if (!cancelled && trackedStats) setStats(trackedStats);
        }
      } catch (statsError) {
        console.error(statsError);
      }
    }

    loadStatsAndTrack();
    return () => {
      cancelled = true;
    };
  }, [dataset, sector, trackView]);

  useEffect(() => {
    if (!dataset) return;
    if (activeView !== 'table' && activeView !== 'raw') return;

    let cancelled = false;
    async function loadPage() {
      setPageLoading(true);
      setPageError('');
      try {
        const response = await api.get(`/datasets/data/${encodeURIComponent(dataset.id)}`, {
          params: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
        });
        if (!cancelled) {
          setPageData({
            records: response.data?.records || [],
            columns: response.data?.columns || [],
            totalRows: response.data?.totalRows || 0,
            totalPages: response.data?.totalPages || 1,
          });
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setPageError(apiErrorMessage(loadError, 'Failed to load dataset page.'));
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    loadPage();
    return () => {
      cancelled = true;
    };
  }, [dataset, activeView, page]);

  useEffect(() => {
    setPage(1);
    setPageData({ records: [], columns: [], totalRows: 0, totalPages: 1 });
    setPageError('');
  }, [dataset?.id, activeView]);

  useEffect(() => {
    if (!dataset || !sector || activeView !== 'viz' || vizState.data || vizState.loading) return;

    let cancelled = false;
    async function loadVisualization() {
      setVizState({ loading: true, data: null, error: '' });
      try {
        const response = await api.get(`/datasets/${sector}/${encodeURIComponent(dataset.id)}`);
        if (!cancelled) setVizState({ loading: false, data: response.data, error: '' });
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setVizState({ loading: false, data: null, error: apiErrorMessage(loadError, 'Failed to generate visualization.') });
      }
    }

    loadVisualization();
    return () => {
      cancelled = true;
    };
  }, [dataset, sector, activeView, vizState.data, vizState.loading]);

  const csvPreview = useMemo(() => formatCsv(pageData.records, pageData.columns), [pageData]);

  const handleDownload = async () => {
    if (!dataset || !sector || downloading) return;
    setDownloading(true);
    try {
      const engagement = await trackDownload(dataset.id, sector);
      if (engagement?.downloads) {
        setStats((current) => ({ ...(current || {}), downloads: engagement.downloads, views: engagement.views ?? current?.views ?? 0 }));
      }
      const response = await api.get(`/datasets/${sector}/${encodeURIComponent(dataset.id)}/raw`, {
        params: { full: true },
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${(dataset.title || dataset.id).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      console.error(downloadError);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-500">Loading dataset...</div>;
  }

  if (error || !dataset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 gap-4">
        <div className="text-2xl font-bold">Dataset not found</div>
        <div>{error}</div>
        <button onClick={() => navigate(-1)} className="px-5 py-3 rounded-xl bg-black text-white">Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-black bg-white dark:bg-gray-950 p-6 sm:p-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-black dark:hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">{dataset.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-3xl">{dataset.description || 'Dataset details and API-backed preview are available below.'}</p>
          </div>
          <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-white font-semibold disabled:opacity-50">
            <Download className="w-4 h-4" /> {downloading ? 'Downloading...' : 'Download CSV'}
          </button>
        </div>
      </motion.div>

      <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Metadata</h2>
        <DatasetMeta dataset={dataset} />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-950">
          <div className="text-sm text-gray-500 mb-2">Rows</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{(stats?.rows || dataset.numberOfRows || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-950">
          <div className="text-sm text-gray-500 mb-2">Columns</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{stats?.columnCount || dataset.numberOfColumns || stats?.columns?.length || 0}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-950">
          <div className="text-sm text-gray-500 mb-2 flex items-center gap-2"><Eye className="w-4 h-4" />Views</div>
          <div className="text-2xl font-black text-green-600">{(stats?.views || dataset.views || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-950">
          <div className="text-sm text-gray-500 mb-2 flex items-center gap-2"><Download className="w-4 h-4" />Downloads</div>
          <div className="text-2xl font-black text-blue-600">{(stats?.downloads || dataset.downloads || 0).toLocaleString()}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setActiveView('table')} className={`px-4 py-2 rounded-xl font-semibold ${activeView === 'table' ? 'bg-black text-white' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
            View Details
          </button>
          <button onClick={() => setActiveView('raw')} className={`px-4 py-2 rounded-xl font-semibold ${activeView === 'raw' ? 'bg-black text-white' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
            Raw View
          </button>
          <button onClick={() => setActiveView('viz')} className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 ${activeView === 'viz' ? 'bg-black text-white' : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'}`}>
            <BarChart3 className="w-4 h-4" /> Visualization
          </button>
        </div>

        {(activeView === 'table' || activeView === 'raw') && (
          <>
            {pageLoading && <div className="text-gray-500">Loading page {page}...</div>}
            {pageError && <div className="text-red-500">{pageError}</div>}

            {!pageLoading && !pageError && activeView === 'table' && (
              <div className="overflow-auto border border-gray-200 dark:border-gray-800 rounded-2xl max-h-[640px]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {pageData.columns.map((column) => (
                        <th key={column} className="px-4 py-3 text-left font-bold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-800 whitespace-nowrap">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.records.map((record, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                        {pageData.columns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="px-4 py-3 align-top text-gray-700 dark:text-gray-300 whitespace-nowrap">{String(record[column] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!pageLoading && !pageError && activeView === 'raw' && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-950 text-emerald-400 p-5 overflow-auto max-h-[640px]">
                <pre className="text-sm whitespace-pre-wrap">{csvPreview}</pre>
              </div>
            )}

            {!pageLoading && !pageError && pageData.totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-sm text-gray-500">Page {page} of {pageData.totalPages} • 500 rows per page</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <button onClick={() => setPage((current) => Math.min(pageData.totalPages, current + 1))} disabled={page === pageData.totalPages} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 flex items-center gap-2">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeView === 'viz' && (
          <>
            {vizState.loading && <div className="text-gray-500">Generating dataset-driven visualization from the full dataset...</div>}
            {vizState.error && <div className="text-red-500">{vizState.error}</div>}
            {!vizState.loading && !vizState.error && (
              <DatasetVisualizer visualization={vizState.data?.visualization} insights={vizState.data?.insights || []} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

