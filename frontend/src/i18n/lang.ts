// The active language, kept outside React so that apiFetch — which is not a component and has
// no hooks — can read it when building every request (spec 004 §7.1).
//
// Same shape as the token store in api/client.ts: a module-level value plus a subscription,
// so the React context stays a thin mirror of it.

export type Lang = 'pt' | 'en';

export const LANGS: readonly Lang[] = ['pt', 'en'];

const STORAGE_KEY = 'workout-organizer:lang';

// The html lang attribute needs the region so screen readers pick the right voice, and so does
// Intl: 'pt' alone formats a date the European way (spec 006 §7).
const HTML_LANG: Record<Lang, string> = { pt: 'pt-BR', en: 'en' };

export function localeTag(lang: Lang): string {
  return HTML_LANG[lang];
}

function isLang(value: string | null): value is Lang {
  return value === 'pt' || value === 'en';
}

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Private mode / blocked storage: fall through to the browser preference.
  }

  // The browser preference only gets to pick between the two supported languages; anything
  // else (fr, es, ...) lands on the default rather than on English.
  const preferred = navigator.language?.toLowerCase() ?? '';
  if (preferred.startsWith('en')) return 'en';
  return 'pt';
}

let current: Lang = detect();

type Listener = () => void;
const listeners = new Set<Listener>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Preference just does not survive the session; the app still switches.
  }

  applyHtmlLang();
  listeners.forEach((listener) => listener());
}

export function onLangChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyHtmlLang(): void {
  document.documentElement.lang = HTML_LANG[current];
}
