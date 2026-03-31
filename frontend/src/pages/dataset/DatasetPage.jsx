import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../api';
import CatalogCard from '../../components/dataset/CatalogCard';
import { formatSectorLabel } from '../../constants/sectors';

const ITEMS_PER_PAGE = 50;

function apiErrorMessage(error, fallback) {
  if (error?.response?.status === 502) {
    return 'Data.gov.in is temporarily unavailable. Please try again shortly.';
  }
  return fallback;
}

export default function DatasetPage() {
  const { domain } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [totalPages, setTotalPages] = useState(1);
  const [totalDatasets, setTotalDatasets] = useState(0);

  const currentPage = Number(searchParams.get('page') || 1);
  const activeSearch = (searchParams.get('q') || searchQuery || '').trim();
  const normalizedSector = domain ? formatSectorLabel(domain) : '';
  const visibleDatasets = activeSearch ? datasets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE) : datasets;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setWarning('');
      try {
        if (activeSearch) {
          const response = await api.get('/datasets/search', { params: { q: activeSearch, sector: domain || undefined } });
          if (!cancelled) {
            const results = response.data || [];
            setDatasets(results);
            setTotalDatasets(results.length);
            setTotalPages(Math.max(1, Math.ceil(results.length / ITEMS_PER_PAGE)));
          }
        } else if (normalizedSector) {
          const response = await api.get(`/datasets/${normalizedSector}`, { params: { page: currentPage, limit: ITEMS_PER_PAGE } });
          if (!cancelled) {
            setDatasets(response.data?.datasets || []);
            setTotalDatasets(response.data?.totalDatasets || 0);
            setTotalPages(Math.max(1, response.data?.totalPages || 1));
            setWarning(response.data?.warning || '');
          }
        } else {
          const response = await api.get('/datasets/all', { params: { limit: 12 } });
          if (!cancelled) {
            const sectorPages = Object.values(response.data || {});
            const flattened = sectorPages.flatMap((payload) => payload.datasets || []);
            setDatasets(flattened);
            setTotalDatasets(flattened.length);
            setTotalPages(1);
          }
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setError(apiErrorMessage(loadError, 'Failed to load datasets.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeSearch, normalizedSector, domain, currentPage]);

  const updatePage = (page) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    const nextParams = {};
    if (activeSearch) nextParams.q = activeSearch;
    if (next > 1) nextParams.page = String(next);
    setSearchParams(nextParams);
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
          placeholder="Search datasets by title, description, organization, or resource ID"
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
        />
      </div>

      {warning && <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">{warning}</div>}
      {loading && <div className="text-gray-500">Loading datasets...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {!loading && !error && visibleDatasets.length === 0 && (
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">No datasets found.</div>
      )}

      {!loading && !error && visibleDatasets.length > 0 && (
        <>
          <div className="text-sm text-gray-500">{totalDatasets.toLocaleString()} datasets</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleDatasets.map((dataset) => (
              <CatalogCard key={dataset.id} dataset={dataset} onView={() => navigate(`/dataset/${encodeURIComponent(dataset.id)}`, { state: dataset })} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-500">Page {currentPage} of {totalPages}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => updatePage(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button onClick={() => updatePage(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
