import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import BackgroundFrame from '../../components/common/BackgroundFrame';
import DomainCard from '../../components/domain/DomainCard';
import { overviewPageBackground } from '../../constants/backgrounds';
import { getCachedData, setCachedData } from '../../utils/dataCache';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      
      try {
        // Check cache first for 20 minutes
        const cached = getCachedData('dashboard:domains');
        if (cached) {
          setDomains(cached);
          setLoading(false);
          return;
        }

        const response = await api.get('/domains');
        if (!cancelled) {
          const data = response.data || [];
          setDomains(data);
          // Cache for 20 minutes
          setCachedData('dashboard:domains', data, 20 * 60 * 1000);
        }
      } catch (error) {
        console.error('Dashboard load error:', error);
        if (!cancelled) setDomains([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => ({
    datasets: domains.reduce((sum, domain) => sum + (domain.datasets || 0), 0),
    catalogs: domains.reduce((sum, domain) => sum + (domain.catalogs || 0), 0),
  }), [domains]);

  if (loading) {
    return (
      <BackgroundFrame
        imageSrc={overviewPageBackground}
        className="min-h-[calc(100vh-9rem)]"
        contentClassName="flex min-h-[calc(100vh-9rem)] items-center justify-center"
      >
        <div className="rounded-2xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-6" style={{ color: '#0F172A' }}>{t('Loading dashboard...')}</div>
      </BackgroundFrame>
    );
  }

  return (
    <BackgroundFrame
      imageSrc={overviewPageBackground}
      className="min-h-[calc(100vh-9rem)]"
      contentClassName="space-y-8 p-4 sm:p-6 lg:p-8"
    >
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-white bg-black/28 p-8 dark:border-white dark:bg-gray-950/92">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-4xl font-black text-white">{domains.length}</div>
              <div className="mt-1 text-sm uppercase tracking-wide text-white/90">{t('Domains')}</div>
            </div>
            <div>
              <div className="text-4xl font-black text-white">{totals.catalogs}</div>
              <div className="mt-1 text-sm uppercase tracking-wide text-white/90">{t('Catalog Pages')}</div>
            </div>
            <div>
              <div className="text-4xl font-black text-white">{totals.datasets}</div>
              <div className="mt-1 text-sm uppercase tracking-wide text-white/90">{t('Datasets')}</div>
            </div>
          </div>
        </motion.div>

        <section className="space-y-4">
          <h2 className="rounded-2xl border-2 border-white bg-black/28 p-4 text-3xl font-black text-white dark:border-white dark:bg-gray-950/92 dark:text-white">{t('Explore Domains')}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {domains.map((domain) => (
              <DomainCard key={domain.sector} domain={domain} onClick={() => navigate(`/domain/${domain.sector}`)} />
            ))}
          </div>
        </section>
      </div>
    </BackgroundFrame>
  );
}
