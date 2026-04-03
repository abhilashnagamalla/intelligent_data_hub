import { useContext } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContextFixed";

function GoogleMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.8 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.8H12z"
        />
        <path
          fill="#34A853"
          d="M3.2 7.3l3.2 2.3C7.3 7.6 9.4 6 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.8 14.7 2 12 2 8.2 2 4.8 4.1 3.2 7.3z"
        />
        <path
          fill="#FBBC05"
          d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1-3.4 1-3.7 0-5.2-2.5-5.5-3.8l-3.1 2.4C5 19.9 8.2 22 12 22z"
        />
        <path
          fill="#4285F4"
          d="M21.6 12.3c0-.7-.1-1.2-.2-1.8H12v3.9h5.5c-.3 1.3-1.1 2.3-2.1 3l3 2.4c1.8-1.7 3.2-4.3 3.2-7.5z"
        />
      </svg>
    </span>
  );
}

export default function AuthPanel() {
  const { t } = useTranslation();
  const { googleLogin, loading, error, clearError } = useContext(AuthContext);
  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get("redirect") || "/dashboard";

  return (
    <div className="surface-panel w-full max-w-xl p-8 sm:p-10">
      <div className="mb-8">
        <div className="stat-chip inline-flex bg-primary/10 text-primary">{t("Intelligent Data Hub")}</div>
        <h1 className="mt-5 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
          {t("Sign in with Google")}
        </h1>
        <p className="mt-3 max-w-lg text-base leading-7 text-muted">
          {t("Use your Google account to access saved datasets, analytics, and your personalized workspace instantly.")}
        </p>
      </div>

      <div className="space-y-5">
        <div className="surface-muted p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
            {t("Google sign-in only")}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">
            {t("Account creation and password-based authentication have been removed. Continue with Google to enter the platform.")}
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            clearError();
            try {
              await googleLogin({ redirectTo });
            } catch {
              // Error state is handled inside the auth context.
            }
          }}
          className="btn-primary w-full justify-between px-5 py-4 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="flex items-center gap-3">
            <GoogleMark />
            <span className="text-left">
              <span className="block text-base font-semibold">{t("Continue with Google")}</span>
              <span className="block text-xs font-medium text-white/80">{t("Direct Google authentication")}</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
