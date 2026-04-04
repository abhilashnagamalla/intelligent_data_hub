import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BarChart3, Bookmark, Download, Eye, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import Pagination from "../../components/common/Pagination";
import DatasetMeta from "../../components/dataset/DatasetMeta";
import DatasetVisualizer from "../../components/dataset/DatasetVisualizerFixed";
import useEngagement from "../../hooks/useEngagement";
import { AuthContext } from "../../context/AuthContextFixed";
import { UserDataContext } from "../../context/UserDataContext";
import GeoViewModal from "../../components/dataset/GeoViewModalMap";
import { Map, Loader2 } from "lucide-react";

const PAGE_SIZE = 250;

function csvPreview(records, columns) {
  if (!records.length || !columns.length) return "";
  return [columns.join(","), ...records.map((record) => columns.map((column) => record[column] ?? "").join(","))].join("\n");
}

export default function DatasetDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const trackedRef = useRef(false);
  const { trackView, trackDownload } = useEngagement();
  const { user, googleLogin } = useContext(AuthContext);
  const { toggleWishlist, isWishlisted } = useContext(UserDataContext);

  const [dataset, setDataset] = useState(location.state || null);
  const [sector, setSector] = useState(location.state?.sectorKey || location.state?.sector || "");
  const [stats, setStats] = useState(location.state || null);
  const [activeView, setActiveView] = useState("table");
  const [page, setPage] = useState(1);
  const [tableState, setTableState] = useState({ records: [], columns: [], totalPages: 1 });
  const [visualization, setVisualization] = useState({ loading: false, data: null });
  const [loading, setLoading] = useState(true);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [geoRecords, setGeoRecords] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      setLoading(true);
      try {
        const response = await api.get(`/datasets/by-id/${encodeURIComponent(id)}`);
        if (cancelled) return;

        setDataset(response.data?.dataset || null);
        setSector(response.data?.sector || "");
        setStats(response.data?.dataset || null);
      } catch {
        if (!cancelled) {
          setDataset(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDataset();
    return () => {
      cancelled = true;
      trackedRef.current = false;
    };
  }, [id]);

  useEffect(() => {
    if (!dataset || !sector || trackedRef.current) return;

    trackedRef.current = true;
    trackView(dataset.id, sector).then((response) => {
      if (response) {
        setStats((current) => ({ ...(current || {}), ...response }));
      }
    }).catch(() => {});
  }, [dataset, sector, trackView]);

  useEffect(() => {
    if (!dataset) return undefined;

    let cancelled = false;
    api
      .get(`/datasets/data/${encodeURIComponent(dataset.id)}`, {
        params: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      })
      .then((response) => {
        if (!cancelled) {
          setTableState({
            records: response.data?.records || [],
            columns: response.data?.columns || [],
            totalPages: response.data?.totalPages || 1,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTableState({ records: [], columns: [], totalPages: 1 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, page]);

  useEffect(() => {
    if (!dataset || !sector || activeView !== "viz") return undefined;

    let cancelled = false;
    setVisualization({ loading: true, data: null });
    api
      .get(`/datasets/${sector}/${encodeURIComponent(dataset.id)}`)
      .then((response) => {
        if (!cancelled) {
          setVisualization({ loading: false, data: response.data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisualization({ loading: false, data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, dataset, sector]);

  useEffect(() => {
    const handleEvent = (event) => {
      if (event.detail?.datasetId !== dataset?.id) return;
      setStats((current) => ({
        ...(current || {}),
        views: event.detail?.views ?? current?.views,
        downloads: event.detail?.downloads ?? current?.downloads,
      }));
    };

    window.addEventListener("idh:engagement-updated", handleEvent);
    return () => {
      window.removeEventListener("idh:engagement-updated", handleEvent);
    };
  }, [dataset?.id]);

  const handleGeoView = async () => {
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

  const rawPreview = useMemo(
    () => csvPreview(tableState.records, tableState.columns),
    [tableState.columns, tableState.records],
  );

  if (loading) {
    return <div className="text-muted">{t("Loading dataset...")}</div>;
  }

  if (!dataset) {
    return <div className="surface-card p-8 text-center text-muted">{t("Dataset not found")}</div>;
  }

  const actions = [
    { key: "table", icon: Table2, label: t("View Details") },
    { key: "raw", icon: Eye, label: t("Raw View") },
    { key: "viz", icon: BarChart3, label: t("Visualization") },
    { key: "geo", icon: Map, label: t("Geo View") },
  ];

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6 sm:p-8">
        <button type="button" onClick={() => navigate(-1)} className="text-sm font-medium text-muted">
          {t("Back")}
        </button>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Datasets")}</div>
            <h1 className="mt-3 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">{dataset.title}</h1>
            <p className="mt-4 text-base leading-7 text-muted">{dataset.description}</p>
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
            className="btn-secondary"
          >
            <Bookmark className={`h-4 w-4 ${isWishlisted(dataset.id) ? "fill-current text-amber-500" : ""}`} />
            {isWishlisted(dataset.id) ? t("Saved") : t("Save")}
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Rows")}</div>
          <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{(stats?.rows || dataset.numberOfRows || 0).toLocaleString()}</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Columns")}</div>
          <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{(stats?.columnCount || dataset.numberOfColumns || 0).toLocaleString()}</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Views")}</div>
          <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{(stats?.views || 0).toLocaleString()}</div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Downloads")}</div>
          <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{(stats?.downloads || 0).toLocaleString()}</div>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="mb-5 text-xl font-bold text-[var(--text-primary)]">{t("Metadata")}</div>
        <DatasetMeta dataset={dataset} />
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                if (action.key === "geo") {
                  handleGeoView();
                } else {
                  setActiveView(action.key);
                }
              }}
              className={action.key === activeView ? "btn-primary" : "btn-secondary"}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
              {action.key === "geo" && isGeoLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              if (!dataset || !sector) return;
              const engagement = await trackDownload(dataset.id, sector);
              if (engagement) {
                setStats((current) => ({ ...(current || {}), ...engagement }));
              }
              const response = await api.get(`/datasets/${sector}/${encodeURIComponent(dataset.id)}/raw`, {
                params: { full: true },
                responseType: "blob",
              });
              const blobUrl = window.URL.createObjectURL(response.data);
              const link = document.createElement("a");
              link.href = blobUrl;
              link.download = `${dataset.id}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(blobUrl);
            }}
            className="btn-primary ml-auto"
          >
            <Download className="h-4 w-4" />
            {t("Download CSV")}
          </button>
        </div>

        <div className="mt-6">
          {activeView === "table" && (
            <div className="space-y-4">
              <div className="overflow-auto rounded-3xl border border-[var(--border-subtle)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--surface-muted)]">
                    <tr>
                      {tableState.columns.map((column) => (
                        <th key={column} className="px-4 py-3 text-left font-semibold text-[var(--text-secondary)]">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableState.records.map((record, index) => (
                      <tr key={`${index}-${record[tableState.columns[0]] || index}`} className="border-t border-[var(--border-subtle)]">
                        {tableState.columns.map((column) => (
                          <td key={`${index}-${column}`} className="px-4 py-3 align-top text-[var(--text-secondary)]">
                            {String(record[column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={page} totalPages={tableState.totalPages} onPageChange={setPage} />
            </div>
          )}

          {activeView === "raw" && (
            <div className="rounded-3xl bg-slate-950 p-5 text-sm text-emerald-300">
              <pre className="whitespace-pre-wrap">{rawPreview}</pre>
            </div>
          )}

          {activeView === "viz" && (
            <>
              {visualization.loading ? (
                <div className="text-muted">{t("Visualization")}...</div>
              ) : (
                <DatasetVisualizer
                  visualization={visualization.data?.visualization}
                  insights={visualization.data?.insights || []}
                />
              )}
            </>
          )}
        </div>
      </section>

      <GeoViewModal
        isOpen={showGeoModal}
        onClose={() => setShowGeoModal(false)}
        dataset={dataset}
        records={geoRecords || []}
        isLoading={isGeoLoading}
      />
    </div>
  );
}
