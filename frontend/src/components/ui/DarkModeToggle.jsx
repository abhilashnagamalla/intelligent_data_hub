import { useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-400 focus:outline-none shadow-inner border border-white/10 ${darkMode ? 'bg-black' : 'bg-gray-200'}`}
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle dark mode"
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full transition-transform duration-400 flex items-center justify-center shadow-lg ${darkMode ? 'translate-x-9 bg-gray-800' : 'translate-x-1 bg-white'}`}
      >
        {darkMode ? <Moon className="w-3 h-3 text-white" /> : <Sun className="w-3 h-3 text-yellow-500" />}
      </span>
    </button>
  );
}
