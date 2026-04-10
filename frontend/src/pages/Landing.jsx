import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, X, Database, Bot, BarChart, Globe } from 'lucide-react';
import { useState } from 'react';
import AuthForm from '../components/auth/AuthForm';
import loginBg from '../../images/login.png';

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
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-base)]">

      {/* ─── Main landing content ─── */}
      <div className="relative z-10 flex w-full flex-col overflow-hidden">
        {/* Navbar */}
        <nav className="bg-white/95 shadow-sm backdrop-blur-sm dark:bg-slate-950/40">
          <div className="relative mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
            <div className="flex flex-1 justify-start items-center gap-3">
              {/* Header Icons */}
              <div className="flex items-center gap-1">
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-orange-100 text-orange-600 border-2 border-black dark:bg-orange-900/30 dark:text-orange-400 dark:border-black">
                  <Globe className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-blue-100 text-blue-600 border-2 border-black dark:bg-blue-900/30 dark:text-blue-400 dark:border-black">
                  <Database className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-purple-100 text-purple-600 border-2 border-black dark:bg-purple-900/30 dark:text-purple-400 dark:border-black">
                  <Bot className="h-4 w-4 sm:h-7 sm:w-7" />
                </div>
                <div className="flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-green-100 text-green-600 border-2 border-black dark:bg-green-900/30 dark:text-green-400 dark:border-black">
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
      </div>

      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <img
            src={loginBg}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-white/14 dark:bg-slate-950/42" />
        </div>

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
      </main>

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
