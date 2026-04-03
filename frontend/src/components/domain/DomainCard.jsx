import { motion } from 'framer-motion';
import { HeartPulse, GraduationCap, Truck, Apple, FileBarChart, DollarSign, Database, Library, Download, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const domainConfig = {
  health: {
    name: 'Health',
    desc: 'Healthcare datasets and analytics',
    icon: HeartPulse,
    color: 'text-red-600',
    topDatasets: ['State Health Indicators', 'Hospital Infrastructure Data', 'Disease Surveillance Dataset'],
    updated: '2 days ago',
    downloads: 530,
    views: '2.3k',
  },
  education: {
    name: 'Education',
    desc: 'Educational statistics and school data',
    icon: GraduationCap,
    color: 'text-blue-600',
    topDatasets: ['School Enrollment Stats', 'Teacher Distribution Data', 'Exam Results Dataset'],
    updated: '5 days ago',
    downloads: 289,
    views: '1.8k',
  },
  transport: {
    name: 'Transport',
    desc: 'Transportation and logistics datasets',
    icon: Truck,
    color: 'text-orange-600',
    topDatasets: ['Road Accident Data', 'Public Transport Stats', 'Vehicle Registration'],
    updated: '1 week ago',
    downloads: 412,
    views: '3.1k',
  },
  agriculture: {
    name: 'Agriculture',
    desc: 'Agriculture production and farmer data',
    icon: Apple,
    color: 'text-green-600',
    topDatasets: ['Crop Production Stats', 'Farmer Subsidy Data', 'Market Price Trends'],
    updated: '3 days ago',
    downloads: 789,
    views: '4.5k',
  },
  census: {
    name: 'Census',
    desc: 'Population and demographic data',
    icon: FileBarChart,
    color: 'text-purple-600',
    topDatasets: ['Population Census 2011', 'District Demographics', 'Migration Patterns'],
    updated: '1 month ago',
    downloads: 156,
    views: '1.2k',
  },
  finance: {
    name: 'Finance',
    desc: 'Financial and economic datasets',
    icon: DollarSign,
    color: 'text-teal-600',
    topDatasets: ['GDP State-wise', 'Bank Loan Data', 'Tax Revenue Stats'],
    updated: '4 days ago',
    downloads: 367,
    views: '2.8k',
  },
};

export default function DomainCard({ domain, onClick }) {
  const config = domainConfig[domain.sector.toLowerCase()] || domainConfig.health;
  const Icon = config.icon;
  const { t } = useTranslation();

  return (
    <motion.div
      layout
      whileHover={{ y: -2, boxShadow: '0 20px 25px -5px rgba(0, 0,0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="group cursor-pointer bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-[var(--border-subtle)]/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col hover:border-[var(--border-subtle)]/50"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border-subtle)]/30">
        <div className={`p-2.5 rounded-lg ${config.color} bg-opacity-10 border`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg leading-tight">{t(config.name)}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{config.desc}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Database className="w-3.5 h-3.5" />
            {t('Catalogs')}
          </span>
          <span className="font-semibold">{domain.catalogs || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Library className="w-3.5 h-3.5" />
            {t('Datasets')}
          </span>
          <span className="font-semibold">{domain.datasets || 0}</span>
        </div>
      </div>

      {/* Top Datasets */}
      <div className="mb-4 space-y-1">
        <div className="font-medium text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">{t('Top Datasets')}</div>
        <div className="space-y-1">
          {(domain.topDatasets || config.topDatasets).length > 0 ? (
            (domain.topDatasets || config.topDatasets).map((dataset, index) => (
              <div key={index} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
                <span className="truncate">{dataset}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-400 italic">{t('No datasets available')}</div>
          )}
        </div>
      </div>

      {/* Info & Button */}
      <div className="flex items-center justify-end gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4 mt-auto">
        <div className="flex items-center gap-1.5">
          <Download className="w-4 h-4 text-blue-500" />
          <span className="font-semibold">{domain.downloads || 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-green-500" />
          <span className="font-semibold">{domain.views || 0}</span>
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full border border-primary text-primary bg-primary/10 hover:bg-primary/20 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-200"
        onClick={onClick}
      >
        {t('View Details')} →
      </motion.button>
    </motion.div>
  );
}

