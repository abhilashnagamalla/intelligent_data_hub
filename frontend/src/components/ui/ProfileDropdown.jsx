import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { User, Settings, LogOut, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ProfileDropdown({ className = '' }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useTranslation();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center shadow-lg hover:shadow-glow transition-all overflow-hidden text-white font-bold text-base sm:text-lg"
        aria-label={t('Profile')}
        aria-expanded={open}
      >
        {user?.picture && user.picture !== 'https://vitejs.dev/logo.svg' ? (
          <img src={user.picture} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 sm:w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="font-semibold text-gray-900 dark:text-white truncate">{user?.name}</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => { navigate('/dashboard/profile'); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-200"
          >
            <User className="w-4 h-4" />
            {t('Profile')}
          </button>
          <button
            onClick={() => { navigate('/dashboard/profile'); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-200"
          >
            <Heart className="w-4 h-4" />
            {t('Wishlist')}
          </button>
          <button
            onClick={() => { navigate('/dashboard/settings'); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-200"
          >
            <Settings className="w-4 h-4" />
            {t('Settings')}
          </button>
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-gray-700 text-sm"
          >
            <LogOut className="w-4 h-4" />
            {t('Logout')}
          </button>
        </div>
      )}
    </div>
  );
}
