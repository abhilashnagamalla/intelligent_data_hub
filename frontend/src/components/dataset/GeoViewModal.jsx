import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, MapPin, Navigation } from 'lucide-react';

function detectCoordinateColumns(columns) {
  const latitude = columns.find((column) => /^(lat|latitude)$/i.test(column) || /latitude/i.test(column));
  const longitude = columns.find((column) => /^(lng|lon|longitude)$/i.test(column) || /longitude/i.test(column));
  return { latitude, longitude };
}

function detectLocationColumn(columns) {
  return columns.find((column) => /state|district|city|location|village|region|tehsil|block|port|area|place|town|zone|country|headquarters|station|taluka|mandal|division/i.test(column));
}

export default function GeoViewModal({ isOpen, onClose, dataset, records = [], isLoading }) {
  const geoData = useMemo(() => {
    if (!records.length) {
      return { type: 'empty', points: [], groups: [] };
    }

    const columns = Object.keys(records[0]);
    const { latitude, longitude } = detectCoordinateColumns(columns);

    if (latitude && longitude) {
      const points = records
        .map((record) => ({
          label: record.name || record.title || record[detectLocationColumn(columns)] || 'Point',
          latitude: Number(record[latitude]),
          longitude: Number(record[longitude]),
        }))
        .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

      return { type: 'coordinates', points, columns, latitude, longitude };
    }

    const locationColumn = detectLocationColumn(columns);
    if (locationColumn) {
      const grouped = {};
      records.forEach((record) => {
        const key = String(record[locationColumn] || 'Unknown').trim() || 'Unknown';
        grouped[key] = (grouped[key] || 0) + 1;
      });
      const groups = Object.entries(grouped)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      return { type: 'groups', groups, locationColumn };
    }

    return { type: 'none', points: [], groups: [] };
  }, [records]);

  if (!isOpen || typeof document === 'undefined') return null;

  const coordinates = geoData.type === 'coordinates' ? geoData.points : [];
  const minLat = coordinates.length ? Math.min(...coordinates.map((item) => item.latitude)) : 0;
  const maxLat = coordinates.length ? Math.max(...coordinates.map((item) => item.latitude)) : 1;
  const minLng = coordinates.length ? Math.min(...coordinates.map((item) => item.longitude)) : 0;
  const maxLng = coordinates.length ? Math.max(...coordinates.map((item) => item.longitude)) : 1;

  const projectX = (longitude) => 40 + ((longitude - minLng) / Math.max(maxLng - minLng || 1, 1)) * 620;
  const projectY = (latitude) => 340 - ((latitude - minLat) / Math.max(maxLat - minLat || 1, 1)) * 280;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-gray-950 border border-black shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Geo View</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Rendered strictly from dataset values only.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-[var(--border-subtle)]/30 bg-[var(--surface-muted)]/40 p-4 backdrop-blur-sm">
            <div className="font-semibold text-gray-900 dark:text-white">{dataset?.title || 'Dataset'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">No external maps, state files, or inferred joins are used here.</div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading dataset geography view...
            </div>
          )}

          {!isLoading && geoData.type === 'coordinates' && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <div className="rounded-2xl border border-[var(--border-subtle)]/30 p-4 bg-[var(--surface-muted)]/40 overflow-x-auto backdrop-blur-sm">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white">Coordinate Plot</div>
                <svg viewBox="0 0 700 380" className="w-full min-h-[320px] bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <line x1="40" y1="340" x2="660" y2="340" stroke="black" strokeWidth="2" />
                  <line x1="40" y1="40" x2="40" y2="340" stroke="black" strokeWidth="2" />
                  {coordinates.map((point, index) => (
                    <g key={`${point.label}-${index}`}>
                      <circle cx={projectX(point.longitude)} cy={projectY(point.latitude)} r="5" fill="#059669" />
                    </g>
                  ))}
                </svg>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><Navigation className="w-4 h-4" />Using {geoData.latitude} and {geoData.longitude}</div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)]/30 p-4 bg-[var(--surface-muted)]/40 backdrop-blur-sm">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white">Sample Coordinates</div>
                <div className="space-y-3 max-h-[360px] overflow-y-auto">
                  {coordinates.slice(0, 12).map((point, index) => (
                    <div key={`${point.label}-${index}`} className="rounded-xl border border-[var(--border-subtle)]/30 p-3 text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">{point.label}</div>
                      <div className="text-gray-500 dark:text-gray-400">Lat: {point.latitude}</div>
                      <div className="text-gray-500 dark:text-gray-400">Lng: {point.longitude}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isLoading && geoData.type === 'groups' && (
            <div className="rounded-2xl border border-[var(--border-subtle)]/30 p-4 bg-[var(--surface-muted)]/40 backdrop-blur-sm">
              <div className="font-semibold mb-4 text-gray-900 dark:text-white">Location Distribution by {geoData.locationColumn}</div>
              <div className="space-y-3">
                {geoData.groups.map((group) => (
                  <div key={group.label} className="grid grid-cols-[minmax(0,1fr)_80px] gap-4 items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" />{group.label}</div>
                      <div className="h-2 mt-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full bg-emerald-600" style={{ width: `${Math.max(8, (group.count / geoData.groups[0].count) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right font-semibold text-gray-700 dark:text-gray-200">{group.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && (geoData.type === 'none' || geoData.type === 'empty') && (
            <div className="rounded-2xl border border-[var(--border-subtle)]/30 p-10 text-center text-gray-500 dark:text-gray-400 bg-[var(--surface-muted)]/40 backdrop-blur-sm">
              Geo View is only available when the dataset itself contains coordinates or explicit geographic fields.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

