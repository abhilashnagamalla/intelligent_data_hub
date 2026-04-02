import { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { User, BarChart3, Heart, Eye, Download, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('info');
  const [wishlist, setWishlist] = useState([]);

  const userId = user?.id || 'guest';

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(`wishlist_${userId}`) || '[]');
    setWishlist(stored);
  }, [userId]);

  if (!user) return null;

  const viewedDatasets = JSON.parse(localStorage.getItem('viewed_datasets') || '[]');
  const downloadCounts = JSON.parse(localStorage.getItem('download_counts') || '{}');
  const totalDownloads = Object.values(downloadCounts).reduce((a, b) => a + b, 0);

  const removeFromWishlist = (datasetId) => {
    const key = `wishlist_${userId}`;
    const updated = wishlist.filter((item) => item.id !== datasetId);
    localStorage.setItem(key, JSON.stringify(updated));
    setWishlist(updated);
  };

  const tabs = [
    { id: 'info', label: t('User Info'), icon: User },
    { id: 'analytics', label: t('Analytics'), icon: BarChart3 },
    { id: 'wishlist', label: t('Wishlist'), icon: Heart },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
          {t('My Profile')}
        </h1>
        <p className="text-gray-500 mt-1">{t('Manage your account, view analytics, and access your wishlist.')}</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'wishlist' && wishlist.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full font-bold">{wishlist.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {user.picture ? (
                <img src={user.picture} alt="Profile" className="w-28 h-28 rounded-2xl border-4 border-primary/20 shadow-xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-28 h-28 rounded-2xl border-4 border-primary/20 shadow-xl flex items-center justify-center bg-gradient-to-br from-primary to-accent text-white text-4xl font-black">
                  {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{user.name || 'User'}</h2>
                <p className="text-gray-500 font-medium mt-1">{user.email}</p>
              </div>

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest">
                  Active Researcher
                </span>
                <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-black uppercase tracking-widest">
                  Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Member Since')}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Account ID')}</div>
                  <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{user.id?.substring(0, 12) || 'N/A'}...</div>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('Wishlisted')}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{wishlist.length} {t('datasets')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 border-b-4 border-b-emerald-500 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <Eye className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-black text-xs uppercase tracking-widest text-gray-500">{t('Datasets Explored')}</h3>
              </div>
              <div className="text-4xl font-black text-emerald-600">{viewedDatasets.length}</div>
              <p className="text-xs text-gray-400 mt-2">{t('Unique datasets you\'ve viewed')}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 border-b-4 border-b-blue-500 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Download className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-black text-xs uppercase tracking-widest text-gray-500">{t('Total Downloads')}</h3>
              </div>
              <div className="text-4xl font-black text-blue-600">{totalDownloads}</div>
              <p className="text-xs text-gray-400 mt-2">{t('CSV files you\'ve downloaded')}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-8 border-b-4 border-b-indigo-500 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-indigo-500/10">
                  <Heart className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-black text-xs uppercase tracking-widest text-gray-500">{t('Wishlist Items')}</h3>
              </div>
              <div className="text-4xl font-black text-indigo-600">{wishlist.length}</div>
              <p className="text-xs text-gray-400 mt-2">{t('Datasets saved for later')}</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('Account Status')}</h3>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-bold text-emerald-600 uppercase">{t('Fully Synced')}</span>
              <span className="text-sm text-gray-400">• {t('All data is up to date')}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="space-y-6">
          {wishlist.length === 0 ? (
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-12 text-center shadow-sm">
              <Heart className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('No wishlisted datasets yet')}</h3>
              <p className="text-gray-500 mb-6">{t('Browse datasets and click the bookmark icon to save them here.')}</p>
              <button
                onClick={() => navigate('/datasets')}
                className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                {t('Browse Datasets')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlist.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <h3 className="font-bold text-base text-gray-900 dark:text-white line-clamp-2 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{item.description || 'No description available.'}</p>
                  <div className="text-xs text-gray-400 mb-4">
                    {item.organization && <span>{item.organization}</span>}
                    {item.addedAt && <span className="block mt-1">Saved {new Date(item.addedAt).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/dataset/${encodeURIComponent(item.id)}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('View Details')}
                    </button>
                    <button
                      onClick={() => removeFromWishlist(item.id)}
                      className="px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
