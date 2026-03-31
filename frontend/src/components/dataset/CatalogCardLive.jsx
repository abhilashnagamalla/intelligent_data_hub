import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Eye, Loader2, Bookmark, Share2, Copy, Check, Map } from 'lucide-react';
import api from '../../api';
import GeoViewModal from './GeoViewModalMap';
import useEngagement from '../../hooks/useEngagement';

function formatDate(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CatalogCardLive({ dataset, onView }) {
  const [views, setViews] = useState(dataset.views ?? 0);
  const [downloads, setDownloads] = useState(dataset.downloads ?? 0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [geoRecords, setGeoRecords] = useState([]);
  const { trackDownload } = useEngagement();

  const encodedDatasetId = useMemo(() => encodeURIComponent(dataset.id || ''), [dataset.id]);

  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    setIsBookmarked(bookmarks.includes(dataset.id));
  }, [dataset.id]);

  useEffect(() => {
    if (!dataset.sector || !dataset.id) return;
    api.get(`/datasets/${dataset.sector}/${encodedDatasetId}/stats`)
      .then((res) => {
        setViews(res.data?.stats?.views ?? 0);
        setDownloads(res.data?.stats?.downloads ?? 0);
      })
      .catch(() => {});
  }, [dataset.sector, dataset.id, encodedDatasetId]);

  const toggleBookmark = (event) => {
    event.stopPropagation();
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const updated = bookmarks.includes(dataset.id)
      ? bookmarks.filter((id) => id !== dataset.id)
      : [...bookmarks, dataset.id];
    localStorage.setItem('bookmarks', JSON.stringify(updated));
    setIsBookmarked(updated.includes(dataset.id));
  };

  const handleShare = (event) => {
    event.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/dataset/${encodedDatasetId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  const handleDownload = async (event) => {
    event.stopPropagation();
    if (isDownloading || !dataset.sector || !dataset.id) return;
    setIsDownloading(true);

    try {
      const engagement = await trackDownload(dataset.id, dataset.sector);
      setDownloads(engagement?.downloads ?? (downloads + 1));

      const response = await api.get(`/datasets/${dataset.sector}/${encodedDatasetId}/raw`, {
        params: { full: true },
        responseType: 'blob',
      });

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${(dataset.title || dataset.id || 'dataset').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed', error);
    } finally {
      setIsDownloading(false);
    }
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
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10 bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-300 dark:border-gray-700 shadow-sm">
        <button onClick={toggleBookmark} className={`p-2 rounded-lg transition-all ${isBookmarked ? 'bg-amber-100 text-amber-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>

        <div className="relative">
          <button onClick={(event) => { event.stopPropagation(); setShowShareMenu((value) => !value); }} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <Share2 className="w-4 h-4" />
          </button>
          {showShareMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button onClick={handleShare} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Link Copied' : 'Copy Link'}
              </button>
            </div>
          )}
        </div>

        <button onClick={handleDownload} disabled={isDownloading} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-40" title="Download CSV">
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
      </div>

      <div className="pr-24 mb-5">
        <h3 className="font-bold text-lg leading-tight text-gray-900 dark:text-white line-clamp-3">{dataset.title}</h3>
      </div>

      <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300 mb-6 flex-1">
        <div className="font-semibold text-gray-800 dark:text-gray-200">{dataset.organization || 'Government of India'}</div>
        <div className="line-clamp-3">{dataset.description || 'Dataset metadata available from the backend catalog.'}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Published Date</div>
          <div className="font-semibold text-gray-900 dark:text-white">{formatDate(dataset.publishedDate)}</div>
        </div>
        <button
          type="button"
          onClick={handleGeoView}
          className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-900 text-left hover:border-black dark:hover:border-white transition-colors"
        >
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Geo View</div>
          <div className="font-semibold text-emerald-600 flex items-center gap-2">
            {isGeoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
            Dataset Only
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1"><Eye className="w-4 h-4" />Views</div>
          <div className="font-bold text-green-600 text-lg">{views.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1"><Download className="w-4 h-4" />Downloads</div>
          <div className="font-bold text-blue-600 text-lg">{downloads.toLocaleString()}</div>
        </div>
      </div>

      <button onClick={() => onView(dataset)} className="w-full bg-black text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-gray-800 transition-colors">
        View Details
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

