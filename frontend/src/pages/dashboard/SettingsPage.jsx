import { useTranslation } from "react-i18next";
import LanguageControl from "../../components/ui/LanguageControl";
import ThemeToggleSwitch from "../../components/ui/ThemeToggleSwitch";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6 sm:p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Settings")}</div>
        <h1 className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{t("Appearance")}</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t("Update the interface language for navigation, dashboards, and actions.")}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Dark mode")}</div>
          <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{t("Appearance")}</h2>
          <p className="mt-2 text-muted">{t("Toggle the interface theme for day or night work.")}</p>
          <div className="mt-6">
            <ThemeToggleSwitch />
          </div>
        </section>

        <section className="surface-card p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-secondary)]">{t("Language")}</div>
          <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{t("Choose language")}</h2>
          <p className="mt-2 text-muted">{t("Update the interface language for navigation, dashboards, and actions.")}</p>
          <div className="mt-6">
            <LanguageControl />
          </div>
        </section>
      </div>
    </div>
  );
}
