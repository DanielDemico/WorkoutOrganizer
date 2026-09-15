import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyHtmlLang, getLang, onLangChange, setLang as setLangStore, type Lang } from './lang';
import { pt, type Dictionary } from './pt';
import { en } from './en';

export type { Lang } from './lang';
export { LANGS, getLang } from './lang';

const DICTIONARIES: Record<Lang, Dictionary> = { pt, en };

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang);

  // The store is the source of truth (apiFetch reads it directly), so the context follows it
  // instead of the other way around.
  useEffect(() => {
    applyHtmlLang();
    return onLangChange(() => setLangState(getLang()));
  }, []);

  const value = useMemo(
    () => ({ lang, setLang: setLangStore, t: DICTIONARIES[lang] }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within a LanguageProvider');
  return ctx;
}
