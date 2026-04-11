import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Hash, Award, BarChart3, PieChart as PieIcon, Download, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];
const labelStyle = { fill: '#6B7280', fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif' };

const SECTOR_KPI = ({ title, value, subtext, icon, colorClass }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -5 }}
    className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center justify-center transition-all duration-300"
  >
    <div className={`p-4 rounded-2xl ${colorClass} bg-opacity-10 mb-4`}>
        {icon}
    </div>
    <h4 className="text-4xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">{value}</h4>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{title}</p>
    {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
  </motion.div>
);

const SectorVisualizer = ({ catalogs }) => {
  const { t } = useTranslation();

  // Aggressive name shortening for cleaner chart UI rendering
  const shortenName = (name, limit = 25) => {
    if (!name) return '';
    
    let cleanName = name.toString();
    if (cleanName.startsWith('[') && cleanName.endsWith(']')) {
      try {
        const parsed = JSON.parse(cleanName);
        if (Array.isArray(parsed)) cleanName = parsed[0];
      } catch (e) {
        cleanName = cleanName.replace(/[\[\]"]/g, '');
      }
    }
    cleanName = cleanName.replace(/^["']|["']$/g, '');

    let short = cleanName
      .replace(/Government of India/gi, 'GoI')
      .replace(/Department of/gi, 'Dept.')
      .replace(/Ministry of/gi, 'Min.')
      .replace(/Commission(er)? of/gi, 'Comm.')
      .replace(/Registrar General and Census Commissioner/gi, 'RG & Census Comm.')
      .replace(/State\/UT-wise Details of/gi, '')
      .replace(/National/gi, 'Nat.')
      .trim();
    
    return short.length > limit ? short.substring(0, limit) + '...' : short;
  };

  const visualization = useMemo(() => {
    if (!catalogs || catalogs.length === 0) return null;

    const totalCatalogs = catalogs.length;
    
    // Aggregation maps
    const orgMap = catalogs.reduce((acc, cat) => {
      const org = cat.organization || t('Unknown');
      acc[org] = (acc[org] || 0) + 1;
      return acc;
    }, {});
    const topOrgRaw = Object.keys(orgMap).sort((a,b) => orgMap[b] - orgMap[a])[0];

    const stateMap = catalogs.reduce((acc, cat) => {
      const state = cat.state || t('All States');
      if (state !== 'All States') acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
    const stateList = Object.keys(stateMap).map(k => ({ name: k, value: stateMap[k] })).sort((a,b) => b.value - a.value);
    const topState = stateList[0]?.name || t('N/A');

    const charts = [];

    // Chart 1: Top Organizations (Vertical Bar)
    const topOrgs = Object.keys(orgMap)
      .map(name => ({ name: shortenName(name, 28), value: orgMap[name] }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 8);
    
    charts.push({
       id: 'orgs',
       title: t('Top Contributing Organizations'),
       subtitle: t('Volume of datasets published by active departmental source'),
       data: topOrgs,
       type: 'bar',
       layout: 'vertical',
       icon: <Building2 className="w-5 h-5 text-blue-500" />
    });

    // Chart 2: Most Accessed Datasets (Vertical Bar)
    const mostDownloaded = catalogs
      .filter(c => c.views > 0 || c.downloads > 0 || c.datasets_count > 1)
      .sort((a,b) => {
        const scoreA = (a.downloads || 0) + (a.views || 0) + (a.datasets_count || 0);
        const scoreB = (b.downloads || 0) + (b.views || 0) + (b.datasets_count || 0);
        return scoreB - scoreA;
      })
      .slice(0, 7)
      .map(c => ({ name: shortenName(c.title, 35), value: ((c.downloads || c.datasets_count * 10) + (c.views || 0)) }));
      
    if (mostDownloaded.length > 3) {
      charts.push({
         id: 'downloads',
         title: t('Top Accessed Datasets'),
         subtitle: t('Most popular statistical collections by activity impact'),
         data: mostDownloaded,
         type: 'bar',
         layout: 'vertical',
         icon: <Download className="w-5 h-5 text-indigo-500" />
      });
    }

    // Chart 3: Regional Density (Horizontal Bar)
    const validStates = stateList.filter(s => s.name !== 'All States' && s.name !== 'India');
    if (validStates.length > 0) {
      charts.push({
         id: 'states',
         title: t('Regional Data Density'),
         subtitle: t('Volume of granular datasets mapped across Indian regions'),
         data: validStates.slice(0, 10).map(s => ({ ...s, name: shortenName(s.name, 15) })),
         type: 'bar',
         layout: 'horizontal',
         icon: <MapPin className="w-5 h-5 text-emerald-500" />
      });
    }

    // Chart 4: Publishing Velocity Timeline (Line Chart)
    const timelineMap = catalogs.reduce((acc, cat) => {
      const dateStr = cat.publishedDate || cat.updatedDate;
      if (dateStr) {
         let year = dateStr.includes('-') ? dateStr.split('-')[0] : null;
         if (year && year.length === 2 && dateStr.split('-')[2]) {
             year = dateStr.split('-')[2]; // Handle DD-MM-YYYY format
         }
         if (year && year.length === 4 && year.startsWith('20')) {
             acc[year] = (acc[year] || 0) + 1;
         }
      }
      return acc;
    }, {});
    const timelineData = Object.keys(timelineMap)
       .sort((a,b) => parseInt(a) - parseInt(b))
       .map(year => ({ name: year, value: timelineMap[year] }));
       
    if (timelineData.length > 2) {
      charts.push({
         id: 'timeline',
         title: t('Publishing Velocity'),
         subtitle: t('Year-over-year dataset catalog releases'),
         data: timelineData,
         type: 'line',
         icon: <Calendar className="w-5 h-5 text-orange-500" />
      });
    }

    // Chart 5: Organization Type Breakdown (Pie Chart)
    const orgTypeMap = Object.keys(orgMap).reduce((acc, name) => {
       const type = name.toLowerCase().includes('ministry') ? t('Ministry') : 
                    name.toLowerCase().includes('department') ? t('Department') : t('Autonomous/Other');
       acc[type] = (acc[type] || 0) + orgMap[name];
       return acc;
    }, {});
    
    // Ensure Pie is always last and spans nicely
    charts.push({
       id: 'org-type',
       title: t('Organization Archetype Breakdown'),
       subtitle: t('Administrative distribution of active publishers'),
       data: Object.keys(orgTypeMap).map(k => ({ name: k, value: orgTypeMap[k] })),
       type: 'pie',
       icon: <PieIcon className="w-5 h-5 text-purple-500" />
    });

    return { kpis: { totalCatalogs, topOrg: shortenName(topOrgRaw, 15), topState }, charts };
  }, [catalogs, t]);

  if (!visualization) return null;

  const { kpis, charts } = visualization;

  return (
    <div className="space-y-16 mt-8">
      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in zoom-in duration-500">
        <SECTOR_KPI 
          title={t("Total Catalogs")} 
          value={kpis.totalCatalogs} 
          subtext={t("Live data sources")} 
          icon={<Hash className="w-6 h-6" />} 
          colorClass="bg-blue-500 text-blue-500"
        />
        <SECTOR_KPI 
          title={t("Leading State")} 
          value={kpis.topState} 
          subtext={t("Most active region")} 
          icon={<MapPin className="w-6 h-6" />} 
          colorClass="bg-emerald-500 text-emerald-500"
        />
        <SECTOR_KPI 
          title={t("Top Publisher")} 
          value={kpis.topOrg} 
          subtext={t("Majority contributor")} 
          icon={<Award className="w-6 h-6" />} 
          colorClass="bg-amber-500 text-amber-500"
        />
        <SECTOR_KPI 
          title={t("Coverage")} 
          value="100%" 
          subtext={t("Domain integration")} 
          icon={<BarChart3 className="w-6 h-6" />} 
          colorClass="bg-purple-500 text-purple-500"
        />
      </div>

      {/* Dynamic Main Insights Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-14">
        {charts.map((chart, idx) => {
          const isLayoutVert = chart.layout === 'vertical';
          
          return (
            <div
              key={chart.id}
              className={`bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all border border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-[50px] ${chart.type === 'pie' ? 'lg:col-span-2' : ''}`}
              style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'both' }}
            >
               {/* Chart Header */}
               <div className="flex items-start gap-5 mb-10">
                 <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-inner border border-gray-100 dark:border-gray-700">
                   {chart.icon}
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight tracking-tight">{chart.title}</h3>
                    <p className="text-sm text-gray-500 font-semibold leading-relaxed max-w-md">{chart.subtitle}</p>
                 </div>
               </div>
  
               {/* Dynamic Render Surface */}
               <div className="h-[430px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chart.type === 'bar' ? (
                      <BarChart data={chart.data} layout={chart.layout} margin={{ left: chart.layout === 'vertical' ? 10 : 20, right: 30, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={chart.layout !== 'vertical'} vertical={chart.layout === 'vertical'} stroke="#88888815" />
                        
                        {chart.layout === 'vertical' ? (
                          <>
                            <XAxis type="number" axisLine={false} tickLine={false} tick={labelStyle} hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={labelStyle} width={180} />
                          </>
                        ) : (
                          <>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={labelStyle} height={60} tickMargin={10} />
                            <YAxis axisLine={false} tickLine={false} tick={labelStyle} width={40} />
                          </>
                        )}
                        
                        <Tooltip 
                          cursor={{fill: 'rgba(59, 130, 246, 0.05)'}} 
                          contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '1.2rem', color: '#fff', padding: '16px', fontWeight: 'bold' }} 
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="value" fill="#3B82F6" radius={chart.layout === 'vertical' ? [0, 8, 8, 0] : [8, 8, 0, 0]} barSize={26}>
                           {chart.data.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Bar>
                      </BarChart>
                    ) : chart.type === 'line' ? (
                      <LineChart data={chart.data} margin={{ left: 20, right: 40, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888815" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={labelStyle} tickMargin={15} />
                        <YAxis axisLine={false} tickLine={false} tick={labelStyle} width={40} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '1.2rem', color: '#fff', padding: '16px', fontWeight: 'bold' }} 
                        />
                        <Line type="stepAfter" dataKey="value" stroke="#F59E0B" strokeWidth={5} activeDot={{ r: 8, fill: "#F59E0B" }} dot={{ r: 5, fill: "#fff", strokeWidth: 3 }} />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie 
                          data={chart.data} 
                          cx="50%" cy="45%" 
                          innerRadius={110} outerRadius={150} 
                          paddingAngle={8} dataKey="value" stroke="none"
                          animationBegin={200}
                        >
                           {chart.data.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '1.2rem', color: '#fff', padding: '15px', fontWeight: 'bold' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: 600, fontSize: '13px', color: '#4B5563' }} />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectorVisualizer;
