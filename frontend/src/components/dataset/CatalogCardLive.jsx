import { useEffect, useMemo, useState, useContext } from 'react';
import { motion } from 'framer-motion';
import { Eye, Loader2, Bookmark, Map, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GeoViewModal from './GeoViewModalMap';
import { AuthContext } from '../../context/AuthContext';

function formatDate(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CatalogCardLive({ dataset, onView }) {
  const [views, setViews] = useState(dataset.views ?? 0);
  const [downloads, setDownloads] = useState(dataset.downloads ?? 0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [geoRecords, setGeoRecords] = useState([]);
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();

  const encodedDatasetId = useMemo(() => encodeURIComponent(dataset.id || ''), [dataset.id]);

  useEffect(() => {
    const userId = user?.id || 'guest';
    const bookmarks = JSON.parse(localStorage.getItem(`wishlist_${userId}`) || '[]');
    setIsBookmarked(bookmarks.some((item) => item.id === dataset.id));
  }, [dataset.id, user]);

  const sectorKey = dataset.sectorKey || dataset.sector?.toLowerCase() || '';

  useEffect(() => {
    if (!sectorKey || !dataset.id) return;
    api.get(`/datasets/${sectorKey}/${encodedDatasetId}/stats`)
      .then((res) => {
        setViews(res.data?.stats?.views ?? 0);
        setDownloads(res.data?.stats?.downloads ?? 0);
      })
      .catch(() => {});
  }, [sectorKey, dataset.id, encodedDatasetId]);

  const toggleBookmark = (event) => {
    event.stopPropagation();
    const userId = user?.id || 'guest';
    const key = `wishlist_${userId}`;
    const bookmarks = JSON.parse(localStorage.getItem(key) || '[]');
    const exists = bookmarks.some((item) => item.id === dataset.id);
    let updated;
    if (exists) {
      updated = bookmarks.filter((item) => item.id !== dataset.id);
    } else {
      updated = [...bookmarks, {
        id: dataset.id,
        title: dataset.title,
        description: dataset.description,
        organization: dataset.organization,
        sector: dataset.sector || dataset.sectorKey,
        publishedDate: dataset.publishedDate,
        addedAt: new Date().toISOString(),
      }];
    }
    localStorage.setItem(key, JSON.stringify(updated));
    setIsBookmarked(!exists);
  };

  const handleGeoView = async (event) => {
    event.stopPropagation();
    setShowGeoModal(true);
    if (geoRecords.length > 0 || isGeoLoading) return;

    setIsGeoLoading(true);
    try {
      const response = await api.get(`/datasets/data/${encodedDatasetId}`, { params: { limit: 500, offset: 0 } });
      setGeoRecords(response.data?.records || []);
    } catch (error) {
      console.error('Geo fetch failed', error);
      setGeoRecords([]);
    } finally {
      setIsGeoLoading(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
className="bg-white dark:bg-gray-950 rounded-2xl p-6 shadow-md hover:shadow-xl border-2 border-black h-full flex flex-col relative"
    >
      {/* Bookmark button only */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={toggleBookmark} className={`rounded-xl border-2 border-black p-2 transition-all ${isBookmarked ? 'bg-amber-100 text-amber-600' : 'bg-white text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800'}`} title={isBookmarked ? 'Remove from Wishlist' : 'Add to Wishlist'}>
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="pr-16 mb-5">
        <h3 className="font-bold text-lg leading-tight text-gray-900 dark:text-white line-clamp-3">{dataset.title}</h3>
      </div>

      <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 mb-6 flex-1">
        <div className="font-semibold text-gray-800 dark:text-gray-200">{dataset.organization || 'Government of India'}</div>
        <div className="line-clamp-3">{dataset.description || 'Dataset metadata available from the backend catalog.'}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Published Date')}</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatDate(dataset.publishedDate)}</div>
        </div>
        <button
          type="button"
          onClick={handleGeoView}
          className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-3 text-left transition-colors hover:bg-[var(--surface-muted)]/60"
        >
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Geo View')}</div>
          <div className="font-semibold text-emerald-600 flex items-center gap-2">
            {isGeoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
            {t('Dataset Only')}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
        <div className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1"><Eye className="w-4 h-4" />{t('Views')}</div>
          <div className="font-bold text-green-600 text-lg">{views.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1"><Download className="w-4 h-4" />{t('Downloads')}</div>
          <div className="font-bold text-blue-600 text-lg">{downloads.toLocaleString()}</div>
        </div>
      </div>

      <button onClick={() => onView(dataset)} className="w-full bg-black text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-gray-800 transition-colors">
        {t('View Details')}
      </button>

      <GeoViewModal
        isOpen={showGeoModal}
        onClose={() => setShowGeoModal(false)}
        dataset={dataset}
        records={geoRecords}
        isLoading={isGeoLoading}
      />
    </motion.div>
  );
}
