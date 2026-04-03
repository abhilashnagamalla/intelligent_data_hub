import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Download, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { AuthContext } from "../../context/AuthContextFixed";
import { UserDataContext } from "../../context/UserDataContext";

function formatDate(value) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export default function DatasetCatalogCard({ dataset }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, googleLogin } = useContext(AuthContext);
  const { toggleWishlist, isWishlisted } = useContext(UserDataContext);
  const [stats, setStats] = useState({
    views: dataset.views || 0,
    downloads: dataset.downloads || 0,
  });

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
          onClick={async () => {
            if (!user) {
              try {
                await googleLogin({ redirectTo: null });
              } catch {
                return;
              }
            }
            await toggleWishlist(dataset);
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${
            isWishlisted(dataset.id)
              ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/40"
              : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isWishlisted(dataset.id) ? "fill-current" : ""}`} />
        </button>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">{dataset.description || t("Metadata")}</p>

      <div className="mt-5 text-sm text-muted">{dataset.organization || t("Government of India")}</div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="surface-muted p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Published Date")}</div>
          <div className="mt-2 font-semibold text-[var(--text-primary)]">{formatDate(dataset.publishedDate)}</div>
        </div>
        <div className="surface-muted p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Rows")}</div>
          <div className="mt-2 font-semibold text-[var(--text-primary)]">{(dataset.numberOfRows || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="surface-muted flex items-center gap-3 p-4">
          <Eye className="h-4 w-4 text-primary" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Views")}</div>
            <div className="font-semibold text-[var(--text-primary)]">{stats.views.toLocaleString()}</div>
          </div>
        </div>
        <div className="surface-muted flex items-center gap-3 p-4">
          <Download className="h-4 w-4 text-secondary" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Downloads")}</div>
            <div className="font-semibold text-[var(--text-primary)]">{stats.downloads.toLocaleString()}</div>
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
    </article>
  );
}
