import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../api';
import CatalogCard from '../../components/dataset/CatalogCardLive';
import { formatSectorLabel } from '../../constants/sectors';

const ITEMS_PER_PAGE = 9;

export default function DomainPage() {
  const { sector } = useParams();
  const navigate = useNavigate();
  const [catalogs, setCatalogs] = useState([]);
  const [stats, setStats] = useState({ catalogs: 0, datasets: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [page, setPage] = useState(1);
  const [warning, setWarning] = useState('');

  const title = formatSectorLabel(sector);

  useEffect(() => {
    setPage(1);
  }, [sector]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setStatsLoading(true);
      try {
        const response = await api.get('/domains');
        if (cancelled) return;
        const domainStats = (response.data || []).find((item) => item.sector === sector) || { catalogs: 0, datasets: 0 };
        setStats({ catalogs: domainStats.catalogs || 0, datasets: domainStats.datasets || 0 });
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setStats({ catalogs: 0, datasets: 0 });
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [sector]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const datasetsResponse = await api.get(`/datasets/${title}`, { params: { page, limit: ITEMS_PER_PAGE } });

        if (cancelled) return;
        const sectorPayload = datasetsResponse.data || {};
        setCatalogs(sectorPayload.datasets || []);
        setStats((current) => ({
          catalogs: current.catalogs || sectorPayload.totalPages || 0,
          datasets: current.datasets || sectorPayload.totalDatasets || 0,
        }));
        setWarning(sectorPayload.warning || '');
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setCatalogs([]);
          setCatalogError('Live sector metadata is temporarily unavailable. Please try again.');
          setWarning('Live sector metadata is temporarily unavailable. Please try again.');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, [page, title]);

  const totalPages = Math.max(1, stats.catalogs || 1);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-black bg-white dark:bg-gray-950 p-6">
        <h1 className="text-4xl font-black text-gray-900 dark:text-white">{title}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-3">Catalog count is based on sector pagination pages, not raw dataset totals.</p>
        <div className="grid grid-cols-2 gap-4 mt-6 max-w-2xl">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Catalogs</div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">
              {statsLoading ? '...' : stats.catalogs.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Datasets</div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">
              {statsLoading ? '...' : stats.datasets.toLocaleString()}
            </div>
          </div>
        </div>
      </motion.div>

      {warning && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          {warning}
        </div>
      )}

      <section className="space-y-6">
        <div className="relative min-h-[320px]">
          {catalogLoading && catalogs.length > 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/75 dark:bg-gray-950/75 backdrop-blur-sm text-gray-600 dark:text-gray-300 font-medium">
              Updating catalogs...
            </div>
          )}

          {!catalogLoading && catalogError && catalogs.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">{catalogError}</div>
          ) : !catalogLoading && catalogs.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">No datasets found for this sector.</div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${catalogLoading ? 'opacity-40' : ''}`}>
              {catalogs.map((catalog) => (
                <CatalogCard key={catalog.id} dataset={catalog} onView={() => navigate(`/dataset/${encodeURIComponent(catalog.id)}`, { state: catalog })} />
              ))}
            </div>
          )}

          {catalogLoading && catalogs.length === 0 && (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">Loading catalogs...</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-gray-500">Page {page} of {totalPages} • {stats.datasets.toLocaleString()} datasets</div>
            <div className="flex gap-2">
              <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || catalogLoading} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Previous</button>
              <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages || catalogLoading} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 disabled:opacity-40 flex items-center gap-2">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
