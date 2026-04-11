import { useEffect, useMemo, useState, useContext } from 'react';
import { motion } from 'framer-motion';
import { Eye, Loader2, Bookmark, Map, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import GeoViewModal from './GeoViewModalMap';
import { AuthContext } from '../../context/AuthContext';
import { getCachedData, setCachedData, getCacheKey } from '../../utils/dataCache';

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
    
    try {
      // Check cache first for stats (5 minute TTL)
      const cacheKey = getCacheKey('card-stats', sectorKey, dataset.id);
      const cached = getCachedData(cacheKey);
      if (cached) {
        setViews(cached.views);
        setDownloads(cached.downloads);
        return;
      }
    } catch (cacheError) {
      console.warn('Cache read error:', cacheError);
      // Continue with API call
    }

    // Stagger stats requests with a random delay to avoid 429 rate limits
    // when multiple cards load simultaneously
    const delay = Math.random() * 1500; // 0-1.5s random spread
    const timeoutId = setTimeout(() => {
      api.get(`/datasets/${sectorKey}/${encodedDatasetId}/stats`)
        .then((res) => {
          const viewsCount = res.data?.stats?.views ?? 0;
          const downloadsCount = res.data?.stats?.downloads ?? 0;
          setViews(viewsCount);
          setDownloads(downloadsCount);
          // Cache for 10 minutes
          try {
            setCachedData(cacheKey, { views: viewsCount, downloads: downloadsCount }, 10 * 60 * 1000);
          } catch (cacheError) {
            console.warn('Cache write error:', cacheError);
            // Non-blocking cache error
          }
        })
        .catch(() => {});
    }, delay);
    return () => clearTimeout(timeoutId);
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
      {/* Minimal Bookmark button */}
      <div className="absolute top-5 right-5 z-10">
        <button
          onClick={toggleBookmark}
          className={`group relative p-2 transition-all duration-300 ${
            isBookmarked 
              ? (sectorKey === 'agriculture' ? 'text-emerald-600' :
                 sectorKey === 'census' ? 'text-blue-600' :
                 sectorKey === 'education' ? 'text-purple-600' :
                 sectorKey === 'finance' ? 'text-amber-600' :
                 sectorKey === 'health' ? 'text-rose-600' :
                 sectorKey === 'transport' ? 'text-indigo-600' : 'text-blue-600')
              : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          title={isBookmarked ? t('Remove from Wishlist') : t('Add to Wishlist')}
        >
          {/* Subtle sector-based hover background */}
          <div className={`absolute inset-0 rounded-full opacity-0 transition-opacity group-hover:opacity-10 ${
            sectorKey === 'agriculture' ? 'bg-emerald-600' :
            sectorKey === 'census' ? 'bg-blue-600' :
            sectorKey === 'education' ? 'bg-purple-600' :
            sectorKey === 'finance' ? 'bg-amber-600' :
            sectorKey === 'health' ? 'bg-rose-600' :
            sectorKey === 'transport' ? 'bg-indigo-600' : 'bg-blue-600'
          }`} />
          <Bookmark className={`relative w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isBookmarked ? 'fill-current' : ''}`} />
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
        <div className="rounded-xl border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-gray-900 p-3" style={{ borderWidth: '1px' }}>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Published Date')}</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatDate(dataset.publishedDate)}</div>
        </div>
        <button
          type="button"
          onClick={handleGeoView}
          className="rounded-xl border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          style={{ borderWidth: '1px' }}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Geo View')}</div>
          <div className={`font-semibold flex items-center gap-2 ${
            sectorKey === 'agriculture' ? 'text-emerald-600' :
            (sectorKey === 'census' || sectorKey.includes('surv')) ? 'text-blue-600' :
            sectorKey === 'education' ? 'text-purple-600' :
            sectorKey === 'finance' ? 'text-amber-600' :
            (sectorKey === 'health' || sectorKey.includes('family')) ? 'text-rose-600' :
            sectorKey === 'transport' ? 'text-indigo-600' :
            'text-blue-600'
          }`}>
            {isGeoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
            {t('Dataset Only')}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
        <div className="rounded-xl border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-gray-900 p-3" style={{ borderWidth: '1px' }}>
          <div className="flex items-center gap-2 text-gray-500 mb-1"><Eye className="w-4 h-4" />{t('Views')}</div>
          <div className="font-bold text-green-600 text-lg">{views.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-gray-900 p-3" style={{ borderWidth: '1px' }}>
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
