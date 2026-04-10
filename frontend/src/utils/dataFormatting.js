// Helper functions for displaying translated data values
// Use these functions to ensure numeric values display correctly in selected language

export const formatNumberForLanguage = (num, language = 'en') => {
  if (typeof num !== 'number') return num;
  
  // Use locale formatting for better language-specific number display
  const localeMap = {
    'en': 'en-US',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
    'ta': 'ta-IN',
    'bn': 'bn-IN',
    'mr': 'mr-IN',
    'gu': 'gu-IN',
  };
  
  const locale = localeMap[language] || 'en-US';
  
  try {
    // For large numbers, use compact notation if available (browser support varies)
    if (num >= 1000000) {
      return num.toLocaleString(locale, { notation: 'compact', compactDisplay: 'long' });
    }
    return num.toLocaleString(locale);
  } catch (e) {
    return num.toLocaleString('en-US');
  }
};

export const formatDatasetCount = (count, language = 'en') => {
  return formatNumberForLanguage(count, language);
};

export const formatCatalogCount = (count, language = 'en') => {
  return formatNumberForLanguage(count, language);
};

// Usage in components:
// import { formatNumberForLanguage } from '@/utils/dataFormatting';
// const { i18n } = useTranslation();
// const formattedCount = formatNumberForLanguage(stats.datasets, i18n.language);
