import { useTranslation } from 'react-i18next';
import i18n from "../../utils/i18n";

const languages = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'kn', name: 'ಕನ್ನಡ' }
];

export default function LanguageSelector() {
  const { i18n: t18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const currentLang = languages.find(l => l.code === t18n.language) || languages[0];

  return (
    <div className="relative group">
      <button className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        {currentLang.name} ▼
      </button>
      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
              t18n.language === lang.code ? 'bg-primary text-white font-medium' : ''
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>
    </div>
  );
}
