import { Bookmark, Globe2, LineChart } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPanel from "../../components/auth/AuthPanel";

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <div className="app-shell flex min-h-screen items-stretch bg-light-bg">
      <div className="hidden w-[46%] flex-col justify-between bg-[linear-gradient(180deg,rgba(15,118,110,0.94),rgba(11,99,206,0.96))] px-10 py-10 text-white lg:flex">
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
            {t("Create your workspace")}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/78">
            {t("Build your analyst workspace for datasets, visualizations, and sector-specific exploration.")}
          </p>
        </div>

        <div className="grid gap-4">
          {[
            { icon: Bookmark, title: t("Saved datasets"), text: t("Keep wishlists, personal analytics, and research activity tied to your account.") },
            { icon: LineChart, title: t("Research Analytics"), text: t("Structured access to your saved datasets and account activity.") },
            { icon: Globe2, title: t("Explore Domains"), text: t("Move faster from discovery to decision with structured datasets, traceable metadata, and reusable analysis flows.") },
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
        <AuthPanel mode="register" />
      </div>
    </div>
  );
}
