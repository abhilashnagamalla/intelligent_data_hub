import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import Pagination from "../../components/common/Pagination";
import DatasetCatalogCard from "../../components/dataset/DatasetCatalogCard";
import { formatSectorLabel } from "../../constants/sectors";

const ITEMS_PER_PAGE = 18;

export default function DatasetCatalogPage() {
  const { domain } = useParams();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [datasets, setDatasets] = useState([]);
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const activeQuery = (searchParams.get("q") || "").trim();

  useEffect(() => {
    setPage(Number(searchParams.get("page") || 1));
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadDatasets() {
      setLoading(true);
      try {
        if (activeQuery) {
          const response = await api.get("/datasets/search", { params: { q: activeQuery, sector: domain } });
          if (!cancelled) {
            const results = response.data || [];
            setDatasets(results.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE));
            setTotalPages(Math.max(1, Math.ceil(results.length / ITEMS_PER_PAGE)));
          }
          return;
        }

        if (domain) {
          const response = await api.get(`/datasets/${domain}`, { params: { page, limit: 9 } });
          if (!cancelled) {
            setDatasets(response.data?.datasets || []);
            setTotalPages(Math.max(1, response.data?.totalPages || 1));
          }
          return;
        }

        const response = await api.get("/datasets/all", { params: { limit: 12 } });
        if (!cancelled) {
          const grouped = Object.values(response.data || {});
          const flat = grouped.flatMap((group) => group.datasets || []);
          setDatasets(flat);
          setTotalPages(1);
        }
      } catch {
        if (!cancelled) {
          setDatasets([]);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDatasets();
    return () => {
      cancelled = true;
    };
  }, [activeQuery, domain, page]);

  const heading = activeQuery
    ? `${t("Search Results")}: "${activeQuery}"`
    : domain
      ? t(formatSectorLabel(domain))
      : t("All Datasets");

  const submitSearch = () => {
    const next = {};
    if (query.trim()) next.q = query.trim();
    setSearchParams(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6 sm:p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Datasets")}</div>
        <h1 className="mt-3 text-4xl font-bold text-[var(--text-primary)]">{heading}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
          {t("Browse sector catalogs with consistent metadata, pagination, and direct detail views.")}
        </p>
        <div className="relative mt-6 max-w-3xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitSearch();
              }
            }}
            placeholder={t("Search datasets by title, description, organization, or resource ID")}
            className="input-control pl-11 pr-28"
          />
          <button type="button" onClick={submitSearch} className="btn-primary absolute bottom-2 right-2 top-2 px-4">
            {t("Search")}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="text-muted">{t("Loading datasets...")}</div>
      ) : datasets.length === 0 ? (
        <div className="surface-card p-8 text-center text-muted">{t("No datasets found.")}</div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {datasets.map((dataset) => (
              <DatasetCatalogCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(nextPage) => {
            setPage(nextPage);
            const nextParams = {};
            if (activeQuery) nextParams.q = activeQuery;
            if (nextPage > 1) nextParams.page = String(nextPage);
            setSearchParams(nextParams);
          }} />
        </>
      )}
    </div>
  );
}
