import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import DomainCard from '../../components/domain/DomainCard';

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
        const response = await api.get('/domains');
        if (!cancelled) setDomains(response.data || []);
      } catch (error) {
        console.error(error);
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

  if (loading) return <div className="text-gray-500">{t('Loading dashboard...')}</div>;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-black bg-white dark:bg-gray-950 p-8">
        <div className="grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="text-4xl font-black text-gray-900 dark:text-white">{domains.length}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide mt-1">{t('Domains')}</div>
          </div>
          <div>
            <div className="text-4xl font-black text-gray-900 dark:text-white">{totals.catalogs}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide mt-1">{t('Catalog Pages')}</div>
          </div>
        </div>
      </motion.div>

      <section className="space-y-4">
        <h2 className="text-3xl font-black text-gray-900 dark:text-white">{t('Explore Domains')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {domains.map((domain) => (
            <DomainCard key={domain.sector} domain={domain} onClick={() => navigate(`/domain/${domain.sector}`)} />
          ))}
        </div>
      </section>
    </div>
  );
}
