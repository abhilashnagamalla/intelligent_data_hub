import { Calendar, Building2, Tag, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DatasetMeta({ dataset, className = "" }) {
  const { t } = useTranslation();

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

  const getDisplayOrg = () => {
    let org = dataset.organization || dataset.department || t('Government of India');
    
    // Consistency logic (matching CatalogCard logic)
    if (dataset.state && dataset.state !== 'All States' && dataset.sector) {
      const sectorName = t(dataset.sector.charAt(0).toUpperCase() + dataset.sector.slice(1));
      org = `${t(dataset.state)} ${sectorName} ${t('Department')}`;
    } else if (dataset.sector) {
      const sectorName = t(dataset.sector.charAt(0).toUpperCase() + dataset.sector.slice(1));
      org = `${t('Ministry of')} ${sectorName}`;
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
      value: t(dataset.sector || dataset.category || 'General'),
      icon: Tag,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: t('State'),
      value: t(dataset.state || 'All India'),
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
        <div key={idx} className="group flex items-center gap-3 p-4 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-gray-800/40 backdrop-blur-sm" style={{ border: '1px solid #d1d5db', borderRadius: '12px', background: '#ffffff' }}>
          <div className={`p-2 rounded-xl bg-gray-50 dark:bg-gray-900/50 group-hover:scale-110 transition-transform ${item.color}`}>
            <item.icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">{item.label}</div>
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate" title={item.value}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
