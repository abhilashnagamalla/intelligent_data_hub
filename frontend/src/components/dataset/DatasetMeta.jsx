import { Calendar, Building2, Tag, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { allStatesOption, getStateCode, getStateName } from '../../constants/states';
import { formatSectorLabel, sectorLabels } from '../../constants/sectors';

export default function DatasetMeta({ dataset, className = "" }) {
  const { t, i18n } = useTranslation();
  const languageCode = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return t('N/A');
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getLocalizedState = (stateValue) => {
    const normalizedState = String(stateValue || '').trim();
    if (!normalizedState) return t('All India');
    if (
      normalizedState.toUpperCase() === allStatesOption.code
      || normalizedState === allStatesOption.en
    ) {
      return allStatesOption[languageCode] || allStatesOption.en;
    }
    if (normalizedState === 'All India') {
      return t('All India');
    }

    const stateCode = getStateCode(normalizedState)
      || (normalizedState.length <= 3 ? normalizedState.toUpperCase() : null);

    if (stateCode && stateCode !== allStatesOption.code) {
      return getStateName(stateCode, languageCode);
    }

    return t(normalizedState);
  };

  const getSectorLabel = () => {
    const sectorValue = String(dataset.sectorKey || dataset.sector || dataset.category || 'General').trim();
    if (!sectorValue) return t('General');

    const normalizedSector = sectorValue.toLowerCase();
    if (sectorLabels[normalizedSector]) {
      return t(formatSectorLabel(normalizedSector));
    }

    return t(sectorValue);
  };

  const localizedState = getLocalizedState(dataset.state);
  const localizedSector = getSectorLabel();
  const hasSpecificState = Boolean(
    dataset.state
    && String(dataset.state).trim()
    && String(dataset.state).trim().toUpperCase() !== allStatesOption.code
    && String(dataset.state).trim() !== allStatesOption.en
    && String(dataset.state).trim() !== 'All India'
  );

  const getDisplayOrg = () => {
    let org = dataset.organization || dataset.department || t('Government of India');
    
    // Consistency logic (matching CatalogCard logic)
    if (hasSpecificState && (dataset.sector || dataset.sectorKey)) {
      org = `${localizedState} ${localizedSector} ${t('Department')}`;
    } else if (dataset.sector || dataset.sectorKey) {
      org = `${t('Ministry of')} ${localizedSector}`;
    }
    return org;
  };

  const metadataItems = [
    {
      label: t('Organization'),
      value: getDisplayOrg(),
      icon: Building2,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: t('Domain'),
      value: localizedSector,
      icon: Tag,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: t('State'),
      value: hasSpecificState ? localizedState : t('All India'),
      icon: MapPin,
      color: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      label: t('Published'),
      value: formatDate(dataset.publishedDate || dataset.published_at),
      icon: Calendar,
      color: 'text-orange-600 dark:text-orange-400'
    },
    {
      label: t('Updated'),
      value: formatDate(dataset.updatedDate || dataset.updated_at),
      icon: Calendar,
      color: 'text-rose-600 dark:text-rose-400'
    }
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 ${className}`}>
      {metadataItems.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-900/90"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 ${item.color}`}>
            <item.icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-300">{item.label}</div>
            <div className="text-sm font-bold text-gray-800 dark:text-white truncate" title={item.value}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
