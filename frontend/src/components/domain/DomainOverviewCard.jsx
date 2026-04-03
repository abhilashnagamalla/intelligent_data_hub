import { motion } from "framer-motion";
import {
  Database,
  FileBarChart,
  GraduationCap,
  HeartPulse,
  Sprout,
  Truck,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatSectorLabel } from "../../constants/sectors";

const iconMap = {
  agriculture: Sprout,
  education: GraduationCap,
  health: HeartPulse,
  transport: Truck,
  finance: Wallet,
  census: FileBarChart,
};

export default function DomainOverviewCard({ domain, onClick }) {
  const { t } = useTranslation();
  const Icon = iconMap[domain.sector] || Database;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      onClick={onClick}
className="surface-card border-2 border-black flex h-full w-full flex-col p-6 text-left rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="stat-chip inline-flex bg-primary/10 text-primary">{t("Domains")}</div>
          <h3 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
            {t(formatSectorLabel(domain.sector))}
          </h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="surface-muted p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Catalog Pages")}</div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{domain.catalogs || 0}</div>
        </div>
        <div className="surface-muted p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("Datasets")}</div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{(domain.datasets || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-5 text-sm leading-6 text-muted">
        {t("Live sector data refreshed from the backend catalog and summary pipeline.")}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(domain.topDatasets || []).slice(0, 3).map((title) => (
          <span key={title} className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {title}
          </span>
        ))}
      </div>
    </motion.button>
  );
}
