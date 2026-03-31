import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Papa from 'papaparse';

export default function DataPreviewModal({ open, onClose, resource, content, viewMode, setViewMode }) {
  const rows = useMemo(() => {
    if (!content || viewMode === 'raw') return [];
    try {
      if (resource?.format === 'JSON') {
        const json = JSON.parse(content);
        if (Array.isArray(json)) return json.slice(0, 50);
        if (json?.data && Array.isArray(json.data)) return json.data.slice(0, 50);
        if (json?.records && Array.isArray(json.records)) return json.records.slice(0, 50);
        return [];
      } else if (resource?.format === 'CSV') {
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });
        return parsed.data.slice(0, 50);
      }
    } catch (e) {
      console.error('Error parsing content:', e);
      return [];
    }
    return [];
  }, [content, resource, viewMode]);

  if (!open || !resource) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preview: {resource.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 py-3 gap-3 overflow-x-auto bg-gray-50 dark:bg-gray-800">
          <button onClick={() => setViewMode('table')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${viewMode === 'table' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}>
            Table View
          </button>
          <button onClick={() => setViewMode('raw')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${viewMode === 'raw' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}>
            Raw View
          </button>
        </div>

        <div className="h-full overflow-auto p-5 bg-white dark:bg-gray-900">
          {viewMode === 'table' ? (
            rows.length ? (
              <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      {Object.keys(rows[0]).map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((value, colIndex) => (
                          <td key={colIndex} className="px-3 py-2 text-gray-700 dark:text-gray-200 break-words max-w-[180px]">{String(value)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500">No structured rows available for preview.</div>
            )
          ) : (
            <pre className="whitespace-pre-wrap break-words max-h-[70vh] overflow-auto bg-slate-950 text-slate-100 p-4 rounded-xl text-xs">
              {content || 'No raw content available.'}
            </pre>
          )}
        </div>
      </motion.div>
    </div>
  );
}
