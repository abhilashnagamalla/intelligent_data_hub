import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Download, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberForLanguage } from '../../utils/dataFormatting';
import api from "../../api";
import { AuthContext } from "../../context/AuthContextFixed";
import { UserDataContext } from "../../context/UserDataContext";
import GeoViewModal from "./GeoViewModalMap";
import { Map, Loader2 } from "lucide-react";

function formatDate(value) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export default function DatasetCatalogCard({ dataset }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, googleLogin } = useContext(AuthContext);
  const { toggleWishlist, isWishlisted } = useContext(UserDataContext);
  const [stats, setStats] = useState({
    views: dataset.views || 0,
    downloads: dataset.downloads || 0,
  });
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [geoRecords, setGeoRecords] = useState([]);

  useEffect(() => {
    if (!dataset?.sectorKey && !dataset?.sector) return undefined;

    let cancelled = false;
    api
      .get(`/datasets/${dataset.sectorKey || dataset.sector}/${encodeURIComponent(dataset.id)}/stats`)
      .then((response) => {
        if (!cancelled) {
          setStats({
            views: response.data?.stats?.views || 0,
            downloads: response.data?.stats?.downloads || 0,
          });
        }
      })
      .catch(() => {});

    const handleEvent = (event) => {
      if (event.detail?.datasetId !== dataset.id) return;
      setStats((current) => ({
        views: event.detail?.views ?? current.views,
        downloads: event.detail?.downloads ?? current.downloads,
      }));
    };

    window.addEventListener("idh:engagement-updated", handleEvent);
    return () => {
      cancelled = true;
      window.removeEventListener("idh:engagement-updated", handleEvent);
    };
  }, [dataset.id, dataset.sector, dataset.sectorKey]);

  const handleGeoView = async (event) => {
    event.stopPropagation();
    setShowGeoModal(true);
    if (geoRecords.length > 0 || isGeoLoading) return;

    setIsGeoLoading(true);
    try {
      const response = await api.get(`/datasets/data/${encodeURIComponent(dataset.id)}`, {
        params: { limit: 500, offset: 0 },
      });
      setGeoRecords(response.data?.records || []);
    } catch (error) {
      console.error("Geo fetch failed", error);
      setGeoRecords([]);
    } finally {
      setIsGeoLoading(false);
    }
  };

  return (
    <article className="surface-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">
            {t("Datasets")}
          </div>
          <h3 className="mt-3 line-clamp-3 text-xl font-bold text-[var(--text-primary)]">{dataset.title}</h3>
        </div>
        <button
          type="button"
          onClick={async (event) => {
            event.stopPropagation();
            if (!user) {
              try {
                await googleLogin({ redirectTo: null });
              } catch {
                return;
              }
            }
            await toggleWishlist(dataset);
          }}
          className={`group relative p-2 transition-all duration-300 ${
            isWishlisted(dataset.id)
              ? (sector.includes('agriculture') ? 'text-emerald-600' :
                 sector.includes('census') ? 'text-blue-600' :
                 sector.includes('education') ? 'text-purple-600' :
                 sector.includes('finance') ? 'text-amber-600' :
                 sector.includes('health') ? 'text-rose-600' :
                 sector.includes('transport') ? 'text-indigo-600' : 'text-blue-600')
              : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          title={isWishlisted(dataset.id) ? t('Remove from Wishlist') : t('Add to Wishlist')}
        >
          {/* Subtle sector-based hover background */}
          <div className={`absolute inset-0 rounded-full opacity-0 transition-opacity group-hover:opacity-10 ${
            sector.includes('agriculture') ? 'bg-emerald-600' :
            sector.includes('census') ? 'bg-blue-600' :
            sector.includes('education') ? 'bg-purple-600' :
            sector.includes('finance') ? 'bg-amber-600' :
            sector.includes('health') ? 'bg-rose-600' :
            sector.includes('transport') ? 'bg-indigo-600' : 'bg-blue-600'
          }`} />
          <Bookmark className={`relative w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isWishlisted(dataset.id) ? "fill-current" : ""}`} />
        </button>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">{dataset.description || t("Metadata")}</p>

      <div className="mt-5 text-sm text-muted">{dataset.organization || t("Government of India")}</div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Published Date")}</div>
          <div className="mt-2 font-semibold text-[var(--text-primary)]">{formatDate(dataset.publishedDate)}</div>
        </div>
        <button
          type="button"
          onClick={handleGeoView}
          className="rounded-lg border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-4 text-left transition-colors hover:bg-[var(--surface-muted)]/60"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Geo View")}</div>
          <div className={`mt-2 font-semibold flex items-center gap-2 ${
            sector.includes('agriculture') ? 'text-emerald-600' :
            (sector.includes('census') || sector.includes('surv')) ? 'text-blue-600' :
            sector.includes('education') ? 'text-purple-600' :
            sector.includes('finance') ? 'text-amber-600' :
            (sector.includes('health') || sector.includes('family')) ? 'text-rose-600' :
            sector.includes('transport') ? 'text-indigo-600' :
            'text-blue-600'
          }`}>
            {isGeoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}
            {t("Dataset Only")}
          </div>
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 flex items-center gap-3 p-4">
          <Eye className="h-4 w-4 text-primary" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Views")}</div>
            <div className="font-semibold text-[var(--text-primary)]">{formatNumberForLanguage(stats.views, i18n.language)}</div>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 flex items-center gap-3 p-4">
          <Download className="h-4 w-4 text-secondary" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Downloads")}</div>
            <div className="font-semibold text-[var(--text-primary)]">{formatNumberForLanguage(stats.downloads, i18n.language)}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/dataset/${encodeURIComponent(dataset.id)}`, { state: dataset })}
        className="btn-primary mt-6 w-full"
      >
        {t("View Details")}
      </button>

      <GeoViewModal
        isOpen={showGeoModal}
        onClose={() => setShowGeoModal(false)}
        dataset={dataset}
        records={geoRecords || []}
        isLoading={isGeoLoading}
      />
    </article>
  );
}
