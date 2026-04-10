import { useContext } from "react";
import { ArrowRight, Bookmark, Database, LineChart, Search } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../context/AuthContextFixed";

const featureCards = [
  {
    icon: Database,
    titleKey: "Dataset Explorer",
    textKey: "Browse sector catalogs with consistent metadata, pagination, and direct detail views.",
  },
  {
    icon: Search,
    titleKey: "Public sector intelligence",
    textKey: "Move faster from discovery to decision with structured datasets, traceable metadata, and reusable analysis flows.",
  },
  {
    icon: Bookmark,
    titleKey: "Analyst Profiles",
    textKey: "Keep wishlists, personal analytics, and research activity tied to your account.",
  },
  {
    icon: LineChart,
    titleKey: "Live Views and Downloads",
    textKey: "Track engagement consistently across cards, detail pages, and profile analytics.",
  },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, googleLogin, loading, error, clearError } = useContext(AuthContext);
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const handleGoogleAccess = async () => {
    if (user) {
      navigate(redirectTo);
      return;
    }

    try {
      clearError();
      await googleLogin({ redirectTo });
    } catch {
      // Keep the user on the landing page when the popup is closed or blocked.
    }
  };

  const homeFeatures = [
    {
      icon: Database,
      titleKey: "Dataset Explorer",
      textKey: "Browse, filter, and download 800+ datasets.",
    },
    {
      icon: Search,
      titleKey: "AI Chatbot",
      textKey: "Ask questions about datasets and get instant insights.",
    },
    {
      icon: Bookmark,
      titleKey: "Personal Dashboard",
      textKey: "Track favorites, saved searches, and analysis history.",
    },
  ];

  return (
    <div className="app-shell min-h-screen flex flex-col bg-gradient-to-b from-white to-slate-50">
      {/* Header Navigation - EXCLUDED FROM CHANGES */}
      <div className="w-full px-5 py-6 sm:px-6 lg:px-8 border-b border-gray-200">
        <nav className="flex items-center justify-between px-6 py-4 rounded-2xl border-2 border-black bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white">
              IDH
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">IDH</div>
              <div className="text-lg font-bold text-gray-900">{t("Intelligent Data Hub")}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/datasets" className="px-4 py-2 rounded-lg border-2 border-black bg-white font-semibold text-gray-900 hover:bg-gray-100 transition-colors">
              {t("All Datasets")}
            </Link>
            <button
              type="button"
              onClick={handleGoogleAccess}
              disabled={loading}
              className="px-4 py-2 rounded-lg border-2 border-black bg-black font-semibold text-white hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              {user ? t("Open Dashboard") : t("Get Started")}
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content - Non-scrollable, fits in viewport */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 sm:px-6 lg:px-8 overflow-hidden">
        <div className="w-full max-w-5xl">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600">
              🚀 {t("AI-Powered Government Data Hub")}
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-center text-4xl sm:text-5xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            {t("Intelligent Data Hub")}
          </h1>

          {/* Subtitle */}
          <p className="text-center text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t("Unlock 100+ datasets with AI insights, analytics, and intelligent search.")}
          </p>

          {/* Section Title */}
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-3">
            {t("Everything You Need")}
          </h2>
          <p className="text-center text-gray-600 text-sm mb-6 max-w-xl mx-auto">
            {t("Comprehensive tools for government data exploration and analysis.")}
          </p>

          {/* Three Feature Cards - Horizontal Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {homeFeatures.map((feature) => (
              <div
                key={feature.titleKey}
                className="rounded-2xl border-2 border-black bg-white p-6 hover:shadow-lg transition-shadow"
              >
                <feature.icon className="h-8 w-8 text-blue-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-sm text-gray-600 leading-6">
                  {t(feature.textKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
