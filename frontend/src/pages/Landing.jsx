import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, X, Database, Bot, BarChart, Globe, Search, Bookmark, Map, PieChart, MapPin } from 'lucide-react';
import { useState } from 'react';
import AuthForm from '../components/auth/AuthForm';
import background from '../assets/background.png';

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

  const AnimationLayer = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Background Light Streaks */}
      <motion.div
        animate={{
          x: [-200, 200],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 -left-1/4 w-[150%] h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent rotate-[35deg] blur-[2px]"
      />
      <motion.div
        animate={{
          x: [200, -200],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-3/4 -left-1/4 w-[150%] h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent rotate-[-35deg] blur-[2px]"
      />

      {/* Floating Network Mesh (Low Opacity) */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#4f46e5 0.5px, transparent 0.5px), linear-gradient(90deg, #4f46e5 0.5px, transparent 0.5px)', backgroundSize: '60px 60px' }} />
    </div>
  );

  const LeftAnimation = () => (
    <div className="absolute inset-y-0 left-0 w-[8%] hidden lg:flex flex-col items-center justify-between py-10 overflow-hidden pointer-events-none z-10 border-r border-blue-200/40 bg-gradient-to-b from-blue-100/60 via-indigo-100/30 to-blue-200/50 backdrop-blur-sm">
      {/* Top Header Label */}
      <div className="text-[10px] font-black text-blue-600/40 tracking-widest uppercase mb-4">Geo-Analytics</div>

      {/* Intelligent Radar Search Animation - No Box Version */}
      <div className="relative z-20 scale-125 w-full h-36 flex items-center justify-center overflow-hidden">
        {/* Rotating Radar Beam */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute w-40 h-40 bg-gradient-conic from-blue-500/30 via-transparent to-transparent opacity-40 origin-center"
        />

        {/* Detected Data Nodes */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-500 rounded-full"
            style={{
              top: `${25 + Math.random() * 50}%`,
              left: `${25 + Math.random() * 50}%`
            }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.2, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.4
            }}
          />
        ))}

        <motion.div
          animate={{
            scale: [0.95, 1.1, 0.95],
            y: [-2, 2, -2]
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="relative z-10"
        >
          <Search className="w-14 h-14 text-blue-600 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
        </motion.div>
      </div>

      {/* Location Insights Module */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="text-[11px] font-bold text-blue-700/60 uppercase tracking-widest">Live Tracking</div>
        <div className="relative w-24 h-24 bg-blue-50/20 rounded-full border border-blue-200/30 flex items-center justify-center backdrop-blur-sm shadow-inner overflow-hidden">
          <motion.div
            animate={{
              y: [-15, 0, -15],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="relative z-10"
          >
            <MapPin className="w-10 h-10 text-indigo-600 drop-shadow-lg" />
            <div className="absolute top-full left-1/2 w-8 h-2 bg-indigo-900/10 rounded-full -translate-x-1/2 mt-1 blur-[2px]" />
          </motion.div>
          {/* Pulsing Radar Ring below Pin */}
          {[...Array(2)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 3], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i }}
              className="absolute w-12 h-12 border border-indigo-400/40 rounded-full"
            />
          ))}
        </div>
      </div>

      {/* Left-side Analytics Chart (Histogram) */}
      <div className="flex flex-col items-center gap-2 mt-8">
        <div className="text-[11px] font-bold text-blue-700/60 mb-1">Growth Metrics</div>
        <div className="flex items-end gap-1.5 h-24">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [15 + (i * 8), 60 + (i * 2), 15 + (i * 8)],
                opacity: [0.4, 0.9, 0.4]
              }}
              transition={{ duration: 3 + (i % 3), repeat: Infinity }}
              className="w-2.5 bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-sm"
            />
          ))}
        </div>
      </div>

      {/* Rotating Data Compass (Analytical Ring) */}
      <div className="relative h-48 w-full flex items-center justify-center scale-90">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="w-36 h-36 border-2 border-dashed border-blue-400/20 rounded-full flex items-center justify-center">
          <div className="w-24 h-24 border border-indigo-400/30 rounded-full flex items-center justify-center">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="absolute w-2 h-2 bg-blue-600 rounded-full" style={{ transform: `rotate(${i * 90}deg) translate(58px)` }} />
            ))}
          </div>
        </motion.div>
        <div className="absolute text-[8px] font-black text-blue-500 uppercase">Live Index</div>
      </div>

      {/* Neural Records Stream */}
      <div className="flex flex-col gap-4 relative z-10 mb-8 w-full px-4">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ x: [-10, 10, -10], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 4 + i, repeat: Infinity }}
            className="h-2 w-full bg-blue-500/10 rounded-full overflow-hidden"
          >
            <motion.div
              animate={{ width: ['0%', '100%', '0%'] }}
              transition={{ duration: 5, repeat: Infinity, delay: i }}
              className="h-full bg-blue-500/30 w-1/2"
            />
          </motion.div>
        ))}
      </div>
    </div>
  );

  const RightAnimation = () => (
    <div className="absolute inset-y-0 right-0 w-[8%] hidden lg:flex flex-col items-center justify-between py-12 overflow-hidden pointer-events-none z-10 border-l border-blue-200/40 bg-gradient-to-b from-blue-200/50 via-indigo-100/30 to-blue-100/60 backdrop-blur-sm">
      {/* Complex Analytical Arcs */}
      <div className="absolute top-20 scale-100">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} className="relative w-36 h-36 flex items-center justify-center">
          <div className="absolute inset-0 border-[8px] border-blue-500/10 rounded-full" />
          <div className="absolute inset-0 border-[8px] border-transparent border-t-blue-500/40 rounded-full" />
          <motion.div
            animate={{ rotate: -720 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-2 border-dashed border-indigo-400/30 rounded-full flex items-center justify-center"
          >
            <div className="w-10 h-10 border-2 border-blue-200/20 rounded-full" />
          </motion.div>
        </motion.div>
      </div>

      {/* High-Fidelity Signal Path */}
      <div className="relative h-40 w-full px-3 mt-32 opacity-60">
        <svg viewBox="0 0 100 60" className="w-full h-full stroke-blue-700 stroke-[1.5] fill-none">
          <motion.path
            animate={{
              d: [
                "M0 30 Q25 0 50 30 T100 30",
                "M0 30 Q25 60 50 30 T100 30",
                "M0 30 Q25 0 50 30 T100 30"
              ]
            }}
            transition={{ duration: 5, repeat: Infinity }}
            d="M0 30 Q25 0 50 30 T100 30"
          />
          <motion.path
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            d="M0 30 L100 30"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      {/* AI Bot 2.0 - Scanning & Orbiting */}
      <div className="relative py-12 z-10">
        {/* Intelligence Rings */}
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute -inset-8 border-[1.5px] border-blue-400/20 rounded-full border-t-blue-400" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -inset-12 border-[1.5px] border-indigo-400/10 rounded-full border-r-indigo-400/40" />

        <motion.div
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="p-5 bg-white/80 rounded-[2rem] border-2 border-blue-200/50 shadow-2xl backdrop-blur-xl relative"
        >
          <Bot className="w-10 h-10 text-blue-600 opacity-90" />
          {/* Scanning Beam */}
          <motion.div
            animate={{ top: ['0%', '100%', '0%'], opacity: [0, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute left-0 right-0 h-[2px] bg-blue-500/40 z-10"
          />
        </motion.div>
      </div>

      {/* Dynamic Data Bar Modules */}
      <div className="flex items-end gap-2 h-36 mb-12 relative">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="relative flex flex-col items-center">
            <motion.div
              key={i}
              animate={{
                height: [30 + (i * 10), 80 + (i * 5), 30 + (i * 10)],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{ duration: 4 + (i % 2), repeat: Infinity }}
              className="w-3 bg-gradient-to-t from-blue-700 via-blue-500 to-indigo-400 rounded-t-lg shadow-lg"
            />
            {/* Percentage Counters */}
            <motion.span
              animate={{ y: [0, -40], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
              className="absolute bottom-full text-[8px] font-black text-blue-600 mb-1"
            >
              {20 + Math.floor(Math.random() * 80)}%
            </motion.span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-white"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 15%, rgba(255, 255, 255, 0) 85%, rgba(255, 255, 255, 0.4) 100%), 
                          url(${background})`,
        backgroundSize: '85% auto',
        backgroundPosition: 'center 30%',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <AnimationLayer />
      <LeftAnimation />
      <RightAnimation />

      {/* ─── HEADER (DO NOT MODIFY) ─── */}
      <header className="relative z-10 flex w-full flex-col overflow-hidden">
        <nav className="border-b border-slate-400/40 bg-white/40 shadow-[0_1px_15px_rgba(0,0,0,0.05)] backdrop-blur-xl">
          <div className="relative flex items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
            <div className="flex flex-1 justify-start items-center gap-3">
              {/* Header Icons - Unified Bar */}
              <div className="flex items-center border border-slate-400/40 rounded-lg overflow-hidden shadow-sm bg-white/50 backdrop-blur-sm">
                {/* Globe - Section 1 */}
                <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center bg-orange-100/40 text-orange-600 border-r border-slate-400/40">
                  <Globe className="h-4 w-4 sm:h-6 sm:w-6" />
                </div>
                {/* Database - Section 2 */}
                <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center bg-blue-100/40 text-blue-600 border-r border-slate-400/40">
                  <Database className="h-4 w-4 sm:h-6 sm:w-6" />
                </div>
                {/* Bot - Section 3 */}
                <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center bg-purple-100/40 text-purple-600 border-r border-slate-400/40">
                  <Bot className="h-4 w-4 sm:h-6 sm:w-6" />
                </div>
                {/* BarChart - Section 4 */}
                <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center bg-green-100/40 text-green-600">
                  <BarChart className="h-4 w-4 sm:h-6 sm:w-6" />
                </div>
              </div>

              {/* IDH Logo */}
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 border border-slate-400/50 sm:h-12 sm:w-12 shadow-xl">
                <span className="text-sm font-black text-white sm:text-lg">IDH</span>
              </div>
            </div>

            <div className="flex flex-1 justify-end">
              <button
                onClick={() => handleOpenAuth('login')}
                className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-400/50 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-950 backdrop-blur-sm transition-all hover:bg-white/95 hover:shadow-lg sm:px-6 sm:py-3 sm:text-base"
              >
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-black text-white border border-slate-400/40 shadow-sm">
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
      <main className="flex-1 overflow-hidden flex flex-col px-4 py-3 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 flex flex-col justify-between h-full pt-16 pb-4"
        >
          <div className="w-full flex flex-col items-center">
            {/* Badge - Moved Down Slightly */}
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center rounded-full border-2 border-blue-200/50 bg-blue-50/50 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-blue-600">
                AI-Powered Government Data Hub
              </div>
            </div>

            {/* Main Heading */}
            <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight tracking-tight drop-shadow-md">
              Intelligent Data Hub
            </h2>

            {/* Subtitle */}
            <p className="text-center text-base sm:text-lg text-gray-700 font-medium mb-5 max-w-2xl mx-auto leading-relaxed drop-shadow-sm">
              Explore 100+ datasets with structured metadata, live previews, and actionable analytics.
            </p>

            {/* Section Title - Moved Down Slightly */}
            <div className="relative mt-4 text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Everything You Need
              </h3>
              <p className="text-sm font-medium text-gray-600">
                Comprehensive tools for government data exploration and analysis.
              </p>
            </div>
          </div>

          {/* Feature Cards Grid - Pushed to Bottom & Constrained to 85% */}
          <div className="mx-auto w-[85%] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 pb-5">
            {featureCards.map((card, idx) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 + idx * 0.1 }}
                className="group rounded-xl border border-white/50 bg-white/40 p-5 sm:p-6 shadow-xl backdrop-blur-md transition-all hover:-translate-y-2 hover:bg-white/60"
              >
                <div className="rounded-lg bg-white/80 p-2 w-fit mb-3 shadow-sm transition-transform group-hover:scale-110">
                  <card.icon className="h-7 w-7 text-blue-600" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                  {card.title}
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {card.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
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
