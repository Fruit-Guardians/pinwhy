import { createContext, useContext, useEffect } from 'react';
import { useRoute } from './router.jsx';
import { zh } from './locales/zh.jsx';
import { en } from './locales/en.jsx';

export const DICTS = { zh, en };

const LangCtx = createContext({ lang: 'zh', t: zh, setLang: () => { /* context fallback */ } });

export function LangProvider({ children }) {
  const { lang, switchLang } = useRoute();
  const t = DICTS[lang] || DICTS.zh;

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.desc);
  }, [t]);

  return <LangCtx.Provider value={{ lang, t, setLang: switchLang }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
export const useT = () => useContext(LangCtx).t;
