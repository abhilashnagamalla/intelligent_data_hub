import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, ChevronUp, Info, Layers } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Custom tooltip – shows fullLabel on hover for numeric / long labels */
/* ------------------------------------------------------------------ */
function ChartTooltip({ active, payload, labelMapping }) {
  if (!active || !payload?.length) return null;

  const entry = payload[0]?.payload;
  if (!entry) return null;

  const displayLabel = entry.fullLabel || entry.displayLabel || entry.label || "";
  const value = payload[0]?.value;
  const yName = payload[0]?.dataKey || "value";

  return (
    <div
      style={{
        background: "var(--surface-primary, #fff)",
        border: "1px solid var(--border-subtle, #e5e7eb)",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        maxWidth: 320,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: "var(--text-primary, #111827)",
          marginBottom: 4,
          wordBreak: "break-word",
        }}
      >
        {displayLabel}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary, #6b7280)",
        }}
      >
        {yName}: <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      </div>
      {entry.grouped && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--brand-accent, #8b5cf6)",
            fontStyle: "italic",
          }}
        >
          Aggregated from grouped categories
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Label mapping legend – shows number → full label mapping           */
/* ------------------------------------------------------------------ */
function LabelMappingLegend({ labelMapping, t }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!labelMapping?.length) return null;

  return (
    <div className="surface-muted p-4 mt-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left text-sm font-semibold text-[var(--text-primary)]"
      >
        <Info className="w-4 h-4 text-[var(--brand-primary)]" />
        {t("Label Mapping")}
        <span className="ml-1 text-xs text-muted">
          ({labelMapping.length} {t("labels")})
        </span>
        <span className="ml-auto">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {labelMapping.map((item) => (
            <div key={item.shortLabel} className="flex items-baseline gap-2 text-sm">
              <span className="font-bold text-[var(--brand-primary)] min-w-[2rem] text-right">
                {item.shortLabel}
              </span>
              <span className="text-[var(--text-secondary)] truncate" title={item.fullLabel}>
                → {item.fullLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grouped categories panel – shows what's inside "Others"            */
/* ------------------------------------------------------------------ */
function GroupedCategoriesPanel({ groupedCategories, groupedTotal, yLabel, t }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!groupedCategories?.length) return null;

  return (
    <div className="surface-muted p-4 mt-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left text-sm font-semibold text-[var(--text-primary)]"
      >
        <Layers className="w-4 h-4 text-[var(--brand-accent)]" />
        {t("Grouped into \"Others\"")}
        <span className="ml-1 text-xs text-muted">
          ({groupedCategories.length} {t("categories")})
        </span>
        {groupedTotal && (
          <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] rounded-full">
            {t("Total")}: {groupedTotal}
          </span>
        )}
        <span className="ml-auto">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 overflow-auto max-h-60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left py-1.5 pr-4 font-semibold text-[var(--text-secondary)]">
                  {t("Category")}
                </th>
                <th className="text-right py-1.5 font-semibold text-[var(--text-secondary)]">
                  {yLabel || t("Value")}
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedCategories.map((item, idx) => (
                <tr key={idx} className="border-b border-[var(--border-subtle)]/50">
                  <td className="py-1.5 pr-4 text-[var(--text-primary)] truncate max-w-[200px]" title={item.label}>
                    {item.label}
                  </td>
                  <td className="py-1.5 text-right font-medium text-[var(--text-secondary)]">
                    {item.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bar colors                                                         */
/* ------------------------------------------------------------------ */
const BAR_COLORS = [
  "var(--brand-secondary, #16a34a)",
  "var(--brand-primary, #2563eb)",
  "var(--brand-accent, #8b5cf6)",
  "#0891b2",
  "#d97706",
  "#dc2626",
  "#059669",
  "#7c3aed",
  "#c026d3",
  "#ea580c",
];
const OTHERS_COLOR = "#94a3b8";

function getBarColor(entry, index) {
  if (entry?.grouped) return OTHERS_COLOR;
  return BAR_COLORS[index % BAR_COLORS.length];
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function DatasetVisualizerFixed({ visualization, insights = [] }) {
  const { t } = useTranslation();

  if (!visualization) {
    return (
      <div className="surface-muted p-8 text-sm text-muted">
        {t("Visualization is not available yet.")}
      </div>
    );
  }

  if (visualization.message) {
    return (
      <div className="surface-muted p-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Info className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {visualization.message}
            </div>
            {visualization.rowCount && visualization.threshold && (
              <div className="text-xs text-muted mt-1">
                {t("Dataset has")} {visualization.rowCount.toLocaleString()} {t("rows")} ({t("threshold")}: {visualization.threshold.toLocaleString()})
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const chart = visualization.charts?.[0];
  if (!chart) {
    return (
      <div className="surface-muted p-8 text-sm text-muted">
        {t("No dataset-driven chart could be created.")}
      </div>
    );
  }

  const hasLabelMapping = chart.labelMapping?.length > 0;
  const hasGrouped = chart.groupedCategories?.length > 0;

  return (
    <div className="space-y-4">
      {/* Chart header */}
      <div className="surface-muted p-5">
        <h3 className="text-xl font-bold text-[var(--text-primary)]">{chart.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {t("Automatically detected from dataset columns.")}
          {chart.xLabel && chart.yLabel && (
            <span className="ml-1">
              X: <strong>{chart.xLabel}</strong> · Y: <strong>{chart.yLabel}</strong>
            </span>
          )}
        </p>
        {visualization.rowCount && (
          <p className="text-xs text-muted mt-1">
            {t("Based on")} {visualization.rowCount.toLocaleString()} {t("rows")}
          </p>
        )}
      </div>

      {/* Chart area */}
      <div className="surface-card h-[420px] p-4">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "line" ? (
            <AreaChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }}>
                {chart.xLabel && <Label value={chart.xLabel} position="insideBottom" offset={-5} style={{ fontSize: 12, fill: "var(--text-secondary)" }} />}
              </XAxis>
              <YAxis tick={{ fontSize: 12 }}>
                {chart.yLabel && <Label value={chart.yLabel} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: "var(--text-secondary)", textAnchor: "middle" }} />}
              </YAxis>
              <Tooltip content={<ChartTooltip labelMapping={chart.labelMapping} />} />
              <Area
                type="monotone"
                dataKey={chart.yKey}
                stroke="var(--brand-primary)"
                fill="var(--brand-primary)"
                fillOpacity={0.18}
              />
            </AreaChart>
          ) : chart.type === "histogram" ? (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey={chart.xKey}
                interval={0}
                angle={chart.data.length > 6 ? -25 : 0}
                textAnchor={chart.data.length > 6 ? "end" : "middle"}
                height={chart.data.length > 6 ? 70 : 40}
                tick={{ fontSize: 11 }}
              >
                {chart.xLabel && <Label value={chart.xLabel} position="insideBottom" offset={-5} style={{ fontSize: 12, fill: "var(--text-secondary)" }} />}
              </XAxis>
              <YAxis tick={{ fontSize: 12 }}>
                {chart.yLabel && <Label value={chart.yLabel} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: "var(--text-secondary)", textAnchor: "middle" }} />}
              </YAxis>
              <Tooltip content={<ChartTooltip labelMapping={chart.labelMapping} />} />
              <Bar dataKey={chart.yKey} fill="var(--brand-accent)" radius={[8, 8, 0, 0]} />
            </BarChart>
          ) : (
            /* Bar chart — default */
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey={chart.xKey}
                interval={0}
                angle={chart.data.length > 6 ? -25 : 0}
                textAnchor={chart.data.length > 6 ? "end" : "middle"}
                height={chart.data.length > 6 ? 80 : 40}
                tick={{ fontSize: 11 }}
              >
                {chart.xLabel && !hasLabelMapping && (
                  <Label value={chart.xLabel} position="insideBottom" offset={-5} style={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                )}
              </XAxis>
              <YAxis tick={{ fontSize: 12 }}>
                {chart.yLabel && <Label value={chart.yLabel} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: "var(--text-secondary)", textAnchor: "middle" }} />}
              </YAxis>
              <Tooltip content={<ChartTooltip labelMapping={chart.labelMapping} />} />
              <Bar dataKey={chart.yKey} radius={[8, 8, 0, 0]}>
                {chart.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry, index)} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Label mapping legend (when numeric labels are used) */}
      {hasLabelMapping && <LabelMappingLegend labelMapping={chart.labelMapping} t={t} />}

      {/* Grouped categories panel */}
      {hasGrouped && (
        <GroupedCategoriesPanel
          groupedCategories={chart.groupedCategories}
          groupedTotal={chart.groupedTotal}
          yLabel={chart.yLabel}
          t={t}
        />
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="surface-muted p-5">
          <h4 className="mb-3 font-bold text-[var(--text-primary)]">{t("Dataset Insights")}</h4>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
