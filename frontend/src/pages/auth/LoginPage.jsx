import { useContext, useEffect } from "react";
import { BarChart3, Database, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPanel from "../../components/auth/AuthPanel";
import { AuthContext } from "../../context/AuthContextFixed";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user) return;
    navigate(searchParams.get("redirect") || "/dashboard", { replace: true });
  }, [navigate, searchParams, user]);

  return (
    <div className="app-shell flex min-h-screen flex-col bg-white dark:bg-gray-950">
      {/* Full-page Background Container */}
      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Header Logo */}
          <div className="mb-12 flex flex-col items-center">
            <Link to="/" className="inline-flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-blue-600 text-lg font-black text-white">
                IDH
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">{t("IDH")}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{t("Intelligent Data Hub")}</div>
              </div>
            </Link>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            {/* Left Side - Info Panel */}
            <div className="hidden flex-col justify-between lg:flex">
              <div>
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                  {t("AI-Powered Government Data Hub")}
                </div>
                <h2 className="mt-6 text-3xl font-bold leading-tight text-gray-900 dark:text-white">
                  {t("Sign in to your account")}
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-gray-600 dark:text-gray-400">
                  {t("Access saved datasets, analytics, and your personalized workspace instantly.")}
                </p>
              </div>

              {/* Feature Cards */}
              <div className="space-y-3">
                {[
                  { icon: Database, title: t("Dataset Explorer"), text: t("Browse sector catalogs with consistent metadata, pagination, and direct detail views.") },
                  { icon: BarChart3, title: t("Live Views and Downloads"), text: t("Track engagement consistently across cards, detail pages, and profile analytics.") },
                  { icon: ShieldCheck, title: t("Secure Sign-in"), text: t("Your account and data are protected with enterprise-grade Google authentication.") },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <item.icon className="mb-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side - Auth Panel */}
            <div className="flex items-center justify-center w-full">
              <div className="w-full">
                <AuthPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
