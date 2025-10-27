/**
 * Language helper utility for translation features
 * Provides language codes, names, flag emojis, and helper functions
 */

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

/**
 * Common languages with their codes, names, and flag emojis
 */
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
];

/**
 * Get language info by code
 */
export function getLanguageByCode(code: string): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Get language name by code
 */
export function getLanguageName(code: string): string {
  const lang = getLanguageByCode(code);
  return lang?.name || code;
}

/**
 * Get flag emoji by language code
 */
export function getFlagEmoji(code: string): string {
  const lang = getLanguageByCode(code);
  return lang?.flag || '🌐';
}

/**
 * Format language display with flag and name
 */
export function formatLanguageDisplay(code: string): string {
  const lang = getLanguageByCode(code);
  if (lang) {
    return `${lang.flag} ${lang.name}`;
  }
  return code;
}
