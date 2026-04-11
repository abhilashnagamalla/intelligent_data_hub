import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

export default function DatasetVisualizer({ visualization, insights = [] }) {
  if (!visualization) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-gray-500">Visualization is not available yet.</div>;
  }

  if (visualization.message) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-gray-700 dark:text-gray-300">{visualization.message}</div>;
  }

  const chart = visualization.charts?.[0];
  if (!chart) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-gray-500">No dataset-driven chart could be created.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-950">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{chart.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automatically selected from full dataset content.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'line' ? (
            <AreaChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey={chart.xKey} />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey={chart.yKey} stroke="#2563eb" fill="#93c5fd" />
            </AreaChart>
          ) : chart.type === 'histogram' ? (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey={chart.xKey} />
              <YAxis />
              <Tooltip />
              <Bar dataKey={chart.yKey} fill="#111827" />
            </BarChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey={chart.xKey} interval={0} angle={chart.data.length > 8 ? -20 : 0} textAnchor={chart.data.length > 8 ? 'end' : 'middle'} height={chart.data.length > 8 ? 70 : 30} />
              <YAxis />
              <Tooltip />
              <Bar dataKey={chart.yKey} fill="#16a34a" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {insights.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-950">
          <h4 className="font-bold text-gray-900 dark:text-white mb-3">Dataset Insights</h4>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
            {insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

