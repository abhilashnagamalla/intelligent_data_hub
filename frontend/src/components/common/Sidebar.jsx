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
import ContactUs from './ContactUs';

const domainIcons = {
  agriculture: Apple,
  education: GraduationCap,
  health: HeartPulse,
  transport: Truck,
  finance: DollarSign,
  census: FileBarChart,
};

const sectorColors = {
  agriculture: { light: '#10b981', dark: '#34d399', name: 'emerald' },
  health: { light: '#ef4444', dark: '#f87171', name: 'red' },
  education: { light: '#3b82f6', dark: '#60a5fa', name: 'blue' },
  transport: { light: '#f97316', dark: '#fb923c', name: 'orange' },
  census: { light: '#a855f7', dark: '#d8b4fe', name: 'purple' },
  finance: { light: '#14b8a6', dark: '#2dd4bf', name: 'teal' },
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('idh-sidebar-collapsed') === '1';
  });
  const [domains, setDomains] = useState(defaultDomains);
  const [hoveredDomain, setHoveredDomain] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('idh-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose?.();
    }
  };

  // Desktop: sidebar is always in-flow; mobile: fixed drawer
  return (
    <>
      {/* Desktop sidebar (lg+): inline, collapsible */}
      <div
        className={`
          hidden lg:flex flex-col h-screen bg-gradient-to-b from-gray-900 to-black
          text-white shadow-2xl border-r-2 border-black
          transition-all duration-300
          ${collapsed ? 'w-20' : 'w-64 xl:w-72'}
        `}
      >
        <SidebarContent
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          hoveredDomain={hoveredDomain}
          setHoveredDomain={setHoveredDomain}
          mousePos={mousePos}
          setMousePos={setMousePos}
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
          text-white shadow-2xl border-r-2 border-black
          transition-transform duration-300 ease-in-out
          lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          collapsed={false}
          setCollapsed={() => {}}
          hoveredDomain={hoveredDomain}
          setHoveredDomain={setHoveredDomain}
          mousePos={mousePos}
          setMousePos={setMousePos}
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

function SidebarContent({ collapsed, setCollapsed, hoveredDomain, setHoveredDomain, mousePos, setMousePos, domains, isActive, handleNav, t, showClose, onClose }) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b-2 border-black p-4 sm:p-6">
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
            <h2 className="text-xl sm:text-2xl font-black text-white">
              IDH
            </h2>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              {t('Intelligent Data Hub')}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
        <button
          onClick={() => handleNav('/dashboard')}
          className={`w-full flex items-center gap-3 rounded-2xl border-2 border-black p-3 sm:p-4 text-left text-white transition-colors ${
            isActive('/dashboard') && !isActive('/chatbot')
              ? 'bg-primary/20 font-semibold'
              : 'bg-transparent'
          }`}
        >
          <LayoutDashboard className="w-5 sm:w-6 h-5 sm:h-6 flex-shrink-0" />
          {!collapsed && <span className="text-sm sm:text-base">{t('Overview')}</span>}
        </button>

        {/* Removed All Datasets Button */}

        <div className="space-y-2">
          <div className="px-4 py-2 text-xs text-gray-500 uppercase font-semibold tracking-wider opacity-75">
            {!collapsed && t('Domains')}
          </div>
          <div className="overflow-hidden rounded-2xl border-2 border-black bg-white/5">
            {domains.map((domain, index) => {
              const Icon = domainIcons[domain.sector.toLowerCase()] || LayoutDashboard;
              const sectorColor = sectorColors[domain.sector.toLowerCase()];
              const isActiveDomain = isActive(`/domain/${domain.sector}`);
              
              return (
                <button
                  key={domain.sector}
                  onClick={() => handleNav(`/domain/${domain.sector}`)}
                  onMouseEnter={() => setHoveredDomain(domain.sector)}
                  onMouseLeave={() => {
                    setHoveredDomain(null);
                    setMousePos({ x: 0, y: 0 });
                  }}
                  onMouseMove={(e) => {
                    if (collapsed) {
                      setMousePos({ x: e.clientX + 10, y: e.clientY - 5 });
                    }
                  }}
                  style={isActiveDomain ? { borderLeftColor: sectorColor.light, borderLeftWidth: '4px' } : {}}
                  className={`w-full flex items-center gap-3 p-3 transition-all group relative ${
                    index !== domains.length - 1 ? 'border-b border-white/20' : ''
                  } ${
                    isActiveDomain 
                      ? 'bg-white/15 font-medium shadow-md' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {/* Sector indicator dot */}
                  {isActiveDomain && (
                    <div 
                      className="absolute left-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: sectorColor.light }}
                    />
                  )}
                  <div className="relative">
                    <Icon className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 opacity-80 group-hover:opacity-100" style={isActiveDomain ? { color: sectorColor.light } : {}} />
                    {collapsed && hoveredDomain === domain.sector && mousePos.x > 0 && (
                      <div 
                        className="fixed bg-gray-950 text-white text-xs px-3 py-1.5 rounded whitespace-nowrap font-medium shadow-xl border border-white/80 z-[99999]"
                        style={{
                          left: `${mousePos.x}px`,
                          top: `${mousePos.y}px`,
                          pointerEvents: 'none'
                        }}
                      >
                        {t(formatSectorLabel(domain.sector))}
                      </div>
                    )}
                  </div>
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
        </div>

        <button
          onClick={() => handleNav('/dashboard/chatbot')}
          className={`w-full flex items-center gap-3 rounded-2xl border-2 border-black p-3 sm:p-4 text-left text-white transition-colors ${
            isActive('/chatbot') ? 'bg-accent/20 font-semibold' : 'bg-transparent'
          }`}
        >
          <MessageCirclePlus className="w-5 sm:w-6 h-5 sm:h-6 flex-shrink-0" />
          {!collapsed && <span className="text-sm sm:text-base">{t('Domain Chatbot')}</span>}
        </button>
      </nav>

      {/* Contact Us Section */}
      <ContactUs collapsed={collapsed} />
    </>
  );
}
