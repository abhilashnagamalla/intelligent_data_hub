import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Download, Eye, User2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContextFixed";
import { UserDataContext } from "../../context/UserDataContext";

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { analytics, wishlist, loading, toggleWishlist } = useContext(UserDataContext);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <section className="surface-panel p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="surface-card p-6">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-secondary text-2xl font-bold text-white">
              {user.name?.charAt(0)?.toUpperCase() || <User2 className="h-6 w-6" />}
            </div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("User Info")}</div>
            <h1 className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{user.name}</h1>
            <p className="mt-2 text-muted">{user.email}</p>
          </div>

          <div className="surface-card p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Research Analytics")}</div>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              {t("Structured access to your saved datasets and account activity.")}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="surface-muted p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Bookmark className="h-4 w-4" />
                  {t("Datasets Explored")}
                </div>
                <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  {(analytics.datasetsExplored || 0).toLocaleString()}
                </div>
              </div>
              <div className="surface-muted p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Download className="h-4 w-4" />
                  {t("Total Downloads")}
                </div>
                <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  {(analytics.totalDownloads || 0).toLocaleString()}
                </div>
              </div>
              <div className="surface-muted p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Eye className="h-4 w-4" />
                  {t("Total Views")}
                </div>
                <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                  {(analytics.totalViews || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel p-6 sm:p-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Wishlist")}</div>
            <h2 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{t("Saved datasets")}</h2>
            <p className="mt-2 text-muted">{t("Wishlist items appear here once you save datasets from the catalog.")}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-muted">{t("Loading datasets...")}</div>
        ) : wishlist.length === 0 ? (
          <div className="surface-card p-8 text-center text-muted">{t("No saved datasets yet.")}</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {wishlist.map((dataset) => (
              <div key={dataset.id} className="surface-card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
                  {t("Wishlist")}
                </div>
                <h3 className="mt-4 text-xl font-bold text-[var(--text-primary)]">{dataset.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{dataset.description}</p>
                <div className="mt-4 text-sm text-muted">
                  {t("Added on")}: {new Date(dataset.addedAt).toLocaleDateString()}
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/dataset/${encodeURIComponent(dataset.id)}`, { state: dataset })}
                    className="btn-primary flex-1"
                  >
                    {t("View Details")}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(dataset)}
                    className="btn-secondary"
                  >
                    {t("Remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
