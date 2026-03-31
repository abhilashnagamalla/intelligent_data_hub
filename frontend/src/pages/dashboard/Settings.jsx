import { useContext } from 'react';
import { ThemeContext } from "../../context/ThemeContext";
import { useTranslation } from 'react-i18next';
import i18n from "../../utils/i18n";
import { Sun, Moon, Globe } from 'lucide-react';

export default function Settings() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const { i18n: t18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', flag: '🇮🇳' },
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="text-3xl font-bold mb-12">Settings</div>
      
      <div className="space-y-6">
        {/* Dark Mode */}
        <div className="glass p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Dark Mode</h3>
              <p className="text-gray-500">Toggle between light and dark themes</p>
            </div>
            <button onClick={toggleDarkMode} className="p-3 rounded-xl bg-gray-200 dark:bg-gray-800">
              {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="glass p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Language</h3>
              <p className="text-gray-500">Select your preferred language</p>
            </div>
            <Globe className="w-6 h-6 text-gray-500" />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-2 gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`p-3 rounded-xl flex items-center gap-2 transition-all ${
                  t18n.language === lang.code
                    ? 'bg-primary text-white shadow-glow'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'
                }`}
              >
                <span>{lang.flag}</span>
                <span className="font-medium">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
