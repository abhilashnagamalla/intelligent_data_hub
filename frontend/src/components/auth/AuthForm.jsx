import { useContext } from 'react';
import { motion } from 'framer-motion';
import { AuthContext } from "../../context/AuthContext";
import { User } from 'lucide-react';

export default function AuthForm() {
  const { googleLogin, loading, error, clearError } = useContext(AuthContext);

  const handleGoogleAuth = async () => {
    clearError();
    try {
      await googleLogin();
    } catch {
      // Error handled in context
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md h-full flex flex-col justify-center overflow-y-auto pt-10"
    >
      <div className="text-center mb-10">
        <motion.div 
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-20 h-20 bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg"
        >
          <User className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent mb-4">
          Welcome
        </h1>
        <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">
          Sign in to access Intelligent Data Hub
        </p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/90 text-white p-4 rounded-xl mb-6 text-center font-medium border border-red-400/50 text-sm"
        >
          {error}
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGoogleAuth}
        disabled={loading}
        className="w-full bg-white/90 hover:bg-white text-gray-900 font-bold py-5 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-600 mt-4"
      >
        <User className="w-6 h-6" />
        <span className="text-lg">Continue with Google</span>
      </motion.button>
    </motion.div>
  );
}
