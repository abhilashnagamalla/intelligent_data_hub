import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, LogIn, Menu, X, Loader2 } from 'lucide-react';
import { AuthContext } from "../../context/AuthContext";
import LanguageSelector from "../ui/LanguageSelector";
import DarkModeToggle from "../ui/DarkModeToggle";
import ProfileDropdown from "../ui/ProfileDropdown";
import api from "../../api";

export default function Header({ onMenuToggle }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filteredResults, setFilteredResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Optimized debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setFilteredResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/datasets/search?q=${encodeURIComponent(searchQuery)}`);
        // Map backend items to have 'type' for categorization
        setFilteredResults(res.data.map(item => ({ ...item, type: 'dataset' })));
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (result) => {
    setSearchQuery('');
    setFilteredResults([]);
    setSearchExpanded(false);
    
    if (result.type === 'domain') {
      navigate(`/domain/${result.name}`);
    } else {
      navigate(`/dataset/${result.id}`);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (filteredResults.length > 0) {
        handleResultClick(filteredResults[0]);
      } else if (searchQuery.trim()) {
        navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchExpanded(false);
        setFilteredResults([]);
      }
    }
  };

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700 shadow-sm sticky top-0 z-40">
      <div className="px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Main row */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">

          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Hamburger — only on <lg */}
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>

            {/* Logo */}
            <h1
              className="text-base sm:text-xl md:text-2xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent drop-shadow cursor-pointer hover:scale-105 transition-transform whitespace-nowrap"
              onClick={() => navigate('/')}
            >
              {/* Short name on xs, full name on sm+ */}
              <span className="sm:hidden">IDH</span>
              <span className="hidden sm:inline">{t('Intelligent Data Hub')}</span>
            </h1>
          </div>

          {/* Center: Search bar (md+) */}
          <div className="flex-1 max-w-lg mx-4 hidden md:flex relative">
            <div className="relative w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Search className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <input
                type="text"
                placeholder={t('Search datasets, domains...', { defaultValue: 'Search datasets, domains...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm hover:shadow-md text-sm"
              />
            </div>

            {/* Search Results Dropdown */}
            {filteredResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100]">
                {filteredResults.map((res, idx) => (
                  <button
                    key={`${res.id || res.name}-${idx}`}
                    onClick={() => handleResultClick(res)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-none group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${res.type === 'domain' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        <Search className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{res.title || (res.name?.charAt(0).toUpperCase() + res.name?.slice(1))}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="text-[10px] uppercase tracking-widest font-black text-gray-400">{res.sector || res.type}</div>
                          {res.organization && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-gray-300" />
                              <div className="text-[10px] font-bold text-primary/70">{res.organization}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">GO →</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Search icon on <md */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setSearchExpanded(v => !v)}
              aria-label="Search"
            >
              {searchExpanded
                ? <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                : <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              }
            </button>

            <DarkModeToggle />
            <div className="text-gray-900 dark:text-white">
              <LanguageSelector />
            </div>

            {user ? (
              <ProfileDropdown />
            ) : (
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1.5 px-3 sm:px-5 py-2 bg-primary/90 hover:bg-primary text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-glow text-xs sm:text-sm whitespace-nowrap"
              >
                <LogIn className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t('Login with Google')}</span>
                <span className="sm:hidden">Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Expanded search row on mobile */}
        {searchExpanded && (
          <div className="md:hidden pb-3 relative">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Search className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <input
                type="text"
                autoFocus
                placeholder={t('Search datasets, domains...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
              />
            </div>
            
            {/* Mobile Search Results */}
            {filteredResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100]">
                {filteredResults.map((res, idx) => (
                  <button
                    key={`mob-${res.id || res.name}-${idx}`}
                    onClick={() => handleResultClick(res)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-none"
                  >
                    <Search className={`w-4 h-4 ${res.type === 'domain' ? 'text-indigo-500' : 'text-emerald-500'}`} />
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{res.title || (res.name?.charAt(0).toUpperCase() + res.name?.slice(1))}</div>
                      <div className="text-[10px] uppercase font-black text-gray-400">{res.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
