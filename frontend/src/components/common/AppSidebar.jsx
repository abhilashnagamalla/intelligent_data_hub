import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Database,
  FileBarChart,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  MessageCirclePlus,
  Sprout,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { formatSectorLabel } from "../../constants/sectors";

const iconMap = {
  agriculture: Sprout,
  education: GraduationCap,
  health: HeartPulse,
  transport: Truck,
  finance: Wallet,
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

const sectors = ["agriculture", "census", "education", "finance", "health", "transport"];

export default function AppSidebar({ open, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [domains, setDomains] = useState([]);

  useEffect(() => {
    api.get("/domains").then((response) => {
      setDomains(response.data || []);
    }).catch(() => {
      setDomains([]);
    });
  }, []);

  const domainMap = new Map(domains.map((domain) => [domain.sector, domain]));

  const navItems = [
    {
      label: t("Overview"),
      icon: LayoutDashboard,
      href: "/dashboard",
      exact: true,
    },
    {
      label: t("Domain Chatbot"),
      icon: MessageCirclePlus,
      href: "/dashboard/chatbot",
      exact: false,
    },
  ];

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-contrast)] px-5 py-6 text-white shadow-[var(--shadow-panel)] transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary font-black text-white">
              IDH
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-300">IDH</div>
              <div className="text-lg font-bold">{t("Intelligent Data Hub")}</div>
            </div>
          </button>
          <button type="button" onClick={onClose} className="rounded-2xl p-2 text-slate-300 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {navItems.map((item) => {
            const active = item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  navigate(item.href);
                  onClose?.();
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                  active ? "bg-white/14 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            <Database className="h-3.5 w-3.5" />
            {t("Domains")}
          </div>
          <div className="space-y-2">
            {sectors.map((sector) => {
              const Icon = iconMap[sector] || Database;
              const stats = domainMap.get(sector);
              const active = location.pathname.startsWith(`/domain/${sector}`);
              const sectorColor = sectorColors[sector];
              
              return (
                <button
                  key={sector}
                  type="button"
                  onClick={() => {
                    navigate(`/domain/${sector}`);
                    onClose?.();
                  }}
                  style={active ? { borderLeft: `4px solid ${sectorColor.light}` } : {}}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200 relative ${
                    active 
                      ? "bg-white/20 text-white shadow-md" 
                      : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {/* Sector indicator dot */}
                  {active && (
                    <div 
                      className="absolute left-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: sectorColor.light }}
                    />
                  )}
                  <Icon className="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t(formatSectorLabel(sector))}</div>
                    <div className="text-xs text-slate-400">
                      {(stats?.datasets || 0).toLocaleString()} {t("Datasets")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
