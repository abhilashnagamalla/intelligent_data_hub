import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, X, Database, Bot, BarChart, Globe, Search, Bookmark, Map, PieChart } from 'lucide-react';
import { useState } from 'react';
import AuthForm from '../components/auth/AuthForm';

export default function Landing() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const handleOpenAuth = (mode) => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  const handleCloseAuth = () => {
    setShowAuth(false);
  };

  const featureCards = [
    {
      icon: Map,
      title: 'GeoView',
      description: 'Visualize geographic data on interactive maps and explore spatial patterns.',
    },
    {
      icon: Database,
      title: 'Dataset Explorer',
      description: 'Browse, filter, and download 100+ datasets with detailed metadata.',
    },
    {
      icon: Search,
      title: 'AI Chatbot',
      description: 'Ask questions about datasets and get intelligent insights instantly.',
    },
    {
      icon: Bookmark,
      title: 'Personal Dashboard',
      description: 'Track favorites, saved searches, and your analysis history.',
    },
    {
      icon: PieChart,
      title: 'Visualization',
      description: 'Create interactive charts, graphs, and custom visualizations from your data.',
    },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-b from-white to-slate-50 dark:from-gray-950 dark:to-gray-900">

      {/* ─── HEADER (DO NOT MODIFY) ─── */}
      <header className="relative z-10 flex w-full flex-col overflow-hidden">
        <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/95 shadow-sm backdrop-blur-sm dark:bg-slate-950/40">
          <div className="relative flex items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
            <div className="flex flex-1 justify-start items-center gap-3">
              {/* Header Icons - Unified Bar */}
              <div className="flex items-center border-2 border-black rounded-lg dark:border-black overflow-hidden shadow-md">
                {/* Globe - Section 1 */}
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center bg-orange-100 text-orange-600 border-r-2 border-black dark:bg-orange-900/30 dark:text-orange-400 dark:border-black">
                  <Globe className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
                {/* Database - Section 2 */}
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center bg-blue-100 text-blue-600 border-r-2 border-black dark:bg-blue-900/30 dark:text-blue-400 dark:border-black">
                  <Database className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
                {/* Bot - Section 3 */}
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center bg-purple-100 text-purple-600 border-r-2 border-black dark:bg-purple-900/30 dark:text-purple-400 dark:border-black">
                  <Bot className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
                {/* BarChart - Section 4 */}
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <BarChart className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
              </div>

              {/* IDH Logo */}
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black border-2 border-black sm:h-14 sm:w-14">
                <span className="text-sm font-black text-white sm:text-lg">IDH</span>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
              <h1 className="text-2xl font-black text-slate-950 sm:text-4xl dark:text-white">
                Intelligent Data Hub
              </h1>
            </div>

            <div className="flex flex-1 justify-end">
              <button
                onClick={() => handleOpenAuth('login')}
                className="inline-flex items-center justify-center gap-2 rounded-3xl border-2 border-black bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-950 backdrop-blur-sm transition-colors hover:bg-white/95 sm:px-6 sm:py-3 sm:text-base dark:border-black dark:bg-slate-900/50 dark:text-white dark:hover:bg-slate-900/70"
              >
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-black text-white border-2 border-black dark:bg-black dark:border-black">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* ─── MAIN CONTENT (BELOW HEADER) ─── */}
      <main className="flex-1 overflow-hidden flex flex-col items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full">
          
          {/* Badge - Moved Higher */}
          <div className="flex justify-center mb-2">
            <div className="inline-flex items-center rounded-full border-2 border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              🚀 AI-Powered Government Data Hub
            </div>
          </div>

          {/* Main Heading */}
          <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-3 leading-tight">
            Intelligent Data Hub
          </h2>

          {/* Subtitle */}
          <p className="text-center text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Explore 100+ datasets with structured metadata, live previews, and actionable analytics for every research session.
          </p>

          {/* Section Title */}
          <h3 className="text-center text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Everything You Need
          </h3>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">
            Comprehensive tools for government data exploration and analysis.
          </p>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <card.icon className="h-7 w-7 text-blue-600 dark:text-blue-400 mb-3" />
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {card.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ─── Desktop split-panel auth (lg+) ─── */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            key="desktop-auth"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-y-0 right-0 z-20 hidden w-full max-w-[460px] border-l border-white/20 bg-white/14 backdrop-blur-xl lg:block dark:bg-slate-950/24"
          >
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleCloseAuth}
              className="absolute right-4 top-4 z-50 rounded-full border border-white/20 bg-white/20 p-3 text-black transition-colors hover:bg-white/30"
            >
              <X className="h-6 w-6" />
            </motion.button>
            <div className="flex h-full items-center justify-center overflow-y-auto p-6">
              <AuthForm mode={authMode} setMode={setAuthMode} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Mobile auth modal (< lg) ─── */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            key="mobile-auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm lg:hidden"
            onClick={handleCloseAuth}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white/95 shadow-2xl dark:bg-gray-900/95"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={handleCloseAuth}
                className="absolute right-4 top-4 z-50 rounded-full bg-gray-100 p-2 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-black" />
              </button>
              <div className="p-6">
                <AuthForm mode={authMode} setMode={setAuthMode} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
