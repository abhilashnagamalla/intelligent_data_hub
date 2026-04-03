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
    <div className="app-shell flex min-h-screen items-stretch bg-light-bg">
      <div className="hidden w-[46%] flex-col justify-between bg-[linear-gradient(180deg,rgba(11,99,206,0.92),rgba(15,118,110,0.96))] px-10 py-10 text-white lg:flex">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-lg font-black">
              IDH
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-white/70">IDH</div>
              <div className="text-2xl font-bold">{t("Intelligent Data Hub")}</div>
            </div>
          </Link>
          <h2 className="mt-14 max-w-lg text-5xl font-bold leading-tight">
            {t("Sign in with Google")}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/78">
            {t("Use your Google account to access saved datasets, analytics, and your personalized workspace instantly.")}
          </p>
        </div>

        <div className="grid gap-4">
          {[
            { icon: Database, title: t("Dataset Explorer"), text: t("Browse sector catalogs with consistent metadata, pagination, and direct detail views.") },
            { icon: BarChart3, title: t("Live Views and Downloads"), text: t("Track engagement consistently across cards, detail pages, and profile analytics.") },
            { icon: ShieldCheck, title: t("Google sign-in only"), text: t("Account creation and password-based authentication have been removed. Continue with Google to enter the platform.") },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-lg">
              <item.icon className="mb-3 h-6 w-6" />
              <div className="text-lg font-semibold">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-white/75">{item.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <AuthPanel />
      </div>
    </div>
  );
}
