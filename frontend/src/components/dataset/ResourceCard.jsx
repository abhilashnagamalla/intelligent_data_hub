import { motion } from 'framer-motion';
import { Download, Eye, Code2, ExternalLink } from 'lucide-react';

export default function ResourceCard({ resource, onPreview, onDownload, showApi }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white/80 dark:bg-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 p-5 shadow-sm hover:shadow-lg transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">{resource.title}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: {resource.format}</p>
        </div>
        <span className="text-xs font-semibold uppercase text-primary">{resource.format}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <div>Size: <span className="font-semibold text-gray-700 dark:text-gray-200">{resource.size || 'N/A'}</span></div>
        <div>Views: <span className="font-semibold text-gray-700 dark:text-gray-200">{resource.views || 0}</span></div>
        <div>Downloads: <span className="font-semibold text-gray-700 dark:text-gray-200">{resource.downloads || 0}</span></div>
        <div>Updated: <span className="font-semibold text-gray-700 dark:text-gray-200">{resource.updatedDate || 'Unknown'}</span></div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{resource.notes || ''}</p>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onPreview(resource)}
          className="py-2 px-3 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary-dark transition-all inline-flex items-center gap-2"
        >
          <Code2 className="w-4 h-4" /> Preview
        </button>
        <button
          type="button"
          onClick={() => onDownload(resource)}
          className="py-2 px-3 text-sm font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Download
        </button>
        {showApi && resource.format === 'JSON' && (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3 text-sm font-semibold rounded-lg border border-primary text-primary hover:bg-primary/5 transition-all inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> API
          </a>
        )}
      </div>
    </motion.div>
  );
}
