import { useContext, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { User } from 'lucide-react';

export default function Login() {
  const { user, googleLogin, loading, error, clearError } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromLanding = searchParams.get('from') === 'landing';

  useEffect(() => {
    if (user && !fromLanding) {
      navigate('/dashboard');
    }
  }, [user, navigate, fromLanding]);

  const handleGoogleLogin = async () => {
    clearError();
    try {
      await googleLogin();
      navigate('/dashboard');
    } catch {
      // Error handled in context
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary via-secondary to-accent">
        <div className="text-white text-xl">Signing in...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none bg-white">
        <img
          src={fixedBgLogin}
          alt=""
          className="h-screen w-screen object-cover object-center fixed top-16 left-0"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/20 to-white/35 pointer-events-none" />
      </div>
      <div className="relative z-10 w-full h-full">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass backdrop-blur-xl bg-white/20 rounded-3xl p-12 max-w-md w-full shadow-2xl border border-white/20 max-h-[85vh] overflow-y-auto mx-auto mt-[5vh]"
      >
        <div className="text-center mb-12">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-28 h-28 bg-black rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-glow overflow-hidden border border-white/30"
          >
            <User className="w-16 h-16 text-white" />
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent mb-6 leading-tight">
            Welcome
          </h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl text-white/95 font-medium"
          >
            Sign in to access your data hub
          </motion.p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/90 text-white p-4 rounded-2xl mb-6 text-center font-medium border border-red-400/50 backdrop-blur-sm"
          >
            {error}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(255,255,255,0.3)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white/90 hover:bg-white text-gray-900 font-bold py-5 px-8 rounded-2xl flex items-center justify-center gap-4 shadow-2xl hover:shadow-glow transition-all duration-300 border border-white/30 text-lg backdrop-blur-sm mt-6"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black border-2 border-black">
            <User className="w-6 h-6 text-white" />
          </div>
          Continue with Google
        </motion.button>

      </motion.div>
      </div>
    </div>
  );
}
