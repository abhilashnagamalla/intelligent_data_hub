import { useContext } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../../context/ThemeContext";

export default function ThemeToggleSwitch() {
  const { t } = useTranslation();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--surface-muted)]"
      aria-label={t("Toggle dark mode")}
    >
      {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="sr-only">{darkMode ? t("Dark") : t("Light")}</span>
    </button>
  );
}
