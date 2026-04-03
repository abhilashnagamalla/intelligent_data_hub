import { useTranslation } from "react-i18next";
import i18n from "../../utils/i18nFixed";
import { supportedLanguages } from "../../constants/languages";

export default function LanguageControl() {
  const { i18n: activeI18n } = useTranslation();

  return (
    <label className="relative">
      <span className="sr-only">Language</span>
      <select
        value={activeI18n.language}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition-colors hover:bg-[var(--surface-muted)]"
      >
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}
