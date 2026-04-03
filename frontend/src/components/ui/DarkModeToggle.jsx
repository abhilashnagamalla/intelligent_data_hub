import { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative inline-flex h-8 w-16 items-center rounded-full border transition-colors duration-400 focus:outline-none shadow-inner ${darkMode ? 'border-white/60 bg-white' : 'border-black/10 bg-gray-200'}`}
      title={t('Toggle dark mode')}
      aria-label={t('Toggle dark mode')}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full transition-transform duration-400 flex items-center justify-center shadow-lg ${darkMode ? 'translate-x-9 bg-slate-900' : 'translate-x-1 bg-white'}`}
      >
        {darkMode ? <Moon className="w-3 h-3 text-white" /> : <Sun className="w-3 h-3 text-yellow-500" />}
      </span>
    </button>
  );
}
