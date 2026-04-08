import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, X } from 'lucide-react';
import { useState } from 'react';
import AuthForm from '../components/auth/AuthForm';
import { landingBackground } from '../constants/backgrounds';

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
        <nav className="border-b border-slate-200/80 bg-white/88 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/20">
          <div className="relative mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-16">
            <div className="flex flex-1 justify-start">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary sm:h-10 sm:w-10">
                <span className="text-sm font-black text-white sm:text-lg">IDH</span>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
              <h1 className="text-base font-black text-slate-950 sm:text-2xl dark:text-white">
                Intelligent Data Hub
              </h1>
            </div>

            <div className="flex flex-1 justify-end">
              <button
                onClick={() => handleOpenAuth('login')}
                className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-300 bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-950 backdrop-blur-sm transition-colors hover:bg-white/95 sm:px-6 sm:py-3 sm:text-base dark:border-white/20 dark:bg-slate-900/50 dark:text-white dark:hover:bg-slate-900/70"
              >
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </nav>
      </div>

      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <img
            src={landingBackground}
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
              className="absolute right-4 top-4 z-50 rounded-full border border-white/20 bg-white/20 p-3 text-white transition-colors hover:bg-white/30"
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
                <X className="h-5 w-5 text-gray-700 dark:text-gray-200" />
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
