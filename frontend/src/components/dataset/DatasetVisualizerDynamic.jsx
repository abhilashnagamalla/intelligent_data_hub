import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function formatMetricValue(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return value;
  }

  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function ChartTooltip({ active, payload, chart }) {
  if (!active || !payload?.length || !chart) {
    return null;
  }

  const point = payload[0]?.payload || {};
  const label = point.fullLabel || point.displayLabel || '';
  const value = point[chart.yKey] ?? payload[0]?.value;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{chart.xLabel}</div>
      <div className="mt-1 font-bold text-gray-900 dark:text-white">{label}</div>
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {chart.yLabel}: {formatMetricValue(value)}
      </div>
    </div>
  );
}

export default function DatasetVisualizerDynamic({ visualization, insights = [] }) {
  if (!visualization) {
    return <div className="rounded-2xl border border-gray-200 p-8 text-gray-500 dark:border-gray-800">Visualization is not available yet.</div>;
  }

  if (visualization.message) {
    return <div className="rounded-2xl border border-gray-200 p-8 text-gray-700 dark:border-gray-800 dark:text-gray-300">{visualization.message}</div>;
  }

  const chart = visualization.charts?.[0];
  if (!chart) {
    return <div className="rounded-2xl border border-gray-200 p-8 text-gray-500 dark:border-gray-800">No dataset-driven chart could be created.</div>;
  }

  const rotateLabels = !chart.labelMapping?.length && chart.data?.some((item) => String(item.displayLabel || '').length > 12);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{chart.title}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Automatically selected from detected categorical and numerical columns.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data} margin={{ top: 12, right: 24, left: 8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
            <XAxis
              dataKey={chart.xKey}
              interval={0}
              angle={rotateLabels ? -20 : 0}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              height={rotateLabels ? 70 : 40}
              label={{ value: chart.xLabel, position: 'insideBottom', offset: -8 }}
            />
            <YAxis
              tickFormatter={formatMetricValue}
              label={{ value: chart.yLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<ChartTooltip chart={chart} />} />
            <Bar
              dataKey={chart.yKey}
              fill={chart.type === 'histogram' ? '#111827' : '#16a34a'}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {chart.labelMapping?.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <h4 className="mb-3 font-bold text-gray-900 dark:text-white">Label Mapping</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {chart.labelMapping.map((item) => (
              <div key={item.shortLabel} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
                <span className="font-black text-emerald-600">{item.shortLabel}</span>
                <span className="mx-2 text-gray-400">-&gt;</span>
                <span className="text-gray-700 dark:text-gray-300">{item.fullLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chart.groupedCategories?.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <h4 className="font-bold text-gray-900 dark:text-white">Others Includes</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Aggregated value: {chart.groupedTotal}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {chart.groupedCategories.map((item) => (
              <li key={item.label}>
                {item.label}: {item.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <h4 className="mb-3 font-bold text-gray-900 dark:text-white">Dataset Insights</h4>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
