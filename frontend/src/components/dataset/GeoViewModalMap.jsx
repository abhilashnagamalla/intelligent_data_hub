import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { X, Loader2, MapPin, Navigation, Search, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const INDIA_MAP_URL = '/india.topo.json';

/* ─── State name normalization ─── */
const STATE_ALIASES = {
  'andaman and nicobar islands': 'Andaman and Nicobar',
  'andaman and nicobar': 'Andaman and Nicobar',
  'andaman & nicobar islands': 'Andaman and Nicobar',
  'andaman & nicobar': 'Andaman and Nicobar',
  'a & n islands': 'Andaman and Nicobar',
  'arunachal pradesh': 'Arunanchal Pradesh',
  'arunanchal pradesh': 'Arunanchal Pradesh',
  'dadra and nagar haveli': 'Dadara and Nagar Havelli',
  'dadra & nagar haveli': 'Dadara and Nagar Havelli',
  'dadra and nagar haveli and daman and diu': 'Dadara and Nagar Havelli',
  'dadara and nagar havelli': 'Dadara and Nagar Havelli',
  'd & n haveli': 'Dadara and Nagar Havelli',
  'daman & diu': 'Daman and Diu',
  'daman and diu': 'Daman and Diu',
  maharashtra: 'Maharashtra',
  maharastra: 'Maharashtra',
  mh: 'Maharashtra',
  karntaka: 'Karnataka',
  karkataka: 'Karnataka',
  ka: 'Karnataka',
  karnataka: 'Karnataka',
  kerala: 'Kerala',
  kl: 'Kerala',
  rajasthan: 'Rajasthan',
  rj: 'Rajasthan',
  gujarat: 'Gujarat',
  gj: 'Gujarat',
  punjab: 'Punjab',
  pj: 'Punjab',
  pb: 'Punjab',
  haryana: 'Haryana',
  hr: 'Haryana',
  bihar: 'Bihar',
  br: 'Bihar',
  jharkhand: 'Jharkhand',
  jh: 'Jharkhand',
  odisha: 'Odisha',
  orissa: 'Odisha',
  od: 'Odisha',
  manipur: 'Manipur',
  mn: 'Manipur',
  meghalaya: 'Meghalaya',
  ml: 'Meghalaya',
  mizoram: 'Mizoram',
  mz: 'Mizoram',
  nagaland: 'Nagaland',
  nl: 'Nagaland',
  tripura: 'Tripura',
  tr: 'Tripura',
  sikkim: 'Sikkim',
  sk: 'Sikkim',
  assam: 'Assam',
  as: 'Assam',
  goa: 'Goa',
  ga: 'Goa',
  arunachal: 'Arunanchal Pradesh',
  arunanchal: 'Arunanchal Pradesh',
  'andhra pradesh': 'Andhra Pradesh',
  'uttar pradesh': 'Uttar Pradesh',
  'madhya pradesh': 'Madhya Pradesh',
  'himachal pradesh': 'Himachal Pradesh',
  up: 'Uttar Pradesh',
  mp: 'Madhya Pradesh',
  ap: 'Andhra Pradesh',
  hp: 'Himachal Pradesh',
  'nct of delhi': 'NCT of Delhi',
  delhi: 'NCT of Delhi',
  'new delhi': 'NCT of Delhi',
  chandigarh: 'Chandigarh',
  ch: 'Chandigarh',
  'jammu and kashmir': 'Jammu and Kashmir',
  'jammu & kashmir': 'Jammu and Kashmir',
  'j and k': 'Jammu and Kashmir',
  jk: 'Jammu and Kashmir',
  ladakh: 'Ladakh',
  ld: 'Ladakh',
  puducherry: 'Puducherry',
  pondicherry: 'Puducherry',
  py: 'Puducherry',
  lakshadweep: 'Lakshadweep',
  ld: 'Lakshadweep',
};

function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[().,/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalStateName(value) {
  const normalized = normalizeLabel(value);
  if (STATE_ALIASES[normalized]) return STATE_ALIASES[normalized];
  
  const statesBase = [
    'Andhra Pradesh', 'Arunanchal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar', 'Chandigarh', 'Dadara and Nagar Havelli', 'Daman and Diu', 'Lakshadweep', 
    'NCT of Delhi', 'Puducherry', 'Ladakh', 'Jammu and Kashmir'
  ].map(s => s.toLowerCase());

  // More aggressive substring matching for "Uttar Pradesh SRTC" etc.
  for (const s of statesBase) {
    if (normalized.includes(s.toLowerCase())) return s;
  }
  
  // Handle common bureaucratic abbreviations
  const words = normalized.split(/[\s-]+/);
  if (words.includes('tn')) return 'Tamil Nadu';
  if (words.includes('up')) return 'Uttar Pradesh';
  if (words.includes('mp')) return 'Madhya Pradesh';
  if (words.includes('ap')) return 'Andhra Pradesh';
  if (words.includes('wb')) return 'West Bengal';
  if (words.includes('hp')) return 'Himachal Pradesh';
  if (words.includes('jk')) return 'Jammu and Kashmir';

  return String(value || '').trim();
}

/* ─── Generic Location mapping to State ─── */
const CITY_TO_STATE = {
  // Ports
  bhavnagar: 'Gujarat',
  chennai: 'Tamil Nadu',
  cochin: 'Kerala',
  kochi: 'Kerala',
  dharmatar: 'Maharashtra',
  gangavaram: 'Andhra Pradesh',
  goa: 'Goa',
  gopalpur: 'Odisha',
  haldia: 'West Bengal',
  kakinada: 'Andhra Pradesh',
  kandla: 'Gujarat',
  karaikal: 'Puducherry',
  kolkata: 'West Bengal',
  krishnapatnam: 'Andhra Pradesh',
  vizag: 'Andhra Pradesh',
  visakhapatnam: 'Andhra Pradesh',
  mangalore: 'Karnataka',
  'new mangalore': 'Karnataka',
  mumbai: 'Maharashtra',
  jnpt: 'Maharashtra',
  mundra: 'Gujarat',
  paradip: 'Odisha',
  pipavav: 'Gujarat',
  porbandar: 'Gujarat',
  tuticorin: 'Tamil Nadu',
  'v o chidambaranar': 'Tamil Nadu',
  'voc port': 'Tamil Nadu',
  'new tuticorin': 'Tamil Nadu',
  ennore: 'Tamil Nadu',
  'kamarajar': 'Tamil Nadu',
  navlakhi: 'Gujarat',
  okha: 'Gujarat',
  bedi: 'Gujarat',
  dahej: 'Gujarat',
  hazira: 'Gujarat',
  dhamra: 'Odisha',
  mormugao: 'Goa',
  panambur: 'Karnataka',
  nagapattinam: 'Tamil Nadu',
  chennai: 'Tamil Nadu',
  
  // Major Cities & Districts
  delhi: 'NCT of Delhi',
  'new delhi': 'NCT of Delhi',
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
  hyderabad: 'Telangana',
  ahmedabad: 'Gujarat',
  pune: 'Maharashtra',
  jaipur: 'Rajasthan',
  surat: 'Gujarat',
  lucknow: 'Uttar Pradesh',
  kanpur: 'Uttar Pradesh',
  nagpur: 'Maharashtra',
  indore: 'Madhya Pradesh',
  bhopal: 'Madhya Pradesh',
  patna: 'Bihar',
  vadodara: 'Gujarat',
  ludhiana: 'Punjab',
  agra: 'Uttar Pradesh',
  nashik: 'Maharashtra',
  faridabad: 'Haryana',
  meerut: 'Uttar Pradesh',
  rajkot: 'Gujarat',
  varanasi: 'Uttar Pradesh',
  srinagar: 'Jammu and Kashmir',
  amritsar: 'Punjab',
  allahabad: 'Uttar Pradesh',
  prayagraj: 'Uttar Pradesh',
  ranchi: 'Jharkhand',
  haora: 'West Bengal',
  howrah: 'West Bengal',
  coimbatore: 'Tamil Nadu',
  jabalpur: 'Madhya Pradesh',
  gwalior: 'Madhya Pradesh',
  vijayawada: 'Andhra Pradesh',
  jodhpur: 'Rajasthan',
  madurai: 'Tamil Nadu',
  raipur: 'Chhattisgarh',
  kota: 'Rajasthan',
  guwahati: 'Assam',
  chandigarh: 'Chandigarh',
  solapur: 'Maharashtra',
  hubli: 'Karnataka',
  bareilly: 'Uttar Pradesh',
  moradabad: 'Uttar Pradesh',
  mysore: 'Karnataka',
  gurgaon: 'Haryana',
  gurugram: 'Haryana',
  aligarh: 'Uttar Pradesh',
  jalandhar: 'Punjab',
  bhubaneswar: 'Odisha',
  bhubaneshwar: 'Odisha',
  salem: 'Tamil Nadu',
  noida: 'Uttar Pradesh',
  thiruvananthapuram: 'Kerala',
  trivandrum: 'Kerala',
};

/* ─── Column detection helpers ─── */
function detectCoordinateColumns(columns) {
  const latitude = columns.find((c) => /^(lat|latitude)$/i.test(c) || /latitude/i.test(c));
  const longitude = columns.find((c) => /^(lng|lon|longitude)$/i.test(c) || /longitude/i.test(c));
  return { latitude, longitude };
}

function detectStateColumn(records, columns) {
  const statesBase = [
    'Andhra Pradesh', 'Arunanchal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar', 'Chandigarh', 'Dadara and Nagar Havelli', 'Daman and Diu', 'Lakshadweep', 
    'NCT of Delhi', 'Puducherry', 'Ladakh', 'Jammu and Kashmir',
    'up', 'mp', 'ap', 'tn', 'jk', 'wb', 'hp', 'uk', 'hr', 'rj', 'gj', 'mh', 'ka', 'kl', 'tn'
  ].map(s => s.toLowerCase());

  // Pass 1: Trusted Headers - Strictly States/UTs
  const trustedHeaderCol = columns.find((c) => /(^|\s)(state|ut|union territory)(\s|$)/i.test(c) || /^state$/i.test(c.trim()) || /state[_\s]?name/i.test(c));
  if (trustedHeaderCol) {
    const vals = records.slice(0, 15).map(r => String(r[trustedHeaderCol] || '').trim()).filter(Boolean);
    const isActuallyStrings = vals.some(v => isNaN(Number(v.replace(/,/g, ''))));
    if (isActuallyStrings) return trustedHeaderCol;
  }

  // Pass 2: Deep Data Inspection
  for (const col of columns) {
    let matches = 0;
    const sample = records.slice(0, 100);
    for (const rec of sample) {
       const val = normalizeLabel(rec[col]);
       if (!val) continue;
       // Check for exact state match or abbreviation
       if (statesBase.includes(val) || statesBase.some(s => s.length > 3 && val.includes(s))) {
         matches++;
       }
       if (matches > 2) return col; 
    }
  }
  return null;
}

function detectLocationColumn(records, columns) {
  // Pass 1: Wide Regex on Headers
  const headerCol = columns.find((c) => /\b(state|district|city|location|village|region|tehsil|block|port|area|place|town|zone|country|headquarters|station|taluka|mandal|division)\b/i.test(c));
  if (headerCol) {
     const isActuallyStrings = records.slice(0, 20).some(r => isNaN(Number(String(r[headerCol] || '').replace(/,/g, ''))));
     if (isActuallyStrings) return headerCol;
  }

  // Pass 2: City Mapping Check (Look for "Mumbai", "Kochi", etc.)
  const cities = Object.keys(CITY_TO_STATE);
  for (const col of columns) {
    let matches = 0;
    for (const rec of records.slice(0, 50)) {
       const val = normalizeLabel(rec[col]);
       if (!val) continue;
       if (cities.includes(val)) matches++;
       if (matches > 2) return col;
    }
  }
  return null;
}

function detectNumericColumns(records, columns) {
  const numeric = columns.filter((col) =>
    records.some((rec) => {
      const v = rec[col];
      if (v === null || v === undefined || v === '') return false;
      const parsed = Number(String(v).replace(/,/g, ''));
      return Number.isFinite(parsed);
    }),
  );
  
  // Identify "true" analytical metrics vs IDs/Serial numbers
  const analytical = numeric.filter(c => !/\b(sl|s\.?no|serial|id|code|year|pin|phone|mobile|lat|lng|latitude|longitude)\b/i.test(c));
  const IDs = numeric.filter(c => /\b(sl|s\.?no|serial|id|code|year|pin|phone|mobile|lat|lng|latitude|longitude)\b/i.test(c));
  
  // Sort analytical metrics to the top
  return [...analytical, ...IDs];
}

function metricValue(record, column) {
  const raw = record?.[column];
  const parsed = Number(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ─── Domain-specific Color Palettes ─── */
const DOMAIN_COLORS = {
  agriculture: {
    gradient: ['#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#15803D', '#14532D'], // Green
    neutral: '#F0FDF4',
    textHighlight: 'text-emerald-600',
    barFill: 'bg-emerald-500',
    markerFill: '#059669'
  },
  census: {
    gradient: ['#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#1D4ED8', '#1E3A8A'], // Blue
    neutral: '#EFF6FF',
    textHighlight: 'text-blue-600',
    barFill: 'bg-blue-500',
    markerFill: '#2563EB'
  },
  education: {
    gradient: ['#F3E8FF', '#E9D5FF', '#D8B4FE', '#C084FC', '#A855F7', '#7E22CE', '#581C87'], // Purple
    neutral: '#FAF5FF',
    textHighlight: 'text-purple-600',
    barFill: 'bg-purple-500',
    markerFill: '#9333EA'
  },
  finance: {
    gradient: ['#FEF3C7', '#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#B45309', '#78350F'], // Amber
    neutral: '#FFFBEB',
    textHighlight: 'text-amber-600',
    barFill: 'bg-amber-500',
    markerFill: '#D97706'
  },
  health: {
    gradient: ['#FFE4E6', '#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E', '#BE123C', '#881337'], // Rose
    neutral: '#FFF1F2',
    textHighlight: 'text-rose-600',
    barFill: 'bg-rose-500',
    markerFill: '#E11D48'
  },
  transport: {
    gradient: ['#E0E7FF', '#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1', '#4338CA', '#312E81'], // Indigo
    neutral: '#EEF2FF',
    textHighlight: 'text-indigo-600',
    barFill: 'bg-indigo-600',
    markerFill: '#4F46E5'
  },
  others: {
    gradient: ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#475569'], // Slate
    neutral: '#F1F5F9',
    textHighlight: 'text-slate-600',
    barFill: 'bg-slate-600',
    markerFill: '#475569'
  }
};

function getSectorTheme(dataset) {
  const sector = String(dataset?.sectorKey || dataset?.sector || '').toLowerCase();
  if (sector.includes('agriculture') || sector.includes('fert') || sector.includes('sprout')) return DOMAIN_COLORS.agriculture;
  if (sector.includes('census') || sector.includes('surv') || sector.includes('stat')) return DOMAIN_COLORS.census;
  if (sector.includes('education') || sector.includes('school') || sector.includes('grad')) return DOMAIN_COLORS.education;
  if (sector.includes('finance') || sector.includes('econ') || sector.includes('bank') || sector.includes('wallet')) return DOMAIN_COLORS.finance;
  if (sector.includes('health') || sector.includes('family') || sector.includes('medic') || sector.includes('heart')) return DOMAIN_COLORS.health;
  if (sector.includes('transport') || sector.includes('road') || sector.includes('truck')) return DOMAIN_COLORS.transport;
  return DOMAIN_COLORS.others; 
}

const HIGHLIGHT_FILL = '#2563EB';
const SELECTED_STROKE = '#2563EB';
const FADED_FILL = '#F9FAFB';

function choroplethColor(value, maxValue, theme) {
  if (!value || !maxValue) return theme.neutral;
  const ratio = Math.min(value / maxValue, 1);
  const idx = Math.min(Math.floor(ratio * (theme.gradient.length - 1)), theme.gradient.length - 1);
  return theme.gradient[idx];
}

/* ─── Tooltip component ─── */
function Tooltip({ x, y, stateName, metricLabel, value, total, rank, theme }) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  
  return (
    <div
      className="pointer-events-none fixed z-[9999] rounded-xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95"
      style={{ left: x + 12, top: y - 12, transform: 'translate(0, -50%)' }}
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--surface-muted)] ${theme.textHighlight}`}>
          <Navigation className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold text-gray-900 dark:text-white">{stateName}</div>
          {rank != null && (
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rank #{rank}</div>
          )}
        </div>
      </div>
      
      {metricLabel && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{metricLabel}</span>
            <span className={`text-sm font-bold ${theme.textHighlight}`}>{(value ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">% Share</span>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{percentage}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Legend component (inside map area) ─── */
function Legend({ label, theme }) {
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-md backdrop-blur-sm dark:bg-gray-900/90" style={{ zIndex: 5 }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Low</span>
      <div className="flex h-3 overflow-hidden rounded-sm">
        {theme.gradient.map((c) => (
          <div key={c} style={{ background: c, width: 18, height: 12 }} />
        ))}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">High</span>
      {label && <span className="ml-1 text-[10px] text-gray-400">({label})</span>}
    </div>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export default function GeoViewModalMap({ isOpen, onClose, dataset, records = [], isLoading }) {
  const { t } = useTranslation();
  const theme = getSectorTheme(dataset);
  const [selectedState, setSelectedState] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, name: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetricIdx, setSelectedMetricIdx] = useState(0);
  const geoJsonCacheRef = useRef(null);

  /* ─── Process dataset records ─── */
  const geoData = useMemo(() => {
    if (!records.length) {
      return { type: 'empty', points: [], groups: [], states: [], numericColumns: [] };
    }

    const columns = Object.keys(records[0]);
    const { latitude, longitude } = detectCoordinateColumns(columns);

    if (latitude && longitude) {
      const points = records
        .map((rec) => ({
          label: rec.name || rec.title || rec[detectLocationColumn(records, columns)] || 'Point',
          latitude: Number(rec[latitude]),
          longitude: Number(rec[longitude]),
        }))
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

      if (points.length) {
        return { type: 'coordinates', points, latitude, longitude, numericColumns: [] };
      }
    }

    const stateColumn = detectStateColumn(records, columns);
    if (stateColumn) {
      const numericColumns = detectNumericColumns(records, columns.filter((c) => c !== stateColumn));
      const metricColumn = numericColumns[0] || null;
      const groupedStates = {};

      records.forEach((rec) => {
        const rawState = String(rec[stateColumn] || '').trim();
        if (!rawState) return;
        const name = canonicalStateName(rawState);
        if (!groupedStates[name]) {
          groupedStates[name] = { label: name, values: {}, rows: 0 };
        }
        groupedStates[name].rows += 1;
        // Store values for ALL numeric columns
        numericColumns.forEach((col) => {
          if (!groupedStates[name].values[col]) groupedStates[name].values[col] = 0;
          groupedStates[name].values[col] += metricValue(rec, col);
        });
      });

      const states = Object.values(groupedStates)
        .filter((s) => s.label)
        .map((s) => ({ ...s, value: metricColumn ? (s.values[metricColumn] || 0) : s.rows }))
        .sort((a, b) => b.value - a.value);

      if (states.length) {
        return { type: 'states', stateColumn, metricColumn, numericColumns, states };
      }
    }

    const locationColumn = detectLocationColumn(records, columns);
    if (locationColumn) {
      const numericColumns = detectNumericColumns(records, columns.filter((c) => c !== locationColumn));
      const metricColumn = numericColumns[0] || null;
      
      let mappedToStateCount = 0;
      const groupedStates = {};
      const groupedLocations = {};

      records.forEach((rec) => {
        const rawLoc = String(rec[locationColumn] || '').trim();
        if (!rawLoc || rawLoc.toLowerCase() === 'unknown') return;
        
        // Fallback tracking
        groupedLocations[rawLoc] = (groupedLocations[rawLoc] || 0) + 1;
        
        // Try mapping to state intelligently
        const normLoc = normalizeLabel(rawLoc);
        const mappedState = CITY_TO_STATE[normLoc];
        
        if (mappedState) {
          mappedToStateCount++;
          const stateName = canonicalStateName(mappedState);
          if (!groupedStates[stateName]) {
            groupedStates[stateName] = { label: stateName, values: {}, rows: 0 };
          }
          groupedStates[stateName].rows += 1;
          numericColumns.forEach((col) => {
            if (!groupedStates[stateName].values[col]) groupedStates[stateName].values[col] = 0;
            groupedStates[stateName].values[col] += metricValue(rec, col);
          });
        }
      });

      // If any of the locations mapped successfully to states, render as State map!
      if (mappedToStateCount > 0) {
        const states = Object.values(groupedStates)
          .filter((s) => s.label)
          .map((s) => ({ ...s, value: metricColumn ? (s.values[metricColumn] || 0) : s.rows }))
          .sort((a, b) => b.value - a.value);

        return { type: 'states', stateColumn: locationColumn, metricColumn, numericColumns, states, mappedFromLocation: true };
      }

      // Otherwise, just a generic groups list
      const groups = Object.entries(groupedLocations)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      return { type: 'groups', groups, locationColumn, numericColumns: [] };
    }

    return { type: 'none', points: [], groups: [], states: [], numericColumns: [] };
  }, [records]);

  /* Active metric column (for switching) */
  const activeMetricCol = useMemo(() => {
    if (geoData.type !== 'states' || !geoData.numericColumns.length) return null;
    return geoData.numericColumns[selectedMetricIdx % geoData.numericColumns.length] || null;
  }, [geoData, selectedMetricIdx]);

  /* Recompute state values and ranks when metric changes */
  const { stateMetricMap, maxStateValue, rankedStates } = useMemo(() => {
    if (geoData.type !== 'states') return { stateMetricMap: {}, maxStateValue: 0, rankedStates: [] };

    const col = activeMetricCol;
    const mapped = geoData.states.map((s) => ({
      ...s,
      value: col ? (s.values[col] || 0) : s.rows,
    }));
    mapped.sort((a, b) => b.value - a.value);

    const ranked = mapped.map((s, i) => ({ ...s, rank: i + 1 }));
    const map = {};
    ranked.forEach((s) => {
      map[normalizeLabel(s.label)] = s;
    });
    const max = ranked.length ? Math.max(...ranked.map((s) => s.value)) : 0;

    return { stateMetricMap: map, maxStateValue: max, rankedStates: ranked };
  }, [geoData, activeMetricCol]);

  /* Search filtering */
  const searchNorm = normalizeLabel(searchQuery);
  const matchingStateNames = useMemo(() => {
    if (!searchNorm) return null; // null = show all
    const set = new Set();
    rankedStates.forEach((s) => {
      if (normalizeLabel(s.label).includes(searchNorm)) {
        set.add(normalizeLabel(s.label));
      }
    });
    return set;
  }, [searchNorm, rankedStates]);

  const filteredStates = useMemo(() => {
    if (!matchingStateNames) return rankedStates;
    return rankedStates.filter((s) => matchingStateNames.has(normalizeLabel(s.label)));
  }, [matchingStateNames, rankedStates]);

  // Flush tooltip and selection on metric change to avoid stale data
  useEffect(() => {
    setTooltip(prev => ({ ...prev, show: false }));
    setSelectedState(null);
  }, [selectedMetricIdx]);

  /* ─── Handlers ─── */
  const handleMouseEnter = useCallback(
    (geo, evt) => {
      const stateName = geo.properties?.name || geo.id;
      setTooltip({
        show: true,
        x: evt.clientX,
        y: evt.clientY,
        name: stateName,
      });
    },
    [],
  );

  const handleMouseMove = useCallback((evt) => {
    setTooltip((prev) => ({ ...prev, x: evt.clientX, y: evt.clientY }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ show: false, x: 0, y: 0, name: '' });
  }, []);

  const handleStateClick = useCallback((geo) => {
    const stateName = geo.properties?.name || geo.id;
    setSelectedState((prev) => (prev === stateName ? null : stateName));
  }, []);

  /* ─── Compute fill for a geography ─── */
  const getStateFill = useCallback(
    (geo) => {
      const stateName = geo.properties?.name || geo.id;
      const norm = normalizeLabel(stateName);
      const match = stateMetricMap[norm];

      // If searching, fade unmatched states
      if (matchingStateNames && !matchingStateNames.has(norm)) {
        return FADED_FILL;
      }

      if (!match) return theme.neutral;
      return choroplethColor(match.value, maxStateValue, theme);
    },
    [stateMetricMap, maxStateValue, matchingStateNames, theme],
  );

  const getStateStroke = useCallback(
    (geo) => {
      const stateName = geo.properties?.name || geo.id;
      if (selectedState === stateName) return SELECTED_STROKE;
      return '#374151';
    },
    [selectedState],
  );

  const getStateStrokeWidth = useCallback(
    (geo) => {
      const stateName = geo.properties?.name || geo.id;
      if (selectedState === stateName) return 2.2;
      return 0.6;
    },
    [selectedState],
  );

  /* Selected state panel info */
  const selectedStateInfo = useMemo(() => {
    if (!selectedState) return null;
    return stateMetricMap[normalizeLabel(selectedState)] || null;
  }, [selectedState, stateMetricMap]);

  if (!isOpen || typeof document === 'undefined') return null;

  const metricLabel = activeMetricCol || (geoData.type === 'states' ? 'Row Count' : '');

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-gray-950 border border-black shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Geo View')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Interactive India map with dataset-driven geographic values.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Dataset info bar */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
            <div className="font-semibold text-gray-900 dark:text-white">{dataset?.title || 'Dataset'}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">States or markers render only when the dataset includes explicit geographic fields.</div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading dataset geography view...
            </div>
          )}

          {/* ═══ STATES VIEW (choropleth) ═══ */}
          {!isLoading && geoData.type === 'states' && (
            <div className="space-y-4">
              {/* Search + Metric Selector bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search states..."
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                {geoData.numericColumns.length >= 1 && (
                  <div className="relative">
                    <select
                      value={selectedMetricIdx}
                      onChange={(e) => setSelectedMetricIdx(Number(e.target.value))}
                      className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      {geoData.numericColumns.map((col, idx) => (
                        <option key={col} value={idx}>{col}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                {/* Map container */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                  <div className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    India State View
                    <span className="text-xs font-normal text-gray-400">(Ranked by {metricLabel})</span>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 pb-8">
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: [82, 22.5], scale: 900 }}
                      className="w-full h-auto"
                    >
                      <Geographies geography={INDIA_MAP_URL}>
                        {({ geographies }) =>
                          geographies.map((geo) => (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={getStateFill(geo)}
                              stroke={getStateStroke(geo)}
                              strokeWidth={getStateStrokeWidth(geo)}
                              onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                              onMouseMove={handleMouseMove}
                              onMouseLeave={handleMouseLeave}
                              onClick={() => handleStateClick(geo)}
                              style={{
                                default: { outline: 'none', transition: 'fill 0.2s ease, stroke-width 0.2s ease' },
                                hover: { outline: 'none', fill: HIGHLIGHT_FILL, cursor: 'pointer' },
                                pressed: { outline: 'none' },
                              }}
                            />
                          ))
                        }
                      </Geographies>
                    </ComposableMap>
                    {/* Legend */}
                    <Legend label={metricLabel} theme={theme} />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Using {geoData.stateColumn}{activeMetricCol ? ` × ${activeMetricCol}` : ' with row counts'}
                    {' · '}{rankedStates.length} states matched
                  </div>
                </div>

                {/* Matched States panel */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                  <div className="font-semibold mb-1 text-gray-900 dark:text-white">
                    Matched States
                    <span className="ml-2 text-xs font-normal text-gray-400">({filteredStates.length})</span>
                  </div>

                  {/* Selected state detail */}
                  {selectedStateInfo && (
                    <div className="relative mb-3 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-3 pr-8 text-sm">
                      <button 
                        onClick={() => setSelectedState(null)} 
                        className="absolute right-2 top-2 p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                        title="Clear selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="font-bold text-blue-700 dark:text-blue-300">{selectedState}</div>
                      <div className="mt-1 text-blue-600 dark:text-blue-400">
                        {metricLabel}: <span className="font-semibold">{selectedStateInfo.value?.toLocaleString()}</span>
                      </div>
                      <div className="text-blue-500 dark:text-blue-400 text-xs">
                        Rank #{selectedStateInfo.rank} of {rankedStates.length} · {selectedStateInfo.rows} row{selectedStateInfo.rows !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[460px] overflow-y-auto">
                    {filteredStates.map((state) => {
                      const isSelected = selectedState === state.label;
                      return (
                        <button
                          key={state.label}
                          type="button"
                          onClick={() => setSelectedState((prev) => (prev === state.label ? null : state.label))}
                          className={`w-full text-left rounded-xl border p-3 text-sm transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                              : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-900 dark:text-white">{state.label}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">#{state.rank}</span>
                              <div className="h-3 w-3 rounded-sm" style={{ background: choroplethColor(state.value, maxStateValue, theme) }} />
                            </div>
                          </div>
                          <div className="mt-1 text-gray-500 dark:text-gray-400 text-xs">
                            {metricLabel}: {state.value.toLocaleString()} · {state.rows} row{state.rows !== 1 ? 's' : ''}
                          </div>
                          {/* Mini bar */}
                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${theme.barFill} transition-all`}
                              style={{ width: `${Math.max(4, (state.value / maxStateValue) * 100)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                    {filteredStates.length === 0 && (
                      <div className="py-6 text-center text-sm text-gray-400">No states match your search.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ COORDINATES VIEW ═══ */}
          {!isLoading && geoData.type === 'coordinates' && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                  India Coordinate View
                  <span className="text-xs font-normal text-gray-400">(Plotted by lat/lng)</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                  <ComposableMap projection="geoMercator" projectionConfig={{ center: [82, 23], scale: 1000 }} className="w-full h-auto">
                    <Geographies geography={INDIA_MAP_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={theme.neutral}
                            stroke="#374151"
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
                        <circle r={3.5} fill={theme.markerFill} stroke="#111827" strokeWidth={0.5} />
                      </Marker>
                    ))}
                  </ComposableMap>
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Navigation className="w-4 h-4" /> Using {geoData.latitude} and {geoData.longitude} · {geoData.points.length} points
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

          {/* ═══ GROUPS VIEW ═══ */}
          {!isLoading && geoData.type === 'groups' && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                  India Location View
                  <span className="text-xs font-normal text-gray-400">(Mapped by points)</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                  <ComposableMap projection="geoMercator" projectionConfig={{ center: [82, 23], scale: 1000 }} className="w-full h-auto">
                    <Geographies geography={INDIA_MAP_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={theme.neutral}
                            stroke="#374151"
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
                  </ComposableMap>
                </div>
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Using {geoData.locationColumn} for location mapping. Points without coordinates cannot be accurately plotted.
                </div>
              </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950 flex flex-col h-full">
                  <div className="font-semibold mb-4 text-gray-900 dark:text-white flex items-center justify-between">
                    <div>Matched Locations <span className="text-gray-400 font-normal">({geoData.groups.length})</span></div>
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {geoData.groups.map((group) => (
                    <div key={group.label} className="grid grid-cols-[minmax(0,1fr)_80px] gap-4 items-center">
                      <div>
                        <div className={`text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2`}><MapPin className={`w-4 h-4 ${theme.textHighlight}`} />{group.label}</div>
                        <div className="h-2 mt-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                          <div className={`h-full ${theme.barFill}`} style={{ width: `${Math.max(8, (group.count / geoData.groups[0].count) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right font-semibold text-gray-700 dark:text-gray-200">{group.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ NO GEO DATA ═══ */}
          {!isLoading && (geoData.type === 'none' || geoData.type === 'empty') && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950">
              <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Geographic data not available for visualization</div>
              <div className="text-sm">Geo View is available when the dataset contains latitude/longitude fields or an explicit state column that can be matched to the India map.</div>
            </div>
          )}
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip.show && (
        <Tooltip
          x={tooltip.x}
          y={tooltip.y}
          stateName={tooltip.name}
          metricLabel={metricLabel}
          value={stateMetricMap[normalizeLabel(tooltip.name)]?.value ?? 0}
          total={maxStateValue || 1}
          rank={stateMetricMap[normalizeLabel(tooltip.name)]?.rank ?? null}
          theme={theme}
        />
      )}
    </div>,
    document.body,
  );
}
