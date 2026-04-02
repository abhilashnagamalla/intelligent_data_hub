import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, Bot, Database, X } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-slate-900 flex overflow-hidden">

      {/* ─── Main landing content ─── */}
      <motion.div
        animate={{ width: showAuth ? '70%' : '100%' }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="flex flex-col overflow-y-auto h-screen"
      >
        {/* Navbar */}
        <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-sm sm:text-lg">IDH</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {/* Short name on very small screens */}
                <span className="sm:hidden">IDH</span>
                <span className="hidden sm:inline">Intelligent Data Hub</span>
              </h1>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className={`flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-16 ${showAuth ? 'pt-20 pb-12' : 'py-8 sm:py-12'}`}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center w-full"
          >
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl px-4 sm:px-6 py-2 sm:py-3 rounded-3xl shadow-xl border border-white/50 mb-4 sm:mb-6">
              <Bot className="w-4 sm:w-6 h-4 sm:h-6 text-primary flex-shrink-0" />
              <span className="font-semibold text-sm sm:text-lg">AI-Powered Government Data Hub</span>
            </div>

            <h1 className={`font-black leading-tight mb-4 sm:mb-6 text-3xl sm:text-5xl ${showAuth ? 'lg:text-6xl' : 'lg:text-7xl'}`}>
              <span className="block text-gray-900 dark:text-white">Intelligent</span>
              <span className="block text-gray-900 dark:text-white">Data Hub</span>
            </h1>

            <p className="text-gray-700 dark:text-gray-300 font-medium mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed text-base sm:text-lg md:text-xl">
              Unlock 100+ datasets with AI insights, analytics, and intelligent search.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => handleOpenAuth('login')}
                className="group w-full sm:w-auto bg-gradient-to-r from-primary to-secondary text-white font-black py-3 sm:py-4 px-6 sm:px-8 rounded-3xl text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl border border-white/20 cursor-pointer"
              >
                <User className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className={`px-4 sm:px-6 lg:px-16 ${showAuth ? 'py-10 sm:py-16' : 'py-4 sm:py-8'}`}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto space-y-6 sm:space-y-8"
          >
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-3 sm:mb-4">
                Everything You Need
              </h2>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Comprehensive tools for government data exploration and analysis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { Icon: Database, color: 'text-primary', title: 'Dataset Explorer', desc: 'Browse, filter, and download 800+ datasets.' },
                { Icon: Bot, color: 'text-secondary', title: 'AI Chatbot', desc: 'Ask questions about datasets and get instant insights.' },
                { Icon: User, color: 'text-accent', title: 'Personal Dashboard', desc: 'Track favorites, saved searches, and analysis history.' },
              ].map(({ Icon, color, title, desc }) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="glass backdrop-blur-xl p-5 sm:p-6 rounded-3xl text-center group hover:shadow-3xl transition-all border border-white/20"
                >
                  <Icon className={`w-10 sm:w-12 h-10 sm:h-12 ${color} mx-auto mb-3 opacity-75 group-hover:opacity-100 transition-opacity`} />
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      </motion.div>

      {/* ─── Desktop split-panel auth (lg+) ─── */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: showAuth ? '30%' : 0, opacity: showAuth ? 1 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="flex-shrink-0 overflow-hidden bg-white/30 backdrop-blur-xl border-l border-white/20 relative h-screen hidden lg:block"
      >
        {showAuth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="h-full flex flex-col relative"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCloseAuth}
              className="absolute top-4 right-4 z-50 p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors border border-white/20"
            >
              <X className="w-6 h-6 text-gray-900 dark:text-white" />
            </motion.button>
            <div className="h-full p-6 flex items-center justify-center overflow-y-auto">
              <AuthForm mode={authMode} setMode={setAuthMode} />
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ─── Mobile auth modal (< lg) ─── */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            key="mobile-auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={handleCloseAuth}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCloseAuth}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
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
