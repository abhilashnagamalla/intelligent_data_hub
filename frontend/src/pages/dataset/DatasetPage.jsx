import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import CatalogCard from '../../components/dataset/CatalogCard';
import { formatSectorLabel } from '../../constants/sectors';
import { usePerformanceMonitor } from '../../utils/performanceMonitor';

const ITEMS_PER_PAGE = 50;

function apiErrorMessage(error, fallback) {
  if (error?.response?.status === 502) {
    return 'Data.gov.in is temporarily unavailable. Please try again shortly.';
  }
  return fallback;
}

function Pagination({ page, totalPages, onPageChange }) {
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
      <div className="rounded-lg border border-black bg-white px-4 py-2 text-sm font-medium text-black">Page {page} of {totalPages}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="First">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="Previous">
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
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

        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="Next">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="Last">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function DatasetPage() {
  const { domain } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { measureRenderTime } = usePerformanceMonitor('DatasetPage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [totalPages, setTotalPages] = useState(1);
  const [totalDatasets, setTotalDatasets] = useState(0);
  const requestAbortRef = useRef(null);

  const currentPage = Number(searchParams.get('page') || 1);
  const activeSearch = (searchParams.get('q') || searchQuery || '').trim();
  const normalizedSector = domain ? formatSectorLabel(domain) : '';
  const visibleDatasets = activeSearch ? datasets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE) : datasets;

  useEffect(() => {
    let cancelled = false;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;

    async function load() {
      setLoading(true);
      setError('');
      setWarning('');
      try {
        if (activeSearch) {
          const response = await api.get('/datasets/search', {
            params: { q: activeSearch, sector: domain || undefined },
            signal: controller.signal,
          });
          if (!cancelled) {
            const results = response.data || [];
            setDatasets(results);
            setTotalDatasets(results.length);
            setTotalPages(Math.max(1, Math.ceil(results.length / ITEMS_PER_PAGE)));
          }
        } else if (normalizedSector) {
          const response = await api.get(`/datasets/${normalizedSector}`, {
            params: { page: currentPage, limit: ITEMS_PER_PAGE },
            signal: controller.signal,
          });
          if (!cancelled) {
            setDatasets(response.data?.datasets || []);
            setTotalDatasets(response.data?.totalDatasets || 0);
            setTotalPages(Math.max(1, response.data?.totalPages || 1));
            setWarning(response.data?.warning || '');
          }
        } else {
          const response = await api.get('/datasets/all', {
            params: { limit: 12 },
            signal: controller.signal,
          });
          if (!cancelled) {
            const sectorPages = Object.values(response.data || {});
            const flattened = sectorPages.flatMap((payload) => payload.datasets || []);
            setDatasets(flattened);
            setTotalDatasets(flattened.length);
            setTotalPages(1);
          }
        }
      } catch (loadError) {
        if (loadError?.code === 'ERR_CANCELED' || controller.signal.aborted) return;
        console.error(loadError);
        if (!cancelled) setError(apiErrorMessage(loadError, 'Failed to load datasets.'));
      } finally {
        if (!cancelled && !controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSearch, normalizedSector, domain, currentPage]);

  // Measure page render performance
  useEffect(() => {
    if (!loading) {
      measureRenderTime(() => {
        // This callback measures when React has finished rendering
        return true;
      });
    }
  }, [loading, datasets.length, measureRenderTime]);

  const updatePage = (page) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    const nextParams = {};
    if (activeSearch) nextParams.q = activeSearch;
    if (next > 1) nextParams.page = String(next);
    setSearchParams(nextParams);
  };

  const clearSearch = () => {
    requestAbortRef.current?.abort();
    setSearchQuery('');
    setSearchParams({});
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {normalizedSector && (
          <button onClick={() => navigate('/datasets')} className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-black dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to All Datasets
          </button>
        )}
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white">{activeSearch ? `Search Results: "${activeSearch}"` : normalizedSector ? `${normalizedSector} Datasets` : 'All Datasets'}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Browse datasets available through the backend catalog and live dataset API.</p>
        </div>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const nextParams = {};
              if (searchQuery.trim()) nextParams.q = searchQuery.trim();
              setSearchParams(nextParams);
            }
          }}
          placeholder={t('Search datasets by title, description, organization, or resource ID')}
          className="w-full pl-12 pr-12 py-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
        {(searchQuery || activeSearch) && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label={t('Cancel search')}
            title={t('Clear search')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {warning && <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">{warning}</div>}
      {loading && <div className="rounded-2xl border-2 border-black bg-white px-6 py-3 inline-block" style={{ color: '#0F172A' }}>{t('Loading datasets...')}</div>}
      {error && <div className="text-red-500">{error}</div>}

      {!loading && !error && visibleDatasets.length === 0 && (
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">{t('No datasets found.')}</div>
      )}

      {!loading && !error && visibleDatasets.length > 0 && (
        <>
          <div className="text-sm text-gray-500">{totalDatasets.toLocaleString()} datasets</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleDatasets.map((dataset) => (
              <CatalogCard key={dataset.id} dataset={dataset} onView={() => navigate(`/dataset/${encodeURIComponent(dataset.id)}`, { state: dataset })} />
            ))}
          </div>

          <Pagination page={currentPage} totalPages={totalPages} onPageChange={updatePage} />
        </>
      )}
    </div>
  );
}
