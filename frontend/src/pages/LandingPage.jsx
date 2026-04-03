import { useContext } from "react";
import { ArrowRight, Bookmark, Database, LineChart, Search } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../context/AuthContextFixed";

const featureCards = [
  {
    icon: Database,
    titleKey: "Dataset Explorer",
    textKey: "Browse sector catalogs with consistent metadata, pagination, and direct detail views.",
  },
  {
    icon: Search,
    titleKey: "Public sector intelligence",
    textKey: "Move faster from discovery to decision with structured datasets, traceable metadata, and reusable analysis flows.",
  },
  {
    icon: Bookmark,
    titleKey: "Analyst Profiles",
    textKey: "Keep wishlists, personal analytics, and research activity tied to your account.",
  },
  {
    icon: LineChart,
    titleKey: "Live Views and Downloads",
    textKey: "Track engagement consistently across cards, detail pages, and profile analytics.",
  },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, googleLogin, loading, error, clearError } = useContext(AuthContext);
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const handleGoogleAccess = async () => {
    if (user) {
      navigate(redirectTo);
      return;
    }

    try {
      clearError();
      await googleLogin({ redirectTo });
    } catch {
      // Keep the user on the landing page when the popup is closed or blocked.
    }
  };

  return (
    <div className="app-shell">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
        <nav className="surface-panel flex items-center justify-between px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-lg font-black text-white shadow-lg">
              IDH
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-secondary)]">IDH</div>
              <div className="text-lg font-bold text-[var(--text-primary)]">{t("Intelligent Data Hub")}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/datasets" className="btn-secondary">
              {t("All Datasets")}
            </Link>
            <button
              type="button"
              onClick={handleGoogleAccess}
              disabled={loading}
              className="btn-primary shadow-none hover:brightness-100 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {user ? t("Open Dashboard") : t("Continue with Google")}
            </button>
          </div>
        </nav>

        <section className="grid gap-8 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="stat-chip inline-flex bg-primary/10 text-primary">
              {t("Built for public-sector data work")}
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.02] text-[var(--text-primary)] sm:text-6xl lg:text-7xl">
              {t("Intelligent Data Hub")}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted sm:text-xl">
              {t("Explore 100+ datasets with structured metadata, live previews, and realistic analytics for every research session.")}
            </p>

            {error && (
              <div className="mt-6 max-w-2xl rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleGoogleAccess}
                disabled={loading}
                className="btn-primary px-6 py-4 shadow-none hover:brightness-100 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {user ? t("Open Dashboard") : t("Continue with Google")}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link to="/datasets" className="btn-secondary px-6 py-4">
                {t("All Datasets")}
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: t("100+ datasets"), value: "100+" },
                { label: t("6 live sectors"), value: "06" },
                { label: t("Actionable metadata"), value: "24/7" },
              ].map((item) => (
                <div key={item.label} className="surface-card p-5">
                  <div className="text-3xl font-bold text-[var(--text-primary)]">{item.value}</div>
                  <div className="mt-2 text-sm text-muted">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel overflow-hidden p-6 sm:p-8">
            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(11,99,206,0.12),rgba(15,118,110,0.08))] p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand-secondary)]">
                {t("Public sector intelligence")}
              </div>
              <h2 className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
                {t("Move faster from discovery to decision with structured datasets, traceable metadata, and reusable analysis flows.")}
              </h2>
              <div className="mt-8 grid gap-4">
                {featureCards.map((card) => (
                  <div key={card.titleKey} className="surface-card p-5">
                    <card.icon className="h-6 w-6 text-primary" />
                    <div className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{t(card.titleKey)}</div>
                    <div className="mt-2 text-sm leading-6 text-muted">{t(card.textKey)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
