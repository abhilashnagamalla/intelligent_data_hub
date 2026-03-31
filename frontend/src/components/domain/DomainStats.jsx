import { Database, Library, Package } from 'lucide-react';

const DomainStats = ({ catalogs, datasets, resources }) => (
  <div className="grid grid-cols-3 gap-4">
    <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
      <Database className="w-6 h-6 mx-auto mb-2 text-primary" />
      <div className="text-2xl font-black text-primary">{catalogs}</div>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Catalogs</div>
    </div>
    <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
      <Library className="w-6 h-6 mx-auto mb-2 text-secondary" />
      <div className="text-2xl font-black text-secondary">{datasets}</div>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Datasets</div>
    </div>
    <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
      <Package className="w-6 h-6 mx-auto mb-2 text-accent" />
      <div className="text-2xl font-black text-accent">{resources}</div>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Resources</div>
    </div>
  </div>
);

export default DomainStats;
