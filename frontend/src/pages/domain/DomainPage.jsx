import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import CatalogCard from '../../components/dataset/CatalogCardLive';
import { formatSectorLabel } from '../../constants/sectors';

const ITEMS_PER_PAGE = 9;

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
      <div className="text-sm text-gray-500">{t('Page')} {page} {t('of')} {totalPages}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1 || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="First">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1 || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="Previous">
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

        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="Next">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages || disabled} className={`${btnBase} border border-gray-200 dark:border-gray-800`} title="Last">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

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
  const { t } = useTranslation();

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
        <h1 className="text-4xl font-black text-gray-900 dark:text-white">{t(title)}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-3">{t('Catalog count is based on sector pagination pages, not raw dataset totals.')}</p>
        <div className="grid grid-cols-2 gap-4 mt-6 max-w-2xl">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('Catalogs')}</div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">
              {statsLoading ? '...' : stats.catalogs.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('Datasets')}</div>
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
              {t('Updating catalogs...')}
            </div>
          )}

          {!catalogLoading && catalogError && catalogs.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">{t(catalogError)}</div>
          ) : !catalogLoading && catalogs.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">{t('No datasets found for this sector.')}</div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${catalogLoading ? 'opacity-40' : ''}`}>
              {catalogs.map((catalog) => (
                <CatalogCard key={catalog.id} dataset={catalog} onView={() => navigate(`/dataset/${encodeURIComponent(catalog.id)}`, { state: catalog })} />
              ))}
            </div>
          )}

          {catalogLoading && catalogs.length === 0 && (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500">{t('Loading catalogs...')}</div>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(p) => setPage(Math.min(Math.max(p, 1), totalPages))}
          disabled={catalogLoading}
        />
      </section>
    </div>
  );
}
