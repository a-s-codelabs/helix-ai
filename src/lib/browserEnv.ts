const globalNavigator =
  typeof globalThis !== 'undefined' && 'navigator' in globalThis
    ? (globalThis.navigator as Navigator)
    : undefined;

const userAgent =
  typeof globalNavigator?.userAgent === 'string'
    ? globalNavigator.userAgent.toLowerCase()
    : '';

export const isFirefoxBrowser = userAgent.includes('firefox');

export function isChromeBuiltinAllowed(): boolean {
  if (isFirefoxBrowser) return false;
  const globalAny = globalThis as any;
  if (typeof globalAny?.LanguageModel !== 'undefined') {
    return true;
  }
  const ai = globalAny?.ai;
  return !!ai && typeof ai.languageModel !== 'undefined';
}
