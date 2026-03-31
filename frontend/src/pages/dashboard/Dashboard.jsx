import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import api from '../../api';
import DomainCard from '../../components/domain/DomainCard';
import Chatbot from '../chatbot/Chatbot';

export default function Dashboard() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

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
    views: domains.reduce((sum, domain) => sum + (domain.views || 0), 0),
    downloads: domains.reduce((sum, domain) => sum + (domain.downloads || 0), 0),
  }), [domains]);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border-2 border-black bg-white dark:bg-gray-950 p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-4xl font-black text-gray-900 dark:text-white">{domains.length}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide mt-1">Domains</div>
          </div>
          <div>
            <div className="text-4xl font-black text-gray-900 dark:text-white">{totals.catalogs}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide mt-1">Catalog Pages</div>
          </div>
          <div>
            <div className="text-4xl font-black text-green-600">{totals.views.toLocaleString()}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide mt-1">Views</div>
          </div>
          <div>
            <div className="text-4xl font-black text-blue-600">{totals.downloads.toLocaleString()}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wide mt-1">Downloads</div>
          </div>
        </div>
      </motion.div>

      <section className="space-y-4">
        <h2 className="text-3xl font-black text-gray-900 dark:text-white">Explore Domains</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {domains.map((domain) => (
            <DomainCard key={domain.sector} domain={domain} onClick={() => navigate(`/domain/${domain.sector}`)} />
          ))}
        </div>
      </section>

      <div className="fixed bottom-6 right-6 z-[60]">
        <button onClick={() => setChatOpen(true)} className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center shadow-2xl">
          <Bot className="w-7 h-7" />
        </button>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl">
            <Chatbot onClose={() => setChatOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

