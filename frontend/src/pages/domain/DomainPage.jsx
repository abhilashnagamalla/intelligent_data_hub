import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import Pagination from '../../components/common/Pagination';
import CatalogCard from '../../components/dataset/CatalogCardLive';
import { formatSectorLabel } from '../../constants/sectors';
import { allStatesOption, getStateName, indianStates } from '../../constants/states';

const ITEMS_PER_PAGE = 9;

export default function DomainPage() {
  const { sector } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [catalogs, setCatalogs] = useState([]);
  const [stats, setStats] = useState({ catalogs: 0, datasets: 0 });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [page, setPage] = useState(1);
  const [warning, setWarning] = useState('');
  const [selectedState, setSelectedState] = useState(allStatesOption.code);

  const title = formatSectorLabel(sector || '');
  const languageCode = useMemo(
    () => (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0],
    [i18n.language, i18n.resolvedLanguage],
  );
  const stateOptions = useMemo(() => [allStatesOption, ...indianStates], []);
  const hasActiveStateFilter = selectedState !== allStatesOption.code;
  const selectedStateLabel = useMemo(
    () => getStateName(selectedState, languageCode),
    [languageCode, selectedState],
  );

  useEffect(() => {
    setPage(1);
  }, [sector, selectedState]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      setCatalogLoading(true);
      setCatalogError('');
      setWarning('');

      try {
        const params = { page, limit: ITEMS_PER_PAGE };
        if (hasActiveStateFilter) {
          params.state = selectedState;
        }

        const response = await api.get(`/datasets/${sector}`, { params });

        if (cancelled) return;

        const payload = response.data || {};
        setCatalogs(payload.datasets || []);
        setStats({
          catalogs: payload.totalPages || 0,
          datasets: payload.totalDatasets || 0,
        });
        setWarning(payload.warning || '');
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setCatalogs([]);
          setStats({ catalogs: 0, datasets: 0 });
          setCatalogError('Live sector metadata is temporarily unavailable. Please try again.');
          setWarning('Live sector metadata is temporarily unavailable. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    }

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, [hasActiveStateFilter, page, sector, selectedState]);

  const totalPages = Math.max(1, stats.catalogs || 0);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border-2 border-black bg-white p-6 dark:bg-gray-950"
      >
        <h1 className="text-4xl font-black text-gray-900 dark:text-white">{t(title)}</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          {t('Catalog count is based on sector pagination pages, not raw dataset totals.')}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:max-w-5xl">
          <div className="rounded-2xl border-2 border-black p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('Catalogs')}</div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">
              {catalogLoading ? '...' : stats.catalogs.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-black p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('Datasets')}</div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">
              {catalogLoading ? '...' : stats.datasets.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-black p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{t('Quick Filters')}</div>
            <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{t('State')}</div>

            <div className="relative mt-3">
              <select
                value={selectedState}
                onChange={(event) => setSelectedState(event.target.value)}
                className="w-full appearance-none rounded-xl border-2 border-black bg-gray-50 px-4 py-3 pr-10 text-sm font-medium text-gray-900 outline-none transition focus:border-black dark:bg-gray-900 dark:text-white"
              >
                {stateOptions.map((state) => (
                  <option key={state.code} value={state.code}>
                    {getStateName(state.code, languageCode)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>

            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {t('State')}: {selectedStateLabel}
            </div>
          </div>
        </div>
      </motion.div>

      {warning && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </div>
      )}

      <section className="space-y-6">
        <div className="relative min-h-[320px]">
          {catalogLoading && catalogs.length > 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/75 text-gray-600 backdrop-blur-sm dark:bg-gray-950/75 dark:text-gray-300">
              {t('Updating catalogs...')}
            </div>
          )}

          {!catalogLoading && catalogError && catalogs.length === 0 ? (
            <div className="rounded-3xl border-2 border-black p-10 text-center text-gray-500">
              {t(catalogError)}
            </div>
          ) : !catalogLoading && catalogs.length === 0 ? (
            <div className="rounded-3xl border-2 border-black p-10 text-center text-gray-500">
              {hasActiveStateFilter
                ? `${t('No datasets found for this sector.')} ${t('State')}: ${selectedStateLabel}`
                : t('No datasets found for this sector.')}
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 ${catalogLoading ? 'opacity-40' : ''}`}>
              {catalogs.map((catalog) => (
                <CatalogCard
                  key={catalog.id}
                  dataset={catalog}
                  onView={() => navigate(`/dataset/${encodeURIComponent(catalog.id)}`, { state: catalog })}
                />
              ))}
            </div>
          )}

          {catalogLoading && catalogs.length === 0 && (
            <div className="rounded-3xl border-2 border-black p-10 text-center text-gray-500">
              {t('Loading catalogs...')}
            </div>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
          className={catalogLoading ? 'pointer-events-none opacity-60' : ''}
        />
      </section>
    </div>
  );
}
