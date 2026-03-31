import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../../api";
import {
  LayoutDashboard,
  MessageCirclePlus,
  ChevronLeft,
  ChevronRight,
  Apple,
  GraduationCap,
  HeartPulse,
  Truck,
  DollarSign,
  FileBarChart,
  Database,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatSectorLabel } from '../../constants/sectors';

const domainIcons = {
  agriculture: Apple,
  education: GraduationCap,
  health: HeartPulse,
  transport: Truck,
  finance: DollarSign,
  census: FileBarChart,
};

const defaultDomains = [
  { sector: 'agriculture', datasets: null },
  { sector: 'census', datasets: null },
  { sector: 'education', datasets: null },
  { sector: 'finance', datasets: null },
  { sector: 'health', datasets: null },
  { sector: 'transport', datasets: null },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [domains, setDomains] = useState(defaultDomains);
  const { t } = useTranslation();

  useEffect(() => {
    api.get('/domains')
      .then((res) => {
        const bySector = new Map((res.data || []).map((domain) => [domain.sector, domain]));
        setDomains(defaultDomains.map((domain) => ({ ...domain, ...(bySector.get(domain.sector) || {}) })));
      })
      .catch(() => {
        setDomains(defaultDomains);
      });
  }, []);

  const isActive = (path) => location.pathname.includes(path);

  const handleNav = (path) => {
    navigate(path);
    onClose?.(); // close drawer on mobile after navigation
  };

  // Desktop: sidebar is always in-flow; mobile: fixed drawer
  return (
    <>
      {/* Desktop sidebar (lg+): inline, collapsible */}
      <div
        className={`
          hidden lg:flex flex-col h-screen bg-gradient-to-b from-gray-900 to-black
          text-white shadow-2xl border-r border-gray-800
          transition-all duration-300
          ${collapsed ? 'w-20' : 'w-64 xl:w-72'}
        `}
      >
        <SidebarContent
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          domains={domains}
          isActive={isActive}
          handleNav={handleNav}
          t={t}
          showClose={false}
          onClose={onClose}
        />
      </div>

      {/* Mobile sidebar (<lg): off-canvas drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          w-72 bg-gradient-to-b from-gray-900 to-black
          text-white shadow-2xl border-r border-gray-800
          transition-transform duration-300 ease-in-out
          lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          collapsed={false}
          setCollapsed={() => {}}
          domains={domains}
          isActive={isActive}
          handleNav={handleNav}
          t={t}
          showClose={true}
          onClose={onClose}
        />
      </div>
    </>
  );
}

function SidebarContent({ collapsed, setCollapsed, domains, isActive, handleNav, t, showClose, onClose }) {
  return (
    <>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
        {showClose ? (
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
        {!collapsed && (
          <div>
            <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              IDH
            </h2>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Intelligent Data Hub
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
        <button
          onClick={() => handleNav('/dashboard')}
          className={`w-full flex items-center gap-3 p-3 sm:p-4 rounded-2xl transition-all group hover:bg-primary/20 ${
            isActive('/dashboard') && !isActive('/chatbot')
              ? 'bg-primary/30 border-r-4 border-primary shadow-glow font-semibold'
              : 'hover:shadow-glow'
          }`}
        >
          <LayoutDashboard className="w-5 sm:w-6 h-5 sm:h-6 flex-shrink-0" />
          {!collapsed && <span className="text-sm sm:text-base">{t('Overview')}</span>}
        </button>

        {/* Removed All Datasets Button */}

        <div className="space-y-1">
          <div className="px-4 py-2 text-xs text-gray-500 uppercase font-semibold tracking-wider opacity-75">
            {!collapsed && t('Domains')}
          </div>
          {domains.map((domain) => {
            const Icon = domainIcons[domain.sector.toLowerCase()] || LayoutDashboard;
            return (
              <button
                key={domain.sector}
                onClick={() => handleNav(`/domain/${domain.sector}`)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group hover:bg-white/10 ${
                  isActive(`/domain/${domain.sector}`) ? 'bg-primary/20 border-r-4 border-primary font-medium' : ''
                }`}
              >
                <Icon className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 opacity-80 group-hover:opacity-100" />
                {!collapsed && (
                  <span className="truncate text-sm sm:text-base">
                    {t(formatSectorLabel(domain.sector))}
                  </span>
                )}
                {!collapsed && (
                  <div className="ml-auto text-xs bg-white/10 px-2 py-1 rounded-full font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    {domain.datasets ?? '...'}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => handleNav('/dashboard/chatbot')}
          className={`w-full flex items-center gap-3 p-3 sm:p-4 rounded-2xl transition-all group hover:bg-accent/20 ${
            isActive('/chatbot') ? 'bg-accent/30 border-r-4 border-accent shadow-glow font-semibold' : 'hover:shadow-glow'
          }`}
        >
          <MessageCirclePlus className="w-5 sm:w-6 h-5 sm:h-6 flex-shrink-0" />
          {!collapsed && <span className="text-sm sm:text-base">{t('Domain Chatbot')}</span>}
        </button>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0">
        <div className="text-xs text-gray-500 text-center">
          {!collapsed && 'v1.0.0'}
        </div>
      </div>
    </>
  );
}
