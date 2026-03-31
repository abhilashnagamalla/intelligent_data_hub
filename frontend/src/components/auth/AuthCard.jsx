import { User, Mail, Lock, Check, Eye, EyeOff } from 'lucide-react';

const AuthCard = ({ tab, setTab, onSubmit, formData, errors, loading, showPassword, togglePassword, googleLogin, onChangeEmail, onChangePassword, onChangeConfirmPassword }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="glass backdrop-blur-xl bg-white/20 dark:bg-gray-800/30 rounded-3xl p-8 md:p-12 max-w-md w-full shadow-2xl border border-white/20 dark:border-gray-200/20 max-h-[90vh] overflow-y-auto"
    >
      {/* Tabs */}
      <div className="flex mb-8">
        <button 
          onClick={() => setTab('login')}
          className={`flex-1 py-3 px-4 rounded-l-xl font-bold text-lg transition-all duration-300 ${
            tab === 'login' 
              ? 'bg-white/30 text-primary shadow-lg shadow-primary/20' 
              : 'bg-transparent text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Sign In
        </button>
        <button 
          onClick={() => setTab('register')}
          className={`flex-1 py-3 px-4 rounded-r-xl font-bold text-lg transition-all duration-300 ${
            tab === 'register' 
              ? 'bg-white/30 text-primary shadow-lg shadow-primary/20' 
              : 'bg-transparent text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-5 relative" autoComplete="off">
        {/* Prevent browser autofill by adding hidden dummy fields */}
        <div className="absolute left-0 top-0 opacity-0 pointer-events-none">
          <input name="password" type="password" autoComplete="current-password" />
        </div>

        <div>
          <label className="block text-gray-900 dark:text-white font-semibold mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email
          </label>
          <input
            name="login"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={onChangeEmail}
            className="w-full bg-white/70 dark:bg-gray-700/70 hover:bg-white text-gray-900 dark:text-white px-4 py-3 rounded-xl font-semibold border border-white/30 focus:border-primary focus:outline-none transition-all shadow-md placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-sm"
            placeholder="Enter your email"
            required
          />
        </div>

        <div>
          <label className="block text-gray-900 dark:text-white font-semibold mb-2 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Password
          </label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={formData.password}
              onChange={onChangePassword}
              className="w-full bg-white/70 dark:bg-gray-700/70 hover:bg-white pr-12 py-3 rounded-xl font-semibold border border-white/30 focus:border-primary focus:outline-none transition-all shadow-md text-gray-900 dark:text-white px-4 placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-sm"
              placeholder="Enter password"
              required
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {tab === 'register' && (
          <div>
            <label className="block text-gray-900 dark:text-white font-semibold mb-2 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Confirm Password
            </label>
            <div className="relative">
              <input
                name="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={onChangeConfirmPassword}
                className="w-full bg-white/70 dark:bg-gray-700/70 hover:bg-white pr-12 py-3 rounded-xl font-semibold border border-white/30 focus:border-primary focus:outline-none transition-all shadow-md text-gray-900 dark:text-white px-4 placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-sm"
                placeholder="Confirm password"
                required
              />
              <button
                type="button"
                onClick={togglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {errors.form && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-xl text-center font-medium ${
              errors.form.toLowerCase().includes('successful') || errors.form.toLowerCase().includes('success')
                ? 'bg-green-500/90 text-white border border-green-400/50'
                : 'bg-red-500/90 text-white border border-red-400/50'
            }`}
          >
            {errors.form}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 text-white font-black py-4 px-6 rounded-xl flex items-center justify-center shadow-2xl hover:shadow-glow transition-all duration-300 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {tab === 'login' ? 'Sign In' : 'Create Account'}
        </motion.button>
      </form>

      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/20 dark:bg-gray-800/20 backdrop-blur px-4 py-2 text-gray-900 dark:text-white font-semibold tracking-wider rounded-full">
            or continue with
          </span>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={googleLogin}
        disabled={loading}
        className="w-full mt-6 bg-white/80 dark:bg-gray-200/80 hover:bg-white text-gray-900 dark:text-gray-900 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-200/50 dark:border-gray-600/50"
      >
        <User className="w-6 h-6" />
        Google
      </motion.button>

      <p className={`text-center mt-8 text-sm text-gray-900 dark:text-white`}>
        {tab === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
        <button 
          type="button"
          onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
          className="font-bold text-primary hover:text-accent transition-colors underline decoration-2"
        >
          {tab === 'login' ? 'Sign Up' : 'Sign In'}
        </button>
      </p>
    </motion.div>
  );
};

export default AuthCard;
