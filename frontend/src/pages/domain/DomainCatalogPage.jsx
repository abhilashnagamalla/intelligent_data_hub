import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../api";
import Pagination from "../../components/common/Pagination";
import DatasetCatalogCard from "../../components/dataset/DatasetCatalogCard";
import { formatSectorLabel } from "../../constants/sectors";
import { indianStates, allStatesOption, getStateName } from "../../constants/states";
import { ChevronDown } from "lucide-react";

export default function DomainCatalogPage() {
  const { sector } = useParams();
  const { t, i18n } = useTranslation();
  const [datasets, setDatasets] = useState([]);
  const [stats, setStats] = useState({ datasets: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState("ALL");

  useEffect(() => {
    setPage(1);
  }, [sector, selectedState]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = { page, limit: 9 };
        if (selectedState && selectedState !== "ALL") {
          params.state = selectedState;
        }

        const datasetsResponse = await api.get(`/datasets/${sector}`, { params });

        if (cancelled) return;

        setStats({
          datasets: datasetsResponse.data?.totalDatasets || 0,
        });
        setDatasets(datasetsResponse.data?.datasets || []);
        setTotalPages(Math.max(1, datasetsResponse.data?.totalPages || 1));
      } catch {
        if (!cancelled) {
          setDatasets([]);
          setStats({ datasets: 0 });
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, sector, selectedState]);

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6 sm:p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Sector overview")}</div>
        <h1 className="mt-3 text-4xl font-bold text-[var(--text-primary)]">{t(formatSectorLabel(sector || ""))}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
          {t("Live sector data refreshed from the backend catalog and summary pipeline.")}
        </p>

        {/* Quick Filter integrated beside catalog and datasets count */}
        <div className="mt-6 grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Catalogs Count */}
          <div className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Catalogs")}</div>
            <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">-</div>
          </div>

          {/* Datasets Count */}
          <div className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Datasets")}</div>
            <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{stats.datasets.toLocaleString()}</div>
          </div>

          {/* Quick Filter Sub Container */}
          <div className="rounded-xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-4 flex flex-col justify-between">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted block mb-3">
              {t("Quick Filter")}
            </label>
            <div className="relative flex-1 flex items-center">
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 pr-10 text-[var(--text-primary)] cursor-pointer hover:border-[var(--brand-primary)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-colors"
              >
                {[allStatesOption, ...indianStates].map((state) => (
                  <option key={state.code} value={state.code}>
                    {getStateName(state.code, i18n.language || "en")}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 h-4 w-4 text-[var(--text-secondary)] pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="text-muted">{t("Loading domain datasets...")}</div>
      ) : datasets.length === 0 ? (
        <div className="surface-card p-8 text-center text-muted">
          {selectedState !== "ALL"
            ? t("No datasets found for the selected state.")
            : t("No datasets found for this sector.")}
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {datasets.map((dataset) => (
              <DatasetCatalogCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
