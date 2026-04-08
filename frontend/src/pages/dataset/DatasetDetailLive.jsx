import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Eye, BarChart3, FileText, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Loader2, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import DatasetMeta from '../../components/dataset/DatasetMeta';
import DatasetVisualizer from '../../components/dataset/DatasetVisualizerDynamic';
import { getSectorBackground } from '../../constants/backgrounds';
import useEngagement from '../../hooks/useEngagement';

const PAGE_SIZE = 500;
const VISUALIZATION_ROW_LIMIT = 50;

function largeDatasetVisualization(totalRows) {
  return {
    visualization: {
      message: 'Data is too large to visualize immediately.',
      charts: [],
      rowCount: Number(totalRows || 0),
      threshold: VISUALIZATION_ROW_LIMIT,
    },
    insights: [],
  };
}

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

function Pagination({ page, totalPages, onPageChange, disabled }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);

      if (page <= 3) { start = 2; end = maxVisible; }
      if (page >= totalPages - 2) { start = totalPages - maxVisible + 1; end = totalPages - 1; }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const btnBase = 'px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-30';

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="text-sm text-gray-500 dark:text-gray-400">{t('Page')} {page} {t('of')} {totalPages} • 500 {t('Rows per page')}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1 || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title={t('First page')}>
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1 || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title={t('Previous page')}>
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              disabled={disabled}
              className={`${btnBase} min-w-[36px] ${
                p === page
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title={t('Next page')}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title={t('Last page')}>
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function DatasetDetailLive() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { trackView, trackDownload } = useEngagement();
  const { t } = useTranslation();
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
  const [rawCopied, setRawCopied] = useState(false);

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
  }, [id]);  // removed location.state to prevent double-fire on navigation

  useEffect(() => {
    if (!dataset || !sector) return;
    let cancelled = false;

    // Stagger this request to avoid hitting data.gov.in rate limits
    const timeoutId = setTimeout(async () => {
      try {
        const statsResponse = await api.get(`/datasets/${sector}/${encodeURIComponent(dataset.id)}/stats`);
        if (!cancelled) setStats(statsResponse.data?.stats || null);

        if (!trackedRef.current) {
          trackedRef.current = true;
          const trackedStats = await trackView(dataset.id, sector);
          if (!cancelled && trackedStats) setStats(trackedStats);

          // Persist to localStorage for Profile analytics
          try {
            const viewed = JSON.parse(localStorage.getItem('viewed_datasets') || '[]');
            if (!viewed.includes(dataset.id)) {
              viewed.push(dataset.id);
              localStorage.setItem('viewed_datasets', JSON.stringify(viewed));
            }
          } catch (_e) { /* ignore localStorage errors */ }
        }
      } catch (statsError) {
        console.error(statsError);
      }
    }, 600); // 600ms delay to stagger behind the data page request

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
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
    setRawCopied(false);
  }, [dataset?.id, activeView]);

  useEffect(() => {
    setVizState({ loading: false, data: null, error: '' });
  }, [dataset?.id]);

  useEffect(() => {
    if (!dataset || activeView !== 'viz') return;

    const totalRows = Number(stats?.rows || dataset.numberOfRows || dataset.rows || 0);
    if (totalRows > VISUALIZATION_ROW_LIMIT) {
      setVizState({ loading: false, data: largeDatasetVisualization(totalRows), error: '' });
      return;
    }

    if (!sector || vizState.data || vizState.loading) return;

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
  }, [dataset, sector, activeView, stats?.rows, vizState.data, vizState.loading]);

  const csvPreview = useMemo(() => formatCsv(pageData.records, pageData.columns), [pageData]);
  const rawPreviewText = csvPreview || 'No data available.';

  const handleCopyRaw = async () => {
    const textToCopy = rawPreviewText;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setRawCopied(true);
      window.setTimeout(() => setRawCopied(false), 1800);
    } catch (copyError) {
      console.error(copyError);
    }
  };

  const handleDownload = async () => {
    if (!dataset || !sector || downloading) return;
    setDownloading(true);
    try {
      const engagement = await trackDownload(dataset.id, sector);
      if (engagement?.downloads) {
        setStats((current) => ({ ...(current || {}), downloads: engagement.downloads, views: engagement.views ?? current?.views ?? 0 }));
      }

      // Persist to localStorage for Profile analytics
      try {
        const counts = JSON.parse(localStorage.getItem('download_counts') || '{}');
        counts[dataset.id] = (counts[dataset.id] || 0) + 1;
        localStorage.setItem('download_counts', JSON.stringify(counts));
      } catch (_e) { /* ignore localStorage errors */ }

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

  const detailBackground = getSectorBackground(sector);

  if (loading) {
    return (
      <DetailPageBackground
        imageSrc={detailBackground}
        innerClassName="flex min-h-[calc(100vh-9rem)] items-center justify-center"
      >
        <div className="text-gray-600 dark:text-gray-300">{t('Loading dataset...')}</div>
      </DetailPageBackground>
    );
  }

  if (error || !dataset) {
    return (
      <DetailPageBackground
        imageSrc={detailBackground}
        innerClassName="flex min-h-[calc(100vh-9rem)] items-center justify-center p-4"
      >
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-black bg-white p-8 text-gray-500 dark:bg-gray-950">
          <div className="text-2xl font-bold">{t('Dataset not found')}</div>
          <div>{error}</div>
          <button onClick={() => navigate(-1)} className="rounded-xl bg-black px-5 py-3 text-white">{t('Back')}</button>
        </div>
      </DetailPageBackground>
    );
  }

  return (
    <DetailPageBackground
      imageSrc={detailBackground}
      innerClassName="p-4 sm:p-6 lg:p-8"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-black bg-white p-6 sm:p-8 dark:bg-gray-950">
          <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-black dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t('Back')}
          </button>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">{dataset.title}</h1>
            <p className="max-w-3xl text-gray-600 dark:text-gray-400">{dataset.description || 'Dataset details and API-backed preview are available below.'}</p>
          </div>
        </motion.div>

        <section className="rounded-3xl border-2 border-black bg-white p-6 dark:bg-gray-950">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">{t('Metadata')}</h2>
          <DatasetMeta dataset={dataset} />
        </section>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border-2 border-black bg-white p-5 dark:bg-gray-950">
            <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">{t('Rows')}</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{(stats?.rows || dataset.numberOfRows || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border-2 border-black bg-white p-5 dark:bg-gray-950">
            <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">{t('Columns')}</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{stats?.columnCount || dataset.numberOfColumns || stats?.columns?.length || 0}</div>
          </div>
          <div className="rounded-2xl border-2 border-black bg-white p-5 dark:bg-gray-950">
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Eye className="h-4 w-4" />{t('Views')}</div>
            <div className="text-2xl font-black text-green-600">{(stats?.views ?? dataset.views ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border-2 border-black bg-white p-5 dark:bg-gray-950">
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Download className="h-4 w-4" />{t('Downloads')}</div>
            <div className="text-2xl font-black text-blue-600">{(stats?.downloads ?? dataset.downloads ?? 0).toLocaleString()}</div>
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border-2 border-black bg-white p-6 dark:bg-gray-950">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setActiveView('table')} className={`rounded-xl border-2 border-black px-4 py-2 text-sm font-semibold ${activeView === 'table' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
              <FileText className="mr-2 inline h-4 w-4" />{t('View Details')}
            </button>
            <button onClick={() => setActiveView('raw')} className={`rounded-xl border-2 border-black px-4 py-2 text-sm font-semibold ${activeView === 'raw' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
              {t('Raw View')}
            </button>
            <button onClick={() => setActiveView('viz')} className={`flex items-center gap-2 rounded-xl border-2 border-black px-4 py-2 text-sm font-semibold ${activeView === 'viz' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
              <BarChart3 className="h-4 w-4" /> {t('Visualization')}
            </button>
            <div className="flex-1" />
            <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border-2 border-black bg-black px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? t('Downloading...') : t('Download CSV')}
            </button>
          </div>

          {(activeView === 'table' || activeView === 'raw') && (
            <>
              {pageLoading && <div className="text-gray-500">Loading page {page}...</div>}
              {pageError && <div className="text-red-500">{pageError}</div>}

              {!pageLoading && !pageError && activeView === 'table' && (
                <div className="max-h-[640px] overflow-auto rounded-2xl border-2 border-black bg-white dark:bg-gray-950">
                  <table className="min-w-full bg-white text-sm dark:bg-gray-950">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        {pageData.columns.map((column) => (
                          <th key={column} className="whitespace-nowrap border-b-2 border-black px-4 py-3 text-left font-bold text-gray-700 dark:text-gray-200">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.records.map((record, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/40">
                          {pageData.columns.map((column) => (
                            <td key={`${rowIndex}-${column}`} className="whitespace-nowrap px-4 py-3 align-top text-gray-700 dark:text-gray-300">{String(record[column] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!pageLoading && !pageError && activeView === 'raw' && (
                <div className="rounded-2xl border-2 border-black bg-gray-950">
                  <div className="flex justify-end px-4 pt-4">
                    <button
                      onClick={handleCopyRaw}
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 border-black bg-white text-gray-900 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                      aria-label={rawCopied ? t('Copied') : t('Copy')}
                      title={rawCopied ? t('Copied') : t('Copy')}
                    >
                      {rawCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="max-h-[580px] overflow-auto px-5 pb-5 pt-3 text-emerald-400">
                    <pre className="break-words whitespace-pre-wrap font-mono text-sm">{rawPreviewText}</pre>
                  </div>
                </div>
              )}

              {!pageLoading && !pageError && (
                <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} disabled={pageLoading} />
              )}
            </>
          )}

          {activeView === 'viz' && (
            <>
              {vizState.loading && <div className="text-gray-500">{t('Generating visualization...')}</div>}
              {vizState.error && <div className="text-red-500">{vizState.error}</div>}
              {!vizState.loading && !vizState.error && (
                <DatasetVisualizer visualization={vizState.data?.visualization} insights={vizState.data?.insights || []} />
              )}
            </>
          )}
        </section>
      </div>
    </DetailPageBackground>
  );
}

function DetailPageBackground({ imageSrc, children, innerClassName = '' }) {
  const contentClassName = ['relative z-10', innerClassName].filter(Boolean).join(' ');

  return (
    <div className="relative min-h-[calc(100vh-9rem)]">
      <div className="pointer-events-none absolute inset-0">
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/18 dark:bg-slate-950/50" />
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
