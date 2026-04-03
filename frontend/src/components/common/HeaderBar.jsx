import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api";
import { AuthContext } from "../../context/AuthContextFixed";
import LanguageControl from "../ui/LanguageControl";
import ThemeToggleSwitch from "../ui/ThemeToggleSwitch";
import UserMenu from "../ui/UserMenu";

export default function HeaderBar({ onMenuToggle }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, googleLogin, loading: authLoading } = useContext(AuthContext);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await api.get("/datasets/search", { params: { q: query.trim() } });
        setResults(response.data || []);
      } catch {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color:var(--surface-base)]/95 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-3 text-[var(--text-primary)] shadow-sm lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-black text-white shadow-lg">
            IDH
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand-secondary)]">
              IDH
            </div>
            <div className="text-lg font-bold text-[var(--text-primary)]">{t("Intelligent Data Hub")}</div>
          </div>
        </button>

        <div className="relative ml-auto flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) {
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                setResults([]);
              }
            }}
            placeholder={t("Search datasets, domains...")}
            className="input-control pl-11"
          />
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+0.75rem)] rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-panel)]">
              {results.slice(0, 6).map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    navigate(`/dataset/${encodeURIComponent(result.id)}`, { state: result });
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full flex-col rounded-2xl px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <span className="font-semibold text-[var(--text-primary)]">{result.title}</span>
                  <span className="text-sm text-muted">{result.organization || t("Government of India")}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ThemeToggleSwitch />
          </div>
          <div className="hidden md:block">
            <LanguageControl />
          </div>
          {user ? (
            <UserMenu />
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  await googleLogin({ redirectTo: "/dashboard" });
                } catch {
                  // Keep the user in context when the popup is closed or blocked.
                }
              }}
              disabled={authLoading}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {t("Continue with Google")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
