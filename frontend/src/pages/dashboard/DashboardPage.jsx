import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { formatNumberForLanguage } from "../../utils/dataFormatting";
import DomainOverviewCard from "../../components/domain/DomainOverviewCard";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDomains() {
      setLoading(true);
      try {
        const response = await api.get("/domains");
        if (!cancelled) {
          setDomains(response.data || []);
        }
      } catch {
        if (!cancelled) {
          setDomains([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDomains();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = domains.reduce(
    (accumulator, domain) => ({
      domains: accumulator.domains + 1,
      catalogs: accumulator.catalogs + (domain.catalogs || 0),
      datasets: accumulator.datasets + (domain.datasets || 0),
    }),
    { domains: 0, catalogs: 0, datasets: 0 },
  );

  if (loading) {
    return <div className="surface-panel p-6 text-center text-[var(--text-primary)]">{t("Loading dashboard...")}</div>;
  }

  return (
    <div className="space-y-8">
      <section className="surface-panel p-6 sm:p-8">
        <div className="stat-chip inline-flex bg-primary/10 text-primary">{t("Dashboard")}</div>
        <h1 className="mt-4 text-4xl font-bold text-[var(--text-primary)]">{t("Public sector intelligence")}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
          {t("Move faster from discovery to decision with structured datasets, traceable metadata, and reusable analysis flows.")}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="surface-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Domains")}</div>
            <div className="mt-2 text-4xl font-bold text-[var(--text-primary)]">{totals.domains}</div>
          </div>
          <div className="surface-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Catalog Pages")}</div>
            <div className="mt-2 text-4xl font-bold text-[var(--text-primary)]">{totals.catalogs}</div>
          </div>
          <div className="surface-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Datasets")}</div>
            <div className="mt-2 text-4xl font-bold text-[var(--text-primary)]">{formatNumberForLanguage(totals.datasets, i18n.language)}</div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4 rounded-3xl border-2 border-black bg-white dark:border-white dark:bg-white p-6">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Explore Domains")}</div>
            <h2 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{t("Sector overview")}</h2>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {domains.map((domain) => (
            <DomainOverviewCard
              key={domain.sector}
              domain={domain}
              onClick={() => navigate(`/domain/${domain.sector}`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
