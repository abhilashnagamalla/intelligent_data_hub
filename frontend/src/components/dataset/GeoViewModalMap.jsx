import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { X, Loader2, MapPin, Navigation } from 'lucide-react';

const INDIA_MAP_URL = '/india.topo.json';

const STATE_ALIASES = {
  'andaman and nicobar islands': 'Andaman and Nicobar',
  'andaman and nicobar': 'Andaman and Nicobar',
  'andaman & nicobar islands': 'Andaman and Nicobar',
  'arunachal pradesh': 'Arunanchal Pradesh',
  'dadra and nagar haveli': 'Dadara and Nagar Havelli',
  'dadra & nagar haveli': 'Dadara and Nagar Havelli',
  'dadra and nagar haveli and daman and diu': 'Dadara and Nagar Havelli',
  'daman & diu': 'Daman and Diu',
  delhi: 'NCT of Delhi',
  'new delhi': 'NCT of Delhi',
  'nct delhi': 'NCT of Delhi',
  'nct of delhi': 'NCT of Delhi',
  odisha: 'Odisha',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  'jammu & kashmir': 'Jammu and Kashmir',
  'jammu and kashmir': 'Jammu and Kashmir',
  uttaranchal: 'Uttarakhand',
};

function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[().,/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalStateName(value) {
  const normalized = normalizeLabel(value);
  return STATE_ALIASES[normalized] || String(value || '').trim();
}

function detectCoordinateColumns(columns) {
  const latitude = columns.find((column) => /^(lat|latitude)$/i.test(column) || /latitude/i.test(column));
  const longitude = columns.find((column) => /^(lng|lon|longitude)$/i.test(column) || /longitude/i.test(column));
  return { latitude, longitude };
}

function detectStateColumn(columns) {
  return columns.find((column) => /(^|\s)(state|state\/ut|state ut|ut|union territory)(\s|$)/i.test(column));
}

function detectLocationColumn(columns) {
  return columns.find((column) => /state|district|city|location|village|region|tehsil|block/i.test(column));
}

function detectNumericColumns(records, columns) {
  return columns.filter((column) =>
    records.some((record) => {
      const value = record[column];
      if (value === null || value === undefined || value === '') return false;
      return Number.isFinite(Number(String(value).replace(/,/g, '')));
    }),
  );
}

function metricValue(record, column) {
  const raw = record?.[column];
  const parsed = Number(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fillColor(value, maxValue) {
  if (!value || !maxValue) return '#E5E7EB';
  const intensity = value / maxValue;
  if (intensity > 0.8) return '#14532D';
  if (intensity > 0.6) return '#15803D';
  if (intensity > 0.4) return '#16A34A';
  if (intensity > 0.2) return '#4ADE80';
  return '#BBF7D0';
}

export default function GeoViewModalMap({ isOpen, onClose, dataset, records = [], isLoading }) {
  const geoData = useMemo(() => {
    if (!records.length) {
      return { type: 'empty', points: [], groups: [], states: [] };
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

      if (points.length) {
        return { type: 'coordinates', points, latitude, longitude };
      }
    }

    const stateColumn = detectStateColumn(columns);
    if (stateColumn) {
      const numericColumns = detectNumericColumns(records, columns.filter((column) => column !== stateColumn));
      const metricColumn = numericColumns[0] || null;
      const groupedStates = {};

      records.forEach((record) => {
        const rawState = String(record[stateColumn] || '').trim();
        if (!rawState) return;
        const name = canonicalStateName(rawState);
        if (!groupedStates[name]) {
          groupedStates[name] = { label: name, value: 0, rows: 0 };
        }
        groupedStates[name].rows += 1;
        groupedStates[name].value += metricColumn ? metricValue(record, metricColumn) : 1;
      });

      const states = Object.values(groupedStates)
        .filter((item) => item.label)
        .sort((a, b) => b.value - a.value);

      if (states.length) {
        return { type: 'states', stateColumn, metricColumn, states };
      }
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

    return { type: 'none', points: [], groups: [], states: [] };
  }, [records]);

  const stateMetricMap = Object.fromEntries(
    (geoData.type === 'states' ? geoData.states : []).map((item) => [normalizeLabel(item.label), item]),
  );
  const maxStateValue = geoData.type === 'states' && geoData.states.length ? Math.max(...geoData.states.map((item) => item.value)) : 0;

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-gray-950 border border-black shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Geo View</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Uses the India map with dataset-provided geographic values only.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
            <div className="font-semibold text-gray-900 dark:text-white">{dataset?.title || 'Dataset'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">States or markers render only when the dataset includes explicit geographic fields.</div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading dataset geography view...
            </div>
          )}

          {!isLoading && geoData.type === 'states' && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white">India State View</div>
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                  <ComposableMap projection="geoMercator" projectionConfig={{ center: [82, 23], scale: 1000 }} className="w-full h-auto">
                    <Geographies geography={INDIA_MAP_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const stateName = geo.properties?.name || geo.id;
                          const match = stateMetricMap[normalizeLabel(stateName)];
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={fillColor(match?.value || 0, maxStateValue)}
                              stroke="#111827"
                              strokeWidth={0.6}
                              style={{
                                default: { outline: 'none' },
                                hover: { outline: 'none', fill: '#2563EB' },
                                pressed: { outline: 'none' },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ComposableMap>
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Using {geoData.stateColumn}{geoData.metricColumn ? ` and ${geoData.metricColumn}` : ' with row counts'}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white">Matched States</div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {geoData.states.slice(0, 20).map((state) => (
                    <div key={state.label} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">{state.label}</div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {geoData.metricColumn ? `${geoData.metricColumn}: ${state.value.toLocaleString()}` : `Rows: ${state.rows.toLocaleString()}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isLoading && geoData.type === 'coordinates' && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white">India Coordinate View</div>
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                  <ComposableMap projection="geoMercator" projectionConfig={{ center: [82, 23], scale: 1000 }} className="w-full h-auto">
                    <Geographies geography={INDIA_MAP_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill="#F3F4F6"
                            stroke="#111827"
                            strokeWidth={0.6}
                            style={{
                              default: { outline: 'none' },
                              hover: { outline: 'none' },
                              pressed: { outline: 'none' },
                            }}
                          />
                        ))
                      }
                    </Geographies>
                    {geoData.points.slice(0, 200).map((point, index) => (
                      <Marker key={`${point.label}-${index}`} coordinates={[point.longitude, point.latitude]}>
                        <circle r={3.5} fill="#059669" stroke="#064E3B" strokeWidth={1} />
                      </Marker>
                    ))}
                  </ComposableMap>
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Navigation className="w-4 h-4" /> Using {geoData.latitude} and {geoData.longitude}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white">Sample Coordinates</div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {geoData.points.slice(0, 12).map((point, index) => (
                    <div key={`${point.label}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm">
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
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
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
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950">
              Geo View is available when the dataset contains latitude/longitude fields or an explicit state column that can be matched to the India map.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
